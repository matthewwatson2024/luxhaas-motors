#!/usr/bin/env python3
"""
scripts/generate_hmmwv_variants.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Programmatically generate all 9 body variants + 6 accessory overlays for the
LuxHaus Motors configurator from the original HMMWV_Desert_OBJ.obj base model.

Pure Python — no Blender required.
Requirements: pip install numpy pyfqmr   (both already installed)

Usage (from project root):
    python3 scripts/generate_hmmwv_variants.py

Outputs:
    models/variants/<name>/web_model.obj    (9 files)
    models/accessories/<name>/web_model.obj (6 files)

━━━ Coordinate system of the base model (verified from geometry analysis) ━━━
    X — lateral      (−141 left … +141 right,   total width  282 cm)
    Y — vertical     (0 = ground … 197 = roof,  total height 197 cm)
    Z — longitudinal (+215 = front … −292 = rear, total length 507 cm)

Key measurements from OBJ centroid analysis:
    Axle height Y   = 49 cm    Tire outer radius ≈ 49 cm
    Front axle Z    = +157 cm  Rear axle Z = −187 cm
    Wheel hub |X|   = 92 cm
    Roof panel      Y > 155 cm
    Front bumper    Z > 190 cm  Rear bumper Z < −265 cm
"""

import sys, os, math, time
import numpy as np
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from qem_decimate import qem_simplify, build_split_normals

# ── Paths ────────────────────────────────────────────────────────────────────

BASE_OBJ     = os.path.join(ROOT, 'models', 'humvee-1',
                'uploads_files_3017515_HMMWV_Desert_OBJ', 'HMMWV_Desert_OBJ.obj')
VARIANTS_DIR = os.path.join(ROOT, 'models', 'variants')
ACC_DIR      = os.path.join(ROOT, 'models', 'accessories')

TARGET_FACES = 55_000
SMOOTH_DEG   = 35.0

# ── Geometric constants from base model analysis ──────────────────────────────

AXLE_Y       = 49.0
FRONT_AX_Z   = 157.0
REAR_AX_Z    = -187.0
WHEEL_HUB_X  = 92.0
TIRE_HUB_R   = 22.0    # YZ-plane: below → wheel_hub
TIRE_OUT_R   = 54.0    # YZ-plane: above → fender/suspension (not tire)
WHEEL_XZ_R   = 68.0    # XZ-plane match radius for wheel zone
TIRE_Y_MAX   = 102.0   # faces above this Y are never tire/hub

ROOF_Y       = 155.0   # body faces above this Y are roof panel
BUMPER_ZF    = 190.0   # Z > → front bumper zone
BUMPER_ZR    = -265.0  # Z < → rear bumper zone
SUSP_BODY_Y  = 50.0    # suspension: Y ≥ → body, Y < → undercarriage

# Variant geometry parameters
REAR_Z_SLANT  = -155.0
REAR_Z_OPEN   = -130.0
DOOR2_ZF      = -25.0
DOOR2_ZR      = -170.0
DOOR2_X       = 93.0
DOOR2_Y_LO    = 60.0
DOOR2_Y_HI    = 155.0

VX1, VX2 = -141.0, 141.0
VY1, VY2 =    0.0, 197.0
VZ1, VZ2 = -292.0, 215.0

WHEEL_CENTRES = [
    ( WHEEL_HUB_X, AXLE_Y,  FRONT_AX_Z),
    (-WHEEL_HUB_X, AXLE_Y,  FRONT_AX_Z),
    ( WHEEL_HUB_X, AXLE_Y,  REAR_AX_Z),
    (-WHEEL_HUB_X, AXLE_Y,  REAR_AX_Z),
]

GROUP_ORDER = ['body', 'tire', 'wheel_hub', 'undercarriage', 'bumper', 'interior']


# ═══════════════════════════════════════════════════════════════════════════════
# 1 — OBJ PARSER
# ═══════════════════════════════════════════════════════════════════════════════

def parse_obj(path):
    """
    Parse OBJ → shared vertex array + list of group dicts.

    Returns:
        verts     : np.ndarray (N, 3) float64
        raw_groups: list of {'name': str, 'faces': np.ndarray (F, 3) int32}
                    face values are 0-indexed vertex indices, triangulated.
    """
    verts, raw_groups = [], []
    cur_name, cur_faces = 'default', []

    def flush():
        if cur_faces:
            raw_groups.append({'name': cur_name,
                               'faces': np.array(cur_faces, dtype=np.int32)})

    with open(path, 'r', encoding='utf-8', errors='replace') as fh:
        for line in fh:
            line = line.strip()
            if line.startswith('v '):
                p = line.split()
                verts.append([float(p[1]), float(p[2]), float(p[3])])
            elif line.startswith('g '):
                flush()
                cur_name, cur_faces = line[2:].strip(), []
            elif line.startswith('f '):
                toks = line.split()[1:]
                idx  = [int(t.split('/')[0]) - 1 for t in toks]
                for i in range(1, len(idx) - 1):
                    cur_faces.append([idx[0], idx[i], idx[i + 1]])
    flush()
    return np.array(verts, dtype=np.float64), raw_groups


# ═══════════════════════════════════════════════════════════════════════════════
# 2 — SEMANTIC CLASSIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

def classify_face(cx, cy, cz):
    """
    Return semantic group name for a face at centroid (cx, cy, cz).
    Called on both the initial classification and on decimated faces.
    """
    for wx, wy, wz in WHEEL_CENTRES:
        if math.sqrt((cx - wx)**2 + (cz - wz)**2) < WHEEL_XZ_R and cy < TIRE_Y_MAX:
            r_yz = math.sqrt((cy - wy)**2 + (cz - wz)**2)
            if r_yz < TIRE_HUB_R:
                return 'wheel_hub'
            if r_yz < TIRE_OUT_R:
                return 'tire'
    if cy < SUSP_BODY_Y:
        return 'undercarriage'
    if cz > BUMPER_ZF or cz < BUMPER_ZR:
        return 'bumper'
    return 'body'


def classify_base(verts, raw_groups):
    """
    Map the 6 original HMMWV_Desert groups into semantic groups.

    Returns:
        classified : dict {group_name: np.ndarray (F, 3) int32} — faces into verts
        glass_faces: np.ndarray (G, 3) int32 — window_glass faces (separate from QEM)
    """
    bins  = defaultdict(list)
    glass = []

    for grp in raw_groups:
        name  = grp['name']
        faces = grp['faces']
        cs    = verts[faces].mean(axis=1)   # (F, 3) centroids

        if 'Glass' in name or 'glass' in name:
            glass.extend(faces.tolist())
            continue

        is_wheel = ('Wheels' in name or 'wheels' in name)
        is_susp  = ('Suspension' in name or 'suspension' in name)

        for fi, (cx, cy, cz) in enumerate(cs):
            face = faces[fi]
            if is_wheel:
                assigned = False
                for wx, wy, wz in WHEEL_CENTRES:
                    if math.sqrt((cx - wx)**2 + (cz - wz)**2) < WHEEL_XZ_R and cy < TIRE_Y_MAX:
                        r_yz = math.sqrt((cy - wy)**2 + (cz - wz)**2)
                        bins['wheel_hub' if r_yz < TIRE_HUB_R else 'tire'].append(face)
                        assigned = True
                        break
                if not assigned:
                    bins['body'].append(face)
            elif is_susp:
                bins['undercarriage' if cy < SUSP_BODY_Y else 'body'].append(face)
            else:
                if cz > BUMPER_ZF or cz < BUMPER_ZR:
                    bins['bumper'].append(face)
                else:
                    bins['body'].append(face)

    classified = {k: np.array(v, dtype=np.int32) for k, v in bins.items() if v}
    glass_arr  = np.array(glass, dtype=np.int32) if glass else np.zeros((0, 3), dtype=np.int32)
    return classified, glass_arr


def reclassify_decimated(nv, nf):
    """Re-assign semantic groups after QEM (which discards original groups)."""
    cs = nv[nf].mean(axis=1)
    bins = defaultdict(list)
    for fi in range(len(nf)):
        cx, cy, cz = float(cs[fi, 0]), float(cs[fi, 1]), float(cs[fi, 2])
        bins[classify_face(cx, cy, cz)].append(nf[fi])
    return {k: np.array(v, dtype=np.int32) for k, v in bins.items() if v}


# ═══════════════════════════════════════════════════════════════════════════════
# 3 — COMPACT VERTICES
# ═══════════════════════════════════════════════════════════════════════════════

def compact_faces(verts, face_groups):
    """
    Strip unreferenced vertices; return (compact_verts, remapped_face_groups).
    face_groups: dict {name: np.ndarray (F,3)}  — indices into verts
    """
    non_empty = {k: v for k, v in face_groups.items() if len(v)}
    if not non_empty:
        return np.zeros((0, 3), dtype=np.float64), {}
    all_f = np.vstack(list(non_empty.values()))
    used  = np.unique(all_f)
    remap = np.full(len(verts), -1, dtype=np.int64)
    remap[used] = np.arange(len(used), dtype=np.int64)
    return (verts[used],
            {k: remap[v].astype(np.int32) for k, v in non_empty.items()})


def compact_glass(verts, glass_faces):
    """Compact glass to its own vertex pool."""
    if len(glass_faces) == 0:
        return np.zeros((0, 3), dtype=np.float64), np.zeros((0, 3), dtype=np.int32)
    vi    = np.unique(glass_faces)
    remap = np.full(len(verts), -1, dtype=np.int64)
    remap[vi] = np.arange(len(vi), dtype=np.int64)
    return verts[vi], remap[glass_faces].astype(np.int32)


# ═══════════════════════════════════════════════════════════════════════════════
# 4 — GEOMETRY UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def _add(verts_list, new_v, new_f):
    """Append new_v vertices to verts_list; return new face array (indices adjusted)."""
    off = len(verts_list)
    verts_list.extend(new_v)
    return np.array([[f[0]+off, f[1]+off, f[2]+off] for f in new_f], dtype=np.int32)


def box_geom(cx, cy, cz, sx, sy, sz):
    hx, hy, hz = sx/2, sy/2, sz/2
    v = [
        [cx-hx,cy-hy,cz-hz],[cx+hx,cy-hy,cz-hz],[cx+hx,cy+hy,cz-hz],[cx-hx,cy+hy,cz-hz],
        [cx-hx,cy-hy,cz+hz],[cx+hx,cy-hy,cz+hz],[cx+hx,cy+hy,cz+hz],[cx-hx,cy+hy,cz+hz],
    ]
    f = [[0,1,2],[0,2,3],[4,6,5],[4,7,6],
         [0,4,5],[0,5,1],[2,6,7],[2,7,3],
         [0,3,7],[0,7,4],[1,5,6],[1,6,2]]
    return v, f


def tube_geom(p0, p1, r, sides=10):
    p0, p1 = np.array(p0, dtype=float), np.array(p1, dtype=float)
    ax = p1 - p0; ln = np.linalg.norm(ax)
    if ln < 1e-6:
        return [], []
    ax /= ln
    ref = np.array([0.,1.,0.]) if abs(ax[1]) < 0.9 else np.array([1.,0.,0.])
    u = np.cross(ax, ref); u /= np.linalg.norm(u)
    v_ax = np.cross(ax, u)
    verts = []
    for end in [p0, p1]:
        for i in range(sides):
            a = 2*math.pi*i/sides
            verts.append((end + r*(math.cos(a)*u + math.sin(a)*v_ax)).tolist())
    faces = []
    for i in range(sides):
        a, b, c, d = i, (i+1)%sides, i+sides, (i+1)%sides+sides
        faces += [[a,b,d],[a,d,c]]
    return verts, faces


def ring_geom(cx, cy, cz, r_in, r_out, h, sides=32):
    """
    Hollow upright ring (washer/tube shape).
    Vertex layout — 4 rings × sides verts:
        ring 0: inner bottom  [0   .. S-1  ]
        ring 1: inner top     [S   .. 2S-1 ]
        ring 2: outer bottom  [2S  .. 3S-1 ]
        ring 3: outer top     [3S  .. 4S-1 ]
    """
    S = sides
    verts = []
    for r in [r_in, r_out]:
        for dy in [0.0, h]:
            for i in range(S):
                a = 2*math.pi*i/S
                verts.append([cx + r*math.cos(a), cy+dy, cz + r*math.sin(a)])
    # total verts = 4*S; valid indices 0 .. 4S-1
    faces = []
    # Inner wall: ring 0 → ring 1
    for i in range(S):
        a,b,c,d = i,(i+1)%S, i+S,(i+1)%S+S
        faces += [[a,b,d],[a,d,c]]
    # Outer wall: ring 2 → ring 3
    for i in range(S):
        a,b,c,d = 2*S+i,2*S+(i+1)%S, 3*S+i,3*S+(i+1)%S
        faces += [[a,c,d],[a,d,b]]
    # Bottom annulus: ring 0 → ring 2 (both at y=cy)
    for i in range(S):
        a,b,c,d = i,(i+1)%S, 2*S+i,2*S+(i+1)%S
        faces += [[a,b,d],[a,d,c]]
    # Top annulus: ring 1 → ring 3 (both at y=cy+h)
    for i in range(S):
        a,b,c,d = S+i,S+(i+1)%S, 3*S+i,3*S+(i+1)%S
        faces += [[a,c,d],[a,d,b]]
    return verts, faces


def canvas_geom(x0, x1, y_edge, y_peak, z_front, z_rear, nu=12, nv_=10):
    """Bowed fabric canvas for soft-top."""
    verts, faces = [], []
    for iz in range(nv_+1):
        tz = iz/nv_
        cz = z_rear + (z_front - z_rear)*tz
        peak_bow = math.sin(math.pi*tz)*4.0   # fabric sag along length
        for ix in range(nu+1):
            tx = ix/nu
            cx = x0 + (x1-x0)*tx
            lat_bow = math.sin(math.pi*tx)*2.0  # lateral arch
            vy = y_peak - peak_bow + lat_bow
            verts.append([cx, vy, cz])
    W = nu+1
    for iz in range(nv_):
        for ix in range(nu):
            a=iz*W+ix; b=a+1; c=a+W; d=c+1
            faces += [[a,b,d],[a,d,c]]
    return verts, faces


def slant_geom(x0, x1, y_top, y_bot, z_hi, z_lo, n=6):
    """Angled rear panel for slant-back."""
    verts, faces = [], []
    for i in range(n+1):
        t = i/n
        z = z_hi + (z_lo - z_hi)*t
        y = y_top + (y_bot - y_top)*t
        verts.append([x0, y, z])
        verts.append([x1, y, z])
    for i in range(n):
        a=i*2; b=a+1; c=a+2; d=a+3
        faces += [[a,c,d],[a,d,b]]
    return verts, faces


def bed_geom(x0, x1, yf, z_front, z_rear, rail_h=28):
    """Flat truck-bed floor + perimeter rails."""
    verts, faces = [], []
    # Floor
    fv = [[x0,yf,z_rear],[x1,yf,z_rear],[x1,yf,z_front],[x0,yf,z_front]]
    verts.extend(fv); faces += [[0,1,2],[0,2,3]]
    for wall_verts in [
        [[x0,yf,z_rear],[x1,yf,z_rear],[x1,yf+rail_h,z_rear],[x0,yf+rail_h,z_rear]],
        [[x0,yf,z_rear],[x0,yf,z_front],[x0,yf+rail_h,z_front],[x0,yf+rail_h,z_rear]],
        [[x1,yf,z_rear],[x1,yf,z_front],[x1,yf+rail_h,z_front],[x1,yf+rail_h,z_rear]],
    ]:
        o = len(verts); verts.extend(wall_verts)
        faces += [[o,o+2,o+1],[o,o+3,o+2]]
    return verts, faces


# ═══════════════════════════════════════════════════════════════════════════════
# 5 — VARIANT MODIFIERS
# ═══════════════════════════════════════════════════════════════════════════════
#
# Each modifier takes (verts, groups, verts_list) where:
#   verts      — numpy array OR list used for centroid computation
#                May include previously-appended procedural vertices.
#   groups     — current semantic group dict {name: np.ndarray (F,3)}
#   verts_list — shared mutable Python list; new procedural vertices are appended here
#                New face arrays reference indices into this list.
#
# Modifiers are composable: pass the mutable list through so each modifier
# appends to the same pool.  export_variant converts it to numpy at the end.
# ─────────────────────────────────────────────────────────────────────────────

def _verts_np(verts):
    """Ensure numpy array for centroid computation."""
    return np.array(verts, dtype=np.float64) if isinstance(verts, list) else verts


def _mask_body(verts, groups, keep_fn):
    """Return copy of groups with body faces filtered by keep_fn(cx,cy,cz)."""
    out = dict(groups)
    body = groups.get('body', np.zeros((0, 3), dtype=np.int32))
    if len(body) == 0:
        return out
    v = _verts_np(verts)
    cs = v[body].mean(axis=1)
    mask = np.array([keep_fn(float(c[0]), float(c[1]), float(c[2])) for c in cs], dtype=bool)
    out['body'] = body[mask] if mask.any() else np.zeros((0, 3), dtype=np.int32)
    return out


def _append_body(groups, new_faces):
    """Concatenate new_faces into groups['body']."""
    out = dict(groups)
    existing = out.get('body', np.zeros((0, 3), dtype=np.int32))
    out['body'] = np.vstack([existing, new_faces]) if len(existing) else new_faces
    return out


def mod_notop(verts, groups, verts_list):
    """Remove roof and side glass (open-top configuration)."""
    return _mask_body(verts, groups, lambda cx, cy, cz: cy < ROOF_Y)


def mod_softtop(verts, groups, verts_list):
    """Remove hard roof, add bowed canvas mesh."""
    out = _mask_body(verts, groups, lambda cx, cy, cz: cy < ROOF_Y)
    cv, cf = canvas_geom(
        x0=VX1+10, x1=VX2-10,
        y_edge=ROOF_Y-6, y_peak=ROOF_Y+1,
        z_front=145.0, z_rear=-85.0,
    )
    return _append_body(out, _add(verts_list, cv, cf))


def mod_slantback(verts, groups, verts_list):
    """Remove rear body, add angled slant-back panel."""
    z_cut = REAR_Z_SLANT
    out = _mask_body(verts, groups, lambda cx, cy, cz: not (cz < z_cut and cy < ROOF_Y+5))
    sv, sf = slant_geom(
        x0=VX1+9, x1=VX2-9,
        y_top=ROOF_Y-3, y_bot=52.0,
        z_hi=z_cut, z_lo=z_cut-115.0, n=8,
    )
    return _append_body(out, _add(verts_list, sv, sf))


def mod_openbed(verts, groups, verts_list):
    """Remove rear cab body, add flat truck bed."""
    z_cut = REAR_Z_OPEN
    out = _mask_body(verts, groups, lambda cx, cy, cz: not (cz < z_cut and cy > 52.0))
    bv, bf = bed_geom(
        x0=VX1+13, x1=VX2-13, yf=53.0,
        z_front=z_cut-2, z_rear=VZ1+32.0, rail_h=28,
    )
    return _append_body(out, _add(verts_list, bv, bf))


def mod_2door(verts, groups, verts_list):
    """Remove rear door side faces; add flat fill panel to close the opening."""
    def in_door_zone(cx, cy, cz):
        return (abs(cx) > DOOR2_X and
                DOOR2_ZR < cz < DOOR2_ZF and
                DOOR2_Y_LO < cy < DOOR2_Y_HI)

    out = _mask_body(verts, groups, lambda cx, cy, cz: not in_door_zone(cx, cy, cz))

    # Flat fill panels for left and right sides
    fill_v, fill_f = [], []
    for sign in [-1.0, 1.0]:
        x_pos = sign * (DOOR2_X + 3.0)
        o = len(fill_v)
        fill_v.extend([
            [x_pos, DOOR2_Y_LO, DOOR2_ZR],
            [x_pos, DOOR2_Y_LO, DOOR2_ZF],
            [x_pos, DOOR2_Y_HI, DOOR2_ZF],
            [x_pos, DOOR2_Y_HI, DOOR2_ZR],
        ])
        if sign > 0:
            fill_f += [[o,o+1,o+2],[o,o+2,o+3]]
        else:
            fill_f += [[o,o+2,o+1],[o,o+3,o+2]]

    return _append_body(out, _add(verts_list, fill_v, fill_f))


# ═══════════════════════════════════════════════════════════════════════════════
# 6 — ACCESSORY GENERATORS
# ═══════════════════════════════════════════════════════════════════════════════

def gen_grillguard():
    verts, faces = [], []
    z = 218.0; r = 3.5
    for y in np.linspace(55, 130, 5):
        v, f = tube_geom([-102, y, z], [102, y, z], r, sides=8)
        faces.append(_add(verts, v, f))
    for x in np.linspace(-95, 95, 4):
        v, f = tube_geom([x, 50, z], [x, 135, z], r, sides=8)
        faces.append(_add(verts, v, f))
    for pts in [
        ([-105,50,z],[-105,135,z]),([ 105,50,z],[ 105,135,z]),
        ([-105,50,z],[ 105, 50,z]),([-105,135,z],[105,135,z]),
    ]:
        v, f = tube_geom(pts[0], pts[1], r*1.4, sides=8)
        faces.append(_add(verts, v, f))
    return np.array(verts, dtype=np.float64), {'bumper': np.vstack(faces)}


def gen_brushguard():
    verts, faces = [], []
    gv, gf = gen_grillguard()
    off = len(verts); verts.extend(gv.tolist())
    faces.append(gf['bumper'] + off)
    for sx in [-1.0, 1.0]:
        xb, xt = sx*102, sx*122
        for pts in [
            ([xb,55,218],[xt,170,142]),
            ([xb,20,200],[xb,55,218]),
        ]:
            v, f = tube_geom(pts[0], pts[1], 4.0, sides=8)
            faces.append(_add(verts, v, f))
    return np.array(verts, dtype=np.float64), {'bumper': np.vstack(faces)}


def gen_lightkit():
    verts, faces = [], []
    configs = [
        (-110, 95, 207, 10, 8, 22, 'bumper'),
        ( 110, 95, 207, 10, 8, 22, 'bumper'),
        ( -88, 198, 153, 48, 7, 10, 'body'),
        (  88, 198, 153, 48, 7, 10, 'body'),
    ]
    grp_faces = defaultdict(list)
    for cx,cy,cz,sx,sy,sz,grp in configs:
        bv,bf = box_geom(cx,cy,cz,sx,sy,sz)
        grp_faces[grp].append(_add(verts,bv,bf))
    return (np.array(verts, dtype=np.float64),
            {k: np.vstack(v) for k,v in grp_faces.items()})


def gen_turret():
    verts, faces = [], []
    cx, cy, cz = 0.0, 197.0, 30.0
    rv, rf = ring_geom(cx, cy, cz, 28.0, 40.0, 18.0, sides=32)
    faces.append(_add(verts, rv, rf))
    pv, pf = tube_geom([cx,cy+18,cz],[cx,cy+52,cz], 5.0, sides=10)
    faces.append(_add(verts, pv, pf))
    cv2,cf2 = tube_geom([cx-20,cy+48,cz],[cx+20,cy+48,cz], 3.5, sides=8)
    faces.append(_add(verts, cv2, cf2))
    hv, hf = ring_geom(cx, cy-3.0, cz, 24.0, 28.0, 5.0, sides=32)
    faces.append(_add(verts, hv, hf))
    return np.array(verts, dtype=np.float64), {'body': np.vstack(faces)}


def gen_offroadtires(base_verts, classified):
    """Enlarged tires + lug-tread overlay."""
    tire_faces = classified.get('tire', np.zeros((0,3),dtype=np.int32))
    hub_faces  = classified.get('wheel_hub', np.zeros((0,3),dtype=np.int32))

    new_verts = base_verts.copy()
    for vi in np.unique(tire_faces):
        cx, cy, cz_v = new_verts[vi]
        wz = FRONT_AX_Z if cz_v > 0 else REAR_AX_Z
        wy = AXLE_Y
        dy, dz = cy - wy, cz_v - wz
        r = math.sqrt(dy*dy + dz*dz)
        if r > 1e-6:
            scale = (r + 4.5) / r
            new_verts[vi, 1] = wy + dy*scale
            new_verts[vi, 2] = wz + dz*scale

    verts_list = new_verts.tolist()
    lug_faces = []
    for wx, wy, wz in WHEEL_CENTRES:
        for i in range(8):
            ang = 2*math.pi*i/8
            yr = wy + 47.0*math.sin(ang)
            zr = wz + 47.0*math.cos(ang)
            bv, bf = box_geom(wx, yr+2*math.sin(ang), zr+2*math.cos(ang), 26, 5, 7)
            lug_faces.append(_add(verts_list, bv, bf))

    extra = np.vstack(lug_faces) if lug_faces else np.zeros((0,3),dtype=np.int32)
    combined = np.vstack([tire_faces, extra]) if len(extra) else tire_faces
    return np.array(verts_list, dtype=np.float64), {'tire': combined, 'wheel_hub': hub_faces}


def gen_accessoriespkg(base_verts):
    verts, faces = [], []
    for cx in [-115.0, 115.0]:
        bv, bf = box_geom(cx, 75.0, -270.0, 22, 40, 14)
        faces.append(_add(verts, bv, bf))
    av, af = tube_geom([0,197,-40],[0,262,-40], 2.5, sides=8)
    faces.append(_add(verts, av, af))
    hv, hf = box_geom(-118.0, 60.0, 208.0, 8, 8, 8)
    faces.append(_add(verts, hv, hf))
    return np.array(verts, dtype=np.float64), {'body': np.vstack(faces)}


# ═══════════════════════════════════════════════════════════════════════════════
# 7 — EXPORT UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def flat_normals(verts, faces):
    """Per-face flat normals (F,3) float32."""
    v0, v1, v2 = verts[faces[:,0]], verts[faces[:,1]], verts[faces[:,2]]
    n = np.cross(v1-v0, v2-v0).astype(np.float32)
    m = np.linalg.norm(n, axis=1, keepdims=True)
    return (n / np.where(m<1e-12, 1e-12, m)).astype(np.float32)


def write_obj(out_path, nv, uniq_normals, loop_idx, ordered_face_groups,
              glass_verts, glass_faces):
    """
    Write grouped OBJ (v//vn, no UV).

    nv                 : (N,3) decimated vertices
    uniq_normals       : (M,3) split normals for non-glass faces
    loop_idx           : (F_total*3,) — face-corner → normal index (0-based)
                         computed for faces in GROUP_ORDER order
    ordered_face_groups: {group: (F_g,3) face arrays} — must match GROUP_ORDER
    glass_verts        : (G_v,3) glass vertex pool (separate from nv)
    glass_faces        : (G_f,3) glass face indices into glass_verts
    """
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    lines = ['# LuxHaus Motors — HMMWV variant\n', 'o HMMWV_Variant\n']

    n_dec  = len(nv)
    n_gnrm = len(uniq_normals)

    for x,y,z in nv:
        lines.append(f'v {x:.4f} {y:.4f} {z:.4f}\n')
    for x,y,z in glass_verts:
        lines.append(f'v {x:.4f} {y:.4f} {z:.4f}\n')

    for nx,ny,nz in uniq_normals:
        lines.append(f'vn {nx:.4f} {ny:.4f} {nz:.4f}\n')

    has_glass = len(glass_faces) > 0
    if has_glass:
        gnrm = flat_normals(glass_verts, glass_faces)
        for nx,ny,nz in gnrm:
            lines.append(f'vn {nx:.4f} {ny:.4f} {nz:.4f}\n')

    # Non-glass faces — emit in GROUP_ORDER, tracking loop_idx offset
    fi_global = 0
    for grp in GROUP_ORDER:
        farr = ordered_face_groups.get(grp)
        if farr is None or len(farr) == 0:
            continue
        lines.append(f'g {grp}\n')
        for row in farr:
            a,b,c = int(row[0])+1, int(row[1])+1, int(row[2])+1
            n0 = int(loop_idx[fi_global*3])   +1
            n1 = int(loop_idx[fi_global*3+1]) +1
            n2 = int(loop_idx[fi_global*3+2]) +1
            lines.append(f'f {a}//{n0} {b}//{n1} {c}//{n2}\n')
            fi_global += 1

    # Glass faces — separate vertex pool
    if has_glass:
        lines.append('g window_glass\n')
        for gi, (a,b,c) in enumerate(glass_faces):
            v0,v1,v2 = int(a)+n_dec+1, int(b)+n_dec+1, int(c)+n_dec+1
            ni = n_gnrm + gi + 1   # one flat normal per glass face
            lines.append(f'f {v0}//{ni} {v1}//{ni} {v2}//{ni}\n')

    with open(out_path, 'w') as fh:
        fh.writelines(lines)
    kb = os.path.getsize(out_path) // 1024
    print(f'    → {out_path.split("/models/")[-1]}  ({kb} KB, '
          f'{fi_global:,} body/tire/etc. faces + {len(glass_faces)} glass)')


def export_variant(out_path, verts_list, group_dict,
                   glass_verts, glass_faces,
                   target=TARGET_FACES):
    """
    Full pipeline for one body variant:
        compact → QEM → reclassify → split normals → write OBJ.

    verts_list  : Python list of [x,y,z] (base + any procedural additions)
    group_dict  : {group_name: np.ndarray (F,3)} — indices into verts_list
    glass_verts : pre-compacted glass vertex array
    glass_faces : pre-compacted glass face array
    """
    verts = np.array(verts_list, dtype=np.float64)
    non_empty = {k: v for k,v in group_dict.items() if len(v)}
    if not non_empty:
        print('    SKIP — empty mesh'); return

    verts_c, groups_c = compact_faces(verts, non_empty)
    if len(verts_c) == 0:
        print('    SKIP — compact produced nothing'); return

    # Flatten to single face array for QEM (group order: GROUP_ORDER)
    flat_rows = []
    for grp in GROUP_ORDER:
        if grp in groups_c:
            flat_rows.extend(groups_c[grp].tolist())
    if not flat_rows:
        print('    SKIP — no faces'); return

    flat_faces = np.array(flat_rows, dtype=np.int32)
    n_in = len(flat_faces)
    act  = min(target, n_in)
    print(f'    QEM {n_in:,} → {act:,} faces …', flush=True)

    nv, nf = qem_simplify(verts_c, flat_faces, act)
    print(f'    decimated: {len(nv):,} verts  {len(nf):,} faces')

    if len(nf) == 0:
        print('    ERROR — 0 faces after QEM'); return

    # Re-classify decimated faces
    reclassified = reclassify_decimated(nv, nf)

    # Build ordered face array + per-group dict for write_obj
    ordered_face_groups = {}
    all_ordered = []
    for grp in GROUP_ORDER:
        farr = reclassified.get(grp)
        if farr is not None and len(farr):
            ordered_face_groups[grp] = farr
            all_ordered.extend(farr.tolist())

    if not all_ordered:
        print('    ERROR — reclassify empty'); return

    ordered_np = np.array(all_ordered, dtype=np.int32)
    uniq_normals, loop_idx = build_split_normals(nv, ordered_np, SMOOTH_DEG)
    print(f'    normals: {len(uniq_normals):,} unique')

    write_obj(out_path, nv, uniq_normals, loop_idx,
              ordered_face_groups, glass_verts, glass_faces)


def export_accessory(out_path, acc_verts, acc_groups, decimate_to=None):
    """
    Export a standalone accessory OBJ.
    decimate_to: if set and face count exceeds it, run QEM first.
    """
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    acc_verts = np.array(acc_verts, dtype=np.float64) if not isinstance(acc_verts, np.ndarray) else acc_verts

    non_empty = {k: v for k,v in acc_groups.items() if len(v)}
    if not non_empty:
        print('    SKIP — empty'); return

    # Compact to referenced vertices only
    acc_verts_c, groups_c = compact_faces(acc_verts, non_empty)
    if len(acc_verts_c) == 0:
        print('    SKIP — compact empty'); return

    flat_rows, grp_tags_pre = [], []
    for grp in GROUP_ORDER:
        if grp in groups_c:
            for row in groups_c[grp]:
                flat_rows.append(row)
                grp_tags_pre.append(grp)
    if not flat_rows:
        print('    SKIP — no faces'); return

    all_faces_pre = np.array(flat_rows, dtype=np.int32)

    # Optional QEM decimation for large accessories (e.g. offroadtires)
    if decimate_to and len(all_faces_pre) > decimate_to:
        tgt = min(decimate_to, len(all_faces_pre))
        print(f'    QEM {len(all_faces_pre):,} → {tgt:,} faces …', flush=True)
        nv, nf = qem_simplify(acc_verts_c, all_faces_pre, tgt)
        print(f'    decimated: {len(nv):,} verts  {len(nf):,} faces')
        if len(nf) == 0:
            print('    ERROR — 0 faces after QEM'); return
        reclass = reclassify_decimated(nv, nf)
        flat_rows, grp_tags_pre = [], []
        for grp in GROUP_ORDER:
            if grp in reclass:
                for row in reclass[grp]:
                    flat_rows.append(row)
                    grp_tags_pre.append(grp)
        acc_verts_c = nv
        all_faces_pre = np.array(flat_rows, dtype=np.int32)

    all_faces = all_faces_pre
    grp_tags  = grp_tags_pre
    uniq_normals, loop_idx = build_split_normals(acc_verts_c, all_faces, SMOOTH_DEG)

    lines = ['# LuxHaus Motors — accessory overlay\n', 'o Accessory\n']
    for x,y,z in acc_verts_c:
        lines.append(f'v {x:.4f} {y:.4f} {z:.4f}\n')
    for nx,ny,nz in uniq_normals:
        lines.append(f'vn {nx:.4f} {ny:.4f} {nz:.4f}\n')

    cur_grp = None
    for fi, (row, grp) in enumerate(zip(all_faces, grp_tags)):
        if grp != cur_grp:
            lines.append(f'g {grp}\n'); cur_grp = grp
        a,b,c = int(row[0])+1, int(row[1])+1, int(row[2])+1
        n0 = int(loop_idx[fi*3])  +1
        n1 = int(loop_idx[fi*3+1])+1
        n2 = int(loop_idx[fi*3+2])+1
        lines.append(f'f {a}//{n0} {b}//{n1} {c}//{n2}\n')

    with open(out_path, 'w') as fh:
        fh.writelines(lines)
    kb = os.path.getsize(out_path) // 1024
    print(f'    → {out_path.split("/models/")[-1]}  ({kb} KB, {len(all_faces):,} faces)')


# ═══════════════════════════════════════════════════════════════════════════════
# 8 — MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    t0 = time.time()
    print('LuxHaus HMMWV variant generator')
    print(f'Base: {BASE_OBJ}\n')

    # ── Parse ──────────────────────────────────────────────────────
    print('[1] Parsing base OBJ …')
    base_verts, raw_groups = parse_obj(BASE_OBJ)
    total_f = sum(len(g['faces']) for g in raw_groups)
    print(f'    {len(base_verts):,} vertices, {total_f:,} faces')

    # ── Classify ───────────────────────────────────────────────────
    print('[2] Classifying faces …')
    classified, glass_faces = classify_base(base_verts, raw_groups)
    for k,v in classified.items():
        print(f'    {k}: {len(v):,}')
    print(f'    window_glass: {len(glass_faces):,} (separate from QEM)')

    # Pre-compact glass (shared across all variants)
    glass_verts, glass_faces_c = compact_glass(base_verts, glass_faces)
    empty_glass_v = np.zeros((0,3),dtype=np.float64)
    empty_glass_f = np.zeros((0,3),dtype=np.int32)

    # ── Variants ───────────────────────────────────────────────────
    print('\n[3] Generating body variants …')

    def make_variant(mod_fns, include_glass=True):
        """
        Build a variant by applying a chain of modifier functions.
        Each mod_fn signature: mod_fn(verts, groups, verts_list) → groups
        """
        v = base_verts.tolist()    # fresh mutable vertex list
        g = dict(classified)       # start from classified base
        for fn in mod_fns:
            g = fn(v, g, v)        # verts and verts_list are both v
        gv = glass_verts if include_glass else empty_glass_v
        gf = glass_faces_c if include_glass else empty_glass_f
        return v, g, gv, gf

    variants = {
        '4door-hardtop':   make_variant([]),
        '4door-softtop':   make_variant([mod_softtop]),
        '4door-slantback': make_variant([mod_slantback]),
        '4door-notop':     make_variant([mod_notop], include_glass=False),
        '4door-openbed':   make_variant([mod_openbed], include_glass=False),
        '2door-hardtop':   make_variant([mod_2door]),
        '2door-softtop':   make_variant([mod_2door, mod_softtop]),
        '2door-slantback': make_variant([mod_2door, mod_slantback]),
        '2door-notop':     make_variant([mod_2door, mod_notop], include_glass=False),
    }

    for name, (vl, gd, gv, gf) in variants.items():
        print(f'\n  [{name}]')
        out = os.path.join(VARIANTS_DIR, name, 'web_model.obj')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        try:
            export_variant(out, vl, gd, gv, gf)
        except Exception as e:
            print(f'    ERROR: {e}')
            import traceback; traceback.print_exc()

    # ── Accessories ────────────────────────────────────────────────
    print('\n[4] Generating accessories …')
    accessories = {
        'grillguard':    gen_grillguard(),
        'brushguard':    gen_brushguard(),
        'lightkit':      gen_lightkit(),
        'turret':        gen_turret(),
        'offroadtires':  gen_offroadtires(base_verts, classified),
        'accessoriespkg': gen_accessoriespkg(base_verts),
    }

    # offroadtires inherits full base-model tire geometry (~76K faces) — must decimate
    decimate_overrides = {'offroadtires': 8_000}

    for name, (av, af) in accessories.items():
        print(f'\n  [{name}]')
        out = os.path.join(ACC_DIR, name, 'web_model.obj')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        try:
            export_accessory(out, av, af, decimate_to=decimate_overrides.get(name))
        except Exception as e:
            print(f'    ERROR: {e}')
            import traceback; traceback.print_exc()

    # ── Verify ─────────────────────────────────────────────────────
    print(f'\n[5] Verification (total {time.time()-t0:.0f}s) …')
    expected = (
        [f'models/variants/{n}/web_model.obj'    for n in variants] +
        [f'models/accessories/{n}/web_model.obj' for n in accessories]
    )
    ok = miss = 0
    for rel in expected:
        full = os.path.join(ROOT, rel)
        if os.path.exists(full):
            kb = os.path.getsize(full) // 1024
            print(f'  ✓  {rel:<50}  {kb:>5} KB')
            ok += 1
        else:
            print(f'  ✗  MISSING  {rel}')
            miss += 1

    print(f'\n{ok}/{ok+miss} files generated')
    if miss:
        print(f'⚠  {miss} file(s) missing — review errors above')
    else:
        print('✓  All files present — start the server with: node server.js')


if __name__ == '__main__':
    main()
