import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  Wheat,
  Droplets,
  Leaf,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace, api } from "../lib/workspace";
import { PageHeading, Badge } from "../components/ui";
export default function Advisor() {
  const { snapshot } = useWorkspace();
  const [messages, setMessages] = useState<{ role: string; text: string }[]>(
      [],
    ),
    [text, setText] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);
  const send = async (content: string) => {
    if (!content.trim() || pending) return;
    const next = [...messages, { role: "user", text: content }];
    setMessages(next);
    setText("");
    setPending(true);
    setError("");
    try {
      const r = await api("/api/advisor", {
        method: "POST",
        body: JSON.stringify({ messages: next.slice(-30) }),
      });
      setMessages([...next, { role: "assistant", text: r.text }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <PageHeading
        title="Farm advisor"
        eyebrow="KNOWLEDGE THAT GROWS WITH YOU"
        description="Practical agricultural guidance for your field team and rice-growing community."
        actions={
          <Badge tone={snapshot.integrations.gemini ? "green" : "gold"}>
            {snapshot.integrations.gemini
              ? "AI connected"
              : "AI connection required"}
          </Badge>
        }
      />
      <div className="advisor-layout">
        <aside className="advisor-sidebar panel">
          <div className="advisor-icon">
            <Bot size={30} />
          </div>
          <h2>
            A helping hand
            <br />
            in the field.
          </h2>
          <p>
            Share your location, crop variety and growth stage for more useful
            guidance.
          </p>
          <div className="advisor-topics">
            {[
              [Wheat, "Rice cultivation"],
              [Droplets, "Water & irrigation"],
              [Leaf, "Soil & crop health"],
            ].map(([Icon, label]: any) => (
              <div key={label}>
                <Icon size={18} />
                {label}
              </div>
            ))}
          </div>
          <div className="advisor-disclaimer">
            <ShieldCheck size={18} />
            <p>
              AI guidance can be incomplete. Confirm high-impact decisions with
              a qualified extension officer.
            </p>
          </div>
          <button
            className="button"
            onClick={() => {
              setMessages([]);
              setError("");
            }}
          >
            <Trash2 size={15} />
            Clear this conversation
          </button>
        </aside>
        <section className="panel advisor-chat">
          <div className="advisor-messages">
            {!messages.length && (
              <div className="advisor-welcome">
                <span>✧</span>
                <h2>What’s growing on your mind?</h2>
                <p>Start with a question or choose a field topic below.</p>
                <div>
                  {[
                    "How should I prepare my rice field for planting?",
                    "What are the signs of rice blast disease?",
                    "How can I reduce losses during rice storage?",
                  ].map((q) => (
                    <button key={q} onClick={() => send(q)}>
                      {q}
                      <Send size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={"chat-message " + m.role}>
                <small>
                  {m.role === "user" ? "YOU" : "RIFAN FARM ADVISOR"}
                </small>
                <div>{m.text}</div>
              </div>
            ))}
            {pending && <p className="muted">Considering your question…</p>}
            {error && (
              <div role="alert" className="error-box">
                {error}
              </div>
            )}
            <div ref={end} />
          </div>
          <form
            className="advisor-compose"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <textarea
              aria-label="Ask the farm advisor"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={10000}
              placeholder="Ask about your crops, field or harvest…"
              rows={2}
            />
            <button
              className="button primary"
              aria-label="Send advisor question"
              disabled={pending || !text.trim()}
            >
              <Send size={18} />
            </button>
          </form>
          <small className="advisor-footer">
            Your messages are sent to the configured AI provider when connected.
          </small>
        </section>
      </div>
    </>
  );
}
