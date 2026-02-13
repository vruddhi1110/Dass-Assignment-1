import React, { useEffect, useState, useRef } from 'react';
import { io as ioClient } from 'socket.io-client';
import QRScanner from '../components/QRScanner';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api';

const EventRegistration = () => {
    const { id } = useParams(); // Gets the Event ID from the URL
    const navigate = useNavigate();
    const [event, setEvent] = useState(null);
    const [responses, setResponses] = useState({});
    const [merchandiseSelection, setMerchandiseSelection] = useState(null);
    const [merchQuantity, setMerchQuantity] = useState(1);
    const role = localStorage.getItem('role') || '';

    // Organizer-specific participant fields
    const [pFirstName, setPFirstName] = useState('');
    const [pLastName, setPLastName] = useState('');
    const [pEmail, setPEmail] = useState('');
    const [pContact, setPContact] = useState('');
    const [pCollege, setPCollege] = useState('');
    // Modal state for organizer success details
    const [participantsList, setParticipantsList] = useState([]); // Store participants for display
    const [scannerOpen, setScannerOpen] = useState(false);
    const [pSearchQuery, setPSearchQuery] = useState(''); // NEW: Search State
    const [showAttendanceModal, setShowAttendanceModal] = useState(false); // NEW: Attendance Details Modal
    // Chat: messages + socket
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState('');
    const [messageFile, setMessageFile] = useState(null); // New state for file upload
    const fileInputRef = useRef(null); // Ref for file input
    const socketRef = useRef(null);
    const [unread, setUnread] = useState(0);

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                const res = await API.get(`/events/${id}`);
                setEvent(res.data);
                
                // If organizer, fetch participants immediately to show in list
                const token = localStorage.getItem('token');
                if (token) {
                    const myId = JSON.parse(atob(token.split('.')[1])).id;
                    if (res.data.organizerId && (res.data.organizerId === myId || res.data.organizerId._id === myId)) {
                        const pRes = await API.get(`/events/${id}/participants`);
                        console.log('Participants fetched:', pRes.data); // Debug log
                        setParticipantsList(pRes.data);
                            // Setup SSE for live attendance updates (organizer view)
                            try {
                                const token = localStorage.getItem('token');
                                const streamUrl = `${API.defaults.baseURL}/registrations/events/${id}/attendance/stream?token=${encodeURIComponent(token)}`;
                                const es = new EventSource(streamUrl);
                                es.addEventListener('attendanceUpdated', async (e) => {
                                    console.log('SSE attendance update', e.data);
                                    // Refresh participant list to reflect latest attendance
                                    const latest = await API.get(`/events/${id}/participants`);
                                    setParticipantsList(latest.data);
                                });
                                es.addEventListener('snapshot', (ev) => {
                                    // optional: could show live counts
                                    // console.log('snapshot', ev.data);
                                });
                                // store on window so we can close later if needed
                                window._attendanceEventSource = es;
                            } catch (sseErr) {
                                console.warn('SSE setup failed', sseErr);
                            }
                    }
                }
            } catch (err) {
                console.error(err);
                alert("Could not load event details");
            }
        };
        fetchEvent();
    }, [id]);

    // Chat: load messages and connect socket
    useEffect(() => {
        if (!event) return; // wait for event meta to be loaded

        const fetchMessages = async () => {
            try {
                const res = await API.get(`/events/${id}/messages`);
                setMessages(res.data || []);
            } catch (e) {
                console.warn('Failed to load messages', e);
            }
        };
        fetchMessages();

        // connect socket
        try {
            const socketUrl = API.defaults.baseURL.replace('/api', '');
            const s = ioClient(socketUrl, { transports: ['websocket'] });
            socketRef.current = s;
            s.emit('join', { eventId: id });

            s.on('newMessage', (msg) => {
                setMessages(prev => [...prev, msg]);
                // If window not focused, increment unread
                if (document.hidden) setUnread(u => u + 1);
            });
            s.on('deleteMessage', ({ _id }) => setMessages(prev => prev.filter(m => m._id !== _id)));
            s.on('pinMessage', (updated) => setMessages(prev => prev.map(m => m._id === updated._id ? updated : m)));

            return () => {
                try { s.emit('leave', { eventId: id }); s.disconnect(); } catch (e) {}
            };
        } catch (e) {
            console.warn('Socket connection failed', e);
        }
    }, [id, event]);

    // Check if registration is blocked
    const isDeadlinePassed = event && event.registrationDeadline && new Date(event.registrationDeadline) < new Date();
    const isLimitReached = event && event.registrationLimit && event.registrationCount >= event.registrationLimit;
    
    // -----------------------------------------------------
    // ANALYTICS CALCULATIONS
    // -----------------------------------------------------
    const successfulParticipants = participantsList.filter(p => p.status === 'Successful');
    
    // 1. Attendance
    const attendanceCount = participantsList.filter(p => p.attendance).length;
    
    // 2. Revenue
    let totalRevenue = 0;
    if (event && event.eventType === 'Merchandise' && event.merchandiseItems) {
        successfulParticipants.forEach(p => {
            if (p.merchandiseSelection && p.merchandiseSelection.variantId) {
                const item = event.merchandiseItems.find(i => i._id === p.merchandiseSelection.variantId);
                if (item) {
                     totalRevenue += (item.price * (p.merchandiseSelection.quantity || 1));
                }
            }
        });
    } else if (event) {
        // Normal Event
        totalRevenue = successfulParticipants.length * (event.registrationFee || 0);
    }

    // Organizer controls: update deadline and registration limit
    const [editDeadline, setEditDeadline] = useState('');
    const [editLimit, setEditLimit] = useState('');

    useEffect(() => {
        if (event) {
            // prefill editable fields
            setEditDeadline(event.registrationDeadline ? new Date(event.registrationDeadline).toISOString().slice(0,16) : '');
            setEditLimit(event.registrationLimit || '');
        }
    }, [event]);

    const saveEventEdits = async () => {
        try {
            const payload = {};
            if (editDeadline) payload.registrationDeadline = new Date(editDeadline).toISOString();
            if (editLimit !== '') payload.registrationLimit = parseInt(editLimit) || 0;
            const resp = await API.patch(`/events/${id}`, payload);
            alert(resp.data?.msg || 'Event updated');
            // refresh event
            const r2 = await API.get(`/events/${id}`);
            setEvent(r2.data);
        } catch (err) {
            console.error('Failed to save event edits', err.response || err);
            alert(err.response?.data?.msg || 'Failed to update event');
        }
    };

    const handleInputChange = (label, value) => {
        setResponses({ ...responses, [label]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Build payload and include merchandiseSelection if applicable
            const payload = {
                eventId: id,
                formResponses: responses
            };

            if (event.eventType === 'Merchandise') {
                if (!merchandiseSelection) {
                    return alert('Please select a merchandise item before confirming registration.');
                }
                payload.merchandiseSelection = {
                    variantId: merchandiseSelection,
                    quantity: merchQuantity
                };
            }

            // Changed endpoint to /registrations to match standard backend routing
            const resp = await API.post('/registrations', payload);

            if (resp.status === 201 || resp.status === 200) {
                alert("Registration Successful! Redirecting to your tickets...");
                // Try normal react-router navigation first
                try {
                    console.log('[ui] navigating to /my-tickets');
                    navigate('/my-tickets');
                } catch (navErr) {
                    console.warn('[ui] navigate failed, falling back to location.href', navErr);
                    window.location.href = '/my-tickets';
                }

                // Fallback: if react-router didn't change the path (role guard or other), force it after a short delay
                setTimeout(() => {
                    if (window.location.pathname !== '/my-tickets') {
                        console.warn('[ui] react-router did not navigate, forcing full reload to /my-tickets');
                        window.location.href = '/my-tickets';
                    }
                }, 250);
            } else {
                alert(resp.data?.msg || 'Registration responded with unexpected status');
            }
        } catch (err) {
            // Log detailed response for easier debugging and show the server message if present
            console.error('Registration error:', err.response || err);
            const serverMsg = err.response?.data?.msg || err.response?.data || err.message;
            alert(typeof serverMsg === 'string' ? serverMsg : JSON.stringify(serverMsg));
        }
    };

    // -----------------------------------------------------
    // RESTORED: Manual Add Participant Logic
    // -----------------------------------------------------
    const handleAddParticipant = async (e) => {
        if (e) e.preventDefault();
        try {
            await API.post(`/events/${id}/add-participant`, {
                firstName: pFirstName,
                lastName: pLastName,
                email: pEmail,
                contactNumber: pContact,
                collegeName: pCollege
            });
            alert('Participant Added Successfully');
            setPFirstName(''); setPLastName(''); setPEmail(''); setPContact(''); setPCollege('');
            // Refresh
            const r2 = await API.get(`/events/${id}`);
            setEvent(r2.data);
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to add participant');
        }
    };
    // -----------------------------------------------------
    // ------------------ Add to Calendar Helpers ------------------
    const parsePossibleDate = (input) => {
        if (!input) return null;
        if (typeof input === 'string' || input instanceof Date) {
            const d = new Date(input);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof input === 'object') {
            if (input.start) {
                const d = new Date(input.start);
                if (!isNaN(d.getTime())) return d;
            }
            if (input.startDate) {
                const d = new Date(input.startDate);
                if (!isNaN(d.getTime())) return d;
            }
            if (Array.isArray(input) && input.length > 0) return parsePossibleDate(input[0]);
        }
        return null;
    };

    // Recursively search for any value that parses to a valid date inside an object/array
    const findDateInObject = (obj, visited = new WeakSet()) => {
        if (!obj || typeof obj === 'number') return null;
        if (typeof obj === 'string' || obj instanceof Date) {
            const d = new Date(obj);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof obj !== 'object') return null;
        if (visited.has(obj)) return null;
        visited.add(obj);

        if (Array.isArray(obj)) {
            for (const el of obj) {
                const found = findDateInObject(el, visited);
                if (found) return found;
            }
            return null;
        }

        // check common keys quickly
        const keysToCheck = ['start', 'startDate', 'start_time', 'date', 'dates', 'eventDates', 'from'];
        for (const k of keysToCheck) {
            if (obj[k]) {
                const found = findDateInObject(obj[k], visited);
                if (found) return found;
            }
        }

        // fallback: scan all values
        for (const k of Object.keys(obj)) {
            try {
                const val = obj[k];
                const found = findDateInObject(val, visited);
                if (found) return found;
            } catch (e) {
                // ignore
            }
        }
        return null;
    };

    const formatForICS = (d) => {
        const dt = new Date(d);
        return dt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const downloadICS = async () => {
        try {
            const resp = await API.get(`/events/${id}/ics`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(resp.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(event.name || 'event').replace(/[^a-z0-9\-_. ]/ig, '').replace(/\s+/g, '_')}.ics`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to download ICS', err);
            const serverMsg = err?.response?.data?.msg || err?.response?.data || err.message;
            alert(typeof serverMsg === 'string' ? serverMsg : 'Failed to download calendar file');
        }
    };

    const openGoogleCalendar = () => {
        try {
            let start = parsePossibleDate(event.dates) || parsePossibleDate(event.eventDates) || parsePossibleDate(event.start) || parsePossibleDate(event.startDate);
            if (!start) {
                // attempt recursive search across the event object for any date-like value
                start = findDateInObject(event);
                if (start) console.debug('[calendar] found start date via recursive search', start);
            }
            const end = parsePossibleDate((event.dates && event.dates.end) || (event.eventDates && event.eventDates.end)) || null;
            if (!start) {
                console.warn('Event start date not available on event object:', event);
                return alert('Event start date not available');
            }

            const startStr = formatForICS(start);
            const endStr = formatForICS(end || new Date(start.getTime() + 2 * 60 * 60 * 1000));

            const details = event.description || '';
            const gUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.name || '')}&details=${encodeURIComponent(details)}&dates=${encodeURIComponent(startStr + '/' + endStr)}`;
            window.open(gUrl, '_blank');
        } catch (err) {
            console.error('Google Calendar link error', err);
            alert('Failed to open Google Calendar');
        }
    };

    const openOutlook = () => {
        try {
            // Reuse parsing helpers
            let start = parsePossibleDate(event.dates) || parsePossibleDate(event.eventDates) || parsePossibleDate(event.start) || parsePossibleDate(event.startDate);
            if (!start) start = findDateInObject(event);
            let end = parsePossibleDate((event.dates && event.dates.end) || (event.eventDates && event.eventDates.end)) || null;
            if (!end && start) end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
            if (!start) return alert('Event start date not available');

            // Outlook wants ISO format (no Z sometimes works). Use full ISO
            const startISO = start.toISOString();
            const endISO = end.toISOString();

            const subject = event.name || '';
            const body = event.description || '';
            const location = event.location || '';

            // Office 365 Outlook (work accounts)
            const officeUrl = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&startdt=${encodeURIComponent(startISO)}&enddt=${encodeURIComponent(endISO)}&location=${encodeURIComponent(location)}`;

            // Outlook.com (personal) fallback
            // const liveUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&startdt=${encodeURIComponent(startISO)}&enddt=${encodeURIComponent(endISO)}&location=${encodeURIComponent(location)}`;

            // Open office.com first (more common for corporate/edu), then fallback to live.com
            // Some browsers block immediate fallback if first opens; open office in new tab and also open live in a second tab if desired.
            window.open(officeUrl, '_blank');
            // Also open live as fallback in another tab (optional):
            // window.open(liveUrl, '_blank');
        } catch (err) {
            console.error('Outlook link error', err);
            alert('Failed to open Outlook calendar');
        }
    };

            // ------------------ Chat Helpers ------------------
        const sendMessage = async (e) => {
            if (e) e.preventDefault();
            if ((!messageText || messageText.trim() === '') && !messageFile) return;

            let fileData = {};
            if (messageFile) {
                const formData = new FormData();
                formData.append('file', messageFile);
                try {
                    const uploadRes = await API.post('/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    fileData = {
                        fileUrl: uploadRes.data.fileUrl,
                        fileName: uploadRes.data.fileName,
                        fileType: uploadRes.data.fileType
                    };
                } catch (err) {
                    console.error('File upload failed', err);
                    alert('Failed to upload file');
                    return;
                }
            }

            try {
                // Use REST endpoint which will broadcast; fallback will add locally
                const payload = { 
                    text: messageText,
                    ...fileData
                };
                const resp = await API.post(`/events/${id}/messages`, payload);
                setMessageText('');
                setMessageFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                // server will broadcast to everyone including us; but append as fallback
                setMessages(prev => [...prev, resp.data]);
            } catch (err) {
                console.error('sendMessage failed', err);
                alert('Failed to send message');
            }
        };

        const handleDeleteMessage = async (messageId) => {
            if (!window.confirm('Delete this message?')) return;
            try {
                await API.delete(`/events/${id}/messages/${messageId}`);
                setMessages(prev => prev.filter(m => m._id !== messageId));
            } catch (err) {
                console.error('delete failed', err);
                alert('Failed to delete message');
            }
        };

        const handlePinMessage = async (messageId, currentlyPinned) => {
            try {
                const res = await API.patch(`/events/${id}/messages/${messageId}/pin`, { pinned: !currentlyPinned });
                setMessages(prev => prev.map(m => m._id === res.data._id ? res.data : m));
            } catch (err) {
                console.error('pin failed', err);
                alert('Failed to pin/unpin');
            }
        };

    if (!event) return <div>Loading Event Details...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <h2>{event.name}</h2>
            <p style={{ color: '#666' }}>{event.description}</p>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <p><strong>Organizer:</strong> {event.organizerId?.firstName} {event.organizerId?.lastName}</p>
                <p><strong>Type:</strong> {event.eventType}</p>
                <p><strong>Dates:</strong> {event.dates ? `${new Date(event.dates.start).toLocaleDateString()} - ${new Date(event.dates.end).toLocaleDateString()}` : 'TBA'}</p>
                <p><strong>Status:</strong> {event.status}</p>
                <p style={{ color: isDeadlinePassed ? 'red' : 'green' }}>
                    <strong>Deadline:</strong> {event.registrationDeadline ? new Date(event.registrationDeadline).toLocaleString() : 'None'}
                    {isDeadlinePassed && ' (Closed)'}
                </p>
                <p style={{ color: isLimitReached ? 'red' : 'black' }}>
                    <strong>Limit:</strong> {event.registrationLimit || 'Unlimited'}
                    {event.eventType === "Merchandise" ? ` (Stock: ${event.merchandiseItems?.reduce((acc, i) => acc + i.stockQuantity, 0) || 0})` : ''} 
                    {isLimitReached && ' (Full)'}
                </p>
            </div>

            {/* Add to Calendar: Google link + direct .ics download */}
            <div style={{ marginBottom: '16px' }}>
                <button onClick={openGoogleCalendar} style={{ padding: '8px 12px', background: '#4285F4', color: 'white', border: 'none', borderRadius: '6px', marginRight: '8px' }}>Add to Google Calendar</button>
                <button onClick={() => openOutlook()} style={{ padding: '8px 12px', background: '#0072C6', color: 'white', border: 'none', borderRadius: '6px', marginRight: '8px' }}>Add to Outlook</button>
                <button onClick={downloadICS} style={{ padding: '8px 12px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px' }}>Download .ics</button>
            </div>

            {role === 'Organizer' && event.organizerId?._id === JSON.parse(atob(localStorage.getItem('token').split('.')[1])).id ? (
                /* ORGANIZER VIEW */
                <div style={{ border: '2px solid #007bff', padding: '20px', borderRadius: '10px', marginTop: '20px' }}>
                    <h3>Manage Event</h3>
                    
                    {/* Analytics Preview */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <div style={{ background: '#e9ecef', padding: '15px', borderRadius: '5px', minWidth: '120px' }}>
                            <h4>Registrations</h4>
                            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{event.registrationCount !== undefined ? event.registrationCount : 'N/A'}</p>
                        </div>
                        <div style={{ background: '#d4edda', padding: '15px', borderRadius: '5px', minWidth: '120px' }}>
                            <h4>Attendance</h4>
                            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{attendanceCount}</p>
                            <button onClick={() => setShowAttendanceModal(true)} style={{ marginTop: '5px', padding: '5px 10px', fontSize: '12px', background: '#218838', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>View Details</button>
                        </div>
                        <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '5px', minWidth: '120px' }}>
                            <h4>Revenue</h4>
                            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>₹{totalRevenue.toLocaleString()}</p>
                        </div>
                    </div>
                    {/* Scanner Controls */}
                    <div style={{ marginBottom: '16px' }}>
                        <button onClick={() => setScannerOpen(true)} style={{ padding: '8px 12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px' }}>Open QR Scanner / Upload</button>
                        <small style={{ marginLeft: '10px', color: '#666' }}>Upload a QR image to mark attendance (or use camera if supported in future).</small>
                    </div>

                    {/* Scanner modal (camera + upload fallback) */}
                    {scannerOpen && (
                        <div style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '820px', maxWidth: '95%' }}>
                                <h3>QR Scanner (Camera + Upload)</h3>
                                <p style={{ color: '#666' }}>Use your device camera to scan tickets in real-time, or upload an image as a fallback.</p>
                                <div>
                                    <React.Suspense fallback={<div>Loading scanner…</div>}>
                                        {/* dynamically import to keep bundle small */}
                                        <QRScanner eventId={id} onScanned={async (result) => {
                                            if (result.success) {
                                                alert(result.msg || 'Scanned');
                                                // refresh participants list
                                                try {
                                                    const pRes = await API.get(`/events/${id}/participants`);
                                                    setParticipantsList(pRes.data);
                                                } catch (e) { console.warn('Failed refresh after scan', e); }
                                            } else {
                                                alert(result.msg || 'Scan failed');
                                            }
                                        }} onClose={() => setScannerOpen(false)} />
                                    </React.Suspense>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Attendance Details Modal */}
                    {showAttendanceModal && (
                        <div style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '800px', maxWidth: '95%', maxHeight: '80vh', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h3>Live Attendance Dashboard</h3>
                                    <button onClick={() => setShowAttendanceModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    {/* Scanned Column */}
                                    <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '5px' }}>
                                        <h4 style={{ color: '#28a745', borderBottom: '2px solid #28a745', paddingBottom: '10px' }}>
                                            Scanned (Are Here) <span style={{ float: 'right', background: '#28a745', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>{participantsList.filter(p => p.attendance).length}</span>
                                        </h4>
                                        <div style={{ marginTop: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                                            {participantsList.filter(p => p.attendance).length > 0 ? (
                                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                                    {participantsList.filter(p => p.attendance).map(p => (
                                                        <li key={p._id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                                                            <strong>{p.name}</strong>
                                                            <div style={{ fontSize: '12px', color: '#666' }}>{p.email}</div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <p style={{ color: '#666', fontStyle: 'italic' }}>No one has checked in yet.</p>}
                                        </div>
                                    </div>
                                    
                                    {/* Not Scanned Column */}
                                    <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '5px' }}>
                                        <h4 style={{ color: '#dc3545', borderBottom: '2px solid #dc3545', paddingBottom: '10px' }}>
                                            Not Yet Scanned <span style={{ float: 'right', background: '#dc3545', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>{participantsList.filter(p => !p.attendance && p.status === 'Successful').length}</span>
                                        </h4>
                                        <div style={{ marginTop: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                                            {participantsList.filter(p => !p.attendance && p.status === 'Successful').length > 0 ? (
                                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                                    {participantsList.filter(p => !p.attendance && p.status === 'Successful').map(p => (
                                                        <li key={p._id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                                                            <strong>{p.name}</strong>
                                                            <div style={{ fontSize: '12px', color: '#666' }}>{p.email}</div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <p style={{ color: '#666', fontStyle: 'italic' }}>Everyone is here!</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    
                    {/* PUBLISH BUTTON FOR DRAFTS */}
                    {event.status === 'Draft' && (
                        <div style={{ marginBottom: '20px', padding: '15px', background: '#fff3cd', borderLeft: '5px solid #ffc107' }}>
                            <p><strong>This event is currently a Draft.</strong> It is not visible to participants.</p>
                            <button 
                                onClick={async () => {
                                    if(!window.confirm('Are you sure you want to publish? This will make the event visible to everyone.')) return;
                                    try {
                                        await API.patch(`/events/${id}`, { status: 'Published' });
                                        alert('Event Published!');
                                        // Refresh
                                        const r2 = await API.get(`/events/${id}`);
                                        setEvent(r2.data);
                                    } catch (err) {
                                        alert('Failed to publish event');
                                    }
                                }}
                                style={{ background: 'green', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', fontSize: '16px', cursor: 'pointer' }}
                            >
                                🚀 Publish Event Now
                            </button>
                        </div>
                    )}

                    {/* UPDATED CSV EXPORT */}
                    <button onClick={async () => {
                        const res = await API.get(`/events/${id}/participants`);
                        const header = ["Name,Email,Contact,TicketID,RegDate,Status,Attendance"];
                        const rows = res.data.map(e => 
                            `${e.name},${e.email},${e.contactNumber},${e.ticketId},${new Date(e.registrationDate).toLocaleDateString()},${e.status},${e.attendance ? 'Yes' : 'No'}`
                        );
                        const csvContent = "data:text/csv;charset=utf-8," + header.concat(rows).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `participants_${event.name}.csv`);
                        document.body.appendChild(link);
                        link.click();
                    }} style={{ background: '#28a745', color: 'white', padding: '10px', border: 'none', borderRadius: '5px', marginBottom: '20px' }}>
                        Download Full Participants CSV
                    </button>

                    <h4 style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>Edit Constraints</h4>
                    {/* Existing Edit Form */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                        <div>
                            <label>Deadline:</label><br/>
                            <input type="datetime-local" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} />
                        </div>
                        <div>
                            <label>Limit:</label><br/>
                            <input type="number" value={editLimit} onChange={e => setEditLimit(e.target.value)} />
                        </div>
                        <button onClick={saveEventEdits}>Update</button>
                    </div>
                    
                    {/* Add Participant Manual Form */}
                    <h4 style={{ marginTop: '20px' }}>Manually Add Participant</h4>
                    <form onSubmit={handleAddParticipant} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
                        <input placeholder="First Name" value={pFirstName} onChange={e => setPFirstName(e.target.value)} />
                        <input placeholder="Last Name" value={pLastName} onChange={e => setPLastName(e.target.value)} />
                        <input placeholder="Email *" value={pEmail} onChange={e => setPEmail(e.target.value)} required />
                        <input placeholder="Contact Number" value={pContact} onChange={e => setPContact(e.target.value)} />
                        <input placeholder="College Name" value={pCollege} onChange={e => setPCollege(e.target.value)} />
                        <button type="submit" style={{ background: '#17a2b8', color: 'white', border: 'none', padding: '10px' }}>Add Participant</button>
                    </form>

                    {/* Participant Management Table */}
                    <h4 style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>Registered Participants</h4>
                    
                    {/* SEARCH BAR (Requirement 10.3) */}
                    <input 
                        type="text" 
                        placeholder="Search by name or email..." 
                        value={pSearchQuery}
                        onChange={(e) => setPSearchQuery(e.target.value)}
                        style={{ padding: '8px', width: '100%', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />

                    {participantsList && participantsList.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                                <thead>
                                    <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Name</th>
                                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Status</th>
                                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {participantsList
                                    .filter(p => 
                                        p.name.toLowerCase().includes(pSearchQuery.toLowerCase()) || 
                                        p.email.toLowerCase().includes(pSearchQuery.toLowerCase())
                                    )
                                    .map(p => (
                                        <tr key={p._id}>
                                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                                {p.name} <br/>
                                                <small style={{color: '#666'}}>{p.email}</small>
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                                <span style={{ 
                                                    padding: '3px 8px', borderRadius: '4px', fontSize: '12px',
                                                    background: p.status === 'Successful' ? '#d4edda' : p.status === 'Rejected' || p.status === 'Cancelled' ? '#f8d7da' : '#fff3cd',
                                                    color: p.status === 'Successful' ? '#155724' : p.status === 'Rejected' || p.status === 'Cancelled' ? '#721c24' : '#856404'
                                                }}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                                                {p.status === 'Pending' && (
                                                    <>
                                                        <button
                                                            onClick={async () => {
                                                                if(!window.confirm(`Approve registration for ${p.name}? This will generate the ticket.`)) return;
                                                                try {
                                                                    await API.post(`/registrations/${p._id}/approve`);
                                                                    alert('Registration Approved');
                                                                    const pRes = await API.get(`/events/${id}/participants`);
                                                                    setParticipantsList(pRes.data);
                                                                } catch (err) {
                                                                    console.error('Approve failed', err);
                                                                    alert(err.response?.data?.msg || 'Failed to approve registration');
                                                                }
                                                            }}
                                                            style={{ background: '#28a745', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', marginRight: '8px' }}
                                                        >
                                                            Approve
                                                        </button>

                                                        <button 
                                                            onClick={async () => {
                                                                if(!window.confirm(`Reject registration for ${p.name}?`)) return;
                                                                try {
                                                                    await API.patch(`/registrations/${p._id}/cancel`, { status: 'Rejected' });
                                                                    alert('Registration Rejected');
                                                                    // Refresh list
                                                                    const pRes = await API.get(`/events/${id}/participants`);
                                                                    setParticipantsList(pRes.data);
                                                                } catch (err) {
                                                                    alert('Failed to reject registration');
                                                                }
                                                            }}
                                                            style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' }}
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                {p.status === 'Successful' && (
                                                    <button 
                                                        onClick={async () => {
                                                            if(!window.confirm(`Reject registration for ${p.name}?`)) return;
                                                            try {
                                                                await API.patch(`/registrations/${p._id}/cancel`, { status: 'Rejected' });
                                                                alert('Registration Rejected');
                                                                // Refresh list
                                                                const pRes = await API.get(`/events/${id}/participants`);
                                                                setParticipantsList(pRes.data);
                                                            } catch (err) {
                                                                alert('Failed to reject registration');
                                                            }
                                                        }}
                                                        style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' }}
                                                    >
                                                        Reject
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p>No participants yet.</p>
                    )}
                </div>
            ) : (
                /* PARTICIPANT REGISTRATION VIEW */
                <>
                    {/* Blocking Logic */}
                    {(isDeadlinePassed || isLimitReached) ? (
                        <div style={{ padding: '20px', background: '#ffebee', color: '#c62828', borderRadius: '5px', textAlign: 'center' }}>
                            <h3>Registration Closed</h3>
                            <p>{isDeadlinePassed ? "The registration deadline has passed." : "The event is full."}</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            {event.eventType === 'Merchandise' ? (
                                <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
                                    <h3>Select Merchandise Item</h3>
                                    {event.merchandiseItems && event.merchandiseItems.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {event.merchandiseItems.map(item => (
                                                <label key={item._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', background: merchandiseSelection === item._id ? '#e3f2fd' : 'white', borderRadius: '5px', border: '1px solid #ddd' }}>
                                                    <input 
                                                        type="radio" 
                                                        name="merchItem" 
                                                        value={item._id} 
                                                        onChange={() => setMerchandiseSelection(item._id)}
                                                        checked={merchandiseSelection === item._id}
                                                    />
                                                    <div>
                                                        <strong>{item.variantName}</strong> - ₹{item.price}
                                                        {item.stockQuantity < 10 && <span style={{ color: 'red', marginLeft: '10px' }}>Only {item.stockQuantity} left!</span>}
                                                    </div>
                                                </label>
                                            ))}
                                            
                                            <div style={{ marginTop: '15px' }}>
                                                <label>Quantity: </label>
                                                <input 
                                                    type="number" 
                                                    min="1" 
                                                    max="5" 
                                                    value={merchQuantity} 
                                                    onChange={e => setMerchQuantity(parseInt(e.target.value))}
                                                    style={{ width: '60px', padding: '5px', marginLeft: '10px' }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <p>No items available for sale.</p>
                                    )}
                                </div>
                            ) : (
                                // EXISTING NORMAL FORM BUILDER
                                event.customForm.map((field, index) => (
                                    <div key={index} style={{ marginBottom: '15px' }}>
                                        <label>{field.label} {field.required && '*'}</label>
                                        <br/>
                                        {field.fieldType === 'text' && (
                                            <input type="text" onChange={(e) => handleInputChange(field.label, e.target.value)} required={field.required} />
                                        )}
                                        {field.fieldType === 'dropdown' && (
                                            <select onChange={(e) => handleInputChange(field.label, e.target.value)} required={field.required}>
                                                <option value="">Select...</option>
                                                {/* Add logic if options exist in DB schema, currently simplistic */}
                                            </select>
                                        )}
                                        {/* Add other field types if needed */}
                                    </div>
                                ))
                            )}

                            <button type="submit" disabled={isDeadlinePassed || isLimitReached} style={{
                                marginTop: '20px', 
                                padding: '10px 20px', 
                                background: (isDeadlinePassed || isLimitReached) ? '#ccc' : '#28a745', 
                                color: 'white', 
                                fontSize: '16px', 
                                border: 'none', 
                                borderRadius: '5px',
                                cursor: (isDeadlinePassed || isLimitReached) ? 'not-allowed' : 'pointer'
                            }}>
                                Confirm Registration
                            </button>
                        </form>
                    )}
                </>
            )}

            {/* Manual Add Participant Modal/Section if Organizer - connecting the existing state */}
            {/* Chat: Real-time discussion */}
            <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                <h3>Event Chat {unread > 0 && <small style={{ color: '#fff', background: '#dc3545', padding: '2px 6px', borderRadius: '12px', marginLeft: '8px' }}>{unread}</small>}</h3>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ maxHeight: '260px', overflowY: 'auto', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', background: '#fff' }}>
                            {messages && messages.length > 0 ? (
                                messages.sort((a,b)=> (b.pinned - a.pinned) || (new Date(a.createdAt) - new Date(b.createdAt))).map(m => (
                                    <div key={m._id} style={{ padding: '8px', borderBottom: '1px solid #f1f1f1', display: 'flex', justifyContent: 'space-between' }}>
                                        <div>
                                            <strong>{m.userId?.firstName} {m.userId?.lastName}</strong>
                                            <div style={{ fontSize: '14px', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                                                {m.text.split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
                                                    part.match(/(https?:\/\/[^\s]+)/g) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{color: '#007bff'}}>{part}</a> : part
                                                )}
                                            </div>
                                            {m.fileUrl && (
                                                <div style={{ marginTop: '5px' }}>
                                                    <a href={`http://127.0.0.1:5050${m.fileUrl}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#28a745', textDecoration: 'none', background: '#f0f0f0', padding: '4px 8px', borderRadius: '4px' }}>
                                                        📎 {m.fileName || 'Attachment'}
                                                    </a>
                                                </div>
                                            )}
                                            <small style={{ color: '#666' }}>{new Date(m.createdAt).toLocaleString()} {m.pinned && ' • 📌'}</small>
                                        </div>
                                        <div style={{ marginLeft: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {(role === 'Admin' || event.organizerId?._id === (localStorage.getItem('token') ? JSON.parse(atob(localStorage.getItem('token').split('.')[1])).id : '')) || (m.userId && m.userId._id === (localStorage.getItem('token') ? JSON.parse(atob(localStorage.getItem('token').split('.')[1])).id : '')) ? (
                                                <>
                                                    <button onClick={() => handleDeleteMessage(m._id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '6px', borderRadius: '4px' }}>Delete</button>
                                                    { (role === 'Admin' || event.organizerId?._id === (localStorage.getItem('token') ? JSON.parse(atob(localStorage.getItem('token').split('.')[1])).id : '')) && (
                                                        <button onClick={() => handlePinMessage(m._id, m.pinned)} style={{ background: '#ffc107', color: '#212529', border: 'none', padding: '6px', borderRadius: '4px' }}>{m.pinned ? 'Unpin' : 'Pin'}</button>
                                                    )}
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ color: '#666' }}>No messages yet — be the first to say hello!</div>
                            )}
                        </div>

                        <form onSubmit={sendMessage} style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    onChange={(e) => setMessageFile(e.target.files[0])}
                                />
                                <button type="button" onClick={() => fileInputRef.current.click()} style={{ background: '#e9ecef', border: '1px solid #ced4da', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Attach File">
                                    📎
                                </button>
                                {messageFile && (
                                    <div style={{ position: 'absolute', bottom: '40px', left: '0', background: '#333', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                        {messageFile.name} <span style={{ cursor: 'pointer', marginLeft: '5px' }} onClick={() => { setMessageFile(null); fileInputRef.current.value = ''; }}>✖</span>
                                    </div>
                                )}
                            </div>
                            <input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Write a message..." style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }} />
                            <button type="submit" style={{ padding: '10px 14px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px' }}>Send</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventRegistration;