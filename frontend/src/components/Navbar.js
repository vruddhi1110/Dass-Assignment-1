import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
    const navigate = useNavigate();
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [role, setRole] = useState(localStorage.getItem('role'));

    useEffect(() => {
        const onAuthChanged = () => {
            setToken(localStorage.getItem('token'));
            setRole(localStorage.getItem('role'));
        };
        // Custom event dispatched on login/logout to notify Navbar to update
        window.addEventListener('authChanged', onAuthChanged);
        return () => window.removeEventListener('authChanged', onAuthChanged);
    }, []);

    const handleLogout = () => {
        // Write a logout marker (other tabs can detect via storage event)
        try { localStorage.setItem('logout', Date.now().toString()); } catch (e) {}
        // Remove auth-related keys only
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('tokenExpiry');
        // Notify other components in this window that auth changed
        window.dispatchEvent(new Event('authChanged'));
        // Redirect to login to clear UI state
        window.location.href = '/login';
    };

    // Do not render Navbar when not authenticated
    if (!token) return null;

    return (
        <nav style={{ padding: '15px', background: '#282c34', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
            <div>
                <Link to="/dashboard" style={{ color: 'white', marginRight: '20px', textDecoration: 'none', fontWeight: 'bold' }}>Felicity EMS</Link>
                <Link to="/dashboard" style={{ color: 'white', marginRight: '15px' }}>Dashboard</Link>
                
                {/* Participant Links */}
                {role === 'Participant' && (
                    <>
                        <Link to="/my-tickets" style={{ color: 'white', marginRight: '15px' }}>My Tickets</Link>
                        <Link to="/organizers" style={{ color: 'white', marginRight: '15px' }}>Clubs</Link>
                    </>
                )}

                {/* Admin / Organizer Links */}
                {(role === 'Admin' || role === 'Organizer' || localStorage.getItem('isOrganizer') === 'true') && (
                    <>
                        {role === 'Organizer' && <Link to="/ongoing-events" style={{ color: 'white', marginRight: '15px' }}>Ongoing Events</Link>}
                        <Link to="/manage-events" style={{ color: 'white', marginRight: '15px' }}>Manage Events</Link>
                        <Link to="/manage-clubs" style={{ color: 'white', marginRight: '15px' }}>Manage Clubs</Link>
                        {role === 'Organizer' && <Link to="/my-reset-requests" style={{ color: 'white', marginRight: '15px' }}>Password Reset</Link>}
                        {role === 'Admin' && <Link to="/admin/reset-requests" style={{ color: 'white', marginRight: '15px' }}>Reset Requests</Link>}
                    </>
                )}

                {/* Common Links */}
                <Link to="/profile" style={{ color: 'white', marginRight: '15px' }}>Profile</Link>

            </div>
            <button onClick={handleLogout} style={{ background: 'red', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>
                Logout
            </button>
        </nav>
    );
};

export default Navbar;