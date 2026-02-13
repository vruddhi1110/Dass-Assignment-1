import React, { useState, useEffect } from 'react';
import API from '../api';

const ManageClubs = () => {
    const [organizers, setOrganizers] = useState([]);
    const [newOrg, setNewOrg] = useState({ firstName: '', lastName: '', email: '', password: '' });
    const [createdCreds, setCreatedCreds] = useState(null); // Store credentials to show Admin

    useEffect(() => {
        fetchOrganizers();
    }, []);

    const fetchOrganizers = async () => {
        try {
            const res = await API.get('/auth/organizers'); 
            setOrganizers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this organizer?')) return;
        try {
            await API.delete(`/auth/organizer/${id}`); // We added this logic
            fetchOrganizers();
        } catch (err) {
            alert('Failed to delete');
        }
    };

    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
        let pass = "";
        for (let i = 0; i < 10; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return pass;
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        
        // Auto-generate credentials if missing (Requirement 11.2)
        const finalEmail = newOrg.email || `org.${newOrg.firstName.toLowerCase().replace(/\s+/g,'')}@felicity.iiit.ac.in`;
        const finalPassword = newOrg.password || generatePassword();

        const payload = {
            ...newOrg,
            email: finalEmail,
            password: finalPassword
        };

        try {
            await API.post('/auth/create-organizer', payload);
            // Show credentials to Admin
            setCreatedCreds({ email: finalEmail, password: finalPassword, name: newOrg.firstName });
            
            alert('Organizer Created! Please save the credentials displayed.');
            
            setNewOrg({ firstName: '', lastName: '', email: '', password: '' });
            fetchOrganizers();
        } catch (err) {
            console.error(err);
            alert('Failed to create organizer. Email might be duplicate.');
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>Manage Clubs & Organizers</h2>
            
            {/* SUCCESS CREDENTIALS DISPLAY */}
            {createdCreds && (
                <div style={{ marginBottom: '30px', padding: '20px', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '5px' }}>
                    <h3 style={{ color: '#155724', marginTop: 0 }}>✅ Organizer Account Created</h3>
                    <p>Please share these credentials with the organizer immediately. They will not be shown again.</p>
                    <div style={{ background: 'white', padding: '15px', borderRadius: '5px', border: '1px solid #ddd' }}>
                        <p><strong>Organizer Name:</strong> {createdCreds.name}</p>
                        <p><strong>Login Email:</strong> <span style={{ fontFamily: 'monospace', fontSize: '1.1em' }}>{createdCreds.email}</span></p>
                        <p><strong>Password:</strong> <span style={{ fontFamily: 'monospace', fontSize: '1.2em', background: '#eee', padding: '2px 5px' }}>{createdCreds.password}</span></p>
                    </div>
                    <button onClick={() => setCreatedCreds(null)} style={{ marginTop: '10px' }}>Done</button>
                </div>
            )}

            <div style={{ marginBottom: '30px', border: '1px solid #ddd', padding: '15px' }}>
                <h3>Add New Organizer</h3>
                <p style={{ fontSize: '0.9em', color: '#666' }}>Leave Email/Password blank to auto-generate.</p>
                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '500px' }}>
                    <input placeholder="Org Name (First Name)" value={newOrg.firstName} onChange={e => setNewOrg({...newOrg, firstName: e.target.value})} required />
                    <input placeholder="Last Name (Optional)" value={newOrg.lastName} onChange={e => setNewOrg({...newOrg, lastName: e.target.value})} />
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input placeholder="Email (Auto-generated if blank)" type="email" value={newOrg.email} onChange={e => setNewOrg({...newOrg, email: e.target.value})} style={{ flex: 1 }} />
                        <input placeholder="Password (Auto-generated if blank)" type="text" value={newOrg.password} onChange={e => setNewOrg({...newOrg, password: e.target.value})} style={{ flex: 1 }} />
                    </div>
                    
                    <button type="submit" style={{ padding: '10px', background: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}>Create Organizer Account</button>
                </form>
            </div>

            <h3>Existing Organizers</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ textAlign: 'left', background: '#f8f9fa' }}>
                        <th style={{ padding: '10px' }}>Name</th>
                        <th>Email</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {organizers.map(org => (
                        <tr key={org._id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px' }}>{org.firstName} {org.lastName}</td>
                            <td>{org.email}</td>
                            <td>
                                <button onClick={() => handleDelete(org._id)} style={{ color: 'red' }}>Remove</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ManageClubs;
