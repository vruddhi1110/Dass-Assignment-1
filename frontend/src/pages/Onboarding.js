import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

const INTEREST_AREAS = [
    'Technology', 'Music', 'Dance', 'Art', 'Literature', 'Sports', 'Gaming', 'Entrepreneurship', 'Social Service'
];

const Onboarding = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [clubs, setClubs] = useState([]);
    const [selectedClubs, setSelectedClubs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch clubs (organizers)
        const fetchClubs = async () => {
            try {
                const res = await API.get('/auth/organizers');
                setClubs(res.data);
            } catch (err) {
                console.error("Failed to fetch clubs", err);
            }
        };
        fetchClubs();
    }, []);

    const toggleInterest = (interest) => {
        if (selectedInterests.includes(interest)) {
            setSelectedInterests(selectedInterests.filter(i => i !== interest));
        } else {
            setSelectedInterests([...selectedInterests, interest]);
        }
    };

    const toggleClub = (clubId) => {
        if (selectedClubs.includes(clubId)) {
            setSelectedClubs(selectedClubs.filter(id => id !== clubId));
        } else {
            setSelectedClubs([...selectedClubs, clubId]);
        }
    };

    const handleNext = () => {
        setStep(step + 1);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Get current user data to merge or just send preferences if backend supports patch
            // Profile update endpoint expects full object usually, but let's check profile update logic in authController
            // Based on Profile.js, it sends the whole formData.
            // Let's first fetch current user to be safe
            const meRes = await API.get('/auth/me');
            const currentUser = meRes.data;

            const updatedUser = {
                ...currentUser,
                preferences: {
                    areasOfInterest: selectedInterests,
                    followedClubs: selectedClubs
                }
            };
            
            await API.put('/auth/me', updatedUser);
            // Show explicit feedback then redirect so user sees confirmation
            setMessage('Preferences saved. Redirecting to dashboard...');
            setTimeout(() => navigate('/dashboard'), 800);
        } catch (err) {
            console.error(err);
            alert('Failed to save preferences');
        } finally {
            setLoading(false);
        }
    };

    const handleSkipStep1 = () => {
        // Skip means ignore selection for this step
        setSelectedInterests([]);
        setStep(2);
    };

    const handleSkipStep2 = () => {
        // Skip means ignore selection for this step
        setSelectedClubs([]);
        // Then submit (save interests from step 1 + empty clubs)
        handleSubmit(); 
    };

    return (
        <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
            <h2>Welcome! Let's personalize your experience.</h2>
            
            {step === 1 && (
                <div>
                    <h3>Select Areas of Interest</h3>
                    <p>Pick topics you are interested in.</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                        {INTEREST_AREAS.map(area => (
                            <button
                                key={area}
                                onClick={() => toggleInterest(area)}
                                style={{
                                    padding: '10px 15px',
                                    borderRadius: '20px',
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
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={handleSkipStep1} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>Skip</button>
                        <button onClick={handleNext} style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Next</button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div>
                    <h3>Follow Student Clubs & Organizers</h3>
                    <p>Stay updated with events from these organizers.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                        {clubs.map(club => (
                            <div 
                                key={club._id} 
                                onClick={() => toggleClub(club._id)}
                                style={{
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    background: selectedClubs.includes(club._id) ? '#e6f7ff' : 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <div>
                                    <strong>{club.firstName} {club.lastName}</strong>
                                    {club.category && <div style={{ fontSize: '12px', color: '#666' }}>{club.category}</div>}
                                </div>
                                {selectedClubs.includes(club._id) && <span style={{ color: 'green' }}>✓</span>}
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={handleSkipStep2} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>Skip</button>
                        <button onClick={handleSubmit} disabled={loading} style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                            {loading ? 'Saving...' : 'Finish'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Onboarding;
