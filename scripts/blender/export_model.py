import argparse
from pathlib import Path

import bpy


def parse_args():
    parser = argparse.ArgumentParser(description="Export a repaired model to a Blender-supported mesh format.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--format", required=True)
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


def export_ply(path):
    try:
        bpy.ops.wm.ply_export(filepath=path)
    except Exception:
        bpy.ops.export_mesh.ply(filepath=path)


def export_stl(path):
    try:
        bpy.ops.wm.stl_export(filepath=path)
    except Exception:
        bpy.ops.export_mesh.stl(filepath=path)


def export_dxf(path):
    try:
        bpy.ops.preferences.addon_enable(module="io_export_dxf")
        bpy.ops.export.dxf(filepath=path)
    except Exception as exc:
        raise RuntimeError("Blender DXF exporter unavailable; configure FreeCAD for DXF export") from exc


def main():
    args = parse_args()
    output_format = args.format.lower()
    clear_scene()
    import_stl(args.input)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)

    if output_format == "ply":
        export_ply(args.output)
    elif output_format == "stl":
        export_stl(args.output)
    elif output_format == "dxf":
        export_dxf(args.output)
    else:
        raise ValueError(f"Unsupported Blender export format: {output_format}")


if __name__ == "__main__":
    main()
