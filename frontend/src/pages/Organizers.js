import React, { useEffect, useState } from 'react';
import API from '../api';

const Organizers = () => {
    const [organizers, setOrganizers] = useState([]);

    useEffect(() => {
        const fetchOrgs = async () => {
            try {
                const res = await API.get('/auth/organizers'); // We added this endpoint
                setOrganizers(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchOrgs();
    }, []);

    const toggleFollow = async (id) => {
        try {
            await API.post(`/auth/organizers/${id}/follow`);
            alert('Follow status updated (Refresh to see changes)'); // Simplified for now
        } catch (err) {
            alert('Error updating follow status');
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>Clubs & Organizers</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                {organizers.map(org => (
                    <div key={org._id} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
                        <h3 
                            style={{ cursor: 'pointer', color: '#007bff' }} 
                            onClick={() => window.location.href=`/organizer/${org._id}`}
                        >
                            {org.firstName} {org.lastName}
                        </h3> 
                        <p>{org.description || 'No description available.'}</p>
                        <p><strong>Category:</strong> {org.category || 'General'}</p>
                        <button onClick={() => toggleFollow(org._id)}>Follow / Unfollow</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Organizers;
