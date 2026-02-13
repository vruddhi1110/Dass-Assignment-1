const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

async function setup() {
    console.log('Creating Ethereal Test Account...');
    try {
        let testAccount = await nodemailer.createTestAccount();

        console.log('Account created!');
        console.log('User:', testAccount.user);
        console.log('Pass:', testAccount.pass);
        console.log('Preview URL:', nodemailer.getTestMessageUrl({})); // Note: This usually needs a message info, but testAccount has a web link property usually? 
        // Actually testAccount object structure: { user, pass, smtp: { host, port, secure }, imap: { host, port, secure } }
        
        console.log('\nLogin to view emails here: https://ethereal.email/login');
        
        const envPath = path.join(__dirname, '../.env');
        let envContent = '';
        
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        // Helper to update or append
        const updateEnv = (key, value) => {
            const regex = new RegExp(`^${key}=.*`, 'm');
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `${key}=${value}`);
            } else {
                envContent += `\n${key}=${value}`;
            }
        };

        updateEnv('EMAIL_USER', testAccount.user);
        updateEnv('EMAIL_PASS', testAccount.pass);
        updateEnv('EMAIL_HOST', 'smtp.ethereal.email');
        updateEnv('EMAIL_PORT', '587');
        updateEnv('EMAIL_FROM', 'no-reply@felicity.iiit.ac.in');

        fs.writeFileSync(envPath, envContent);
        
        console.log('\n✅ .env file updated successfully!');
        console.log('Restart your backend server to apply changes.');
        console.log('---------------------------------------------------');
        console.log(`NOTE: Emails will not arrive in your real inbox.`);
        console.log(`Open https://ethereal.email/messages to view them.`);
        console.log(`Username: ${testAccount.user}`);
        console.log(`Password: ${testAccount.pass}`); 
        console.log('---------------------------------------------------');

    } catch (err) {
        console.error('Failed to create account:', err);
    }
}

setup();
