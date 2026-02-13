import React, { useEffect, useState } from 'react';
import API from '../api';

const AdminResetRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async () => {
    try {
      const res = await API.get('/auth/admin/reset-requests');
      setRequests(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to load requests');
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this request? This will generate a temporary password.')) return;
    setLoading(true);
    try {
      const res = await API.post(`/auth/admin/reset-requests/${id}/approve`);
      alert(`Approved. Temporary password: ${res.data.newPassword}`);
      await fetchRequests();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id) => {
    const comment = window.prompt('Optional rejection comment');
    if (comment === null) return; // cancelled
    setLoading(true);
    try {
      await API.post(`/auth/admin/reset-requests/${id}/reject`, { adminComment: comment });
      alert('Request rejected');
      await fetchRequests();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Rejection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Organizer Password Reset Requests</h2>
      {requests.length === 0 ? <p>No requests.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th>Created</th>
              <th>Organizer</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Admin Comment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.organizerId ? `${r.organizerId.firstName || ''} ${r.organizerId.lastName || ''} (${r.organizerId.email || ''})` : 'Unknown'}</td>
                <td>{r.reason || '-'}</td>
                <td>{r.status}</td>
                <td>{r.adminComment || '-'}</td>
                <td>
                  {r.status === 'Pending' && (
                    <>
                      <button onClick={() => handleApprove(r._id)} disabled={loading} style={{ marginRight: '8px' }}>Approve</button>
                      <button onClick={() => handleReject(r._id)} disabled={loading}>Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AdminResetRequests;
