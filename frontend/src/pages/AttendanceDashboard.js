import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import API from '../api';

const AttendanceDashboard = () => {
  const { id } = useParams(); // eventId
  const [counts, setCounts] = useState({ totalRegs: 0, scanned: 0 });
  const [updates, setUpdates] = useState([]);

  useEffect(() => {
    let es = null;
    const setup = async () => {
      try {
        const token = localStorage.getItem('token');
        const streamUrl = `${API.defaults.baseURL}/registrations/events/${id}/attendance/stream?token=${encodeURIComponent(token)}`;
        es = new EventSource(streamUrl);
        es.addEventListener('snapshot', (e) => {
          try { const d = JSON.parse(e.data); setCounts(d); } catch (err) { }
        });
        es.addEventListener('attendanceUpdated', (e) => {
          try {
            const payload = JSON.parse(e.data);
            setUpdates(prev => [payload, ...prev].slice(0, 100));
          } catch (err) { }
        });
      } catch (err) {
        console.warn('SSE failed', err);
      }
    };
    setup();
    return () => { if (es) es.close(); };
  }, [id]);

  const exportCSV = async () => {
    try {
      const res = await API.get(`/events/${id}/participants`);
      const header = ["Name,Email,Contact,TicketID,RegDate,Status,Attendance"];
      const rows = res.data.map(e => `${e.name},${e.email},${e.contactNumber},${e.ticketId},${new Date(e.registrationDate).toLocaleDateString()},${e.status},${e.attendance ? 'Yes' : 'No'}`);
      const csvContent = "data:text/csv;charset=utf-8," + header.concat(rows).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `participants_${id}.csv`);
      document.body.appendChild(link);
      link.click();
    } catch (err) { alert('Failed to export CSV'); }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Live Attendance Dashboard</h2>
      <p style={{ color: '#666' }}>Live updates for event <strong>{id}</strong>. Connect a scanner to mark attendees in real-time.</p>

      <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
        <div style={{ padding: 20, background: '#f8f9fa', borderRadius: 8 }}>
          <div style={{ color: '#666' }}>Total Registrations</div>
          <div style={{ fontSize: 28, fontWeight: 'bold' }}>{counts.totalRegs}</div>
        </div>
        <div style={{ padding: 20, background: '#e9f7ef', borderRadius: 8 }}>
          <div style={{ color: '#666' }}>Scanned / Present</div>
          <div style={{ fontSize: 28, fontWeight: 'bold' }}>{counts.scanned}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={exportCSV} style={{ padding: '8px 12px', background: '#28a745', color: 'white', border: 'none', borderRadius: 6 }}>Export CSV</button>
        </div>
      </div>

      <h3 style={{ marginTop: 20 }}>Recent Updates</h3>
      <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Time</th>
              <th style={{ padding: 8 }}>Ticket</th>
              <th style={{ padding: 8 }}>Registration</th>
              <th style={{ padding: 8 }}>Participant</th>
            </tr>
          </thead>
          <tbody>
            {updates.map((u, idx) => (
              <tr key={idx}>
                <td style={{ padding: 8 }}>{new Date().toLocaleTimeString()}</td>
                <td style={{ padding: 8 }}>{u.ticketId}</td>
                <td style={{ padding: 8 }}>{u.registrationId}</td>
                <td style={{ padding: 8 }}>{u.participantId}</td>
              </tr>
            ))}
            {updates.length === 0 && (
              <tr><td style={{ padding: 8 }} colSpan={4}>No updates yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceDashboard;
