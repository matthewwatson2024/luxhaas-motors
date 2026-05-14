#!/usr/bin/env python3
"""
Voxel-clustering decimation — regenerates all Hunter variant web_model.obj files.

Step-sampling produced isolated triangles (vertex/face ratio ~2.9 instead of ~0.5).
Voxel clustering merges nearby vertices to cell centres, producing a connected mesh.
"""

import os
import math
import glob
import time

HUNTER_DIR = "/Users/matthewwatson/luxhaas-motors/models/new humvee files from our friend hunter"
GRID_SIZE  = 50   # 50×50×50 cells (~5k–20k output faces per model)


# ── Parser ────────────────────────────────────────────────────────────────────

def parse_obj(path):
    """Return (verts, faces) — verts: list of (x,y,z), faces: list of (a,b,c) 0-indexed."""
    verts = []
    faces = []
    with open(path, 'r', encoding='utf-8', errors='replace') as fh:
        for line in fh:
            if line.startswith('v '):
                p = line.split()
                verts.append((float(p[1]), float(p[2]), float(p[3])))
            elif line.startswith('f '):
                p = line.split()[1:]
                # Handle v, v/vt, v//vn, v/vt/vn — take first token
                idx = []
                for tok in p:
                    raw = int(tok.split('/')[0])
                    idx.append(raw - 1 if raw > 0 else len(verts) + raw)
                # Fan-triangulate polygons
                for i in range(1, len(idx) - 1):
                    faces.append((idx[0], idx[i], idx[i + 1]))
    return verts, faces


# ── Voxel clustering ──────────────────────────────────────────────────────────

def voxel_cluster(verts, faces, N=50):
    """
    Merge vertices into an N×N×N voxel grid.
    Returns (new_verts, new_faces) — both 0-indexed, no degenerate/duplicate faces.
    """
    if not verts or not faces:
        return [], []

    xs = [v[0] for v in verts]
    ys = [v[1] for v in verts]
    zs = [v[2] for v in verts]
    xmin, xmax = min(xs), max(xs)
    ymin, ymax = min(ys), max(ys)
    zmin, zmax = min(zs), max(zs)

    xr = xmax - xmin or 1.0
    yr = ymax - ymin or 1.0
    zr = zmax - zmin or 1.0

    # Assign each vertex to a cell, accumulate for averaging
    cell_to_idx  = {}   # cell_tuple → cluster index
    cluster_acc  = []   # [[sx, sy, sz], ...]
    cluster_cnt  = []
    vert_to_clus = []   # per-vertex cluster index

    for (x, y, z) in verts:
        cx = min(int((x - xmin) / xr * N), N - 1)
        cy = min(int((y - ymin) / yr * N), N - 1)
        cz = min(int((z - zmin) / zr * N), N - 1)
        cell = (cx, cy, cz)

        if cell not in cell_to_idx:
            cell_to_idx[cell] = len(cluster_acc)
            cluster_acc.append([x, y, z])
            cluster_cnt.append(1)
        else:
            ci = cell_to_idx[cell]
            cluster_acc[ci][0] += x
            cluster_acc[ci][1] += y
            cluster_acc[ci][2] += z
            cluster_cnt[ci]    += 1

        vert_to_clus.append(cell_to_idx[cell])

    # Average positions
    new_verts = [
        (s[0] / c, s[1] / c, s[2] / c)
        for s, c in zip(cluster_acc, cluster_cnt)
    ]

    # Remap faces; discard degenerate and duplicates
    seen      = set()
    new_faces = []
    for (a, b, c) in faces:
        ca = vert_to_clus[a]
        cb = vert_to_clus[b]
        cc = vert_to_clus[c]
        if ca == cb or cb == cc or ca == cc:
            continue  # degenerate after clustering
        key = tuple(sorted((ca, cb, cc)))
        if key in seen:
            continue
        seen.add(key)
        new_faces.append((ca, cb, cc))

    return new_verts, new_faces


# ── Normal computation ────────────────────────────────────────────────────────

def compute_normals(verts, faces):
    """Smooth per-vertex normals — area-weighted average of incident face normals."""
    normals = [[0.0, 0.0, 0.0] for _ in verts]

    for (a, b, c) in faces:
        ax, ay, az = verts[a]
        bx, by, bz = verts[b]
        cx, cy, cz = verts[c]
        ux, uy, uz = bx - ax, by - ay, bz - az
        vx, vy, vz = cx - ax, cy - ay, cz - az
        nx = uy * vz - uz * vy
        ny = uz * vx - ux * vz
        nz = ux * vy - uy * vx
        for i in (a, b, c):
            normals[i][0] += nx
            normals[i][1] += ny
            normals[i][2] += nz

    result = []
    for (nx, ny, nz) in normals:
        ln = math.sqrt(nx * nx + ny * ny + nz * nz)
        if ln > 1e-10:
            result.append((nx / ln, ny / ln, nz / ln))
        else:
            result.append((0.0, 1.0, 0.0))
    return result


# ── OBJ writer ────────────────────────────────────────────────────────────────

def write_obj(path, verts, normals, faces):
    """Write v//vn OBJ (no UV coords) — vertex normal index matches vertex index."""
    lines = [
        '# LuxHaus Motors — voxel-clustered web model\n',
        'o Mesh1.0\n',
    ]
    for (x, y, z) in verts:
        lines.append(f'v {x:.6f} {y:.6f} {z:.6f}\n')
    for (nx, ny, nz) in normals:
        lines.append(f'vn {nx:.6f} {ny:.6f} {nz:.6f}\n')
    for (a, b, c) in faces:
        i1, i2, i3 = a + 1, b + 1, c + 1
        lines.append(f'f {i1}//{i1} {i2}//{i2} {i3}//{i3}\n')
    with open(path, 'w') as fh:
        fh.writelines(lines)


# ── Per-variant driver ────────────────────────────────────────────────────────

def process_variant(folder, grid_size):
    name = os.path.basename(folder)
    print(f'\n[{name}]')

    sources = [
        f for f in glob.glob(os.path.join(folder, '*.obj'))
        if os.path.basename(f) != 'web_model.obj'
    ]
    if not sources:
        print('  SKIP — no source OBJ found')
        return

    src  = sources[0]
    out  = os.path.join(folder, 'web_model.obj')
    mb   = os.path.getsize(src) / 1_048_576
    print(f'  source : {os.path.basename(src)} ({mb:.1f} MB)')

    t0 = time.time()
    print('  parsing...')
    verts, faces = parse_obj(src)
    print(f'  parsed  : {len(verts):,} verts  {len(faces):,} faces  ({time.time()-t0:.1f}s)')

    t1 = time.time()
    print(f'  clustering (grid={grid_size})...')
    nv, nf = voxel_cluster(verts, faces, grid_size)
    print(f'  output  : {len(nv):,} verts  {len(nf):,} faces  ratio={len(nv)/max(len(nf),1):.3f}  ({time.time()-t1:.1f}s)')

    if not nf:
        print('  ERROR — zero faces after clustering; skipping write')
        return

    print('  normals...')
    normals = compute_normals(nv, nf)

    print(f'  writing {out}')
    write_obj(out, nv, normals, nf)

    kb = os.path.getsize(out) // 1024
    print(f'  saved   : {kb} KB  ({time.time()-t0:.1f}s total)')


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    folders = sorted([
        os.path.join(HUNTER_DIR, d)
        for d in os.listdir(HUNTER_DIR)
        if os.path.isdir(os.path.join(HUNTER_DIR, d))
    ])

    print(f'Hunter variants found : {len(folders)}')
    print(f'Grid size             : {GRID_SIZE}')

    t_start = time.time()
    for folder in folders:
        process_variant(folder, GRID_SIZE)

    print(f'\nAll done — {time.time()-t_start:.1f}s total')


if __name__ == '__main__':
    main()
