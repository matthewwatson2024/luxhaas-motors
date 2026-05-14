#!/usr/bin/env python3
"""
QEM mesh simplification for Hunter variant HMMWV OBJs.

pyfqmr: Fast Quadric Mesh Reduction — topology-preserving decimation.
Normals: angle-weighted vertex normals with hard-edge splitting.
         Hard edges (dihedral > SMOOTH_ANGLE) get split normals so panel
         creases stay crisp. Smooth areas interpolate cleanly.
"""

import os, math, glob, time
from collections import defaultdict
import numpy as np
import pyfqmr

HUNTER_DIR   = "/Users/matthewwatson/luxhaas-motors/models/new humvee files from our friend hunter"
TARGET_FACES = 80_000
SMOOTH_DEG   = 35.0   # edges sharper than this get split normals


# ── OBJ parser ────────────────────────────────────────────────────────────────

def parse_obj(path):
    """Return (verts np float64, faces np int32), faces 0-indexed, triangulated."""
    verts, faces = [], []
    with open(path, 'r', encoding='utf-8', errors='replace') as fh:
        for line in fh:
            if line.startswith('v '):
                p = line.split()
                verts.append((float(p[1]), float(p[2]), float(p[3])))
            elif line.startswith('f '):
                p = line.split()[1:]
                idx = []
                for tok in p:
                    raw = int(tok.split('/')[0])
                    idx.append(raw - 1 if raw > 0 else len(verts) + raw)
                for i in range(1, len(idx) - 1):
                    faces.append((idx[0], idx[i], idx[i + 1]))
    return (np.array(verts, dtype=np.float64),
            np.array(faces,  dtype=np.int32))


# ── QEM simplification ────────────────────────────────────────────────────────

def qem_simplify(verts, faces, target):
    """QEM decimation via pyfqmr. Returns (new_verts, new_faces) as numpy arrays."""
    m = pyfqmr.Simplify()
    m.setMesh(verts, faces)
    m.simplify_mesh(
        target_count   = max(target, 100),
        aggressiveness = 7,
        preserve_border= True,
        verbose        = False,
    )
    nv, nf, _ = m.getMesh()
    return np.array(nv, dtype=np.float64), np.array(nf, dtype=np.int32)


# ── Split-normal computation ──────────────────────────────────────────────────

def build_split_normals(verts, faces, smooth_deg=35.0):
    """
    Compute per-loop (per-face-corner) normals that preserve hard edges.

    Returns:
        unique_normals  — (M, 3) float32 array of deduplicated normal vectors
        loop_normal_idx — (N*3,) int array mapping each face-corner to a normal index
    where N = len(faces).

    Sharp edges (dihedral angle > smooth_deg) produce split normals so that
    panel creases stay crisp instead of smearing across face groups.
    """
    threshold = math.cos(math.radians(smooth_deg))
    n_faces   = len(faces)

    # Per-face normals (area-weighted, used for gathering)
    v0 = verts[faces[:, 0]]
    v1 = verts[faces[:, 1]]
    v2 = verts[faces[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0).astype(np.float64)   # (N, 3)
    mag = np.linalg.norm(fn, axis=1, keepdims=True)
    mag = np.where(mag < 1e-12, 1e-12, mag)
    fn_unit = fn / mag                                     # (N, 3)

    # Vertex → incident face list
    v2f = defaultdict(list)
    for fi in range(n_faces):
        for vi in faces[fi]:
            v2f[vi].append(fi)

    # Per-loop (face-corner) normals
    loop_normals = np.empty((n_faces * 3, 3), dtype=np.float32)
    fn_unit_f32  = fn_unit.astype(np.float32)

    for fi in range(n_faces):
        cfn = fn_unit_f32[fi]          # current face normal (3,)
        for li, vi in enumerate(faces[fi]):
            # Average all face normals within smooth_deg of cfn at this vertex
            acc = np.zeros(3, dtype=np.float64)
            for adj_fi in v2f[vi]:
                if float(np.dot(cfn, fn_unit_f32[adj_fi])) >= threshold:
                    acc += fn_unit[adj_fi]
            length = np.linalg.norm(acc)
            if length > 1e-10:
                loop_normals[fi * 3 + li] = (acc / length).astype(np.float32)
            else:
                loop_normals[fi * 3 + li] = cfn

    # Deduplicate normals (round to 4 dp for hashing)
    key_map   = {}
    uniq_list = []
    loop_idx  = np.empty(n_faces * 3, dtype=np.int32)

    for i, n in enumerate(loop_normals):
        key = (round(float(n[0]), 4),
               round(float(n[1]), 4),
               round(float(n[2]), 4))
        if key not in key_map:
            key_map[key] = len(uniq_list)
            uniq_list.append(key)
        loop_idx[i] = key_map[key]

    unique_normals = np.array(uniq_list, dtype=np.float32)
    return unique_normals, loop_idx


# ── OBJ writer ────────────────────────────────────────────────────────────────

def write_obj(path, verts, faces, unique_normals, loop_normal_idx):
    """
    Write OBJ with shared vertex positions and per-loop split normals.
    Face format: f v//vn  (no UV, vertex and normal indices differ at hard edges).
    """
    lines = ['# LuxHaus Motors — QEM-decimated web model\n', 'o Mesh1.0\n']

    for (x, y, z) in verts:
        lines.append(f'v {x:.6f} {y:.6f} {z:.6f}\n')

    for (nx, ny, nz) in unique_normals:
        lines.append(f'vn {nx:.6f} {ny:.6f} {nz:.6f}\n')

    for fi, (a, b, c) in enumerate(faces):
        n0 = int(loop_normal_idx[fi * 3])     + 1
        n1 = int(loop_normal_idx[fi * 3 + 1]) + 1
        n2 = int(loop_normal_idx[fi * 3 + 2]) + 1
        lines.append(f'f {a+1}//{n0} {b+1}//{n1} {c+1}//{n2}\n')

    with open(path, 'w') as fh:
        fh.writelines(lines)


# ── Per-variant driver ────────────────────────────────────────────────────────

def process_variant(folder):
    name = os.path.basename(folder)
    print(f'\n[{name}]')

    sources = [f for f in glob.glob(os.path.join(folder, '*.obj'))
               if os.path.basename(f) != 'web_model.obj']
    if not sources:
        print('  SKIP — no source OBJ')
        return

    src = sources[0]
    out = os.path.join(folder, 'web_model.obj')
    print(f'  source : {os.path.basename(src)} ({os.path.getsize(src)/1e6:.1f} MB)')

    t0 = time.time()
    print('  parsing...')
    verts, faces = parse_obj(src)
    print(f'  parsed  : {len(verts):,} verts  {len(faces):,} faces  ({time.time()-t0:.1f}s)')

    # QEM
    t1 = time.time()
    target = min(TARGET_FACES, len(faces))
    print(f'  QEM → target {target:,} faces...')
    nv, nf = qem_simplify(verts, faces, target)
    print(f'  output  : {len(nv):,} verts  {len(nf):,} faces  ratio={len(nv)/max(len(nf),1):.3f}  ({time.time()-t1:.1f}s)')

    if len(nf) == 0:
        print('  ERROR — 0 faces after QEM; skipping')
        return

    # Normals
    t2 = time.time()
    print(f'  split normals (smooth ≤ {SMOOTH_DEG}°)...')
    unique_normals, loop_idx = build_split_normals(nv, nf, SMOOTH_DEG)
    print(f'  normals : {len(unique_normals):,} unique  ({time.time()-t2:.1f}s)')

    # Write
    print(f'  writing...')
    write_obj(out, nv, nf, unique_normals, loop_idx)
    kb = os.path.getsize(out) // 1024
    print(f'  saved   : {kb} KB  (total {time.time()-t0:.1f}s)')


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    folders = sorted([
        os.path.join(HUNTER_DIR, d)
        for d in os.listdir(HUNTER_DIR)
        if os.path.isdir(os.path.join(HUNTER_DIR, d))
    ])

    print(f'Hunter variants  : {len(folders)}')
    print(f'Target faces     : {TARGET_FACES:,}')
    print(f'Smooth threshold : {SMOOTH_DEG}°')

    t_start = time.time()
    for folder in folders:
        process_variant(folder)
    print(f'\nAll done — {time.time()-t_start:.1f}s total')


if __name__ == '__main__':
    main()
