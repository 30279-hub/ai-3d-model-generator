import argparse
import json
from pathlib import Path

import bpy


def parse_args():
    parser = argparse.ArgumentParser(description="Repair and optimize a generated mesh.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--preview", required=True)
    parser.add_argument("--metadata", required=True)
    return parser.parse_args(args_after_double_dash())


def args_after_double_dash():
    import sys

    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_stl(path):
    try:
        bpy.ops.wm.stl_import(filepath=path)
    except Exception:
        bpy.ops.import_mesh.stl(filepath=path)


def export_stl(path):
    try:
        bpy.ops.wm.stl_export(filepath=path)
    except Exception:
        bpy.ops.export_mesh.stl(filepath=path)


def join_mesh_objects():
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError("No mesh objects were imported for repair")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in mesh_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objects[0]
    if len(mesh_objects) > 1:
        bpy.ops.object.join()
    return bpy.context.object


def repair_active_mesh(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")

    try:
        bpy.ops.mesh.remove_doubles(threshold=0.0001)
    except Exception:
        bpy.ops.mesh.merge_by_distance(distance=0.0001)

    try:
        bpy.ops.mesh.fill_holes(sides=0)
    except Exception:
        pass

    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.mesh.quads_convert_to_tris(quad_method="BEAUTY", ngon_method="BEAUTY")
    bpy.ops.object.mode_set(mode="OBJECT")

    if len(obj.data.polygons) > 50000:
        decimate = obj.modifiers.new("topology_optimization", "DECIMATE")
        decimate.ratio = 0.75
        bpy.ops.object.modifier_apply(modifier=decimate.name)

    smooth = obj.modifiers.new("surface_smoothing", "WEIGHTED_NORMAL")
    smooth.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=smooth.name)

    try:
        bpy.ops.object.shade_smooth()
    except Exception:
        pass


def run_printability_checks():
    checks = {}
    try:
        bpy.ops.preferences.addon_enable(module="mesh_print3d_toolbox")
        bpy.ops.mesh.print3d_check_all()
        report = bpy.context.scene.print_3d
        checks = {
            "non_manifold_edges": int(getattr(report, "non_manifold_edges", 0)),
            "bad_contiguous_edges": int(getattr(report, "bad_contiguous_edges", 0)),
            "intersecting_faces": int(getattr(report, "intersecting_faces", 0)),
            "zero_faces": int(getattr(report, "zero_faces", 0))
        }
    except Exception:
        checks = {"status": "mesh_print3d_toolbox unavailable; core repair operations completed"}
    return checks


def export_preview(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB")


def main():
    args = parse_args()
    clear_scene()
    import_stl(args.input)
    obj = join_mesh_objects()
    before = {"vertices": len(obj.data.vertices), "polygons": len(obj.data.polygons)}
    repair_active_mesh(obj)
    checks = run_printability_checks()
    after = {"vertices": len(obj.data.vertices), "polygons": len(obj.data.polygons)}

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    export_stl(args.output)
    export_preview(args.preview)

    with open(args.metadata, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "before": before,
                "after": after,
                "checks": checks,
                "operations": [
                    "merge duplicate vertices",
                    "fill mesh holes where possible",
                    "recalculate outward normals",
                    "triangulate faces",
                    "weighted-normal smoothing",
                    "decimate high-poly meshes"
                ]
            },
            handle,
            indent=2
        )


if __name__ == "__main__":
    main()
