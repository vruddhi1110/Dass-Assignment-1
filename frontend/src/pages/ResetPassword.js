import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import API from '../api';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) {
            setError('No token provided. Please use the link from your email or request a password reset.');
        }
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        if (!token) return setError('Missing token');
        if (!password || password.length < 6) return setError('Password must be at least 6 characters');
        if (password !== confirm) return setError('Passwords do not match');

        setLoading(true);
        try {
            const res = await API.post('/auth/reset-password', { token, newPassword: password });
            setMessage(res.data?.msg || 'Password reset successful. Redirecting to login...');
            setTimeout(() => navigate('/login', { replace: true }), 1600);
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ width: '420px', background: 'white', padding: '24px', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                <h2 style={{ marginTop: 0 }}>Reset password</h2>
                <p style={{ color: '#555' }}>Set a new password for your account. The link (token) is valid for a short time.</p>

                {error && <div style={{ marginBottom: '10px', color: 'red' }}>{error}</div>}
                {message && <div style={{ marginBottom: '10px', color: 'green' }}>{message}</div>}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '6px' }}>New password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }} />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '6px' }}>Confirm password</label>
                        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button type="button" onClick={() => navigate('/login')} style={{ padding: '8px 12px', borderRadius: '6px', background: '#fff', border: '1px solid #ccc' }}>Cancel</button>
                        <button type="submit" disabled={loading} style={{ padding: '8px 12px', borderRadius: '6px', background: '#2563eb', color: 'white', border: 'none' }}>{loading ? 'Saving...' : 'Set password'}</button>
                    </div>
                </form>

                <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
                    If you didn't request this, you can safely ignore this email and your password will remain unchanged.
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
