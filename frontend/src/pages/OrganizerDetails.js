import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import API from '../api';

const OrganizerDetails = () => {
    const { id } = useParams(); // Organizer ID
    const [organizer, setOrganizer] = useState(null);
    const [events, setEvents] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // We're listing users, so we can likely find this organizer from the generic list or create a specific endpoint. 
                // Since there isn't a dedicated "public get user by ID" route, we'll iterate the organizers list or assume the user exists.
                // However, the cleanest way is adding a filter to the getAllOrganizers or just fetching events.
                // Let's rely on events + profile data embedded potentially or fetch via a new endpoint.
                
                // Hack: We don't have a public "get user details" endpoint for arbitrary users.
                // But we can get their events.
                const eventsRes = await API.get(`/events?organizer=${id}`);
                setEvents(eventsRes.data);

                // For the organizer Profile info, usually we'd have an endpoint. 
                // Let's filter it from the 'organizers' list endpoint which is public-ish (protected but accessible)
                const orgRes = await API.get('/auth/organizers');
                const org = orgRes.data.find(o => o._id === id);
                setOrganizer(org);

            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    }, [id]);

    if (!organizer) return <div>Loading...</div>;

    const now = new Date();
    const upcoming = events.filter(e => new Date(e.dates?.start || e.eventDates?.start) >= now);
    const past = events.filter(e => new Date(e.dates?.start || e.eventDates?.start) < now);

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ borderBottom: '1px solid #ccc', paddingBottom: '20px', marginBottom: '20px' }}>
                <h1>{organizer.firstName} {organizer.lastName}</h1>
                <p><strong>Category:</strong> {organizer.category}</p>
                <p>{organizer.description}</p>
                <p>Email: {organizer.email}</p>
            </div>

            <h3>Upcoming Events</h3>
            {upcoming.length > 0 ? (
                <ul>
                    {upcoming.map(e => (
                        <li key={e._id}>
                             <a href={`/event/${e._id}`}>{e.name}</a> - {new Date(e.dates?.start || e.eventDates?.start).toDateString()}
                        </li>
                    ))}
                </ul>
            ) : <p>No upcoming events.</p>}

            <h3>Past Events</h3>
            {past.length > 0 ? (
                <ul>
                    {past.map(e => (
                        <li key={e._id}>
                            {e.name} - {new Date(e.dates?.start || e.eventDates?.start).toDateString()}
                        </li>
                    ))}
                </ul>
            ) : <p>No past events recorded.</p>}
        </div>
    );
};

export default OrganizerDetails;
