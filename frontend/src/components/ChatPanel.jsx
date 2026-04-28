import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";

export function ChatPanel({ messages, onSend }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function submit(event) {
    event.preventDefault();
    const message = input.trim();
    if (!message || sending) return;
    setInput("");
    setSending(true);
    try {
      await onSend(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="chat-panel">
      <div className="panel-heading">
        <Sparkles size={18} />
        <span>Requirement chat</span>
      </div>

      <div className="message-list" ref={scrollRef}>
        {messages.map((message, index) => (
          <article key={`${message.createdAt}-${index}`} className={`message ${message.role}`}>
            <div className="message-bubble">{message.content}</div>
          </article>
        ))}
      </div>

      <form className="composer" onSubmit={submit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) submit(event);
          }}
          placeholder="Describe the model or answer the current question..."
          rows={2}
        />
        <button type="submit" disabled={sending || !input.trim()} title="Send message">
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}
