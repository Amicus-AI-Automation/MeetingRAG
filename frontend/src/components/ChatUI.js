import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import api from "../services/api";
import "./ChatUI.css";

function ChatUI({ meeting }) {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState(() => {
    if (meeting?.meeting_id) {
      const email = localStorage.getItem("email") || "default";
      const saved = localStorage.getItem(`chat_${email}_${meeting.meeting_id}`);
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const chatEndRef = useRef(null);
  const statusIntervalRef = useRef(null);
  const abortControllerRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat]);

  // Load chat and poll status when meeting changes
  useEffect(() => {
    if (meeting) {
      const email = localStorage.getItem("email") || "default";
      const savedChat = localStorage.getItem(`chat_${email}_${meeting.meeting_id}`);
      setChat(savedChat ? JSON.parse(savedChat) : []);
      setError("");
      setPipelineStatus(null);
      if (meeting.is_allowed === false) {
        setError("🔒 you are not allowed to know about this meeting");
      } else {
        checkPipelineStatus();
      }
    }
    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.meeting_id, meeting?.is_allowed]);

  // Save chat to localStorage whenever it changes
  useEffect(() => {
    if (meeting?.meeting_id && chat.length > 0) {
      const email = localStorage.getItem("email") || "default";
      localStorage.setItem(`chat_${email}_${meeting.meeting_id}`, JSON.stringify(chat));
    }
  }, [chat, meeting?.meeting_id]);

  const checkPipelineStatus = async () => {
    if (!meeting) return;
    try {
      const res = await api.get(`/status/${meeting.meeting_id}`);
      const status = res.data.status;
      setPipelineStatus(res.data);

      if (status === "processing" || status === "queued") {
        // Poll every 5 seconds
        if (!statusIntervalRef.current) {
          statusIntervalRef.current = setInterval(async () => {
            try {
              const r = await api.get(`/status/${meeting.meeting_id}`);
              setPipelineStatus(r.data);
              if (r.data.status === "done" || r.data.status === "error") {
                clearInterval(statusIntervalRef.current);
                statusIntervalRef.current = null;
              }
            } catch (e) {}
          }, 5000);
        }
      }
    } catch (e) {
      // status endpoint might not exist or Python API down — ignore
    }
  };
  
  const terminateChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      setChat((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0 && updated[lastIndex].loading) {
          updated[lastIndex] = {
            ...updated[lastIndex],
            loading: false,
            bot: "Chat terminated by user.",
            error: true,
          };
        }
        return updated;
      });
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !meeting) return;

    setError("");
    const userMessage = message;
    setMessage("");

    setChat((prev) => [...prev, { user: userMessage, bot: null, sources: [], loading: true }]);
    setLoading(true);

    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      const res = await api.post("/query", {
        query: userMessage,
        meeting_id: meeting.meeting_id,
      }, {
        signal: abortControllerRef.current.signal
      });

      setChat((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        updated[lastIndex] = {
          user: userMessage,
          bot: res.data.answer || "No response received",
          sources: res.data.sources || [],
          loading: false,
        };
        return updated;
      });
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || axios.isCancel(err)) {
        console.log("Query aborted by user");
        return;
      }
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.response?.data?.detail || "Failed to send query.";

      if (status === 403) {
        setError("🔒 you are not allowed to know about this meeting");
      } else if (status === 202) {
        setError("⏳ Meeting is still being transcribed. Please wait and try again.");
        checkPipelineStatus();
      } else if (status === 503) {
        setError("⚠️ AI service is offline. Please ensure the Python API is running on port 8000.");
      } else {
        setError(msg);
      }

      setChat((prev) => {
        const updated = [...prev];
        // Ensure ANY loading message is cleared on error
        return updated.map(m => m.loading ? { ...m, loading: false, error: true } : m);
      });
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading && message.trim()) {
      sendMessage();
    }
  };

  const formatTime = (seconds) => {
    if (seconds === undefined || seconds === null) return "";
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  // ── Pipeline status banner ──
  const renderStatusBanner = () => {
    if (!pipelineStatus) return null;
    const { status, message: msg } = pipelineStatus;
    if (status === "done") return null;

    const bannerClass =
      status === "error" ? "pipeline-banner error" :
      status === "processing" ? "pipeline-banner processing" :
      "pipeline-banner queued";

    const icon =
      status === "error" ? "❌" :
      status === "processing" ? "⚙️" : "🕐";

    return (
      <div className={bannerClass}>
        <span className="pipeline-icon">{icon}</span>
        <span>{msg || status}</span>
        {(status === "processing" || status === "queued") && (
          <span className="pipeline-spinner" />
        )}
      </div>
    );
  };

  if (!meeting) {
    return (
      <div className="chat-ui-container">
        <div className="empty-state">
          <div className="empty-icon">🎙️</div>
          <h2>No Meeting Selected</h2>
          <p>Upload or select a meeting from the sidebar to start asking questions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-ui-container">
      {/* Header */}
      <div className="chat-header">
        <div className="meeting-title-section">
          <h2>📞 {meeting.title}</h2>
          <div className="meeting-details">
            <span className="detail-item">👥 {meeting.participants_count} participant{meeting.participants_count !== 1 ? "s" : ""}</span>
            <span className="detail-item">⏱️ {Math.floor(meeting.duration_seconds / 60)} min</span>
            <span className="detail-item">📅 {new Date(meeting.date).toLocaleDateString()}</span>
            {meeting.pipeline_status && (
              <span className={`detail-item status-badge status-${meeting.pipeline_status}`}>
                {meeting.pipeline_status === "done" ? "✅ Indexed" :
                 meeting.pipeline_status === "processing" ? "⚙️ Processing" :
                 meeting.pipeline_status === "queued" ? "🕐 Queued" :
                 meeting.pipeline_status === "error" ? "❌ Error" : "📋 " + meeting.pipeline_status}
              </span>
            )}
          </div>
        </div>
        <p className="chat-subtitle">Ask anything about this meeting — get answers with timestamps</p>
      </div>

      {/* Pipeline status banner */}
      {renderStatusBanner()}

      {/* Chat messages */}
      <div className="chat-messages">
        {chat.length === 0 && (
          <div className="empty-state small">
            <p>💬 Start by asking a question about <strong>{meeting.title}</strong></p>
            <div className="example-queries">
              <span onClick={() => setMessage("What were the main decisions made?")}>What were the main decisions made?</span>
              <span onClick={() => setMessage("Who spoke the most?")}>Who spoke the most?</span>
              <span onClick={() => setMessage("Summarize the key action items")}>Summarize the key action items</span>
            </div>
          </div>
        )}

        {chat.map((c, i) => (
          <div key={i} className="message-group">
            {/* User message */}
            <div className="user-message">
              <div className="message-avatar user-avatar">You</div>
              <div className="message-bubble user-bubble">
                <p>{c.user}</p>
              </div>
            </div>

            {/* Bot message */}
            {c.loading && (
              <div className="bot-message">
                <div className="message-avatar bot-avatar">AI</div>
                <div className="message-bubble bot-bubble loading-bubble">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}

            {!c.loading && c.bot && (
              <div className="bot-message">
                <div className="message-avatar bot-avatar">AI</div>
                <div className="message-bubble bot-bubble">
                  <p className="answer-text">{c.bot}</p>

                  {/* Sources with timestamps - Hidden by user request */}
                  {/* 
                  {c.sources && c.sources.length > 0 && (
                    <div className="sources-section">
                      <div className="sources-title">📍 Sources</div>
                      <div className="sources-list">
                        {c.sources.map((src, si) => (
                          <div key={si} className="source-chip">
                            <span className="timestamp-chip">
                              🕐 {src.timestamp || `${formatTime(src.start)} – ${formatTime(src.end)}`}
                            </span>
                            <span className="source-text">{src.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  */}
                </div>
              </div>
            )}

            {!c.loading && c.error && (
              <div className="bot-message">
                <div className="message-avatar bot-avatar error-avatar">!</div>
                <div className="message-bubble error-bubble">
                  <p>Failed to get a response. Please try again.</p>
                </div>
              </div>
            )}
          </div>
        ))}

        <div ref={chatEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError("")}>✕</button>
        </div>
      )}

      {/* Input */}
      <div className="chat-input-section">
        <input
          id="chat-input"
          type="text"
          className="chat-input"
          placeholder={meeting.is_allowed === false ? "Access restricted" : `Ask about "${meeting.title}"…`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading || meeting.is_allowed === false}
        />
        <button
          id="chat-send-btn"
          className="chat-send-button"
          onClick={sendMessage}
          disabled={loading || !message.trim() || meeting.is_allowed === false}
        >
          {loading ? (
            <span className="send-spinner" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export default ChatUI;
