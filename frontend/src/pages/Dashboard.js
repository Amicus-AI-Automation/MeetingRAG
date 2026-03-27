import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import ChatUI from "../components/ChatUI";
import UploadMeeting from "../components/UploadMeeting";
import api from "../services/api";
import "./Dashboard.css";

function Dashboard({ onLogout }) {
  const [showUpload, setShowUpload] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  const fetchMeetings = useCallback(async () => {
    setLoadingMeetings(true);
    try {
      const res = await api.get("/meetings");
      if (res.data.meetings) {
        setMeetings(res.data.meetings);
        // Auto-select the first meeting if none selected, or update the current one's status
        setSelectedMeeting(prev => {
          if (!prev && res.data.meetings.length > 0) return res.data.meetings[0];
          if (prev) {
            const updated = res.data.meetings.find(m => m.meeting_id === prev.meeting_id);
            return updated || prev;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("Failed to fetch meetings:", err);
    } finally {
      setLoadingMeetings(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Poll meetings list every 15s to catch pipeline_status updates
  useEffect(() => {
    const interval = setInterval(() => {
      const hasProcessing = meetings.some(
        m => m.pipeline_status === "processing" || m.pipeline_status === "queued"
      );
      if (hasProcessing) fetchMeetings();
    }, 15000);
    return () => clearInterval(interval);
  }, [meetings, fetchMeetings]);

  const handleUploadComplete = (newMeeting) => {
    setShowUpload(false);
    fetchMeetings();
    if (newMeeting) {
      setSelectedMeeting(newMeeting);
    }
  };

  const handleSelectMeeting = (meeting) => {
    setSelectedMeeting(meeting);
    setShowUpload(false);
  };

  const handleDeleteMeeting = async (meetingId) => {
    try {
      await api.delete(`/meeting/${meetingId}`);
      // Refresh meetings list after deletion
      fetchMeetings();
      // If the deleted meeting was selected, clear selection
      if (selectedMeeting?.meeting_id === meetingId) {
        setSelectedMeeting(null);
      }
    } catch (err) {
      console.error("Failed to delete meeting:", err);
      alert("Failed to delete meeting. Please try again.");
    }
  };

  return (
    <div className="dashboard">
      <Sidebar
        meetings={meetings}
        selectedMeeting={selectedMeeting}
        onSelectMeeting={handleSelectMeeting}
        onDeleteMeeting={handleDeleteMeeting}
        openUpload={() => setShowUpload(true)}
        onLogout={onLogout}
        loadingMeetings={loadingMeetings}
      />

      <div className="dashboard-content">
        {showUpload ? (
          <UploadMeeting onClose={handleUploadComplete} />
        ) : (
          <ChatUI key={selectedMeeting?.meeting_id} meeting={selectedMeeting} />
        )}
      </div>
    </div>
  );
}

export default Dashboard;
