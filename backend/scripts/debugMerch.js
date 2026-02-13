
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/felicity');
        console.log('Connected to Mongo');

        // Mock parameters
        const eventId = '67ab2d67a9980d967e81258d'; // Replace with actual ID if known, or I'll find one
        
        // Find a merchandise event
        const event = await Event.findOne({ eventType: 'Merchandise' });
        if (!event) {
            console.log('No merchandise event found');
            return;
        }
        console.log('Found event:', event._id, event.name);
        
        const item = event.merchandiseItems[0];
        if (!item) {
             console.log('No merchandise items in event');
             return;
        }

        const qty = 1;
        console.log('Attempting update with item ID:', item._id);

        // Simulate the failing query
        const conversionCheck = new mongoose.Types.ObjectId(item._id);
        console.log('Converted ID:', conversionCheck);

        const updateResult = await Event.updateOne(
            { 
                _id: event._id, 
                'merchandiseItems._id': item._id, 
                // 'merchandiseItems.reservedQuantity': { $gte: 0 } // This part might be tricky if field is missing
            },
            { $inc: { 'merchandiseItems.$.reservedQuantity': qty } }
        );

        console.log('Update Result:', updateResult);
        
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
