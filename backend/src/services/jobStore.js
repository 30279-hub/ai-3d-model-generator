import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { HttpError } from "../utils/httpError.js";
import { assertSafeId } from "../utils/ids.js";

export function jobDir(jobId) {
  assertSafeId(jobId, "job id");
  return path.join(config.jobsDir, jobId);
}

export function manifestPath(jobId) {
  return path.join(jobDir(jobId), "manifest.json");
}

export async function saveJobManifest(job) {
  await fs.mkdir(jobDir(job.id), { recursive: true });
  job.updatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath(job.id), JSON.stringify(job, null, 2));
  return job;
}

export async function getJobManifest(jobId) {
  try {
    const raw = await fs.readFile(manifestPath(jobId), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") throw new HttpError(404, "Job not found");
    throw error;
  }
}
