require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/felicityDB';
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const email = process.argv[2];
        const webhookUrl = process.argv[3];

        if (!email || !webhookUrl) {
            console.log('Usage: node setDiscordWebhook.js <organizer_email> <webhook_url>');
            process.exit(1);
        }

        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found!');
            process.exit(1);
        }

        if (user.role !== 'Organizer') {
            console.log('User is not an Organizer!');
            process.exit(1);
        }

        user.discordWebhook = webhookUrl;
        await user.save();

        console.log(`✅ Webhook updated for ${user.firstName} ${user.lastName} (${email})`);
        console.log(`Webhook URL: ${webhookUrl}`);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
