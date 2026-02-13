import React, { useEffect, useState } from 'react';
import API from '../api';
import { Link } from 'react-router-dom';

const MyTickets = () => {
    const [tickets, setTickets] = useState([]);
    const [activeTab, setActiveTab] = useState('Upcoming'); // Default Tab changed

    useEffect(() => {
        const fetchTickets = async () => {
            const res = await API.get('/registrations/my-tickets');
            setTickets(res.data);
        };
        fetchTickets();
    }, []);

    // Categorization Logic
    const getFilteredTickets = () => {
        const isCompleted = (t) => {
            if (!t.eventId) return false; // Safety check
            // Check both standard date location and eventDates object
            const end = t.eventId.dates?.end || t.eventId.eventDates?.end;
            return end && new Date(end) < new Date();
        };

        let result = [];
        switch(activeTab) {
            case 'Upcoming':
                // Renamed from 'Normal' to 'Upcoming'
                // Shows Active Normal events
                result = tickets.filter(t => 
                    t.eventId &&
                    (!t.eventId.eventType || t.eventId.eventType === 'Normal') && 
                    t.status === 'Successful' &&
                    !isCompleted(t)
                );
                break;
            case 'Merchandise':
                result = tickets.filter(t => t.eventId && t.eventId.eventType === 'Merchandise' && t.status === 'Successful');
                break;
            case 'Completed':
                // Assuming events in the past are completed
                result = tickets.filter(t => t.eventId && isCompleted(t) && t.status === 'Successful');
                break;
            case 'Cancelled/Rejected':
                result = tickets.filter(t => t.eventId && ['Cancelled', 'Rejected'].includes(t.status));
                break;
            default:
                result = tickets;
        }
        return result;
    };

    const filteredTickets = getFilteredTickets();

    return (
        <div style={{ padding: '20px' }}>
            <h2>My Participation History</h2>
            
            {/* TABS */}
            <div style={{ display: 'flex', borderBottom: '1px solid #ccc', marginBottom: '20px' }}>
                {['Upcoming', 'Merchandise', 'Completed', 'Cancelled/Rejected'].map(tab => (
                    <button 
                        key={tab} 
                        onClick={() => setActiveTab(tab)}
                        style={{ 
                            padding: '10px 20px', 
                            background: activeTab === tab ? '#007bff' : 'transparent',
                            color: activeTab === tab ? 'white' : 'black',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        {tab === 'Upcoming' ? 'Upcoming (Normal)' : tab}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {filteredTickets.length > 0 ? filteredTickets.map(ticket => (
                    <div key={ticket._id} style={{ border: '2px solid #333', padding: '15px', borderRadius: '10px', textAlign: 'center', background: '#fff' }}>
                        <h3>{ticket.eventId?.name || 'Unknown Event'}</h3>
                        <p>
                            Ticket ID: <strong>
                                <Link to={`/registration/${ticket._id}`} style={{ color: '#007bff', textDecoration: 'none' }}>
                                    {ticket.ticketId}
                                </Link>
                            </strong>
                        </p>
                        
                        {/* DISPLAYING THE QR CODE HERE */}
                        <img 
                            src={ticket.qrCode} 
                            alt="Ticket QR Code" 
                            style={{ width: '200px', height: '200px', border: '1px solid #ddd' }} 
                        />
                        
                        <p>Status: <span style={{ 
                            fontWeight: 'bold', 
                            color: ticket.status === 'Successful' ? 'green' : 
                                   ticket.status === 'Rejected' ? 'red' : 
                                   ticket.status === 'Cancelled' ? 'orange' : 'black' 
                        }}>{ticket.status}</span></p>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
                            <button onClick={() => window.print()}>Download/Print Ticket</button>
                            
                            {/* CANCEL BUTTON - Only for Non-Cancelled/Rejected tickets & Future events */}
                            {['Successful', 'Pending'].includes(ticket.status) && activeTab !== 'Completed' && activeTab !== 'Cancelled/Rejected' && (
                                <button 
                                    onClick={async () => {
                                        if(!window.confirm('Are you sure you want to cancel this ticket? This action cannot be undone.')) return;
                                        try {
                                            await API.patch(`/registrations/${ticket._id}/cancel`);
                                            alert('Ticket Cancelled Successfully');
                                            // Refresh logic (simple reload for now)
                                            window.location.reload();
                                        } catch (err) {
                                            alert('Failed to cancel ticket');
                                        }
                                    }}
                                    style={{ background: '#dc3545', color: 'white', border: 'none' }}
                                >
                                    Cancel Ticket
                                </button>
                            )}
                        </div>
                    </div>
                )) : (
                    <p>No tickets found for the selected category.</p>
                )}
            </div>
        </div>
    );
};

export default MyTickets;