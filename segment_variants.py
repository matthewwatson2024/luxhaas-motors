#!/usr/bin/env python3
"""
Semantic segmentation of Hunter HMMWV web_model.obj files.

6 groups: body / tire / wheel_hub / undercarriage / bumper / interior

COORDINATE SYSTEM (inferred from bounding box + wheel arrangement):
  X — longitudinal (+X=front, −X=rear), widest axis of the OBJ
  Y — vertical     (+Y=up, Y_min=ground)
  Z — lateral      (+Z=right, −Z=left)

The wheel axle runs along Z.  Each wheel is a torus/disc in the XY plane.

KEY FIX vs previous versions:
  1. r_xy = sqrt((cx−wx)² + (cy−wy)²)   — correct radial distance in XY plane
     (old code used r_yz which mixes vertical with lateral → 50%+ misclassification)
  2. wz (Z position of hub centre) is REFINED by a 1-D scan after k-means.
     K-means averages over large body-panel areas and places the wheel centre
     ~0.15 units inboard of the actual tire.  The scan finds the true peak.
  3. Normal constraints separate tread (|nz|<0.45) from sidewall/hub (|nz|>0.50).
"""

import os, glob, time
from collections import defaultdict, deque
import numpy as np

HUNTER_DIR = "/Users/matthewwatson/luxhaas-motors/models/new humvee files from our friend hunter"

# ── Wheel / Tire parameters ───────────────────────────────────────────────────
OUTER_R_SEED    = 0.38   # XZ radius seed for outer-face detection
OUTER_Y_FRAC    = 0.55   # only faces in lower 55% of vehicle height

# Tire geometry in XY plane (axle runs along Z):
TIRE_Z_HALF     = 0.12   # ±Z window for tread faces (used with refined wz)
TIRE_Z_SIDEWALL = 0.20   # extended ±Z for sidewall face detection
HUB_R           = 0.11   # hub/disc radius (r_xy < this)
TIRE_R_MIN      = 0.11   # inner tread radius (just outside hub)
TIRE_R_MAX      = 0.30   # outer tread radius (≈ axle height above ground)

# Normal-based split (only sidewall/hub use normal constraint):
# Tread constraint uses Y-height instead of |nz| — QEM-decimated tires have
# impure radial normals.  Slant-back cargo panels (the main false-positive)
# are ABOVE the axle, so restricting to cy ≤ wy + TREAD_Y_ABOVE cleanly
# separates them from real tread without needing a normal constraint.
TREAD_Y_ABOVE   = 0.06   # tread faces allowed this far above axle (cy ≤ wy+this)
SIDEWALL_NZ_MIN = 0.50   # sidewall / hub disc faces → |nz| > this
HUB_NZ_MIN      = 0.45   # hub disc: Z-facing, small r_xy

# ── Z-scan wz refinement ──────────────────────────────────────────────────────
WZ_SCAN_STEP    = 0.015  # scan resolution in Z
WZ_SCAN_WIN     = 0.07   # half-window around each candidate Z for density count
WZ_SCAN_R_LO    = 0.13   # r_xy lower bound for density candidates
WZ_SCAN_R_HI    = 0.32   # r_xy upper bound

# ── Undercarriage ─────────────────────────────────────────────────────────────
UNDER_NY_MAX    = -0.42
UNDER_Y_FRAC    = 0.28

# ── Bumper (front / rear extremes) ───────────────────────────────────────────
BUMPER_END_FRAC = 0.18   # outermost this fraction of X range
BUMPER_Y_FRAC   = 0.62
BUMPER_NX_MIN   = 0.28

# ── Interior ─────────────────────────────────────────────────────────────────
INTER_X_IN_FRAC = 0.72
INTER_Z_IN_FRAC = 0.72
INTER_Y_LO_FRAC = 0.12
INTER_Y_HI_FRAC = 0.82
INTER_NZ_MIN    = 0.28
INTER_NY_MIN    = -0.20

# ── Cleanup ───────────────────────────────────────────────────────────────────
MAX_TIRE_DIST   = 1.5    # tire face centroid > this × TIRE_R_MAX from all wheels → body
MIN_ARC_DEG     = 65.0   # per-wheel tire faces must collectively span this arc (degrees)

# ── Validation ────────────────────────────────────────────────────────────────
WARN_TIRE_HI    = 0.30
WARN_TIRE_LO    = 0.05
WARN_BODY_LO    = 0.35


# ── OBJ I/O ──────────────────────────────────────────────────────────────────

def parse_obj(path):
    verts, normals, faces = [], [], []
    with open(path, encoding='utf-8', errors='replace') as fh:
        for line in fh:
            if line.startswith('v '):
                p = line.split()
                verts.append([float(p[1]), float(p[2]), float(p[3])])
            elif line.startswith('vn '):
                p = line.split()
                normals.append([float(p[1]), float(p[2]), float(p[3])])
            elif line.startswith('f '):
                tokens = line.split()[1:]
                vi_ni = []
                for tok in tokens:
                    parts = tok.split('/')
                    vi = int(parts[0]) - 1
                    ni = int(parts[-1]) - 1 if len(parts) >= 2 and parts[-1] else 0
                    vi_ni.append((vi, ni))
                for i in range(1, len(vi_ni) - 1):
                    faces.append([vi_ni[0], vi_ni[i], vi_ni[i + 1]])
    return (np.array(verts,   dtype=np.float32),
            np.array(normals, dtype=np.float32),
            faces)


def write_segmented_obj(path, verts, normals, faces, labels):
    lines = ['# LuxHaus Motors — QEM web model (segmented)\n']
    for (x, y, z) in verts:
        lines.append(f'v {x:.6f} {y:.6f} {z:.6f}\n')
    for (nx, ny, nz) in normals:
        lines.append(f'vn {nx:.6f} {ny:.6f} {nz:.6f}\n')

    groups = {}
    for fi, lbl in enumerate(labels):
        groups.setdefault(lbl, []).append(fi)

    for grp in ('body', 'tire', 'wheel_hub', 'undercarriage', 'bumper', 'interior'):
        if grp not in groups:
            continue
        lines.append(f'g {grp}\n')
        for fi in groups[grp]:
            (a_vi, a_ni), (b_vi, b_ni), (c_vi, c_ni) = faces[fi]
            lines.append(f'f {a_vi+1}//{a_ni+1} {b_vi+1}//{b_ni+1} {c_vi+1}//{c_ni+1}\n')

    with open(path, 'w') as fh:
        fh.writelines(lines)
    return {k: len(v) for k, v in groups.items()}


# ── Geometry ──────────────────────────────────────────────────────────────────

def compute_face_normals(verts, faces_arr):
    v0 = verts[faces_arr[:, 0]].astype(np.float64)
    v1 = verts[faces_arr[:, 1]].astype(np.float64)
    v2 = verts[faces_arr[:, 2]].astype(np.float64)
    fn = np.cross(v1 - v0, v2 - v0)
    mag = np.linalg.norm(fn, axis=1, keepdims=True)
    mag = np.where(mag < 1e-12, 1e-12, mag)
    return (fn / mag).astype(np.float32)


# ── Wheel detection + wz refinement ──────────────────────────────────────────

def detect_wheels(verts, faces_arr, fc):
    """K-means on outer-low face centroids → 4 rough wheel positions."""
    ymin   = float(verts[:, 1].min())
    yrange = float(verts[:, 1].max()) - ymin
    zmin   = float(verts[:, 2].min())
    zmax   = float(verts[:, 2].max())

    r_xz  = np.sqrt(fc[:, 0] ** 2 + fc[:, 2] ** 2)
    mask  = (fc[:, 1] < ymin + yrange * OUTER_Y_FRAC) & (r_xz > OUTER_R_SEED)
    pts   = fc[mask][:, [0, 2]]

    if len(pts) < 8:
        x0 = (float(verts[:,0].min()) + float(verts[:,0].max())) * 0.5
        z0 = (float(verts[:,2].min()) + float(verts[:,2].max())) * 0.5
        hx = (float(verts[:,0].max()) - x0) * 0.68
        hz = (float(verts[:,2].max()) - z0) * 0.55
        ay = ymin + yrange * 0.27
        return [(x0+hx, ay, z0+hz), (x0+hx, ay, z0-hz),
                (x0-hx, ay, z0+hz), (x0-hx, ay, z0-hz)]

    mx = float(np.median(pts[:, 0]))
    mz = float(np.median(pts[:, 1]))

    def qm(xc, zc):
        sub = pts[xc & zc]
        return sub.mean(0) if len(sub) > 0 else np.array([mx, mz])

    centers = np.array([
        qm(pts[:,0]>mx, pts[:,1]>mz), qm(pts[:,0]>mx, pts[:,1]<mz),
        qm(pts[:,0]<mx, pts[:,1]>mz), qm(pts[:,0]<mx, pts[:,1]<mz),
    ])

    for _ in range(40):
        dists  = np.linalg.norm(pts[:, None, :] - centers[None, :, :], axis=2)
        assign = dists.argmin(axis=1)
        nc = np.array([pts[assign==k].mean(0) if (assign==k).any()
                       else centers[k] for k in range(4)])
        if np.abs(nc - centers).max() < 1e-6:
            break
        centers = nc

    wheels = []
    for c in centers:
        wx, wz_rough = float(c[0]), float(c[1])
        near = fc[(np.abs(fc[:,0]-wx) < 0.28) &
                  (np.abs(fc[:,2]-wz_rough) < 0.30) &
                  (fc[:,1] < ymin + yrange * 0.70)]
        ay = float(near[:,1].mean()) if len(near) > 0 else ymin + yrange * 0.27
        wheels.append((wx, ay, wz_rough))

    return wheels


def refine_wz(fc, wx, wy, wz_rough, zmin, zmax):
    """
    Scan Z from the vehicle's outer edge inward to find the true tire hub
    centre.  K-means places wz too far inboard because body panels dominate
    the cluster centroid.  The scan finds the Z with peak face density in the
    r_xy = [WZ_SCAN_R_LO, WZ_SCAN_R_HI] ring — which is the actual tire band.
    """
    r_xy = np.sqrt((fc[:, 0] - wx) ** 2 + (fc[:, 1] - wy) ** 2)
    in_ring = (r_xy >= WZ_SCAN_R_LO) & (r_xy <= WZ_SCAN_R_HI)

    if wz_rough >= 0:
        # Right-side wheel: scan from outer edge inward
        candidates = np.arange(zmax - 0.04, max(wz_rough - 0.05, zmin + 0.08), -WZ_SCAN_STEP)
    else:
        # Left-side wheel: scan from outer edge (most negative) inward
        candidates = np.arange(zmin + 0.04, min(wz_rough + 0.05, zmax - 0.08), WZ_SCAN_STEP)

    best_wz = wz_rough
    best_n  = 0
    for wz_c in candidates:
        in_z = np.abs(fc[:, 2] - wz_c) < WZ_SCAN_WIN
        n    = int((in_ring & in_z).sum())
        if n > best_n:
            best_n = n
            best_wz = float(wz_c)

    # Never move more than 0.35 from rough estimate (guards against bad scans)
    if abs(best_wz - wz_rough) > 0.35:
        return wz_rough
    return best_wz


# ── Connected-component cleanup ───────────────────────────────────────────────

def _build_adj(faces_arr):
    e2f = defaultdict(list)
    for fi in range(len(faces_arr)):
        a,b,c = int(faces_arr[fi,0]), int(faces_arr[fi,1]), int(faces_arr[fi,2])
        for e in ((min(a,b),max(a,b)), (min(b,c),max(b,c)), (min(a,c),max(a,c))):
            e2f[e].append(fi)
    adj = defaultdict(set)
    for fis in e2f.values():
        if len(fis) == 2:
            adj[fis[0]].add(fis[1]); adj[fis[1]].add(fis[0])
    return adj


def find_components(n, adj):
    vis = [False]*n; comps = []
    for s in range(n):
        if vis[s]: continue
        comp=[]; q=deque([s]); vis[s]=True
        while q:
            fi=q.popleft(); comp.append(fi)
            for nf in adj[fi]:
                if not vis[nf]: vis[nf]=True; q.append(nf)
        comps.append(comp)
    return comps


def cleanup_tire(labels, faces_arr, fc, wheels):
    tire_mask = labels == 'tire'
    if not tire_mask.any():
        return labels

    wxy = np.array([(wx, wy) for wx, wy, wz in wheels])

    # Distance filter: remove tire faces whose XY centroid is too far from every wheel
    tfi_all = np.where(tire_mask)[0]
    if len(tfi_all) > 0:
        tire_xy   = fc[tfi_all, :2]
        min_dists = np.sqrt(((tire_xy[:, None, :] - wxy[None, :, :])**2).sum(axis=2)).min(axis=1)
        labels[tfi_all[min_dists > TIRE_R_MAX * MAX_TIRE_DIST]] = 'body'

    # Arc-span filter: per-wheel, tire faces must collectively span ≥ MIN_ARC_DEG in XY.
    # Real tire rings span >100°. Misclassified flat body panels span <50°.
    # This replaces the broken MIN_TIRE_COMP size filter which removed all isolated
    # tire faces in closed-body models (faces are not edge-connected through fender).
    min_arc_rad = MIN_ARC_DEG * np.pi / 180.0
    for (wx, wy, wz) in wheels:
        r_xy    = np.sqrt((fc[:,0]-wx)**2 + (fc[:,1]-wy)**2)
        z_off   = np.abs(fc[:,2]-wz)
        in_zone = (z_off < TIRE_Z_SIDEWALL) & (r_xy <= TIRE_R_MAX)
        wheel_tire = (labels == 'tire') & in_zone
        if not wheel_tire.any():
            continue

        tfc          = fc[wheel_tire]
        theta        = np.arctan2(tfc[:,1] - wy, tfc[:,0] - wx)
        theta_sorted = np.sort(theta)

        if len(theta_sorted) > 1:
            gaps        = np.diff(theta_sorted)
            wrap_gap    = (theta_sorted[0] + 2*np.pi) - theta_sorted[-1]
            max_gap_rad = float(max(float(gaps.max()), float(wrap_gap)))
        else:
            max_gap_rad = 2 * np.pi

        if (2*np.pi - max_gap_rad) < min_arc_rad:
            labels[wheel_tire] = 'body'

    return labels


# ── Face classification ───────────────────────────────────────────────────────

def classify_faces(verts, faces_arr, fn, wheels):
    fc = verts[faces_arr].mean(axis=1)

    xmin,xmax = float(verts[:,0].min()), float(verts[:,0].max())
    ymin,ymax = float(verts[:,1].min()), float(verts[:,1].max())
    zmin,zmax = float(verts[:,2].min()), float(verts[:,2].max())
    xrange = xmax-xmin; yrange = ymax-ymin
    half_x = xrange/2; x_ctr = (xmin+xmax)/2
    half_z = (zmax-zmin)/2; z_ctr = (zmin+zmax)/2

    n_faces    = len(faces_arr)
    labels     = np.full(n_faces, 'body', dtype=object)
    in_any_whl = np.zeros(n_faces, dtype=bool)

    abs_nz = np.abs(fn[:, 2])

    # ── 1. Wheel zones ────────────────────────────────────────────────────────
    for (wx, wy, wz) in wheels:
        r_xy  = np.sqrt((fc[:,0]-wx)**2 + (fc[:,1]-wy)**2)
        z_off = np.abs(fc[:,2]-wz)

        # Tread: r_xy in tread band, tight Z window, at or near axle height.
        # Y constraint (cy ≤ wy + TREAD_Y_ABOVE) is the key separator:
        #   - slant-back cargo panels are well above the axle → excluded
        #   - actual tire tread is at or below axle height → included
        # No |nz| filter: QEM-simplified tires don't have clean radial normals.
        in_tread = (z_off < TIRE_Z_HALF) & \
                   (r_xy >= TIRE_R_MIN) & (r_xy <= TIRE_R_MAX) & \
                   (fc[:, 1] <= wy + TREAD_Y_ABOVE)

        # Sidewall: Z-facing (high |nz|), extended Z window, outside hub
        in_side = (z_off < TIRE_Z_SIDEWALL) & \
                  (r_xy >= HUB_R) & (r_xy <= TIRE_R_MAX) & \
                  (abs_nz >= SIDEWALL_NZ_MIN) & \
                  (fc[:, 1] <= wy + TREAD_Y_ABOVE + 0.05)

        # Hub disc: Z-facing (high |nz|), tight Z window, inside hub radius
        in_hub  = (z_off < TIRE_Z_HALF) & \
                  (r_xy < HUB_R) & \
                  (abs_nz >= HUB_NZ_MIN)

        # Mark as in wheel zone to exclude from undercarriage / bumper / interior
        in_any_whl |= (z_off < TIRE_Z_SIDEWALL) & (r_xy <= TIRE_R_MAX)

        is_body = labels == 'body'
        labels[in_tread & is_body] = 'tire'
        labels[in_side  & is_body] = 'tire'
        labels[in_hub   & is_body] = 'wheel_hub'

    # ── 2. Undercarriage ─────────────────────────────────────────────────────
    u_y = ymin + yrange * UNDER_Y_FRAC
    labels[(fn[:,1] < UNDER_NY_MAX) & (fc[:,1] < u_y) &
           ~in_any_whl & (labels == 'body')] = 'undercarriage'

    # ── 3. Bumper ─────────────────────────────────────────────────────────────
    b_y = ymin + yrange * BUMPER_Y_FRAC
    labels[((fc[:,0] > xmax - xrange*BUMPER_END_FRAC) |
            (fc[:,0] < xmin + xrange*BUMPER_END_FRAC)) &
           (fc[:,1] < b_y) & (np.abs(fn[:,0]) >= BUMPER_NX_MIN) &
           ~in_any_whl & (labels == 'body')] = 'bumper'

    # ── 4. Interior ───────────────────────────────────────────────────────────
    in_cab_x = np.abs(fc[:,0]-x_ctr) < half_x * INTER_X_IN_FRAC
    in_cab_z = np.abs(fc[:,2]-z_ctr) < half_z * INTER_Z_IN_FRAC
    in_cab_y = (fc[:,1] > ymin+yrange*INTER_Y_LO_FRAC) & \
               (fc[:,1] < ymin+yrange*INTER_Y_HI_FRAC)
    nz_inward = fn[:,2] * (z_ctr - fc[:,2]) > 0
    labels[in_cab_x & in_cab_z & in_cab_y & nz_inward &
           (abs_nz >= INTER_NZ_MIN) & (fn[:,1] > INTER_NY_MIN) &
           ~in_any_whl & (labels == 'body')] = 'interior'

    return labels


# ── Per-variant driver ────────────────────────────────────────────────────────

def process_variant(folder):
    name = os.path.basename(folder)
    web  = os.path.join(folder, 'web_model.obj')
    if not os.path.exists(web):
        print(f'  [{name}] SKIP — no web_model.obj'); return

    print(f'\n[{name}]')
    t0 = time.time()

    verts, normals, faces = parse_obj(web)
    faces_arr = np.array([[f[0][0],f[1][0],f[2][0]] for f in faces], dtype=np.int32)
    fc        = verts[faces_arr].mean(axis=1)
    fn        = compute_face_normals(verts, faces_arr)
    print(f'  parsed  : {len(verts):,} verts  {len(faces):,} faces')

    zmin = float(verts[:,2].min()); zmax = float(verts[:,2].max())

    # Rough wheel positions from k-means
    wheels_rough = detect_wheels(verts, faces_arr, fc)

    # Refine wz for each wheel via Z-scan
    wheels = []
    for (wx, wy, wz_rough) in wheels_rough:
        wz = refine_wz(fc, wx, wy, wz_rough, zmin, zmax)
        wheels.append((wx, wy, wz))

    print('  wheels  : ' + '  '.join(
        f'(x={wx:+.3f},z={wz:+.3f},y={wy:.3f})' for wx, wy, wz in wheels))

    labels = classify_faces(verts, faces_arr, fn, wheels)
    labels = cleanup_tire(labels, faces_arr, fc, wheels)

    # ── Report ────────────────────────────────────────────────────────────────
    total  = len(faces)
    order  = ('body','tire','wheel_hub','undercarriage','bumper','interior')
    counts = {g: int(np.sum(labels==g)) for g in order}
    print('  groups  :')
    for g in order:
        n = counts[g]; pct = n*100/total
        print(f'    {g:<14} {n:>7,}  ({pct:5.1f}%)  {"█"*int(pct/2)}')

    tf,bf = counts['tire']/total, counts['body']/total
    warns = []
    if tf > WARN_TIRE_HI: warns.append(f'WARN: tire={tf*100:.1f}% > {WARN_TIRE_HI*100:.0f}%')
    if tf < WARN_TIRE_LO: warns.append(f'WARN: tire={tf*100:.1f}% < {WARN_TIRE_LO*100:.0f}%')
    if bf < WARN_BODY_LO: warns.append(f'WARN: body={bf*100:.1f}% < {WARN_BODY_LO*100:.0f}%')
    if counts['wheel_hub'] == 0: warns.append('WARN: wheel_hub empty')
    if counts['interior']  == 0: warns.append('WARN: interior empty')
    for w in warns: print(f'  {w}')
    if not warns: print('  [OK] all groups in expected ranges')

    write_segmented_obj(web, verts, normals, faces, list(labels))
    kb = os.path.getsize(web) // 1024
    print(f'  saved   : {kb} KB  ({time.time()-t0:.1f}s)')


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    folders = sorted([os.path.join(HUNTER_DIR,d) for d in os.listdir(HUNTER_DIR)
                      if os.path.isdir(os.path.join(HUNTER_DIR,d))])
    print(f'Hunter variants : {len(folders)}')
    t0 = time.time()
    for f in folders: process_variant(f)
    print(f'\nAll done — {time.time()-t0:.1f}s total')


if __name__ == '__main__':
    main()
