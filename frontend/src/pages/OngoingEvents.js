import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';

const OngoingEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        // Organizer-only view: fetch organizer-specific events and filter ongoing ones
        const res = await API.get('/events/organizer/my-events');
        const all = res.data || [];
        const now = Date.now();
        const ongoing = all.filter(ev => {
          // Prefer explicit status if available
          if (ev.status && ev.status === 'Ongoing') return true;
          // Fallback to date range if status not set
          const start = ev.eventDates && ev.eventDates.start ? new Date(ev.eventDates.start).getTime() : null;
          const end = ev.eventDates && ev.eventDates.end ? new Date(ev.eventDates.end).getTime() : null;
          if (start && end) return start <= now && now <= end;
          return false;
        });
        setEvents(ongoing);
      } catch (err) {
        console.error('Failed to load ongoing events', err.response || err);
        alert('Failed to load ongoing events');
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  if (loading) return <div style={{ padding: 20 }}>Loading ongoing events...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Ongoing Events</h2>
      <p style={{ color: '#666' }}>Events that are currently in progress (Organizer view).</p>

      {events.length === 0 ? (
        <p>No ongoing events found.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
          {events.map(ev => (
            <div key={ev._id} style={{ border: '1px solid #e6e6e6', padding: 12, borderRadius: 6, background: 'white' }}>
              <h3 style={{ margin: '6px 0' }}>{ev.name}</h3>
              <p style={{ color: '#666', marginBottom: 10 }}>{ev.description?.slice(0, 140)}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link to={`/event/${ev._id}`} style={{ padding: '6px 10px', background: '#28a745', color: 'white', borderRadius: 4, textDecoration: 'none' }}>Manage / Open Scanner</Link>
                <Link to={`/events/${ev._id}/audit`} style={{ padding: '6px 10px', background: '#6f42c1', color: 'white', borderRadius: 4, textDecoration: 'none' }}>View Audit</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OngoingEvents;
