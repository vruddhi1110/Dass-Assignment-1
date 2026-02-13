import React, { useState, useEffect } from 'react';
import API from '../api';

const CreateEvent = () => {
    const [eventData, setEventData] = useState({
        name: '', description: '', eventType: 'Normal',
        dates: { start: '', end: '', registrationDeadline: '' },
        registrationLimit: '', eligibility: '', customForm: [],
        registrationFee: 0,
        organizerId: '',
        merchandiseItems: []
    });

    useEffect(() => {
        // Prefill organizerId with current user's id (if authenticated)
        const fetchProfile = async () => {
            try {
                const res = await API.get('/auth/me');
                if (res && res.data && res.data._id) {
                    setEventData(d => ({ ...d, organizerId: res.data._id }));
                } else if (res && res.data && res.data.id) {
                    setEventData(d => ({ ...d, organizerId: res.data.id }));
                }
            } catch (err) {
                // silent - organizerId will remain empty if unauthenticated
            }
        };
        fetchProfile();
    }, []);

    // Function to add a new question to the dynamic form
    const addFormField = () => {
        setEventData({
            ...eventData,
            customForm: [...eventData.customForm, { label: '', fieldType: 'text', required: false }]
        });
    };

    const handleFieldChange = (index, key, value) => {
        const updatedForm = [...eventData.customForm];
        updatedForm[index][key] = value;
        setEventData({ ...eventData, customForm: updatedForm });
    };

    // Merchandise items handler
    const addMerchItem = () => {
        setEventData({
            ...eventData,
            merchandiseItems: [...eventData.merchandiseItems, { variantName: '', price: 0, stockQuantity: 0 }]
        });
    };

    const handleMerchChange = (index, key, value) => {
        const updatedMerch = [...eventData.merchandiseItems];
        updatedMerch[index][key] = value;
        setEventData({ ...eventData, merchandiseItems: updatedMerch });
    };

    const handleSubmit = async (e, status) => {
        e.preventDefault();
        try {
            const payload = {
                ...eventData,
                // ensure numeric fields are typed correctly
                registrationFee: Number(eventData.registrationFee) || 0,
                registrationLimit: eventData.registrationLimit ? Number(eventData.registrationLimit) : undefined,
                status
            };
            await API.post('/events', payload);
            alert(`Event ${status === 'Draft' ? 'Saved as Draft' : 'Published'} Successfully!`);
            window.location.href = '/dashboard';
        } catch (err) {
            alert("Error creating event");
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>Create New Event</h2>
            <form>
                {/* Basic Details */}
                <div style={{ marginBottom: '15px' }}>
                    <label>Event Type: </label>
                    <select value={eventData.eventType} onChange={e => setEventData({...eventData, eventType: e.target.value})}>
                        <option value="Normal">Normal Event</option>
                        <option value="Merchandise">Merchandise Sale</option>
                    </select>
                </div>

                <input type="text" placeholder="Event Name" required style={{ display: 'block', marginBottom: '10px', width: '100%', padding: '8px' }} 
                    onChange={e => setEventData({...eventData, name: e.target.value})} />
                
                <textarea placeholder="Description" required style={{ display: 'block', marginBottom: '10px', width: '100%', padding: '8px' }} 
                    onChange={e => setEventData({...eventData, description: e.target.value})} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                    <div>
                        <label>Start Date:</label>
                        <input type="date" required onChange={e => setEventData({...eventData, dates: {...eventData.dates, start: e.target.value}})} />
                    </div>
                    <div>
                        <label>End Date:</label>
                        <input type="date" required onChange={e => setEventData({...eventData, dates: {...eventData.dates, end: e.target.value}})} />
                    </div>
                    <div>
                        <label>Registration Deadline:</label>
                        <input type="date" required onChange={e => setEventData({...eventData, dates: {...eventData.dates, registrationDeadline: e.target.value}})} />
                    </div>
                    <div>
                        <label>Capacity Limit:</label>
                        <input type="number" placeholder="Max Participants" onChange={e => setEventData({...eventData, registrationLimit: e.target.value})} />
                    </div>
                    <div>
                        <label>Registration Fee (₹):</label>
                        <input type="number" min="0" step="0.01" placeholder="0" value={eventData.registrationFee}
                            onChange={e => setEventData({...eventData, registrationFee: e.target.value})} />
                    </div>
                    <div>
                        <label>Organizer ID:</label>
                        <input type="text" placeholder="Organizer ID" value={eventData.organizerId || ''} readOnly title="Organizer ID is set from your account" />
                    </div>
                </div>
                
                {/* CONDITIONAL SECTIONS */}
                {eventData.eventType === 'Normal' ? (
                    <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                        <h3>Dynamic Registration Form Builder</h3>
                        <p>Customize the questions participants must answer.</p>
                        {eventData.customForm.map((field, index) => (
                            <div key={index} style={{ border: '1px solid #ddd', padding: '10px', marginBottom: '10px', background: 'white' }}>
                                <input type="text" placeholder="Question Label (e.g. T-shirt Size)" 
                                    onChange={e => handleFieldChange(index, 'label', e.target.value)} />
                                <select onChange={e => handleFieldChange(index, 'fieldType', e.target.value)}>
                                    <option value="text">Text Input</option>
                                    <option value="dropdown">Dropdown</option>
                                    <option value="file">File Upload</option>
                                </select>
                                <label style={{ marginLeft: '10px' }}> Required? 
                                    <input type="checkbox" onChange={e => handleFieldChange(index, 'required', e.target.checked)} />
                                </label>
                            </div>
                        ))}
                        <button type="button" onClick={addFormField}>+ Add Form Field</button>
                    </div>
                ) : (
                    <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                        <h3>Merchandise Details</h3>
                        <p>Define the items you are selling.</p>
                        {eventData.merchandiseItems.map((item, index) => (
                            <div key={index} style={{ border: '1px solid #e0c070', padding: '10px', marginBottom: '10px', background: 'white', display: 'flex', gap: '10px' }}>
                                <input type="text" placeholder="Item Name / Variant (e.g. Size M)" 
                                    onChange={e => handleMerchChange(index, 'variantName', e.target.value)} />
                                <input type="number" placeholder="Price (₹)" 
                                    onChange={e => handleMerchChange(index, 'price', e.target.value)} />
                                <input type="number" placeholder="Stock Qty" 
                                    onChange={e => handleMerchChange(index, 'stockQuantity', e.target.value)} />
                            </div>
                        ))}
                        <button type="button" onClick={addMerchItem}>+ Add Merchandise Item</button>
                    </div>
                )}

                <hr/>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <button type="button" onClick={(e) => handleSubmit(e, 'Draft')} style={{ background: '#6c757d', color: 'white' }}>Save as Draft</button>
                    <button type="button" onClick={(e) => handleSubmit(e, 'Published')} style={{ background: 'green', color: 'white' }}>Publish Event</button>
                </div>
            </form>
        </div>
    );
};

export default CreateEvent;