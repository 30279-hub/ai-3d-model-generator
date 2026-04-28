import fs from "node:fs/promises";
import { Router } from "express";
import { SUPPORTED_FORMATS, prepareExport } from "../services/exportService.js";
import { getJobManifest } from "../services/jobStore.js";
import { HttpError } from "../utils/httpError.js";

export const jobsRouter = Router();

jobsRouter.get("/formats", (_req, res) => {
  res.json({ formats: SUPPORTED_FORMATS });
});

jobsRouter.get("/:jobId", async (req, res, next) => {
  try {
    res.json({ job: await getJobManifest(req.params.jobId) });
  } catch (error) {
    next(error);
  }
});

jobsRouter.get("/:jobId/preview", async (req, res, next) => {
  try {
    const job = await getJobManifest(req.params.jobId);
    if (job.status !== "ready") {
      throw new HttpError(409, `Preview is not ready. Current status: ${job.status}`);
    }

    const previewPath = job.files?.preview;
    if (!previewPath) throw new HttpError(404, "Preview file missing");

    await fs.access(previewPath);
    res.type("model/gltf-binary").sendFile(previewPath);
  } catch (error) {
    next(error);
  }
});

jobsRouter.get("/:jobId/exports/:format", async (req, res, next) => {
  try {
    const { filePath, definition, format } = await prepareExport(
      req.params.jobId,
      req.params.format
    );
    res.download(filePath, `model.${definition.extension}`, {
      headers: {
        "Content-Type": definition.mime,
        "X-Export-Format": format
      }
    });
  } catch (error) {
    next(error);
  }
});
