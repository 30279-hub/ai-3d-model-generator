import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { config, projectRoot } from "./config.js";
import { chatRouter } from "./routes/chat.routes.js";
import { jobsRouter } from "./routes/jobs.routes.js";
import { sessionsRouter } from "./routes/sessions.routes.js";

export const app = express();

app.use(cors({ origin: config.frontendOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "ai-3d-model-generator" });
});

app.use("/api/sessions", sessionsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/jobs", jobsRouter);

const frontendDist = path.join(projectRoot, "frontend", "dist");
if (config.serveFrontend && existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.use((err, _req, res, _next) => {
  const status = err.statusCode || err.status || 500;
  const payload = {
    error: err.publicMessage || err.message || "Unexpected server error"
  };

  if (process.env.NODE_ENV !== "production" && err.stack) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
});
