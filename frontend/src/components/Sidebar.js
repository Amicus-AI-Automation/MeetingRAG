import React from "react";
import "./Sidebar.css";

const statusIcon = (status) => {
  switch (status) {
    case "done":       return <span className="s-badge s-done"    title="Indexed">✓</span>;
    case "processing": return <span className="s-badge s-proc"    title="Processing…">⚙</span>;
    case "queued":     return <span className="s-badge s-queue"   title="Queued">·</span>;
    case "error":      return <span className="s-badge s-err"     title="Error">!</span>;
    default:           return null;
  }
};

function Sidebar({ meetings, selectedMeeting, onSelectMeeting, openUpload, onLogout, loadingMeetings, onDeleteMeeting }) {
  const email = localStorage.getItem("email") || "";
  const role = localStorage.getItem("role") || "user";
  const isAdmin = role === "admin";

  return (
    <div className="sidebar">
      {/* ── Brand ── */}
      <div className="sidebar-brand">
        <div className="brand-icon">🎙️</div>
        <div>
          <h3 className="brand-name">MeetingRAG</h3>
          <p className="brand-sub">AI Meeting Assistant</p>
        </div>
      </div>

      {/* ── User info ── */}
      <div className="sidebar-user">
        <div className="user-avatar-sm">{email.charAt(0).toUpperCase() || "U"}</div>
        <div className="user-text-info">
          <span className="user-email">{email}</span>
          <span className="user-role-badge">{isAdmin ? "Admin" : "User"}</span>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="sidebar-actions">
        {isAdmin && (
          <button className="btn-upload" onClick={openUpload} id="upload-btn">
            <span>＋</span> Upload Meeting
          </button>
        )}
      </div>

      {/* ── Meetings list ── */}
      <div className="sidebar-meetings">
        <div className="meetings-header">
          <span>My Meetings</span>
          {loadingMeetings && <span className="spin-sm">⟳</span>}
        </div>

        <div className="meetings-list">
          {meetings.length === 0 ? (
            <div className="no-meetings">
              {loadingMeetings
                ? "Loading…"
                : "No meetings yet. Upload one to get started!"}
            </div>
          ) : (
            meetings.map((m) => (
              <div
                key={m.meeting_id}
                id={`meeting-${m.meeting_id}`}
                role="button"
                tabIndex={0}
                className={`meeting-item ${selectedMeeting?.meeting_id === m.meeting_id ? "active" : ""}`}
                onClick={() => onSelectMeeting(m)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelectMeeting(m); }}
                title={`${m.title}\n${m.participants_count} participant(s)\nStatus: ${m.pipeline_status}`}
              >
                <div className="meeting-left">
                  <div className="meeting-icon">{m.is_allowed ? "📞" : "🔒"}</div>
                  <div className="meeting-info">
                    <p className={`meeting-title ${m.is_allowed ? "" : "locked-text"}`}>{m.title}</p>
                    <p className="meeting-meta">
                      {new Date(m.date).toLocaleDateString()} · {m.participants_count} person{m.participants_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                {m.is_allowed && (
                  <div className="meeting-right-actions">
                    {statusIcon(m.pipeline_status)}
                    <button 
                      className="btn-delete-meeting" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (!m.can_delete) {
                          alert("you are not the admin of this meeting so you are not allowed to delete this meeting");
                          return;
                        }
                        if(window.confirm('Delete this meeting? This will also stop any active processing.')) onDeleteMeeting(m.meeting_id); 
                      }} 
                      title="Delete meeting"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        <button className="btn-logout" onClick={onLogout} id="logout-btn">
          ⎋ Logout
        </button>
        <p className="version-tag">v2.0 · RAG Pipeline</p>
      </div>
    </div>
  );
}

export default Sidebar;
