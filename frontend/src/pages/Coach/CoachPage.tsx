import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageHeading } from "../../components/common/PageHeading.js";
import type { CoachMessage } from "../../types/index.js";

export function CoachPage({
  apiStream,
}: {
  apiStream: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const conversationEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function askCoach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || busy) return;

    setQuestion("");
    setError("");
    setMessages((current) => [
      ...current,
      { role: "user", content: prompt },
      { role: "assistant", content: "" },
    ]);
    setBusy(true);
    try {
      const response = await apiStream("/api/v1/coach/stream", {
        method: "POST",
        body: JSON.stringify({
          question: prompt,
          history: messages.slice(-8),
        }),
      });
      if (!response.body) {
        throw new Error("The coach connection did not provide a response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let receivedAnswer = false;
      let finished = false;
      const handleEvent = (line: string) => {
        if (!line.startsWith("data: ")) return;
        const event = JSON.parse(line.slice(6)) as {
          type: "token" | "done" | "error";
          token?: string;
          message?: string;
        };
        if (event.type === "token" && event.token) {
          receivedAnswer = true;
          setMessages((current) => {
            const next = [...current];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = {
                ...last,
                content: last.content + event.token,
              };
            }
            return next;
          });
        } else if (event.type === "error") {
          throw new Error(
            event.message ?? "The coach could not finish replying.",
          );
        } else if (event.type === "done") {
          finished = true;
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          pending += decoder.decode(value, { stream: !done });
          const lines = pending.split(/\r?\n/);
          pending = lines.pop() ?? "";
          lines.forEach(handleEvent);
          if (done) break;
        }
        if (pending) handleEvent(pending);
      } finally {
        reader.releaseLock();
      }
      if (!finished || !receivedAnswer) {
        throw new Error(
          "The coach response ended before a complete answer arrived.",
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The coach could not reply. Please try again.",
      );
      setQuestion(prompt);
      setMessages((current) => {
        const last = current[current.length - 1];
        return last?.role === "assistant" && !last.content
          ? current.slice(0, -1)
          : current;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="coach-page">
      <PageHeading
        eyebrow="YOUR LOCAL FITNESS COMPANION"
        title="Meet your AI coach."
        description="Ask about movement, workout routines, or building healthy habits—one practical step at a time."
      />
      <div className="coach-safety-note" role="note">
        <span aria-hidden="true">✳</span>
        <p>
          <strong>A helpful guide, not a medical professional.</strong> Replies
          come from a local AI model and may be inaccurate. Your profile, meals,
          and workout logs are not shared automatically. For medical advice or
          injuries, talk with a qualified professional.
        </p>
      </div>
      <section className="surface coach-chat" aria-label="Chat with AI coach">
        <header className="coach-chat-header">
          <div className="coach-avatar" aria-hidden="true">
            ✳
          </div>
          <div>
            <h2>FITFORGE Coach</h2>
            <p>
              <span className="coach-online-dot" /> Powered privately on this
              server
            </p>
          </div>
          {messages.length > 0 && (
            <button
              className="text-button coach-clear"
              onClick={() => {
                setMessages([]);
                setError("");
              }}
              disabled={busy}
            >
              Clear chat
            </button>
          )}
        </header>
        <div className="coach-conversation" aria-live="polite">
          {messages.length === 0 ? (
            <div className="coach-welcome">
              <span className="coach-welcome-icon" aria-hidden="true">
                ✳
              </span>
              <h3>A good place to start.</h3>
              <p>
                Tell me what you’re working toward, and we’ll make the next step
                feel manageable.
              </p>
              <div className="coach-prompts">
                {[
                  "Help me plan my first week of workouts",
                  "What is a simple warm-up before exercise?",
                  "How can I build a consistent sleep routine?",
                ].map((suggestion) => (
                  <button
                    className="coach-prompt"
                    key={suggestion}
                    onClick={() => setQuestion(suggestion)}
                    disabled={busy}
                  >
                    {suggestion} <span aria-hidden="true">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <article
                className={`coach-message ${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.role === "assistant" && (
                  <span className="coach-message-icon" aria-hidden="true">
                    ✳
                  </span>
                )}
                <p>{message.content}</p>
              </article>
            ))
          )}
          {busy && !messages[messages.length - 1]?.content && (
            <div className="coach-thinking" role="status">
              <span />
              <span />
              <span />
              <small>Putting a thoughtful answer together…</small>
            </div>
          )}
          {error && (
            <p className="coach-error" role="alert">
              {error}
            </p>
          )}
          <div ref={conversationEnd} />
        </div>
        <form className="coach-composer" onSubmit={askCoach}>
          <label className="sr-only" htmlFor="coach-question">
            Your question for the coach
          </label>
          <textarea
            id="coach-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ask a fitness or healthy-habit question…"
            maxLength={1000}
            rows={2}
            disabled={busy}
          />
          <div className="coach-composer-footer">
            <span>Enter to send · Shift + Enter for a new line</span>
            <button
              className="button primary"
              type="submit"
              disabled={busy || !question.trim()}
            >
              {busy ? "Thinking…" : "Send"} <span aria-hidden="true">↗</span>
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}
