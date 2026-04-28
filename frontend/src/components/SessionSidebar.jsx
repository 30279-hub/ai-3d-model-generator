import { Clock3, MessageSquarePlus } from "lucide-react";

export function SessionSidebar({ sessions, activeSessionId, onNew, onOpen }) {
  return (
    <aside className="session-sidebar">
      <div className="brand-row">
        <div className="brand-mark">3D</div>
        <div>
          <strong>ModelForge AI</strong>
          <span>Saved sessions</span>
        </div>
      </div>

      <button className="new-session-button" type="button" onClick={onNew}>
        <MessageSquarePlus size={18} />
        New session
      </button>

      <div className="session-list">
        {sessions.map((session) => (
          <button
            key={session.id}
            className={`session-item ${session.id === activeSessionId ? "active" : ""}`}
            type="button"
            onClick={() => onOpen(session.id)}
          >
            <span className="session-title">{session.title}</span>
            <span className="session-date">
              <Clock3 size={13} />
              {new Date(session.updatedAt).toLocaleString()}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
