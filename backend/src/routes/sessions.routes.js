import { Router } from "express";
import {
  createSession,
  deleteSession,
  getSession,
  listSessions
} from "../services/sessionStore.js";

export const sessionsRouter = Router();

sessionsRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ sessions: await listSessions() });
  } catch (error) {
    next(error);
  }
});

sessionsRouter.post("/", async (req, res, next) => {
  try {
    const session = await createSession({ title: req.body?.title });
    res.status(201).json({ session });
  } catch (error) {
    next(error);
  }
});

sessionsRouter.get("/:sessionId", async (req, res, next) => {
  try {
    res.json({ session: await getSession(req.params.sessionId) });
  } catch (error) {
    next(error);
  }
});

sessionsRouter.delete("/:sessionId", async (req, res, next) => {
  try {
    await deleteSession(req.params.sessionId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
