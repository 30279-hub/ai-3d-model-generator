import fs from "node:fs/promises";
import path from "node:path";
import { config, projectRoot } from "../config.js";
import { HttpError } from "../utils/httpError.js";
import { runCommand } from "../utils/runCommand.js";
import { getJobManifest, jobDir } from "./jobStore.js";
import { runBlenderScript } from "./modelGenerationService.js";

export const SUPPORTED_FORMATS = {
  stl: {
    extension: "stl",
    mime: "model/stl",
    label: "STL mesh",
    adapter: "copy"
  },
  "3mf": {
    extension: "3mf",
    mime: "model/3mf",
    label: "3MF mesh",
    adapter: "assimp"
  },
  ply: {
    extension: "ply",
    mime: "application/octet-stream",
    label: "PLY mesh",
    adapter: "blender"
  },
  amf: {
    extension: "amf",
    mime: "application/octet-stream",
    label: "AMF mesh",
    adapter: "assimp"
  },
  step: {
    extension: "step",
    mime: "application/step",
    label: "STEP CAD",
    adapter: "freecad"
  },
  igs: {
    extension: "igs",
    mime: "model/iges",
    label: "IGES CAD",
    adapter: "freecad"
  },
  x_t: {
    extension: "x_t",
    mime: "application/octet-stream",
    label: "Parasolid",
    adapter: "external"
  },
  sldprt: {
    extension: "sldprt",
    mime: "application/octet-stream",
    label: "SolidWorks Part",
    adapter: "external"
  },
  dwg: {
    extension: "dwg",
    mime: "application/acad",
    label: "AutoCAD DWG",
    adapter: "external"
  },
  dxf: {
    extension: "dxf",
    mime: "image/vnd.dxf",
    label: "AutoCAD DXF",
    adapter: "freecad"
  }
};

export async function prepareExport(jobId, requestedFormat) {
  const format = normalizeFormat(requestedFormat);
  const definition = SUPPORTED_FORMATS[format];
  if (!definition) throw new HttpError(400, `Unsupported export format: ${requestedFormat}`);

  const job = await getJobManifest(jobId);
  if (job.status !== "ready") {
    throw new HttpError(409, `Job is not ready for export. Current status: ${job.status}`);
  }

  const dir = jobDir(job.id);
  const exportsDir = path.join(dir, "exports");
  await fs.mkdir(exportsDir, { recursive: true });

  const source = job.files?.stl;
  if (!source) throw new HttpError(500, "Repaired STL file missing from job manifest");

  const outputPath = path.join(exportsDir, `model.${definition.extension}`);
  if (await fileExists(outputPath)) {
    return { filePath: outputPath, definition, format };
  }

  if (definition.adapter === "copy") {
    await fs.copyFile(source, outputPath);
  } else if (definition.adapter === "blender") {
    await runBlenderScript("export_model.py", [
      "--input",
      source,
      "--output",
      outputPath,
      "--format",
      format
    ]);
  } else if (definition.adapter === "assimp") {
    await runAssimpExport(source, outputPath);
  } else if (definition.adapter === "freecad") {
    await runFreeCadExport(source, outputPath, format);
  } else if (definition.adapter === "external") {
    await runExternalExport(source, outputPath, format, dir);
  }

  return { filePath: outputPath, definition, format };
}

function normalizeFormat(format) {
  const lower = String(format || "").toLowerCase().replace(/^\./, "");
  if (lower === "iges") return "igs";
  return lower;
}

async function runAssimpExport(input, output) {
  try {
    await runCommand(config.assimpBin, ["export", input, output]);
  } catch (error) {
    throw new HttpError(
      501,
      `Assimp conversion failed: ${error.message}`,
      "Assimp is required for this mesh export format. Install Assimp or configure ASSIMP_BIN."
    );
  }
}

async function runFreeCadExport(input, output, format) {
  const scriptPath = path.join(projectRoot, "scripts", "freecad", "convert_mesh.py");
  try {
    await runCommand(config.freecadCmd, [
      scriptPath,
      "--input",
      input,
      "--output",
      output,
      "--format",
      format
    ]);
  } catch (error) {
    throw new HttpError(
      501,
      `FreeCAD conversion failed: ${error.message}`,
      "FreeCAD is required for STEP, IGES, and DXF conversion from mesh output. Install FreeCAD or configure FREECAD_CMD."
    );
  }
}

async function runExternalExport(input, output, format, dir) {
  const template = config.converterTemplates[format];
  if (!template) {
    throw new HttpError(
      501,
      `No external converter configured for ${format}`,
      `${format.toUpperCase()} export requires a licensed/vendor converter. Configure the matching converter command in .env.`
    );
  }

  const commandLine = fillCommandTemplate(template, { input, output, format, jobDir: dir });
  await runCommandWithShell(commandLine);
}

function fillCommandTemplate(template, replacements) {
  return Object.entries(replacements).reduce(
    (command, [key, value]) => command.replaceAll(`{${key}}`, quoteForShell(value)),
    template
  );
}

function quoteForShell(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

function runCommandWithShell(commandLine) {
  return new Promise((resolve, reject) => {
    import("node:child_process").then(({ exec }) => {
      exec(commandLine, { windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
