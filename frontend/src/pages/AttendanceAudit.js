import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../api';

const AttendanceAudit = () => {
  const { id } = useParams(); // eventId
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await API.get(`/registrations/events/${id}/audit`);
        setAudits(res.data || []);
      } catch (err) {
        console.error('Failed to load audits', err.response || err);
        alert('Failed to load audit records');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  if (loading) return <div style={{ padding: 20 }}>Loading audit...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Attendance Audit</h2>
      <p style={{ color: '#666' }}>Showing recent attendance audit entries for this event.</p>

      <div style={{ marginTop: 12 }}>
        <Link to="/manage-events" style={{ textDecoration: 'none', color: '#007bff' }}>← Back to Manage Events</Link>
      </div>

      {audits.length === 0 ? (
        <p style={{ marginTop: 20 }}>No audit records found.</p>
      ) : (
        <div style={{ marginTop: 20, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f8f9fa' }}>
                <th style={{ padding: '8px', border: '1px solid #eee' }}>Time</th>
                <th style={{ padding: '8px', border: '1px solid #eee' }}>Action</th>
                <th style={{ padding: '8px', border: '1px solid #eee' }}>Ticket</th>
                <th style={{ padding: '8px', border: '1px solid #eee' }}>Actor</th>
                <th style={{ padding: '8px', border: '1px solid #eee' }}>Reason</th>
                <th style={{ padding: '8px', border: '1px solid #eee' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {audits.map(a => (
                <tr key={a._id}>
                  <td style={{ padding: '8px', border: '1px solid #eee' }}>{new Date(a.createdAt).toLocaleString()}</td>
                  <td style={{ padding: '8px', border: '1px solid #eee' }}>{a.action}</td>
                  <td style={{ padding: '8px', border: '1px solid #eee' }}>{a.registrationId?.ticketId || (a.registrationId?._id)}</td>
                  <td style={{ padding: '8px', border: '1px solid #eee' }}>{a.actorId ? `${a.actorId.firstName || ''} ${a.actorId.lastName || ''} (${a.actorId.email || ''})` : a.actorRole}</td>
                  <td style={{ padding: '8px', border: '1px solid #eee' }}>{a.reason || '-'}</td>
                  <td style={{ padding: '8px', border: '1px solid #eee' }}>
                    {a.registrationId && a.registrationId._id ? (
                      <Link to={`/registration/${a.registrationId._id}`} style={{ color: '#007bff' }}>Open Registration</Link>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AttendanceAudit;
