import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api';

const ManageEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const role = localStorage.getItem('role');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        if (role === 'Admin') {
          const res = await API.get('/events');
          setEvents(res.data || []);
        } else {
          // Organizer view: fetch organizer-specific events
          const res = await API.get('/events/organizer/my-events');
          setEvents(res.data || []);
        }
      } catch (err) {
        console.error('Failed to load events', err.response || err);
        alert('Failed to load events');
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [role]);

  if (loading) return <div style={{ padding: 20 }}>Loading events...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Manage Events</h2>
      <p style={{ color: '#666' }}>Listing events {role === 'Admin' ? ' (all events)' : ' (your events)'}.</p>

      <div style={{ marginTop: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/create-event')} style={{ padding: '8px 12px', background: '#007bff', color: 'white', border: 'none', borderRadius: 4 }}>Create New Event</button>
      </div>

      {events.length === 0 ? (
        <p>No events found.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
          {events.map(ev => (
            <div key={ev._id} style={{ border: '1px solid #e6e6e6', padding: 12, borderRadius: 6, background: 'white' }}>
              <h3 style={{ margin: '6px 0' }}>{ev.name}</h3>
              <p style={{ color: '#666', marginBottom: 10 }}>{ev.description?.slice(0, 140)}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* Edit allowed only for organizers (create-event route enforces this) */}
                {role === 'Organizer' && (
                  <Link to={`/create-event?eventId=${ev._id}`} style={{ padding: '6px 10px', background: '#17a2b8', color: 'white', borderRadius: 4, textDecoration: 'none' }}>Edit</Link>
                )}

                <Link to={`/event/${ev._id}`} style={{ padding: '6px 10px', background: '#28a745', color: 'white', borderRadius: 4, textDecoration: 'none' }}>Manage</Link>

                {/* Open scanner uses the event page which contains the organizer scanner UI */}
                <Link to={`/event/${ev._id}`} style={{ padding: '6px 10px', background: '#007bff', color: 'white', borderRadius: 4, textDecoration: 'none' }}>Open Scanner</Link>

                {/* Audit view */}
                <Link to={`/events/${ev._id}/audit`} style={{ padding: '6px 10px', background: '#6f42c1', color: 'white', borderRadius: 4, textDecoration: 'none' }}>View Audit</Link>

                {/* Quick link to participants API view (if you want direct participants route) */}
                <button onClick={async () => {
                  try {
                    const res = await API.get(`/events/${ev._id}/participants`);
                    // show quick count
                    alert(`Participants: ${res.data.length}`);
                  } catch (err) {
                    alert('Failed to fetch participants');
                  }
                }} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc', background: 'white' }}>Show Count</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageEvents;
