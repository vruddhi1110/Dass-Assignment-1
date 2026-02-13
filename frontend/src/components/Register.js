import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

const Register = () => {
    const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', contactNumber: '', collegeName: '' });
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    // Redirect away from register page if already authenticated
    React.useEffect(() => {
        if (localStorage.getItem('token')) {
            navigate('/dashboard', { replace: true });
        }
    }, [navigate]);

    const isIIITEmail = (email) => {
        if (!email) return false;
        const e = email.toLowerCase().trim();
        return /@(students|research)\.iiit\.ac\.in$/.test(e) || /@iiit\.ac\.in$/.test(e);
    };

    const iiitNotes = () => (
        <div style={{ fontSize: '13px', color: '#555' }}>
            IIIT emails accepted:
            <ul style={{ margin: '6px 0 0 18px' }}>
                <li><strong>Students (single degree):</strong> firstname.lastname@students.iiit.ac.in</li>
                <li><strong>Students (dual/research):</strong> firstname.lastname@research.iiit.ac.in</li>
                <li><strong>Professors / Staff:</strong> firstname.lastname@iiit.ac.in</li>
            </ul>
        </div>
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Backend expects firstName, lastName, email, password, contactNumber, collegeName
            const payload = {
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim(),
                password: formData.password,
                contactNumber: formData.contactNumber.trim() || undefined,
                collegeName: formData.collegeName.trim() || undefined
            };

            // Client-side validation: if user supplies an IIIT email, ensure it matches allowed IIIT patterns
            const lower = payload.email.toLowerCase();
            if (lower.includes('.iiit.ac.in') && !isIIITEmail(lower)) {
                alert('Invalid IIIT email. Use students.iiit.ac.in, research.iiit.ac.in or iiit.ac.in as appropriate.');
                setSubmitting(false);
                return;
            }

            const res = await API.post('/auth/register', payload);
            
            // Auto-login if token is provided
            if (res.data.token) {
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('role', res.data.user.role);
                window.dispatchEvent(new Event('authChanged'));
                // Requirement: Redirect new users to onboarding
                navigate('/onboarding');
            } else {
                alert('Registration successful! Please login.');
                navigate('/login');
            }
        } catch (err) {
            console.error('Registration error:', err);
            alert(err.response?.data?.msg || 'Registration failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
            <h2>Register</h2>
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" placeholder="First Name" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} required style={{flex:1, marginBottom: '10px'}} />
                    <input type="text" placeholder="Last Name" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} required style={{flex:1, marginBottom: '10px'}} />
                </div>
                <input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required style={{width: '100%', marginBottom: '10px'}} />
                <input type="password" placeholder="Password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required style={{width: '100%', marginBottom: '10px'}} />
                <input type="text" placeholder="Contact Number (optional)" value={formData.contactNumber} onChange={(e) => setFormData({...formData, contactNumber: e.target.value})} style={{width: '100%', marginBottom: '10px'}} />
                <input type="text" placeholder="College / Organization (optional)" value={formData.collegeName} onChange={(e) => setFormData({...formData, collegeName: e.target.value})} style={{width: '100%', marginBottom: '10px'}} />

                <div style={{ marginBottom: '10px' }}>
                    <div style={{ color: '#555', fontSize: '14px' }}>Note: Organizer accounts cannot self-register.</div>
                    {iiitNotes()}
                </div>

                <button type="submit" disabled={submitting} style={{ padding: '10px 20px' }}>{submitting ? 'Registering...' : 'Sign Up'}</button>
            </form>
        </div>
    );
};

export default Register;