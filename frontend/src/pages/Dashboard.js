import React, { useEffect, useState, useMemo } from 'react';
import API from '../api';

const Dashboard = () => {
    const [allEvents, setAllEvents] = useState([]);
    const [myEvents, setMyEvents] = useState([]);
    const [trendingEvents, setTrendingEvents] = useState([]); // New state for trending
    const [searchTerm, setSearchTerm] = useState(""); // 1. State for the search text
    
    // FILTERS STATE
    const [filterType, setFilterType] = useState("");
    const [filterEligibility, setFilterEligibility] = useState("");
    const [filterStart, setFilterStart] = useState("");
    const [filterEnd, setFilterEnd] = useState("");
    const [filterFollowed, setFilterFollowed] = useState(false);

    // Pagination & sorting
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(8);
    const [sortOption, setSortOption] = useState('name-asc');
    // Tab state for organizers: 'all' or 'mine'
    const [activeTab, setActiveTab] = useState('all');
    const role = localStorage.getItem('role');

    // Organizer Aggregate Stats (New)
    const [organizerStats, setOrganizerStats] = useState(null);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                // Check if we are searching/filtering to decide endpoint params
                const params = {};
                if (searchTerm) params.search = searchTerm;
                if (filterType) params.type = filterType;
                if (filterEligibility) params.eligibility = filterEligibility;
                if (filterStart) params.startDate = filterStart;
                if (filterEnd) params.endDate = filterEnd;
                if (filterFollowed) params.followed = 'true';

                // Always fetch filtered published events for browsing
                const allRes = await API.get('/events', { params });
                setAllEvents(allRes.data || []);

                // Only fetch trending once on mount usually, but here simplified
                if (!searchTerm && !filterType && !filterStart) {
                     const trendRes = await API.get('/events?trend=true');
                     setTrendingEvents(trendRes.data || []);
                }

                // If organizer, also fetch owned events
                if (role === 'Organizer') {
                    const myRes = await API.get('/events/organizer/my-events');
                    setMyEvents(myRes.data || []);

                    // Fetch Aggregate Stats
                    const statsRes = await API.get('/events/organizer/stats'); // Use new endpoint
                    setOrganizerStats(statsRes.data);
                } else {
                    setMyEvents([]);
                }
            } catch (err) {
                console.error("Failed to load dashboard data", err);
            }
        };
    // Debounce search slightly or just run on every change
    const timeoutId = setTimeout(() => {
        loadDashboard();
    }, 500);
    return () => clearTimeout(timeoutId);
}, [role, searchTerm, filterType, filterEligibility, filterStart, filterEnd]); // Add dependencies





    // 2. Filter logic: This checks if the search term matches the event name
    // NOTE: We moved search to server-side in the useEffect above, so we can remove client-side filtering 
    // or keep it as a fallback. For now, we trust server results:
    const filteredAll = allEvents; 
    const filteredMine = myEvents.filter(event => event.name.toLowerCase().includes(searchTerm.toLowerCase())); // Keep client search for owned 

    // Owned set for quick lookup (events the current organizer manages)
    const ownedIds = useMemo(() => new Set((myEvents || []).map(e => e._id)), [myEvents]);

    // Sorting
    const sortedAll = useMemo(() => {
        const copy = [...filteredAll];
        switch (sortOption) {
            case 'name-asc':
                return copy.sort((a, b) => a.name.localeCompare(b.name));
            case 'name-desc':
                return copy.sort((a, b) => b.name.localeCompare(a.name));
            case 'registrations-desc':
                return copy.sort((a, b) => (b.registrationCount || 0) - (a.registrationCount || 0));
            case 'registrations-asc':
                return copy.sort((a, b) => (a.registrationCount || 0) - (b.registrationCount || 0));
            default:
                return copy;
        }
    }, [filteredAll, sortOption]);

    // Pagination for All published events
    const totalPages = Math.max(1, Math.ceil(sortedAll.length / pageSize));
    const paginatedAll = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedAll.slice(start, start + pageSize);
    }, [sortedAll, currentPage, pageSize]);

    return (
        <div style={{ padding: '20px' }}>
            {/* ORGANIZER STATS DASHBOARD (Requirement 10.2) */}
            {role === 'Organizer' && organizerStats && (
                <div style={{ marginBottom: '30px', padding: '20px', background: '#f0f2f5', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <h2 style={{ marginTop: 0 }}>📊 Overview</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                        <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '14px', color: '#666' }}>Total Events</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>{organizerStats.eventsCount}</div>
                        </div>
                        <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '14px', color: '#666' }}>Total Registrations</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>{organizerStats.totalRegistrations}</div>
                        </div>
                        <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '14px', color: '#666' }}>Total Revenue</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>₹{organizerStats.totalRevenue.toLocaleString()}</div>
                        </div>
                        <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '14px', color: '#666' }}>Total Attendance</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>{organizerStats.totalAttendance}</div>
                        </div>
                        {/* New Item: Link to Create Event logic if not already prominent */}
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                            <button onClick={()=>window.location.href='/create-event'} style={{padding: '10px 20px', background: '#007bff', color:'white', border:'none', borderRadius:'5px', cursor:'pointer'}}>+ New Event</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Explore Events</h2>
                {role === 'Organizer' && (
                    <button onClick={() => window.location.href='/create-event'} style={{ padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}>
                        + Create Event
                    </button>
                )}
            </div>

            {/* 3. THE SEARCH BAR & FILTERS UI */}
            <div style={{ marginBottom: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '10px' }}>
                <input 
                    type="text" 
                    placeholder="Search events by name or description..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ 
                        width: '100%', 
                        padding: '12px', 
                        borderRadius: '8px', 
                        border: '1px solid #ddd',
                        fontSize: '16px',
                        marginBottom: '15px'
                    }} 
                />
                
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                    
                    {/* Event Type Filter */}
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Event Type</label>
                        <select 
                            value={filterType} 
                            onChange={(e) => setFilterType(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }}
                        >
                            <option value="">All Types</option>
                            <option value="Normal">Normal</option>
                            <option value="Merchandise">Merchandise</option>
                        </select>
                    </div>

                    {/* Eligibility Filter (Example values, adapt to your schema) */}
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Eligibility</label>
                        <select 
                            value={filterEligibility} 
                            onChange={(e) => setFilterEligibility(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }}
                        >
                            <option value="">Any</option>
                            <option value="Everyone">Everyone</option>
                            <option value="Students Only">Students Only</option>
                            {/* Add other eligibility options used in your CreateEvent page */}
                        </select>
                    </div>

                    {/* Date Range Start */}
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>From Date</label>
                        <input 
                            type="date" 
                            value={filterStart} 
                            onChange={(e) => setFilterStart(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }}
                        />
                    </div>

                    {/* Date Range End */}
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>To Date</label>
                        <input 
                            type="date" 
                            value={filterEnd} 
                            onChange={(e) => setFilterEnd(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }}
                        />
                    </div>

                    {/* Reset Button */}
                    <div style={{ display: 'flex', alignItems: 'end' }}>
                         <button 
                            onClick={() => {
                                setSearchTerm("");
                                setFilterType("");
                                setFilterEligibility("");
                                setFilterStart("");
                                setFilterEnd("");
                                setFilterFollowed(false);
                            }}
                            style={{ width: '100%', padding: '8px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '5px' }}
                         >
                            Clear Filters
                         </button>
                    </div>
                </div>
                {/* Followed Clubs toggle (only visible for logged-in users) */}
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                        <input type="checkbox" checked={filterFollowed} onChange={(e) => setFilterFollowed(e.target.checked)} />
                        Show only events from clubs I follow
                    </label>
                </div>
            </div>

            {/* TRENDING EVENTS SECTION */}
            {role === 'Participant' && trendingEvents.length > 0 && !searchTerm && !filterType && !filterStart && (
                <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ color: '#d35400' }}>🔥 Trending Now</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                        {trendingEvents.map((item) => (
                            <div key={item._id} style={{ border: '1px solid #ffcc00', background: '#fffcf5', padding: '15px', borderRadius: '10px' }}>
                                <h4>{item.name}</h4>
                                <p style={{ fontSize: '13px' }}>{item.registrationCount} Registrations</p>
                                <button onClick={() => window.location.href=`/event/${item._id}`} style={{ background: '#d35400', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px' }}>View</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs for organizers: show either 'All events' or 'Events managed by me' */}
            {role === 'Organizer' && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
                    <button onClick={() => setActiveTab('all')} style={{ padding: '8px 14px', borderRadius: '8px', border: activeTab === 'all' ? '2px solid #007bff' : '1px solid #ddd', background: activeTab === 'all' ? '#e9f2ff' : 'white', cursor: 'pointer' }}>All events</button>
                    <button onClick={() => setActiveTab('mine')} style={{ padding: '8px 14px', borderRadius: '8px', border: activeTab === 'mine' ? '2px solid #007bff' : '1px solid #ddd', background: activeTab === 'mine' ? '#e9f2ff' : 'white', cursor: 'pointer' }}>Events managed by me</button>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {role === 'Organizer' ? (
                    activeTab === 'mine' ? (
                        // Show only organizer's events
                        <>
                            <h3>Your events</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                                {filteredMine.length > 0 ? filteredMine.map((item) => (
                                    <div key={item._id} style={{ 
                                        border: '1px solid #eee', 
                                        padding: '15px', 
                                        borderRadius: '10px', 
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)', 
                                        background: item.status === 'Draft' ? '#fff3cd' : 'white' /* Highlight Drafts */
                                    }}>
                                        <h4 style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            {item.name}
                                            <span style={{ fontSize: '10px', padding: '2px 5px', borderRadius: '3px', background: '#ccc' }}>{item.status}</span>
                                        </h4>
                                        <p style={{ color: '#666', fontSize: '14px' }}>{item.description.substring(0, 100)}...</p>
                                        <div style={{ margin: '10px 0', padding: '5px 10px', background: '#e9ecef', borderRadius: '5px', fontSize: '13px', fontWeight: 'bold', color: '#495057' }}>Registrations: {item.registrationCount || 0}</div>
                                        <button onClick={() => window.location.href=`/event/${item._id}`} style={{ background: '#28a745', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' }}>Manage Event</button>
                                    </div>
                                )) : <p style={{ gridColumn: '1/-1' }}>You are not managing any events yet.</p>}
                            </div>
                        </>
                    ) : (
                        // Show only All published events (with sorting & pagination)
                        <>
                            <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>All published events
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <label style={{ fontSize: '13px', color: '#444' }}>Sort:</label>
                                    <select value={sortOption} onChange={(e) => { setSortOption(e.target.value); setCurrentPage(1); }} style={{ padding: '6px', borderRadius: '6px' }}>
                                        <option value="name-asc">Name ↑</option>
                                        <option value="name-desc">Name ↓</option>
                                        <option value="registrations-desc">Registrations ↓</option>
                                        <option value="registrations-asc">Registrations ↑</option>
                                    </select>

                                    <label style={{ fontSize: '13px', color: '#444' }}>Per page:</label>
                                    <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '6px', borderRadius: '6px' }}>
                                        <option value={5}>5</option>
                                        <option value={8}>8</option>
                                        <option value={12}>12</option>
                                    </select>
                                </div>
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                                {paginatedAll.length > 0 ? paginatedAll.map((item) => (
                                    <div key={item._id} style={{ border: '1px solid #eee', padding: '15px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', background: 'white', position: 'relative' }}>
                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {item.name}
                                            {role === 'Organizer' && ownedIds.has(item._id) && (
                                                <span style={{ background: '#28a745', color: 'white', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>You manage</span>
                                            )}
                                        </h4>
                                        <p style={{ color: '#666', fontSize: '14px' }}>{(item.description || '').substring(0, 100)}...</p>
                                        <button onClick={() => window.location.href=`/event/${item._id}`} style={{ background: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' }}>View Event</button>
                                    </div>
                                )) : <p>No published events found.</p>}
                            </div>

                            {/* Pagination controls */}
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc', background: currentPage === 1 ? '#f1f1f1' : 'white' }}>Prev</button>
                                <div style={{ fontSize: '14px' }}>Page {currentPage} / {totalPages}</div>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc', background: currentPage === totalPages ? '#f1f1f1' : 'white' }}>Next</button>
                            </div>
                        </>
                    )
                ) : (
                    // Participant/other view unchanged
                    filteredAll.length > 0 ? filteredAll.map((item) => (
                        <div key={item._id} style={{ border: '1px solid #eee', padding: '15px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', background: 'white' }}>
                            <h4>{item.name}</h4>
                            <p style={{ color: '#666', fontSize: '14px' }}>{item.description.substring(0, 100)}...</p>
                            <button onClick={() => window.location.href=`/event/${item._id}`} style={{ background: '#28a745', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' }}>Register Now</button>
                        </div>
                    )) : (
                        <p>No events found matching "{searchTerm}"</p>
                    )
                )}
            </div>
        </div>
    );
};

export default Dashboard;