import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { HttpError } from "../utils/httpError.js";
import { assertSafeId, newId } from "../utils/ids.js";

const INITIAL_ASSISTANT_MESSAGE =
  "Hi. Tell me what you want to model, and I will collect the dimensions, shape, use case, material, detail level, and constraints before anything is generated.";

export function createEmptyRequirements() {
  return {
    dimensions: null,
    shapeType: null,
    useCase: null,
    material: null,
    detailLevel: null,
    constraints: null,
    finish: null,
    tolerance: null,
    notes: []
  };
}

function sessionPath(sessionId) {
  assertSafeId(sessionId, "session id");
  return path.join(config.sessionsDir, `${sessionId}.json`);
}

export async function createSession(input = {}) {
  const now = new Date().toISOString();
  const session = {
    id: newId("ses"),
    title: input.title || "Untitled 3D model",
    requirements: createEmptyRequirements(),
    awaitingConfirmation: false,
    lastJobId: null,
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        role: "assistant",
        content: INITIAL_ASSISTANT_MESSAGE,
        createdAt: now
      }
    ]
  };

  await saveSession(session);
  return session;
}

export async function getSession(sessionId) {
  try {
    const raw = await fs.readFile(sessionPath(sessionId), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new HttpError(404, "Session not found");
    }
    throw error;
  }
}

export async function saveSession(session) {
  session.updatedAt = new Date().toISOString();
  await fs.writeFile(sessionPath(session.id), JSON.stringify(session, null, 2));
  return session;
}

export async function listSessions() {
  const entries = await fs.readdir(config.sessionsDir, { withFileTypes: true });
  const sessions = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(config.sessionsDir, entry.name), "utf8");
      const session = JSON.parse(raw);
      sessions.push({
        id: session.id,
        title: session.title,
        updatedAt: session.updatedAt,
        createdAt: session.createdAt,
        lastJobId: session.lastJobId
      });
    } catch {
      // Ignore malformed session files instead of breaking the whole sidebar.
    }
  }

  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteSession(sessionId) {
  try {
    await fs.unlink(sessionPath(sessionId));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
