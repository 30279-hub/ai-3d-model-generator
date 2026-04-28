import argparse
import json
import math
from pathlib import Path

import bpy


def parse_args():
    parser = argparse.ArgumentParser(description="Generate a parametric model from JSON requirements.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--blend", required=True)
    parser.add_argument("--stl", required=True)
    parser.add_argument("--preview", required=True)
    parser.add_argument("--metadata", required=True)
    return parser.parse_args(args_after_double_dash())


def args_after_double_dash():
    import sys

    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.length_unit = "MILLIMETERS"


def read_requirements(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def get_dimensions(requirements):
    dimensions = requirements.get("dimensions") or {}
    unit = dimensions.get("unit") or "mm"
    scale = {"mm": 1.0, "cm": 10.0, "m": 1000.0, "in": 25.4}.get(unit, 1.0)

    length = float(dimensions.get("length") or dimensions.get("diameter") or 60) * scale
    width = float(dimensions.get("width") or dimensions.get("diameter") or length) * scale
    height = float(dimensions.get("height") or max(min(length, width) * 0.5, 10)) * scale
    diameter = float(dimensions.get("diameter") or min(length, width)) * scale
    radius = float(dimensions.get("radius") or diameter / 2.0) * scale

    return {
        "length": max(length, 1.0),
        "width": max(width, 1.0),
        "height": max(height, 1.0),
        "diameter": max(diameter, 1.0),
        "radius": max(radius, 0.5),
        "unit": "mm"
    }


def create_material(name):
    material = bpy.data.materials.new(name="Generated material")
    material.use_nodes = True
    color = material_color(name or "")
    material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = color
    material.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.48
    return material


def material_color(name):
    lower = name.lower()
    if "steel" in lower:
        return (0.62, 0.64, 0.66, 1.0)
    if "aluminum" in lower or "aluminium" in lower:
        return (0.78, 0.80, 0.82, 1.0)
    if "brass" in lower:
        return (0.92, 0.68, 0.28, 1.0)
    if "wood" in lower:
        return (0.55, 0.35, 0.19, 1.0)
    if "concrete" in lower:
        return (0.50, 0.50, 0.47, 1.0)
    if "resin" in lower:
        return (0.33, 0.62, 0.90, 0.85)
    if "pla" in lower or "petg" in lower or "abs" in lower:
        return (0.08, 0.48, 0.58, 1.0)
    return (0.74, 0.74, 0.70, 1.0)


def apply_finish(obj, detail_level, finish):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    if detail_level in {"medium", "high"} or finish in {"smooth", "polished"}:
        try:
            bpy.ops.object.shade_smooth()
        except Exception:
            pass

    if detail_level == "high" or finish == "smooth":
        bevel = obj.modifiers.new("manufacturing_edge_softening", "BEVEL")
        bevel.width = 1.5
        bevel.segments = 4
        bevel.affect = "EDGES"
        normal = obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
        normal.keep_sharp = True


def create_box(dimensions):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name = "parametric_box"
    obj.dimensions = (dimensions["length"], dimensions["width"], dimensions["height"])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def create_cylinder(dimensions, vertices):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=dimensions["diameter"] / 2,
        depth=dimensions["height"]
    )
    obj = bpy.context.object
    obj.name = "parametric_cylinder"
    return obj


def create_sphere(dimensions, segments):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=max(12, segments // 2),
        radius=dimensions["radius"]
    )
    obj = bpy.context.object
    obj.name = "parametric_sphere"
    return obj


def create_cone(dimensions, vertices):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=dimensions["diameter"] / 2,
        radius2=max(dimensions["diameter"] * 0.08, 1.0),
        depth=dimensions["height"]
    )
    obj = bpy.context.object
    obj.name = "parametric_cone"
    return obj


def create_torus(dimensions, segments):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=segments,
        minor_segments=max(8, segments // 4),
        major_radius=dimensions["diameter"] * 0.35,
        minor_radius=dimensions["diameter"] * 0.08
    )
    obj = bpy.context.object
    obj.name = "parametric_torus"
    return obj


def create_plate_with_holes(dimensions, material):
    base = create_box(dimensions)
    base.name = "parametric_plate"
    hole_radius = max(min(dimensions["length"], dimensions["width"]) * 0.08, 2.0)
    inset_x = dimensions["length"] * 0.32
    inset_y = dimensions["width"] * 0.32

    cutters = []
    for x in (-inset_x, inset_x):
        for y in (-inset_y, inset_y):
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=48,
                radius=hole_radius,
                depth=dimensions["height"] * 3,
                location=(x, y, 0)
            )
            cutter = bpy.context.object
            cutter.name = "mounting_hole_cutter"
            cutters.append(cutter)

    bpy.context.view_layer.objects.active = base
    for cutter in cutters:
        modifier = base.modifiers.new(f"hole_{len(base.modifiers)}", "BOOLEAN")
        modifier.operation = "DIFFERENCE"
        modifier.object = cutter
        bpy.context.view_layer.objects.active = base
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.data.objects.remove(cutter, do_unlink=True)

    base.data.materials.append(material)
    return base


def create_gear(dimensions, material):
    base = create_cylinder(dimensions, 96)
    base.name = "parametric_gear_body"
    tooth_count = 16
    tooth_length = dimensions["diameter"] * 0.12
    tooth_width = dimensions["diameter"] * 0.10

    for index in range(tooth_count):
        angle = (math.tau / tooth_count) * index
        radius = dimensions["diameter"] / 2 + tooth_length / 2
        x = math.cos(angle) * radius
        y = math.sin(angle) * radius
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0))
        tooth = bpy.context.object
        tooth.name = "gear_tooth"
        tooth.dimensions = (tooth_length, tooth_width, dimensions["height"])
        tooth.rotation_euler[2] = angle
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        modifier = base.modifiers.new(f"tooth_union_{index}", "BOOLEAN")
        modifier.operation = "UNION"
        modifier.object = tooth
        bpy.context.view_layer.objects.active = base
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.data.objects.remove(tooth, do_unlink=True)

    inner = dimensions["diameter"] * 0.16
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=inner, depth=dimensions["height"] * 3)
    cutter = bpy.context.object
    modifier = base.modifiers.new("center_bore", "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.object = cutter
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    base.data.materials.append(material)
    return base


def create_building(dimensions, material):
    body = create_box(dimensions)
    body.name = "architectural_mass"
    body.data.materials.append(material)

    roof_height = max(dimensions["height"] * 0.22, 4.0)
    bpy.ops.mesh.primitive_cone_add(
        vertices=4,
        radius1=max(dimensions["length"], dimensions["width"]) * 0.72,
        radius2=0,
        depth=roof_height,
        location=(0, 0, dimensions["height"] / 2 + roof_height / 2)
    )
    roof = bpy.context.object
    roof.name = "architectural_roof"
    roof.rotation_euler[2] = math.radians(45)
    roof.data.materials.append(material)
    return join_objects([body, roof], "architectural_model")


def join_objects(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = name
    return joined


def build_model(requirements):
    dimensions = get_dimensions(requirements)
    detail_level = requirements.get("detailLevel") or "medium"
    finish = requirements.get("finish") or ""
    shape = (requirements.get("shapeType") or "box").lower()
    material = create_material(requirements.get("material") or "")
    vertices = 32 if detail_level == "low" else 64 if detail_level == "medium" else 128

    if shape in {"cylinder", "flange"}:
        obj = create_cylinder(dimensions, vertices)
        obj.data.materials.append(material)
    elif shape == "sphere":
        obj = create_sphere(dimensions, vertices)
        obj.data.materials.append(material)
    elif shape == "cone":
        obj = create_cone(dimensions, vertices)
        obj.data.materials.append(material)
    elif shape == "torus":
        obj = create_torus(dimensions, vertices)
        obj.data.materials.append(material)
    elif shape == "gear":
        obj = create_gear(dimensions, material)
    elif shape in {"plate", "bracket"}:
        obj = create_plate_with_holes(dimensions, material)
    elif shape in {"building", "arch"}:
        obj = create_building(dimensions, material)
    else:
        obj = create_box(dimensions)
        obj.data.materials.append(material)

    obj.location = (0, 0, dimensions["height"] / 2)
    apply_finish(obj, detail_level, finish)
    return obj


def add_lighting_and_camera(obj):
    bpy.ops.object.light_add(type="AREA", location=(120, -120, 180))
    light = bpy.context.object
    light.name = "preview_key_light"
    light.data.energy = 450
    light.data.size = 120

    max_dim = max(obj.dimensions.x, obj.dimensions.y, obj.dimensions.z, 1)
    bpy.ops.object.camera_add(location=(max_dim * 1.6, -max_dim * 1.8, max_dim * 1.2), rotation=(math.radians(60), 0, math.radians(42)))
    bpy.context.scene.camera = bpy.context.object


def export_stl(path):
    try:
        bpy.ops.wm.stl_export(filepath=path)
    except Exception:
        bpy.ops.export_mesh.stl(filepath=path)


def export_glb(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB")


def main():
    args = parse_args()
    clear_scene()
    requirements = read_requirements(args.input)
    obj = build_model(requirements)
    add_lighting_and_camera(obj)

    Path(args.blend).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=args.blend)
    export_stl(args.stl)
    export_glb(args.preview)

    metadata = {
        "object": obj.name,
        "dimensions_mm": {
            "x": obj.dimensions.x,
            "y": obj.dimensions.y,
            "z": obj.dimensions.z
        },
        "vertices": len(obj.data.vertices),
        "polygons": len(obj.data.polygons)
    }
    with open(args.metadata, "w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)


if __name__ == "__main__":
    main()
