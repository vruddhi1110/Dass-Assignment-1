import React, { useEffect, useState } from 'react';
import API from '../api';

const INTEREST_AREAS = [
    'Technology', 'Music', 'Dance', 'Art', 'Literature', 'Sports', 'Gaming', 'Entrepreneurship', 'Social Service'
];

const Profile = () => {
    const [user, setUser] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({});
    const [clubs, setClubs] = useState([]);
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [selectedClubs, setSelectedClubs] = useState([]);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await API.get('/auth/me'); // We added this endpoint
            setUser(res.data);
            setFormData(res.data);
            const prefs = res.data.preferences || {};
            setSelectedInterests(prefs.areasOfInterest || []);
            // followedClubs may be populated objects or ids
            const followed = (prefs.followedClubs || []).map(fc => fc && fc._id ? fc._id : fc);
            setSelectedClubs(followed);
            // Fetch clubs for selection
            try {
                const orgRes = await API.get('/auth/organizers');
                setClubs(orgRes.data);
            } catch (e) {
                console.error('Failed to fetch organizers for profile', e);
            }
        } catch (err) {
            console.error(err);
            if (err.response && (err.response.status === 401 || err.response.status === 404)) {
                 setMessage('Session invalid (User not found or Token expiried). Please logout and login again.');
            } else {
                 setMessage('Failed to load profile. Please ensure the backend server is running and updated (restart it if you just added the feature).');
            }

        }
    };


            const toggleInterest = (interest) => {
                if (selectedInterests.includes(interest)) setSelectedInterests(selectedInterests.filter(i => i !== interest));
                else setSelectedInterests([...selectedInterests, interest]);
            };

            const toggleClub = (clubId) => {
                if (selectedClubs.includes(clubId)) setSelectedClubs(selectedClubs.filter(id => id !== clubId));
                else setSelectedClubs([...selectedClubs, clubId]);
            };
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Merge preferences into payload
            const payload = { ...formData };
            payload.preferences = {
                areasOfInterest: selectedInterests,
                followedClubs: selectedClubs
            };
            const res = await API.put('/auth/me', payload);
            setUser(res.data);
            setEditMode(false);
            // If participant, preferences were part of the payload -> show explicit message
            if (user.role === 'Participant') {
                setMessage('Preferences saved successfully!');
            } else {
                setMessage('Profile updated successfully!');
            }
        } catch (err) {
            setMessage('Failed to update profile.');
        }
    };

    const handleResetPassword = async () => {
        const email = user.email;
        try {
            await API.post('/auth/request-reset', { email });
            alert('Password reset link sent to your email.');
        } catch (err) {
            alert('Failed to send reset link.');
        }
    };

    if (!user) return (
        <div style={{ padding: '20px' }}>
            {message ? <p style={{color: 'red'}}>{message}</p> : <p>Loading...</p>}
        </div>
    );

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h2>My Profile</h2>
            {message && <p style={{ color: 'green' }}>{message}</p>}
            
            {!editMode ? (
                <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
                    <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
                    <p><strong>Email:</strong> {user.email} (Non-editable)</p>
                    <p><strong>Role:</strong> {user.role}</p>
                    <p><strong>Contact:</strong> {user.contactNumber || 'N/A'}</p>
                    <p><strong>College/Org:</strong> {user.collegeName || 'N/A'}</p>
                    {/* Display Organizer Specific Fields */}
                    {user.role === 'Organizer' && (
                        <>
                            <p><strong>Description:</strong> {user.description || 'N/A'}</p>
                            <p><strong>Category:</strong> {user.category || 'N/A'}</p>
                            <p><strong>Discord Webhook:</strong> {user.discordWebhook ? 'Configured' : 'Not configured'}</p>
                        </>
                    )}

                    {user.role === 'Participant' && (
                         <p><strong>Type:</strong> {user.participantType}</p>
                    )}
                    
                    <button onClick={() => setEditMode(true)} style={{ marginRight: '10px' }}>Edit Profile</button>
                    <button onClick={handleResetPassword}>Reset Password</button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input name="firstName" value={formData.firstName || ''} onChange={handleChange} placeholder="First Name" />
                    <input name="lastName" value={formData.lastName || ''} onChange={handleChange} placeholder="Last Name" />
                    <input name="contactNumber" value={formData.contactNumber || ''} onChange={handleChange} placeholder="Contact Number" />
                    
                    {/* Conditional Input Fields for Organizers */}
                    {user.role === 'Organizer' ? (
                        <>
                            <textarea 
                                name="description" 
                                value={formData.description || ''} 
                                onChange={handleChange} 
                                placeholder="Club Description"
                                rows="3"
                                style={{ padding: '8px' }}
                            />
                            <input 
                                name="category" 
                                value={formData.category || ''} 
                                onChange={handleChange} 
                                placeholder="Category (e.g. Technical, Cultural)" 
                            />
                            <input 
                                name="discordWebhook" 
                                value={formData.discordWebhook || ''} 
                                onChange={handleChange} 
                                placeholder="Discord Webhook URL" 
                            />
                        </>
                    ) : (
                        <input name="collegeName" value={formData.collegeName || ''} onChange={handleChange} placeholder="College / Org Name" />
                    )}
                    {/* Preferences editing for Participants */}
                    {user.role === 'Participant' && (
                        <div style={{ marginTop: '10px' }}>
                            <h4>Areas of Interest</h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                                {INTEREST_AREAS.map(area => (
                                    <button
                                        key={area}
                                        type="button"
                                        onClick={() => toggleInterest(area)}
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: '16px',
                                            border: '1px solid #ccc',
                                            background: selectedInterests.includes(area) ? '#007bff' : 'white',
                                            color: selectedInterests.includes(area) ? 'white' : 'black',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {area}
                                    </button>
                                ))}
                            </div>

                            <h4>Follow Clubs / Organizers</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {clubs.map(club => (
                                    <div key={club._id} style={{ padding: '8px', border: '1px solid #eee', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <strong>{club.firstName} {club.lastName}</strong>
                                            {club.category && <div style={{ fontSize: '12px', color: '#666' }}>{club.category}</div>}
                                        </div>
                                        <label style={{ marginLeft: '8px' }}>
                                            <input type="checkbox" checked={selectedClubs.includes(club._id)} onChange={() => toggleClub(club._id)} />
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <button type="submit" style={{ marginRight: '10px' }}>Save</button>
                        <button type="button" onClick={() => setEditMode(false)}>Cancel</button>
                    </div>
                </form>
            )}
            
            {user.role === 'Participant' && user.preferences && user.preferences.followedClubs && (
                <div style={{ marginTop: '20px' }}>
                    <h3>Followed Clubs</h3>
                    <ul>
                    {user.preferences.followedClubs.map(club => (
                        <li key={club._id}>{club.firstName} {club.lastName}</li> // Assuming populated
                    ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default Profile;
