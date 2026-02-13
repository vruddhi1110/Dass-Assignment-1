import React, { useEffect, useState } from 'react';
import API from '../api';

const OrganizerResetRequest = () => {
  const [reason, setReason] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async () => {
    try {
      const res = await API.get('/auth/my-reset-requests');
      setRequests(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to load requests');
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.post('/auth/request-reset', { reason });
      setReason('');
      await fetchRequests();
      alert('Request submitted');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Password Reset Request</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px' }}>Reason (optional)</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} style={{ width: '100%', padding: '8px' }} />
        <div style={{ marginTop: '10px' }}>
          <button type="submit" disabled={loading} style={{ padding: '8px 12px' }}>{loading ? 'Submitting...' : 'Request Reset'}</button>
        </div>
      </form>

      <h3>Your Requests</h3>
      {requests.length === 0 ? <p>No requests yet.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th>Created</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Admin Comment</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.reason || '-'}</td>
                <td>{r.status}</td>
                <td>{r.adminComment || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default OrganizerResetRequest;
