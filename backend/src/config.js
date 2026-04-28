import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const backendRoot = path.resolve(__dirname, "..");
export const projectRoot = path.resolve(backendRoot, "..");

const storageRoot = process.env.STORAGE_ROOT
  ? path.resolve(process.env.STORAGE_ROOT)
  : path.join(backendRoot, "storage");

export const config = {
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  serveFrontend: process.env.SERVE_FRONTEND === "true" || process.env.NODE_ENV === "production",
  storageRoot,
  sessionsDir: path.join(storageRoot, "sessions"),
  jobsDir: path.join(storageRoot, "jobs"),
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash"
  },
  blenderBin: process.env.BLENDER_BIN || "blender",
  assimpBin: process.env.ASSIMP_BIN || "assimp",
  freecadCmd: process.env.FREECAD_CMD || "FreeCADCmd",
  converterTemplates: {
    x_t: process.env.PARASOLID_CONVERTER_CMD || "",
    sldprt: process.env.SOLIDWORKS_CONVERTER_CMD || "",
    dwg: process.env.DWG_CONVERTER_CMD || ""
  }
};

export async function ensureStorageDirs() {
  await fs.mkdir(config.sessionsDir, { recursive: true });
  await fs.mkdir(config.jobsDir, { recursive: true });
}
