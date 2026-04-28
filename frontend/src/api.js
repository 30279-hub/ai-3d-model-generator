const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? "http://localhost:4000" : "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      // Keep status text.
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  baseUrl: API_BASE,
  listSessions: () => request("/api/sessions"),
  createSession: () => request("/api/sessions", { method: "POST", body: "{}" }),
  getSession: (sessionId) => request(`/api/sessions/${sessionId}`),
  deleteSession: (sessionId) => request(`/api/sessions/${sessionId}`, { method: "DELETE" }),
  sendMessage: ({ sessionId, message }) =>
    request("/api/chat", {
      method: "POST",
      body: JSON.stringify({ sessionId, message })
    }),
  getJob: (jobId) => request(`/api/jobs/${jobId}`),
  listFormats: () => request("/api/jobs/formats"),
  previewUrl: (jobId) => `${API_BASE}/api/jobs/${jobId}/preview`,
  exportUrl: (jobId, format) => `${API_BASE}/api/jobs/${jobId}/exports/${format}`
};
