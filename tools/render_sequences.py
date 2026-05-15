#!/usr/bin/env python3
"""
LuxHaus Motors — Blender Orbit Renderer
========================================
Produces 18-frame 360° image sequences for the mobile vehicle configurator.
Each frame is a 20° step (18 × 20° = 360° full orbit).

Usage (from project root — adjust path to your Blender install):
  blender --background --python tools/render_sequences.py
  blender --background --python tools/render_sequences.py -- --variants 4door-hardtop --colors sand,obsidian
  blender --background --python tools/render_sequences.py -- --engine BLENDER_EEVEE --samples 0
  blender --background --python tools/render_sequences.py -- --dry-run

Output:
  images/viewer/{variant}/{color}/frame-01.jpg  …  frame-18.jpg

Requirements:
  Blender 3.6 LTS or Blender 4.x (tested on 3.6.9 and 4.1)
"""

import bpy
import math
import os
import sys
import json
import logging
import argparse
import time
import mathutils
from pathlib import Path
from datetime import datetime, timezone

# ═══════════════════════════════════════════════════════════════════
#  0. CLI ARGUMENT PARSING
#     Args are passed after '--' so Blender doesn't consume them.
#     Example: blender --bg --python script.py -- --colors sand
# ═══════════════════════════════════════════════════════════════════

def parse_args() -> argparse.Namespace:
    raw = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser(prog="render_sequences")
    p.add_argument("--variants",   default="ALL",
                   help="Comma-separated variant keys or ALL  (e.g. 4door-hardtop,2door-softtop)")
    p.add_argument("--colors",     default="ALL",
                   help="Comma-separated color slugs or ALL  (e.g. sand,obsidian,camo)")
    p.add_argument("--engine",     default="CYCLES",
                   choices=["CYCLES", "BLENDER_EEVEE"],
                   help="Render engine.  CYCLES = best quality.  BLENDER_EEVEE = faster preview.")
    p.add_argument("--samples",    type=int, default=256,
                   help="Cycles path-trace samples per pixel.  256 = production quality.  64 = fast test.")
    p.add_argument("--resolution", default="1920x1080",
                   help="WxH in pixels, e.g. 1920x1080 or 1280x720")
    p.add_argument("--quality",    type=int, default=92,
                   help="JPEG compression quality 0–100  (92 = high quality, ~300 KB/frame)")
    p.add_argument("--frames",     type=int, default=18,
                   help="Frames per sequence.  18 = 20° steps (360° orbit).  36 = 10° steps.")
    p.add_argument("--start-angle",type=float, default=-30.0,
                   help="Starting orbit angle in degrees.  -30 = front-right 3/4 view (automotive convention).")
    p.add_argument("--output-dir", default="",
                   help="Override output root.  Default: <project>/images/viewer/")
    p.add_argument("--dry-run",    action="store_true",
                   help="Compute all output paths and log them without rendering anything.")
    return p.parse_args(raw)


# ═══════════════════════════════════════════════════════════════════
#  1. PROJECT PATHS
# ═══════════════════════════════════════════════════════════════════

# Script lives at <project>/tools/render_sequences.py
SCRIPT_DIR   = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Base HMMWV_Desert OBJ (has UV maps and PBR textures)
MODEL_BASE_OBJ = (
    PROJECT_ROOT
    / "models/humvee-1/uploads_files_3017515_HMMWV_Desert_OBJ"
    / "HMMWV_Desert_OBJ.obj"
)

# PBR texture directory (used by the base model)
TEX_DIR = (
    PROJECT_ROOT
    / "models/humvee-1/uploads_files_3017515_HMMWV_Desert_Textures"
)

# Variant OBJ root  (each folder contains web_model.obj, no UV / no MTL)
VARIANT_ROOT = PROJECT_ROOT / "models/variants"


# ═══════════════════════════════════════════════════════════════════
#  2. VARIANT + COLOR TABLES
# ═══════════════════════════════════════════════════════════════════

# Maps variant slug → OBJ filepath
VARIANTS: dict[str, Path] = {
    "4door-hardtop":   MODEL_BASE_OBJ,
    "4door-softtop":   VARIANT_ROOT / "4door-softtop"   / "web_model.obj",
    "4door-slantback": VARIANT_ROOT / "4door-slantback" / "web_model.obj",
    "4door-notop":     VARIANT_ROOT / "4door-notop"     / "web_model.obj",
    "4door-openbed":   VARIANT_ROOT / "4door-openbed"   / "web_model.obj",
    "2door-hardtop":   VARIANT_ROOT / "2door-hardtop"   / "web_model.obj",
    "2door-softtop":   VARIANT_ROOT / "2door-softtop"   / "web_model.obj",
    "2door-slantback": VARIANT_ROOT / "2door-slantback" / "web_model.obj",
    "2door-notop":     VARIANT_ROOT / "2door-notop"     / "web_model.obj",
}

# Maps color slug → PBR parameters for the body paint material
COLORS: dict[str, dict] = {
    "sand":     {"rgba": (0xC4/255, 0xA8/255, 0x82/255, 1.0), "camo": False, "metallic": 0.05, "roughness": 0.28, "clearcoat": 0.80, "cc_rough": 0.06},
    "obsidian": {"rgba": (0x11/255, 0x11/255, 0x11/255, 1.0), "camo": False, "metallic": 0.06, "roughness": 0.22, "clearcoat": 0.90, "cc_rough": 0.05},
    "arctic":   {"rgba": (0xDC/255, 0xDC/255, 0xDC/255, 1.0), "camo": False, "metallic": 0.04, "roughness": 0.20, "clearcoat": 0.85, "cc_rough": 0.05},
    "ranger":   {"rgba": (0x2D/255, 0x5A/255, 0x27/255, 1.0), "camo": False, "metallic": 0.04, "roughness": 0.32, "clearcoat": 0.65, "cc_rough": 0.08},
    "hero-red": {"rgba": (0xCC/255, 0x00/255, 0x00/255, 1.0), "camo": False, "metallic": 0.06, "roughness": 0.24, "clearcoat": 0.88, "cc_rough": 0.05},
    "gold":     {"rgba": (0xC9/255, 0xA8/255, 0x4C/255, 1.0), "camo": False, "metallic": 0.40, "roughness": 0.18, "clearcoat": 0.75, "cc_rough": 0.06},
    "camo":     {"rgba": None,                                  "camo": True,  "metallic": 0.02, "roughness": 0.75, "clearcoat": 0.04, "cc_rough": 0.60},
}


# ═══════════════════════════════════════════════════════════════════
#  3. CAMERA CONSTANTS
# ═══════════════════════════════════════════════════════════════════

CAMERA_DISTANCE_M = 6.5    # metres from model's vertical axis
CAMERA_HEIGHT_M   = 1.80   # metres above ground plane
LOOK_AT_HEIGHT_M  = 1.20   # focal point height (body midpoint of a HMMWV)
CAMERA_FOCAL_MM   = 85     # telephoto compression — automotive photography standard

# Ground plane
GROUND_SIZE_M     = 24.0   # square metres
GROUND_ROUGHNESS  = 0.32   # slight polish — luxury studio feel


# ═══════════════════════════════════════════════════════════════════
#  4. LOGGING
# ═══════════════════════════════════════════════════════════════════

logging.basicConfig(
    level   = logging.INFO,
    format  = "%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt = "%H:%M:%S",
)
log = logging.getLogger("luxhaus")

render_log: list[dict] = []   # accumulated; written to JSON at end


# ═══════════════════════════════════════════════════════════════════
#  5. SCENE UTILITIES
# ═══════════════════════════════════════════════════════════════════

def check_blender_version(required=(3, 6, 0)) -> None:
    bv = bpy.app.version
    if bv < required:
        raise RuntimeError(
            f"Blender {'.'.join(str(x) for x in required)}+ required — "
            f"running {'.'.join(str(x) for x in bv)}"
        )
    log.info("Blender %s", ".".join(str(x) for x in bv))


def clear_scene() -> None:
    """Delete everything: objects, meshes, materials, lights, cameras."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=True)
    for collection in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.images,
        bpy.data.objects,
    ):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def purge_materials_from(mesh_objects: list) -> None:
    """Remove all materials currently assigned to these mesh objects."""
    for obj in mesh_objects:
        for slot in obj.material_slots:
            if slot.material and slot.material.users <= 1:
                bpy.data.materials.remove(slot.material)
        obj.data.materials.clear()


# ═══════════════════════════════════════════════════════════════════
#  6. RENDER CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

def configure_render(scene, args) -> None:
    """Apply engine, resolution, JPEG, and sampling settings."""
    w, h = (int(x) for x in args.resolution.lower().split("x"))
    scene.render.engine                       = args.engine
    scene.render.resolution_x                 = w
    scene.render.resolution_y                 = h
    scene.render.resolution_percentage        = 100
    scene.render.image_settings.file_format   = "JPEG"
    scene.render.image_settings.color_mode    = "RGB"
    scene.render.image_settings.quality       = args.quality
    scene.render.use_persistent_data          = True   # reuse BVH across frames

    if args.engine == "CYCLES":
        c = scene.cycles
        c.samples                = args.samples
        c.use_adaptive_sampling  = True
        c.adaptive_threshold     = 0.004          # stop when noise is below this
        c.use_denoising          = True
        # OIDN runs on CPU — always available, no GPU add-on required
        c.denoiser               = "OPENIMAGEDENOISE"
        c.denoising_input_passes = "RGB_ALBEDO_NORMAL"
        c.sample_clamp_indirect  = 5.0            # suppress fireflies
        c.sample_clamp_direct    = 0.0
        c.caustics_reflective    = False          # faster, rarely needed for cars
        c.caustics_refractive    = False
        _enable_gpu(scene)

    elif args.engine == "BLENDER_EEVEE":
        e = scene.eevee
        e.taa_render_samples    = 64
        e.use_ssr               = True            # screen-space reflections for paint
        e.use_ssr_refraction    = True
        e.use_gtao              = True            # ambient occlusion
        e.gtao_distance         = 0.25
        e.use_bloom             = True
        e.bloom_threshold       = 0.9
        e.bloom_intensity       = 0.04
        e.shadow_cube_size      = "2048"
        e.shadow_cascade_size   = "2048"

    log.info("Render: %s  %dx%d  Q%d  samples=%s",
             args.engine, w, h, args.quality,
             args.samples if args.engine == "CYCLES" else "EEVEE")


def _enable_gpu(scene) -> None:
    """Try METAL → OptiX → CUDA → HIP in order; fall back to CPU."""
    prefs = bpy.context.preferences.addons.get("cycles")
    if not prefs:
        log.warning("Cycles not available — CPU render")
        return

    cp = prefs.preferences
    for dtype in ("METAL", "OPTIX", "CUDA", "HIP", "OPENCL"):
        try:
            cp.compute_device_type = dtype
            # Blender 3.x returns a list; 4.x returns device groups
            devs = cp.get_devices()
            # Flatten device groups (Blender 4.x compatibility)
            flat = []
            for d in devs:
                if hasattr(d, "__iter__"):
                    flat.extend(d)
                else:
                    flat.append(d)
            if not flat:
                continue
            for d in flat:
                d.use = True
            scene.cycles.device = "GPU"
            log.info("GPU: %s (%d device(s) enabled)", dtype, len(flat))
            return
        except Exception as exc:
            log.debug("  %s unavailable: %s", dtype, exc)

    scene.cycles.device = "CPU"
    log.warning("No GPU found — CPU rendering will be slow")


# ═══════════════════════════════════════════════════════════════════
#  7. WORLD / ENVIRONMENT
# ═══════════════════════════════════════════════════════════════════

def setup_world(scene) -> None:
    """
    Dark studio environment matching the site's #080808 colour.
    No external HDRI required — entirely procedural.

    Sky gradient: near-black floor, very dark warm upper hemisphere.
    This gives metallic surfaces a subtle ambient reflection without
    introducing colour casts that would fight the lighting rig.
    """
    world = bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputWorld"); out.location = (500, 0)

    # Lower hemisphere: very dark neutral
    bg_floor = nt.nodes.new("ShaderNodeBackground"); bg_floor.location = (0, 80)
    bg_floor.inputs["Color"].default_value    = (0.022, 0.022, 0.024, 1.0)
    bg_floor.inputs["Strength"].default_value = 0.5

    # Upper hemisphere: faint warm — adds premium ambiance to clearcoat
    bg_sky = nt.nodes.new("ShaderNodeBackground"); bg_sky.location = (0, -80)
    bg_sky.inputs["Color"].default_value    = (0.07, 0.055, 0.03, 1.0)
    bg_sky.inputs["Strength"].default_value = 0.3

    # Blend based on incoming direction (positive Y = upward in world space)
    geom = nt.nodes.new("ShaderNodeNewGeometry"); geom.location = (-250, 0)
    clamp = nt.nodes.new("ShaderNodeMath"); clamp.location = (-80, -60)
    clamp.operation = "MAXIMUM"
    clamp.inputs[1].default_value = 0.0

    mix = nt.nodes.new("ShaderNodeMixShader"); mix.location = (270, 0)

    nt.links.new(geom.outputs["Incoming"], clamp.inputs[0])
    nt.links.new(clamp.outputs["Value"],   mix.inputs["Fac"])
    nt.links.new(bg_floor.outputs["Background"], mix.inputs[1])
    nt.links.new(bg_sky.outputs["Background"],   mix.inputs[2])
    nt.links.new(mix.outputs["Shader"],    out.inputs["Surface"])


# ═══════════════════════════════════════════════════════════════════
#  8. LIGHTING RIG
# ═══════════════════════════════════════════════════════════════════

def setup_lighting(scene) -> None:
    """
    Five-light studio rig — mirrors the Three.js lighting in main.js:

      Key   (warm, upper-right-front) — dominant highlight + shadow
      Fill  (cool, left-back)         — open shadows, prevents harsh contrast
      Rim   (cool, upper-back)        — separates vehicle from background
      Bounce (warm, below)            — undercarriage fill, softens ground shadow
      Top   (warm, directly above)    — roof specular + overall ambient lift

    Sun lamps are used for Key/Fill/Rim: they cast parallel rays, giving the
    clean shadows of a professional photo studio without a huge shadow map.
    Area lamps for Bounce and Top: soft, wrap-around fill without hard shadows.
    """
    defs = [
        # name,     type,   colour RGB,           energy, position,       extras
        ("Key",    "SUN",  (1.00, 0.98, 0.88),   4.8,   ( 6,  12,  8),  {"angle_deg": 3}),
        ("Fill",   "SUN",  (0.78, 0.88, 1.00),   1.5,   (-8,   5, -6),  {"angle_deg": 7}),
        ("Rim",    "SUN",  (0.84, 0.93, 1.00),   2.4,   ( 0,   4,-10),  {"angle_deg": 4}),
        ("Bounce", "AREA", (1.00, 0.92, 0.72),  90.0,   ( 0,  -1,  0),  {"size": 8.0,  "shadow": False}),
        ("Top",    "AREA", (1.00, 0.95, 0.80), 140.0,   ( 0,   0, 14),  {"size": 5.0,  "shadow": True}),
    ]

    for name, ltype, colour, energy, pos, extras in defs:
        ld = bpy.data.lights.new(name=name, type=ltype)
        ld.color  = colour
        ld.energy = energy

        if ltype == "SUN":
            ld.angle       = math.radians(extras.get("angle_deg", 5))
            ld.use_shadow  = True
        elif ltype == "AREA":
            ld.shape      = "RECTANGLE"
            ld.size       = extras.get("size", 4.0)
            ld.size_y     = ld.size
            ld.use_shadow = extras.get("shadow", True)

        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = pos

        # Point Sun lamps toward origin
        if ltype == "SUN":
            direction = mathutils.Vector((0.0, 0.0, 0.6)) - mathutils.Vector(pos)
            lo.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        elif ltype == "AREA":
            # Bounce faces up; Top faces down
            lo.rotation_euler = (0, 0, 0) if pos[2] < 1 else (math.pi, 0, 0)

    log.info("Lighting rig: %d lights", len(defs))


# ═══════════════════════════════════════════════════════════════════
#  9. GROUND PLANE
# ═══════════════════════════════════════════════════════════════════

def add_ground_plane(scene) -> bpy.types.Object:
    """
    Dark, slightly polished studio floor.
    Low roughness creates the subtle car-reflection that anchors the vehicle
    visually without looking like a mirror or a puddle.
    """
    bpy.ops.mesh.primitive_plane_add(size=GROUND_SIZE_M, location=(0, 0, 0))
    plane      = bpy.context.active_object
    plane.name = "StudioFloor"

    mat = bpy.data.materials.new("FloorMat")
    mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    out  = nt.nodes.new("ShaderNodeOutputMaterial"); out.location  = (400, 0)
    prin = nt.nodes.new("ShaderNodeBsdfPrincipled"); prin.location = (100, 0)
    prin.inputs["Base Color"].default_value = (0.028, 0.028, 0.028, 1.0)
    prin.inputs["Metallic"].default_value   = 0.0
    prin.inputs["Roughness"].default_value  = GROUND_ROUGHNESS
    _set_input(prin, "Specular",            0.45)
    nt.links.new(prin.outputs["BSDF"], out.inputs["Surface"])
    plane.data.materials.append(mat)

    # Soften shadow terminator artifacts at the plane edge
    if hasattr(plane, "cycles"):
        plane.cycles.shadow_terminator_offset = 0.1

    return plane


# ═══════════════════════════════════════════════════════════════════
#  10. CAMERA
# ═══════════════════════════════════════════════════════════════════

def create_camera(scene) -> bpy.types.Object:
    cam_data               = bpy.data.cameras.new("StudioCam")
    cam_data.lens          = CAMERA_FOCAL_MM
    cam_data.clip_start    = 0.1
    cam_data.clip_end      = 200.0
    cam_data.dof.use_dof   = False        # keep all geometry sharp for product shots
    cam_obj                = bpy.data.objects.new("StudioCam", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera           = cam_obj
    return cam_obj


def position_camera(cam_obj, frame_idx: int, total_frames: int, start_angle_deg: float) -> None:
    """
    Orbit camera around Y-axis (standard Blender up-axis = Z).
    frame 0  → start_angle_deg (default -30° = front-right 3/4 view)
    frame 17 → start_angle_deg + 340° (one step before full circle)

    Counter-clockwise from above = standard automotive presentation direction.
    """
    angle = math.radians(start_angle_deg + frame_idx / total_frames * 360.0)
    x = CAMERA_DISTANCE_M * math.sin(angle)
    y = -CAMERA_DISTANCE_M * math.cos(angle)
    z = CAMERA_HEIGHT_M

    cam_obj.location = (x, y, z)

    # Track toward the focal point (slightly above ground for a HMMWV body)
    target    = mathutils.Vector((0.0, 0.0, LOOK_AT_HEIGHT_M))
    direction = target - mathutils.Vector((x, y, z))
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


# ═══════════════════════════════════════════════════════════════════
#  11. MATERIALS
# ═══════════════════════════════════════════════════════════════════

def _set_input(node, name: str, value) -> None:
    """
    Set a Principled BSDF input by name, handling Blender 3.x/4.x renames:
      Clearcoat → Coat Weight  (Blender 4.0)
      Clearcoat Roughness → Coat Roughness
      Transmission → Transmission Weight
      Specular → Specular IOR Level
    """
    aliases = {
        "Clearcoat":           ["Coat Weight",         "Clearcoat"],
        "Clearcoat Roughness": ["Coat Roughness",      "Clearcoat Roughness"],
        "Transmission":        ["Transmission Weight", "Transmission"],
        "Specular":            ["Specular IOR Level",  "Specular"],
    }
    for candidate in aliases.get(name, [name]):
        if candidate in node.inputs:
            node.inputs[candidate].default_value = value
            return
    # Input not found — not an error, different Blender versions expose different inputs


def _principled_node(mat: bpy.types.Material, **kw) -> bpy.types.Node:
    """Build a minimal Principled BSDF node tree and return the BSDF node."""
    mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    out  = nt.nodes.new("ShaderNodeOutputMaterial"); out.location  = (420, 0)
    prin = nt.nodes.new("ShaderNodeBsdfPrincipled"); prin.location = (100, 0)
    for key, val in kw.items():
        _set_input(prin, key, val)
    nt.links.new(prin.outputs["BSDF"], out.inputs["Surface"])
    return prin


# ── Body paint ───────────────────────────────────────────────────────

def make_body_material(color_cfg: dict) -> bpy.types.Material:
    if color_cfg["camo"]:
        return _make_camo_material()

    r, g, b, a = color_cfg["rgba"]
    mat = bpy.data.materials.new("body_paint")
    _principled_node(mat,
        **{
            "Base Color":          (r, g, b, a),
            "Metallic":            color_cfg["metallic"],
            "Roughness":           color_cfg["roughness"],
            "Clearcoat":           color_cfg["clearcoat"],
            "Clearcoat Roughness": color_cfg["cc_rough"],
            "Specular":            0.5,
        }
    )
    return mat


def _make_camo_material() -> bpy.types.Material:
    """
    Procedural woodland camo using Noise Texture → ColorRamp with
    CONSTANT interpolation for sharp military pattern edges.
    Object-space UV so pattern scales correctly regardless of mesh size.
    """
    mat = bpy.data.materials.new("body_camo")
    mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()

    out  = nt.nodes.new("ShaderNodeOutputMaterial"); out.location  = (700, 0)
    prin = nt.nodes.new("ShaderNodeBsdfPrincipled"); prin.location = (450, 0)
    _set_input(prin, "Metallic",            0.02)
    _set_input(prin, "Roughness",           0.75)
    _set_input(prin, "Clearcoat",           0.04)
    _set_input(prin, "Clearcoat Roughness", 0.60)

    # Noise source (object-space so pattern size is world-consistent)
    coord = nt.nodes.new("ShaderNodeTexCoord"); coord.location = (-500, 0)
    noise = nt.nodes.new("ShaderNodeTexNoise"); noise.location = (-300, 0)
    noise.inputs["Scale"].default_value      = 9.0
    noise.inputs["Detail"].default_value     = 7.0
    noise.inputs["Roughness"].default_value  = 0.65
    noise.inputs["Distortion"].default_value = 0.45

    ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.location = (100, 0)
    cr   = ramp.color_ramp
    cr.interpolation = "CONSTANT"   # sharp, military edge definition

    # Four camo colours matching the JS createCamoTexture() palette
    cr.elements[0].position = 0.00;  cr.elements[0].color = (0x7B/255, 0x72/255, 0x46/255, 1)  # tan
    cr.elements[1].position = 0.28;  cr.elements[1].color = (0x4B/255, 0x5E/255, 0x35/255, 1)  # mid green
    e2 = cr.elements.new(0.55);      e2.color              = (0x2F/255, 0x3D/255, 0x1E/255, 1)  # dark green
    e3 = cr.elements.new(0.78);      e3.color              = (0x3B/255, 0x2B/255, 0x14/255, 1)  # dark brown

    nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"],    ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"],   prin.inputs["Base Color"])
    nt.links.new(prin.outputs["BSDF"],    out.inputs["Surface"])
    return mat


# ── Textured materials for the base HMMWV_Desert model ──────────────

def _load_tex(filepath: Path, srgb: bool) -> bpy.types.Image:
    """Load an image from disk; return existing block if already loaded."""
    name = filepath.name
    if name in bpy.data.images:
        return bpy.data.images[name]
    img = bpy.data.images.load(str(filepath))
    img.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
    return img


def _tex_node(nt, img: bpy.types.Image, location=(-300, 0)) -> bpy.types.Node:
    node     = nt.nodes.new("ShaderNodeTexImage")
    node.image    = img
    node.location = location
    return node


def make_base_body_material(color_cfg: dict) -> bpy.types.Material:
    """
    For the base HMMWV_Desert model: use the PBR texture maps BUT
    tint the base colour with the selected paint colour via a MixRGB node.
    Desert Sand ('sand') uses the original texture at full strength.
    Other colours blend toward the solid paint colour so the normal/roughness
    maps still contribute surface detail.
    """
    if color_cfg["camo"]:
        return _make_camo_material()

    mat = bpy.data.materials.new("base_body")
    mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()

    out  = nt.nodes.new("ShaderNodeOutputMaterial"); out.location  = (700, 0)
    prin = nt.nodes.new("ShaderNodeBsdfPrincipled"); prin.location = (400, 0)
    _set_input(prin, "Metallic",            color_cfg["metallic"])
    _set_input(prin, "Roughness",           color_cfg["roughness"])
    _set_input(prin, "Clearcoat",           color_cfg["clearcoat"])
    _set_input(prin, "Clearcoat Roughness", color_cfg["cc_rough"])
    _set_input(prin, "Specular",            0.5)

    # Load Body_Color, Body_Normal, Body_Metallic (used as roughness)
    body_col_path  = TEX_DIR / "Body_Color.jpg"
    body_norm_path = TEX_DIR / "Body_Normal.jpg"
    body_met_path  = TEX_DIR / "Body_Metallic.jpg"

    tex_col  = _tex_node(nt, _load_tex(body_col_path,  True),  (-350,  120))
    tex_norm = _tex_node(nt, _load_tex(body_norm_path, False), (-350, -80))
    tex_met  = _tex_node(nt, _load_tex(body_met_path,  False), (-350, -280))

    # Normal map node
    norm_map = nt.nodes.new("ShaderNodeNormalMap"); norm_map.location = (50, -100)
    norm_map.inputs["Strength"].default_value = 1.2

    # If colour is 'sand', use texture directly.  Otherwise mix toward paint colour.
    r, g, b, a = color_cfg["rgba"]
    is_sand = (color_cfg["rgba"] == COLORS["sand"]["rgba"])

    if is_sand:
        nt.links.new(tex_col.outputs["Color"], prin.inputs["Base Color"])
    else:
        mix_col = nt.nodes.new("ShaderNodeMixRGB"); mix_col.location = (100, 120)
        mix_col.blend_type = "MIX"
        mix_col.inputs["Fac"].default_value           = 0.85     # 85% solid paint, 15% texture detail
        mix_col.inputs["Color2"].default_value        = (r, g, b, a)
        nt.links.new(tex_col.outputs["Color"], mix_col.inputs["Color1"])
        nt.links.new(mix_col.outputs["Color"], prin.inputs["Base Color"])

    nt.links.new(tex_norm.outputs["Color"], norm_map.inputs["Color"])
    nt.links.new(norm_map.outputs["Normal"], prin.inputs["Normal"])
    nt.links.new(tex_met.outputs["Color"],  prin.inputs["Roughness"])
    nt.links.new(prin.outputs["BSDF"],      out.inputs["Surface"])
    return mat


def make_base_wheel_material() -> bpy.types.Material:
    mat = bpy.data.materials.new("base_wheel")
    mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    out  = nt.nodes.new("ShaderNodeOutputMaterial"); out.location  = (700, 0)
    prin = nt.nodes.new("ShaderNodeBsdfPrincipled"); prin.location = (400, 0)
    _set_input(prin, "Metallic",  0.3)
    _set_input(prin, "Roughness", 0.7)
    tex_col  = _tex_node(nt, _load_tex(TEX_DIR / "Wheels_Color.jpg",     True),  (-350,  120))
    tex_norm = _tex_node(nt, _load_tex(TEX_DIR / "Wheels_Normal.jpg",    False), (-350,  -80))
    tex_rough= _tex_node(nt, _load_tex(TEX_DIR / "Wheels_Roughness.jpg", False), (-350, -280))
    norm_map = nt.nodes.new("ShaderNodeNormalMap"); norm_map.location = (50, -80)
    nt.links.new(tex_col.outputs["Color"],   prin.inputs["Base Color"])
    nt.links.new(tex_norm.outputs["Color"],  norm_map.inputs["Color"])
    nt.links.new(norm_map.outputs["Normal"], prin.inputs["Normal"])
    nt.links.new(tex_rough.outputs["Color"], prin.inputs["Roughness"])
    nt.links.new(prin.outputs["BSDF"],       out.inputs["Surface"])
    return mat


def make_base_suspension_material() -> bpy.types.Material:
    mat = bpy.data.materials.new("base_susp")
    mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    out  = nt.nodes.new("ShaderNodeOutputMaterial"); out.location  = (700, 0)
    prin = nt.nodes.new("ShaderNodeBsdfPrincipled"); prin.location = (400, 0)
    _set_input(prin, "Metallic",  0.5)
    _set_input(prin, "Roughness", 0.55)
    tex_col  = _tex_node(nt, _load_tex(TEX_DIR / "Suspensions_Color.jpg",    True),  (-350,  120))
    tex_norm = _tex_node(nt, _load_tex(TEX_DIR / "Suspensions_Normal.jpg",   False), (-350,  -80))
    tex_met  = _tex_node(nt, _load_tex(TEX_DIR / "Suspensions_Metallic.jpg", False), (-350, -280))
    norm_map = nt.nodes.new("ShaderNodeNormalMap"); norm_map.location = (50, -80)
    nt.links.new(tex_col.outputs["Color"],   prin.inputs["Base Color"])
    nt.links.new(tex_norm.outputs["Color"],  norm_map.inputs["Color"])
    nt.links.new(norm_map.outputs["Normal"], prin.inputs["Normal"])
    nt.links.new(tex_met.outputs["Color"],   prin.inputs["Metallic"])
    nt.links.new(prin.outputs["BSDF"],       out.inputs["Surface"])
    return mat


def make_base_glass_material() -> bpy.types.Material:
    mat = bpy.data.materials.new("base_glass")
    mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    out  = nt.nodes.new("ShaderNodeOutputMaterial"); out.location  = (700, 0)
    prin = nt.nodes.new("ShaderNodeBsdfPrincipled"); prin.location = (400, 0)
    tex_col = _tex_node(nt, _load_tex(TEX_DIR / "Glass_color.jpg", True), (-350, 120))
    _set_input(prin, "Roughness",    0.04)
    _set_input(prin, "Transmission", 0.80)
    prin.inputs["Alpha"].default_value = 0.25
    mat.blend_method  = "BLEND"
    mat.shadow_method = "CLIP"
    nt.links.new(tex_col.outputs["Color"], prin.inputs["Base Color"])
    nt.links.new(prin.outputs["BSDF"],     out.inputs["Surface"])
    return mat


def make_base_lights_material() -> bpy.types.Material:
    mat = bpy.data.materials.new("base_lights")
    mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    out  = nt.nodes.new("ShaderNodeOutputMaterial"); out.location  = (700, 0)
    prin = nt.nodes.new("ShaderNodeBsdfPrincipled"); prin.location = (400, 0)
    emit = nt.nodes.new("ShaderNodeMixShader");      emit.location = (580, 0)
    glow = nt.nodes.new("ShaderNodeEmission");       glow.location = (400, -120)
    tex_col = _tex_node(nt, _load_tex(TEX_DIR / "lights_color.jpg", True), (-350, 120))
    _set_input(prin, "Roughness",          0.12)
    _set_input(prin, "Metallic",           0.15)
    glow.inputs["Strength"].default_value = 0.6
    emit.inputs["Fac"].default_value      = 0.20      # 20% emissive, 80% principled
    nt.links.new(tex_col.outputs["Color"], prin.inputs["Base Color"])
    nt.links.new(tex_col.outputs["Color"], glow.inputs["Color"])
    nt.links.new(prin.outputs["BSDF"],     emit.inputs[1])
    nt.links.new(glow.outputs["Emission"], emit.inputs[2])
    nt.links.new(emit.outputs["Shader"],   out.inputs["Surface"])
    return mat


# ── Procedural materials for variant models (no UV / no textures) ───

def _make_procedural(name, **kwargs) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    _principled_node(mat, **kwargs)
    return mat


def make_tire_mat() -> bpy.types.Material:
    return _make_procedural("tire",
        **{"Base Color": (0.04, 0.04, 0.04, 1), "Metallic": 0.0, "Roughness": 0.88})

def make_wheel_mat() -> bpy.types.Material:
    return _make_procedural("wheel_hub",
        **{"Base Color": (0.09, 0.10, 0.11, 1), "Metallic": 0.55, "Roughness": 0.50})

def make_glass_mat() -> bpy.types.Material:
    mat = _make_procedural("glass",
        **{"Base Color": (0.53, 0.67, 0.73, 1), "Roughness": 0.02, "Transmission": 0.80,
           "Specular": 0.5})
    mat.blend_method  = "BLEND"
    mat.shadow_method = "CLIP"
    # Set alpha after creation via node
    for node in mat.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            node.inputs["Alpha"].default_value = 0.25
    return mat

def make_undercarriage_mat() -> bpy.types.Material:
    return _make_procedural("undercarriage",
        **{"Base Color": (0.04, 0.04, 0.04, 1), "Metallic": 0.60, "Roughness": 0.70})

def make_bumper_mat() -> bpy.types.Material:
    return _make_procedural("bumper",
        **{"Base Color": (0.06, 0.07, 0.07, 1), "Metallic": 0.45, "Roughness": 0.75})

def make_interior_mat() -> bpy.types.Material:
    return _make_procedural("interior",
        **{"Base Color": (0.08, 0.06, 0.05, 1), "Metallic": 0.05, "Roughness": 0.85})


# ═══════════════════════════════════════════════════════════════════
#  12. MATERIAL ASSIGNMENT
# ═══════════════════════════════════════════════════════════════════

def assign_materials(
    mesh_objects: list,
    color_cfg: dict,
    is_base_model: bool,
) -> None:
    """
    Assign the correct material to each mesh object based on its name.

    Base model mesh names (HMMWV_Desert_OBJ.obj):
      HMMWV_Desert_Suspension, HMMWV_Desert_Wheels, HMMWV_Desert_Body,
      HMMWV_Desert_Lights, HMMWV_Desert_Glass_mirrors, HMMWV_Desert_Nameplates

    Variant mesh names (web_model.obj, set by segment_variants.py):
      body, tire, wheel_hub, undercarriage, bumper, window_glass
    """
    for obj in mesh_objects:
        if obj.type != "MESH":
            continue
        n = obj.name.lower()

        if is_base_model:
            # Use PBR texture maps for non-body parts; override body with paint
            if "body" in n or "nameplate" in n:
                mat = make_base_body_material(color_cfg)
            elif "wheel" in n or "rim" in n:
                mat = make_base_wheel_material()
            elif "suspension" in n or "shock" in n:
                mat = make_base_suspension_material()
            elif "glass" in n or "mirror" in n or "window" in n:
                mat = make_base_glass_material()
            elif "light" in n or "lamp" in n:
                mat = make_base_lights_material()
            else:
                mat = make_base_body_material(color_cfg)  # safe default
        else:
            # Variant models: fully procedural
            body_mat = make_body_material(color_cfg)
            if "tire" in n or "rubber" in n:
                mat = make_tire_mat()
            elif "wheel" in n or "hub" in n or "rim" in n:
                mat = make_wheel_mat()
            elif "glass" in n or "window" in n or "windshield" in n:
                mat = make_glass_mat()
            elif "undercarriage" in n or "chassis" in n:
                mat = make_undercarriage_mat()
            elif "bumper" in n:
                mat = make_bumper_mat()
            elif "interior" in n or "seat" in n or "cabin" in n:
                mat = make_interior_mat()
            else:
                mat = body_mat   # body or unknown → body paint

        obj.data.materials.clear()
        obj.data.materials.append(mat)


# ═══════════════════════════════════════════════════════════════════
#  13. MODEL IMPORT + CENTERING
# ═══════════════════════════════════════════════════════════════════

def import_obj(filepath: Path) -> list:
    """
    Import OBJ without automatic texture search (we set materials manually).
    Returns the list of mesh objects created.
    """
    bpy.ops.object.select_all(action="DESELECT")
    result = bpy.ops.import_scene.obj(
        filepath          = str(filepath),
        use_edges         = True,
        use_smooth_groups = True,
        use_split_objects = True,
        use_split_groups  = True,
        use_image_search  = False,    # ← critical: skip auto-texture lookup
        use_groups_as_vgroups = False,
        split_mode        = "ON",
    )
    if "FINISHED" not in result:
        raise RuntimeError(f"OBJ import returned {result} for {filepath}")

    meshes = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    log.info("    Imported %d meshes from '%s'", len(meshes), filepath.name)
    return meshes


def center_and_ground(meshes: list, target_size: float = 5.5) -> bpy.types.Object:
    """
    Creates a 'ModelRoot' empty, parents all meshes to it, and positions /
    scales the root so the model:
      • Is centred on the XY plane (X=0, Y=0)
      • Sits on Z=0 (ground plane)
      • Fits within target_size units in the longest dimension

    Returns the root empty so it can be deleted cleanly after rendering.
    """
    root      = bpy.data.objects.new("ModelRoot", None)
    root.empty_display_type = "ARROWS"
    bpy.context.scene.collection.objects.link(root)

    # Compute world bounding box before parenting changes transforms
    bpy.context.view_layer.update()
    all_verts = []
    for obj in meshes:
        mw = obj.matrix_world
        for corner in obj.bound_box:
            all_verts.append(mw @ mathutils.Vector(corner))

    if not all_verts:
        log.warning("    Bounding box empty — model may not have geometry")
        return root

    xs = [v.x for v in all_verts]; ys = [v.y for v in all_verts]; zs = [v.z for v in all_verts]
    cx   = (min(xs) + max(xs)) / 2
    cy   = (min(ys) + max(ys)) / 2
    min_z = min(zs)
    size  = max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))
    scale = target_size / size if size > 0.001 else 1.0

    root.scale    = (scale, scale, scale)
    root.location = (-cx * scale, -cy * scale, -min_z * scale)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.object.parent_set(type="OBJECT", keep_transform=True)

    log.info("    Model: %.2f units → scaled ×%.3f, grounded", size, scale)
    return root


def delete_model(root: bpy.types.Object) -> None:
    """Remove the model root and all its children from the scene."""
    to_delete = [root] + list(root.children_recursive)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in to_delete:
        obj.select_set(True)
    bpy.ops.object.delete(use_global=True)
    # Purge orphan meshes/materials left behind
    for col in (bpy.data.meshes, bpy.data.materials):
        for item in list(col):
            if item.users == 0:
                col.remove(item)


# ═══════════════════════════════════════════════════════════════════
#  14. FRAME RENDER
# ═══════════════════════════════════════════════════════════════════

def render_frame(
    scene,
    cam_obj,
    frame_idx: int,
    total_frames: int,
    start_angle_deg: float,
    out_path: Path,
    dry_run: bool = False,
) -> dict:
    """Position camera, render, save JPEG, return a log entry dict."""
    position_camera(cam_obj, frame_idx, total_frames, start_angle_deg)

    # Blender expects a string path; it appends nothing because file_format is JPEG
    scene.render.filepath = str(out_path)

    angle_deg = (start_angle_deg + frame_idx / total_frames * 360.0) % 360

    entry = {
        "frame":     frame_idx + 1,
        "angle_deg": round(angle_deg, 1),
        "path":      str(out_path),
        "ok":        False,
        "elapsed_s": 0.0,
    }

    if dry_run:
        log.info("    [DRY RUN] frame %02d  %.0f°  →  %s", frame_idx + 1, angle_deg, out_path.name)
        entry["ok"] = True
        return entry

    t0     = time.monotonic()
    result = bpy.ops.render.render(write_still=True)
    elapsed = round(time.monotonic() - t0, 2)
    ok     = "FINISHED" in result

    entry["ok"]        = ok
    entry["elapsed_s"] = elapsed

    if ok:
        log.info("    ✓ frame %02d  %.0f°  %s  (%.1fs)",
                 frame_idx + 1, angle_deg, out_path.name, elapsed)
    else:
        log.error("    ✗ frame %02d  FAILED: %s", frame_idx + 1, result)

    return entry


# ═══════════════════════════════════════════════════════════════════
#  15. MAIN RENDER LOOP
# ═══════════════════════════════════════════════════════════════════

def main() -> None:
    check_blender_version()
    args = parse_args()

    # Resolve output root
    output_root = Path(args.output_dir) if args.output_dir else PROJECT_ROOT / "images/viewer"

    # Filter variants and colors
    req_variants = (list(VARIANTS.keys()) if args.variants.upper() == "ALL"
                    else [v.strip() for v in args.variants.split(",")])
    req_colors   = (list(COLORS.keys())   if args.colors.upper()   == "ALL"
                    else [c.strip() for c in args.colors.split(",")])

    unknown_v = [v for v in req_variants if v not in VARIANTS]
    unknown_c = [c for c in req_colors   if c not in COLORS]
    for v in unknown_v: log.error("Unknown variant '%s' — skipping", v)
    for c in unknown_c: log.error("Unknown color '%s' — skipping", c)
    req_variants = [v for v in req_variants if v in VARIANTS]
    req_colors   = [c for c in req_colors   if c in COLORS]

    total_seqs   = len(req_variants) * len(req_colors)
    total_frames = total_seqs * args.frames

    log.info("═" * 58)
    log.info("  LuxHaus Motors — Orbit Sequence Renderer")
    log.info("  Engine  : %s  |  Samples : %s",
             args.engine, args.samples if args.engine == "CYCLES" else "EEVEE-64spp")
    log.info("  Res     : %s  |  JPEG Q%d", args.resolution, args.quality)
    log.info("  Orbit   : %d frames × %.1f° = 360°  (start %.1f°)",
             args.frames, 360 / args.frames, args.start_angle)
    log.info("  Schedule: %d variants × %d colors = %d sequences (%d frames)",
             len(req_variants), len(req_colors), total_seqs, total_frames)
    log.info("  Output  : %s", output_root)
    log.info("  Dry run : %s", args.dry_run)
    log.info("═" * 58)

    # ── One-time scene setup ──────────────────────────────────────
    clear_scene()
    scene = bpy.context.scene
    configure_render(scene, args)
    setup_world(scene)
    add_ground_plane(scene)
    setup_lighting(scene)
    cam_obj = create_camera(scene)

    run_start   = time.monotonic()
    seq_counter = 0
    ok_total    = 0
    err_total   = 0

    for variant_key in req_variants:
        obj_path      = Path(VARIANTS[variant_key])
        is_base_model = (obj_path == MODEL_BASE_OBJ)

        if not obj_path.exists():
            log.warning("▷ Skipping '%s' — OBJ not found: %s", variant_key, obj_path)
            render_log.append({
                "variant": variant_key, "status": "skipped",
                "reason": "OBJ file not found", "path": str(obj_path),
            })
            continue

        log.info("▶ Variant: %s  (%s)", variant_key, "base OBJ" if is_base_model else "variant OBJ")

        # Import model once — shared across all color passes
        try:
            meshes = import_obj(obj_path)
            root   = center_and_ground(meshes)
        except Exception as exc:
            log.error("  Import failed: %s", exc)
            render_log.append({"variant": variant_key, "status": "import_error", "error": str(exc)})
            continue

        for color_slug in req_colors:
            seq_counter += 1
            color_cfg    = COLORS[color_slug]

            log.info("  ▷ Color: %-10s  [seq %d / %d]",
                     color_slug, seq_counter, total_seqs)

            assign_materials(meshes, color_cfg, is_base_model)

            seq_dir = output_root / variant_key / color_slug
            seq_dir.mkdir(parents=True, exist_ok=True)

            seq_log  = []
            seq_ok   = True
            seq_t0   = time.monotonic()

            for fi in range(args.frames):
                out_path = seq_dir / f"frame-{fi + 1:02d}.jpg"
                entry    = render_frame(
                    scene, cam_obj, fi, args.frames,
                    args.start_angle, out_path, args.dry_run,
                )
                seq_log.append(entry)
                if entry["ok"]:
                    ok_total  += 1
                else:
                    err_total += 1
                    seq_ok     = False

            seq_elapsed = round(time.monotonic() - seq_t0, 1)
            log.info("  Sequence done in %.0fs  (%d frames, %s)",
                     seq_elapsed, args.frames, "OK" if seq_ok else "ERRORS")

            render_log.append({
                "variant":     variant_key,
                "color":       color_slug,
                "is_base_obj": is_base_model,
                "status":      "complete" if seq_ok else "partial",
                "frames":      seq_log,
                "elapsed_s":   seq_elapsed,
                "output_dir":  str(seq_dir),
            })

        # Remove model before loading next variant to free memory
        delete_model(root)
        log.info("  Variant '%s' complete.", variant_key)

    # ── Write JSON log ────────────────────────────────────────────
    total_elapsed = round(time.monotonic() - run_start, 1)
    log_path      = PROJECT_ROOT / "render_log.json"

    summary = {
        "timestamp":        datetime.now(timezone.utc).isoformat(),
        "blender_version":  ".".join(str(x) for x in bpy.app.version),
        "engine":           args.engine,
        "samples":          args.samples,
        "resolution":       args.resolution,
        "jpeg_quality":     args.quality,
        "frames_per_seq":   args.frames,
        "degree_per_frame": round(360 / args.frames, 2),
        "start_angle_deg":  args.start_angle,
        "dry_run":          args.dry_run,
        "variants":         req_variants,
        "colors":           req_colors,
        "sequences_total":  seq_counter,
        "frames_ok":        ok_total,
        "frames_error":     err_total,
        "elapsed_s":        total_elapsed,
        "elapsed_min":      round(total_elapsed / 60, 1),
        "output_root":      str(output_root),
        "sequences":        render_log,
    }

    with open(log_path, "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2, default=str)

    # ── Final summary ─────────────────────────────────────────────
    log.info("═" * 58)
    log.info("  COMPLETE")
    log.info("  Frames : %d ok  /  %d errors  /  %d total",
             ok_total, err_total, ok_total + err_total)
    log.info("  Time   : %.0fs  (%.1f min)", total_elapsed, total_elapsed / 60)
    log.info("  Log    : %s", log_path)
    if err_total:
        log.warning("  %d frame(s) failed — check render_log.json for details", err_total)
    log.info("═" * 58)


# ═══════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    main()
