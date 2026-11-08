import { Request, Response } from "express";
import { z } from "zod";
import { NutritionConfig } from "../config.js";
import { HttpError } from "../errors/httpError.js";
import { AiNutritionService, coachSystemPrompt } from "../services/aiNutritionService.js";

const coachInputSchema = z
  .object({
    question: z.string().trim().min(1).max(1000),
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().min(1).max(1000),
          })
          .strict(),
      )
      .max(8)
      .default([]),
  })
  .strict();

export class CoachController {
  constructor(
    private readonly aiService: AiNutritionService,
    private readonly config: NutritionConfig,
  ) {}

  chat = async (req: Request, res: Response): Promise<void> => {
    const parsed = coachInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_COACH_MESSAGE", message: z.prettifyError(parsed.error) },
      });
      return;
    }

    const reply = await this.aiService.chatCoach(parsed.data.question, parsed.data.history);
    res.status(200).json({
      success: true,
      data: {
        reply,
        provider: "Ollama (local)",
        model: this.config.OLLAMA_MODEL,
      },
    });
  };

  stream = async (req: Request, res: Response): Promise<void> => {
    const parsed = coachInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_COACH_MESSAGE", message: z.prettifyError(parsed.error) },
      });
      return;
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 90000);
    const cancelOnClose = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.once("close", cancelOnClose);

    try {
      let response: any;
      try {
        response = await fetch(`${this.config.OLLAMA_BASE_URL}/api/chat`, {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: this.config.OLLAMA_MODEL,
            stream: true,
            messages: [
              {
                role: "system",
                content: coachSystemPrompt,
              },
              ...parsed.data.history,
              { role: "user", content: parsed.data.question },
            ],
            options: { temperature: 0.4, num_predict: 300 },
          }),
        });
      } catch {
        if (res.destroyed) return;
        throw new HttpError(
          timedOut ? 504 : 502,
          timedOut ? "AI_PROVIDER_TIMEOUT" : "AI_PROVIDER_UNAVAILABLE",
          timedOut
            ? "The AI coach took too long to respond. Please try again."
            : "The local AI model could not be reached. Check that Ollama is running.",
        );
      }

      if (!response.ok) {
        if (response.status === 404) {
          throw new HttpError(
            503,
            "AI_MODEL_NOT_FOUND",
            `Local model ${this.config.OLLAMA_MODEL} is not available. Pull it with "docker compose exec ollama ollama pull ${this.config.OLLAMA_MODEL}".`,
          );
        }
        throw new HttpError(502, "AI_MODEL_ERROR", "The AI coach could not complete this response.");
      }
      if (!response.body) {
        throw new HttpError(502, "AI_INVALID_RESPONSE", "The AI coach returned an invalid response.");
      }

      res.status(200).set({
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      res.flushHeaders();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let answerLength = 0;
      let streamDone = false;

      const sendEvent = (event: object) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      const processLine = (line: string) => {
        if (!line.trim()) return;
        let chunk: any;
        try {
          chunk = JSON.parse(line);
        } catch {
          throw new Error("Ollama returned malformed stream data");
        }
        const token = chunk?.message?.content;
        if (token) {
          answerLength += token.length;
          sendEvent({ type: "token", token });
        }
        if (chunk?.done) streamDone = true;
      };

      try {
        while (!streamDone) {
          const { value, done } = await reader.read();
          pending += decoder.decode(value, { stream: !done });
          const lines = pending.split(/\r?\n/);
          pending = lines.pop() ?? "";
          lines.forEach(processLine);
          if (done) {
            if (pending) processLine(pending);
            break;
          }
        }
        if (answerLength === 0 || !streamDone) {
          throw new Error("Ollama ended without a complete answer");
        }
        sendEvent({
          type: "done",
          provider: "Ollama (local)",
          model: this.config.OLLAMA_MODEL,
        });
      } catch (error) {
        console.error("Coach stream error", error);
        if (!res.destroyed) {
          sendEvent({
            type: "error",
            message: timedOut
              ? "The AI coach took too long to respond. Please try again."
              : "The AI coach could not finish this response. Please try again.",
          });
        }
      } finally {
        try {
          await reader.cancel();
        } catch {}
        if (!res.writableEnded && !res.destroyed) res.end();
      }
    } finally {
      clearTimeout(timeout);
      res.off("close", cancelOnClose);
    }
  };
}
