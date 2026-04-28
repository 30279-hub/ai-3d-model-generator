import argparse
from pathlib import Path

import FreeCAD
import Import
import Mesh
import Part


def parse_args():
    parser = argparse.ArgumentParser(description="Convert a repaired mesh into CAD exchange formats using FreeCAD.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--format", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    output_format = args.format.lower()
    if output_format == "igs":
        output_format = "iges"

    doc = FreeCAD.newDocument("mesh_conversion")
    mesh = Mesh.Mesh(args.input)
    shape = Part.Shape()
    shape.makeShapeFromMesh(mesh.Topology, 0.1)
    solid = Part.makeSolid(shape.removeSplitter())

    part = doc.addObject("Part::Feature", "ConvertedModel")
    part.Shape = solid
    doc.recompute()

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)

    if output_format in {"step", "iges", "igs"}:
        Import.export([part], args.output)
    elif output_format == "dxf":
        Import.export([part], args.output)
    else:
        raise ValueError(f"Unsupported FreeCAD export format: {args.format}")

    FreeCAD.closeDocument(doc.Name)


if __name__ == "__main__":
    main()
