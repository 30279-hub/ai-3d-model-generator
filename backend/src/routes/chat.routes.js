import { Router } from "express";
import { z } from "zod";
import { processConversationTurn } from "../ai/conversationManager.js";
import { startGenerationJob } from "../services/modelGenerationService.js";
import { createSession, getSession, saveSession } from "../services/sessionStore.js";
import { HttpError } from "../utils/httpError.js";

export const chatRouter = Router();

const chatRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(4000)
});

chatRouter.post("/", async (req, res, next) => {
  try {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.message);

    const { sessionId, message } = parsed.data;
    const session = sessionId ? await getSession(sessionId) : await createSession();
    const now = new Date().toISOString();

    session.messages.push({
      role: "user",
      content: message,
      createdAt: now
    });

    const outcome = await processConversationTurn(session, message);
    let job = null;
    let assistantMessage = outcome.assistantMessage;

    if (outcome.action?.type === "generate") {
      job = await startGenerationJob(session.id, outcome.action.requirements);
      session.lastJobId = job.id;
      assistantMessage += `\n\nGeneration job started: ${job.id}. The preview will appear when the mesh repair stage finishes.`;
    }

    session.messages.push({
      role: "assistant",
      content: assistantMessage,
      jobId: job?.id || null,
      createdAt: new Date().toISOString()
    });

    await saveSession(session);

    res.json({
      assistant: {
        role: "assistant",
        content: assistantMessage,
        jobId: job?.id || null
      },
      session,
      job
    });
  } catch (error) {
    next(error);
  }
});
