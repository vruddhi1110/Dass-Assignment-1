import React, { useState } from 'react';
import API from '../api';
import { useLocation, useNavigate } from 'react-router-dom';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [forgotOpen, setForgotOpen] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotMessage, setForgotMessage] = useState('');
    const [forgotError, setForgotError] = useState('');
    const location = useLocation();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await API.post('/auth/login', formData);
            const token = res.data.token;
            localStorage.setItem('token', token);
            localStorage.setItem('role', res.data.user.role);
            // Store token expiry derived from JWT so we can quickly check expiry without parsing repeatedly
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(atob(parts[1]));
                    if (payload.exp) localStorage.setItem('tokenExpiry', (payload.exp * 1000).toString());
                }
            } catch (e) {
                // ignore parse errors
            }
            // Notify other components (Navbar) that auth state changed
            window.dispatchEvent(new Event('authChanged'));

            // Onboarding Check
            const user = res.data.user;
            let dest = location.state?.from?.pathname || '/dashboard';
            
            // If user is Participant and has no preferences set, redirect to onboarding
            // But only if they weren't trying to go somewhere specific (like via a protected link)
            // Actually, Requirement 5 implies "After signup" -> "select or skip". 
            // Better to force check if preferences are empty.
            if (user.role === 'Participant' && dest === '/dashboard') {
                const prefs = user.preferences || {};
                const hasInterests = prefs.areasOfInterest && prefs.areasOfInterest.length > 0;
                const hasFollowed = prefs.followedClubs && prefs.followedClubs.length > 0;
                
                if (!hasInterests && !hasFollowed) {
                    dest = '/onboarding';
                }
            }
            
            navigate(dest, { replace: true });
        } catch (err) {
            alert(err.response?.data?.msg || 'Login Failed');
        } finally {
            setLoading(false);
        }
    };

    // Simple styled split-screen layout inspired by IIIT portal mockups
    return (
        <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, Roboto, Arial, sans-serif' }}>
            {/* Left branded panel */}
            <div style={{ flex: 1, background: 'linear-gradient(180deg,#20232a,#2b3350)', color: 'white', padding: '48px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ maxWidth: '540px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                        <div style={{ width: '58px', height: '58px', borderRadius: '10px', background: '#ffffff22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                            FE
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '34px', letterSpacing: '1px' }}>Felicity EMS</h1>
                            <div style={{ opacity: 0.85, fontSize: '14px' }}>IIIT event management — login portal</div>
                        </div>
                    </div>

                    <p style={{ color: '#d0d7e6', lineHeight: 1.6 }}>Access events, register participants, and manage registrations with a single portal. Use your IIIT credentials if you're an IIIT staff or student, otherwise register as a Non-IIIT participant.</p>

                    <div style={{ marginTop: '28px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ background: '#ffffff11', padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}>
                            <strong>Tip</strong>
                            <div style={{ fontSize: '12px', opacity: 0.9 }}>Use your IIIT email for organizer links and official communications.</div>
                        </div>
                        <div style={{ background: '#ffffff11', padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}>
                            <strong>Support</strong>
                            <div style={{ fontSize: '12px', opacity: 0.9 }}>Contact IT or Admin for organizer provisioning.</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right form panel */}
            <div style={{ width: '520px', padding: '48px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f8fb' }}>
                <div style={{ width: '100%', maxWidth: '380px', background: 'white', padding: '28px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(20,30,50,0.08)' }}>
                    {location.state?.message && (
                        <div style={{ marginBottom: '12px', padding: '10px', background: '#fff3cd', color: '#856404', borderRadius: '6px', fontSize: '14px' }}>{location.state.message}</div>
                    )}

                    <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Sign in</h2>
                    <div style={{ marginBottom: '18px', color: '#6b7280', fontSize: '14px' }}>Enter your email and password to continue</div>

                    <form onSubmit={handleSubmit}>
                        <label style={{ display: 'block', fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Email</label>
                        <input
                            type="email"
                            placeholder="name@students.iiit.ac.in"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            required
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e6edf3', marginBottom: '12px', boxSizing: 'border-box' }}
                        />

                        <label style={{ display: 'block', fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Password</label>
                        <div style={{ position: 'relative', marginBottom: '14px' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Your password"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                required
                                style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '8px', border: '1px solid #e6edf3', boxSizing: 'border-box' }}
                            />
                            <button type="button" onClick={() => setShowPassword(s => !s)} aria-label="Toggle password visibility" style={{ position: 'absolute', right: '8px', top: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ fontSize: '13px' }}>
                                <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
                                    <input type="checkbox" style={{ marginRight: '6px' }} /> Remember me
                                </label>
                            </div>
                            <div>
                                    <button type="button" onClick={() => setForgotOpen(true)} style={{ color: '#2563eb', fontSize: '13px', textDecoration: 'none', background: 'transparent', border: 'none', cursor: 'pointer' }}>Forgot password?</button>
                                </div>
                        </div>

                        <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: '#2563eb', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}>{loading ? 'Signing in...' : 'Log in'}</button>
                    </form>

                    <div style={{ marginTop: '14px', fontSize: '13px', color: '#6b7280', textAlign: 'center' }}>
                        Don't have an account? <a href="/register" style={{ color: '#2563eb' }}>Sign up</a>
                    </div>
                            {/* Forgot password modal */}
                            {forgotOpen && (
                                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
                                    <div style={{ width: '420px', background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
                                        <h3 style={{ marginTop: 0 }}>Reset password</h3>
                                        <p style={{ color: '#555' }}>Enter the email address for your account. We'll send a password reset link if the account exists.</p>
                                        <input value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="your.email@domain.com" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd', marginBottom: '10px' }} />
                                        {forgotMessage && <div style={{ marginBottom: '10px', color: 'green' }}>{forgotMessage}</div>}
                                        {forgotError && <div style={{ marginBottom: '10px', color: 'red' }}>{forgotError}</div>}
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <button onClick={() => { setForgotOpen(false); setForgotEmail(''); setForgotMessage(''); setForgotError(''); }} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc', background: 'white' }}>Cancel</button>
                                            <button onClick={async () => {
                                                try {
                                                    setForgotLoading(true);
                                                    setForgotError('');
                                                    const res = await API.post('/auth/forgot-password', { email: forgotEmail });
                                                    setForgotMessage(res.data?.msg || 'If an account exists, a reset link will be sent.');
                                                } catch (e) {
                                                    setForgotError(e.response?.data?.msg || 'Request failed');
                                                } finally {
                                                    setForgotLoading(false);
                                                }
                                            }} disabled={forgotLoading || !forgotEmail} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: '#2563eb', color: 'white' }}>{forgotLoading ? 'Sending...' : 'Send link'}</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                </div>
            </div>
        </div>
    );
};

export default Login;