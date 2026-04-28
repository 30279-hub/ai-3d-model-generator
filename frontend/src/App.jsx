import { useEffect, useMemo, useState } from "react";
import { Box, Plus } from "lucide-react";
import { api } from "./api.js";
import { ChatPanel } from "./components/ChatPanel.jsx";
import { PreviewPanel } from "./components/PreviewPanel.jsx";
import { SessionSidebar } from "./components/SessionSidebar.jsx";

export function App() {
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState(null);
  const [job, setJob] = useState(null);
  const [formats, setFormats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    boot();
  }, []);

  useEffect(() => {
    if (!session?.lastJobId) {
      setJob(null);
      return undefined;
    }

    let cancelled = false;
    let timer = null;

    async function poll() {
      try {
        const payload = await api.getJob(session.lastJobId);
        if (!cancelled) setJob(payload.job);
        if (!cancelled && ["queued", "running"].includes(payload.job.status)) {
          timer = window.setTimeout(poll, 1800);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [session?.lastJobId]);

  const messages = useMemo(() => session?.messages || [], [session]);

  async function boot() {
    try {
      setLoading(true);
      const [sessionList, formatPayload] = await Promise.all([
        api.listSessions(),
        api.listFormats()
      ]);
      setFormats(formatPayload.formats);

      if (sessionList.sessions.length > 0) {
        const payload = await api.getSession(sessionList.sessions[0].id);
        setSession(payload.session);
      } else {
        const payload = await api.createSession();
        setSession(payload.session);
      }

      setSessions(sessionList.sessions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshSessions() {
    const payload = await api.listSessions();
    setSessions(payload.sessions);
  }

  async function createNewSession() {
    const payload = await api.createSession();
    setSession(payload.session);
    setJob(null);
    await refreshSessions();
  }

  async function openSession(sessionId) {
    const payload = await api.getSession(sessionId);
    setSession(payload.session);
    await refreshSessions();
  }

  async function sendMessage(message) {
    if (!message.trim()) return;
    setError("");

    const optimisticSession = {
      ...session,
      messages: [
        ...messages,
        { role: "user", content: message, createdAt: new Date().toISOString() }
      ]
    };
    setSession(optimisticSession);

    try {
      const payload = await api.sendMessage({ sessionId: session?.id, message });
      setSession(payload.session);
      if (payload.job) setJob(payload.job);
      await refreshSessions();
    } catch (err) {
      setError(err.message);
      setSession(session);
    }
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <Box size={34} />
        <span>Starting workspace</span>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <SessionSidebar
        sessions={sessions}
        activeSessionId={session?.id}
        onNew={createNewSession}
        onOpen={openSession}
      />

      <section className="workbench">
        <header className="topbar">
          <div>
            <p className="eyebrow">AI CAD assistant</p>
            <h1>{session?.title || "3D model session"}</h1>
          </div>
          <button className="icon-text-button" type="button" onClick={createNewSession}>
            <Plus size={18} />
            New
          </button>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="workspace-grid">
          <ChatPanel messages={messages} onSend={sendMessage} />
          <PreviewPanel
            job={job}
            formats={formats}
            onRegenerate={(changes) =>
              sendMessage(`Regenerate with these changes: ${changes}. Generate the model`)
            }
          />
        </div>
      </section>
    </main>
  );
}
