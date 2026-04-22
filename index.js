const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const credentials = require('./credentials.json');

// ── Google Sheet ID ──────────────────────────────────────────────────────────
// Extracted from your sheet URL:
// https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit?...
const SHEET_ID = '1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY';

const delay = ms => new Promise(res => setTimeout(res, ms));

// ── WhatsApp Client ──────────────────────────────────────────────────────────
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

// FIX 1: Register the QR event so you can actually scan and log in
client.on('qr', (qr) => {
    console.log('Scan the QR code below with WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ WhatsApp Client is ready!');

    try {
        // FIX 2: Use google-spreadsheet + service account credentials properly
        const auth = new JWT({
            email: credentials.client_email,
            key: credentials.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const doc = new GoogleSpreadsheet(SHEET_ID, auth);
        await doc.loadInfo();

        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        console.log(`Total rows fetched: ${rows.length}`);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            // Adjust these header names to match your actual Google Sheet column headers
            const name     = row.get('Name');    // Column B header
            const phoneRaw = row.get('Phone');   // Column G header
            const message  = row.get('Message'); // Column J header

            console.log(`Row ${i + 1}: Name=${name}, Phone=${phoneRaw}`);

            if (!phoneRaw || !name) {
                console.log(`Skipping row ${i + 1} due to empty data`);
                continue;
            }

            // FIX 3: Proper phone number normalisation
            let phone = String(phoneRaw).replace(/[^\d]/g, '').trim();
            if (phone.length === 10) phone = '91' + phone;

            if (phone.length >= 12) {
                try {
                    const text = message
                        ? `Hi ${name}, ${message}`
                        : `Hi ${name}!`;

                    await client.sendMessage(`${phone}@c.us`, text);
                    console.log(`✅ Sent to: ${name} (${phone})`);
                    await delay(40000); // 40s delay to avoid spam detection
                } catch (err) {
                    console.log(`❌ Failed for ${name} (${phone}): ${err.message}`);
                }
            } else {
                console.log(`⚠️  Invalid phone for ${name}: "${phoneRaw}" → "${phone}"`);
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    console.log('🎉 Task Completed!');
    setTimeout(() => process.exit(0), 5000);
});

client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failure:', msg);
});

client.on('disconnected', (reason) => {
    console.log('⚠️  Client disconnected:', reason);
});

client.initialize();
