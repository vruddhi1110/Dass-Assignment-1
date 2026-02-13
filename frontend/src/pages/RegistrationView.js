import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import API from '../api';

const RegistrationView = () => {
    const { id } = useParams();
    const [registration, setRegistration] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await API.get(`/registrations/${id}`);
                setRegistration(res.data);
            } catch (err) {
                console.error('Failed to fetch registration', err.response || err);
                setError(err.response?.data?.msg || err.message || 'Failed to load');
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [id]);

    if (loading) return <p style={{ padding: 20 }}>Loading ticket...</p>;
    if (error) return <p style={{ padding: 20, color: 'red' }}>{error}</p>;

    return (
        <div style={{ padding: 20 }}>
            <h2>Ticket: {registration.ticketId}</h2>
            <h3>{registration.eventId?.name}</h3>
            <p>Status: {registration.status}</p>
            <div style={{ marginTop: 20 }}>
                <img src={registration.qrCode} alt="QR" style={{ width: 260, height: 260, border: '1px solid #ddd' }} />
            </div>
            <div style={{ marginTop: 20 }}>
                <button onClick={() => window.print()} style={{ padding: '8px 12px' }}>Print Ticket</button>
            </div>
        </div>
    );
};

export default RegistrationView;
