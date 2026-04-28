import fs from "node:fs/promises";
import path from "node:path";
import { config, projectRoot } from "../config.js";
import { newId } from "../utils/ids.js";
import { runCommand } from "../utils/runCommand.js";
import { jobDir, saveJobManifest } from "./jobStore.js";

const blenderScriptsDir = path.join(projectRoot, "scripts", "blender");

export async function startGenerationJob(sessionId, requirements) {
  const now = new Date().toISOString();
  const job = {
    id: newId("job"),
    sessionId,
    status: "queued",
    stage: "queued",
    requirements,
    createdAt: now,
    updatedAt: now,
    files: {},
    error: null
  };

  await saveJobManifest(job);
  runGenerationPipeline(job).catch((error) => {
    console.error("Generation pipeline failed", error);
  });

  return job;
}

async function runGenerationPipeline(job) {
  const dir = jobDir(job.id);
  await fs.mkdir(dir, { recursive: true });

  const requirementsPath = path.join(dir, "requirements.json");
  const rawStlPath = path.join(dir, "raw.stl");
  const blendPath = path.join(dir, "model.blend");
  const rawPreviewPath = path.join(dir, "preview_raw.glb");
  const repairedStlPath = path.join(dir, "model.stl");
  const previewPath = path.join(dir, "preview.glb");
  const generationMetadataPath = path.join(dir, "generation_metadata.json");
  const repairMetadataPath = path.join(dir, "repair_metadata.json");

  try {
    await fs.writeFile(requirementsPath, JSON.stringify(job.requirements, null, 2));
    await updateJob(job, { status: "running", stage: "generating" });

    await runBlenderScript("generate_model.py", [
      "--input",
      requirementsPath,
      "--blend",
      blendPath,
      "--stl",
      rawStlPath,
      "--preview",
      rawPreviewPath,
      "--metadata",
      generationMetadataPath
    ]);

    await updateJob(job, {
      stage: "repairing",
      files: {
        ...job.files,
        rawStl: rawStlPath,
        blend: blendPath,
        rawPreview: rawPreviewPath,
        generationMetadata: generationMetadataPath
      }
    });

    await runBlenderScript("repair_mesh.py", [
      "--input",
      rawStlPath,
      "--output",
      repairedStlPath,
      "--preview",
      previewPath,
      "--metadata",
      repairMetadataPath
    ]);

    await updateJob(job, {
      status: "ready",
      stage: "ready",
      files: {
        ...job.files,
        stl: repairedStlPath,
        preview: previewPath,
        repairMetadata: repairMetadataPath
      }
    });
  } catch (error) {
    await updateJob(job, {
      status: "failed",
      stage: "failed",
      error: error.message
    });
  }
}

async function updateJob(job, patch) {
  Object.assign(job, patch);
  if (patch.files) job.files = patch.files;
  return saveJobManifest(job);
}

export async function runBlenderScript(scriptName, scriptArgs) {
  const scriptPath = path.join(blenderScriptsDir, scriptName);
  return runCommand(config.blenderBin, [
    "--background",
    "--factory-startup",
    "--python",
    scriptPath,
    "--",
    ...scriptArgs
  ]);
}
