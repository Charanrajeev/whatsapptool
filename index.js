const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');  // ← పేరు change చేశాను
const qrcodeImage = require('qrcode');               // ← కొత్తది add చేశాను
const nodemailer = require('nodemailer');             // ← కొత్తది add చేశాను
const https = require('https');

// ── Environment Variables ─────────────────────────────────────────────────────
const SHEET_ID       = process.env.SHEET_ID       || '1JwR6E00bYYOmds5lINQrmFQnRpwjlfeHIMYFB9U7g3I';
const SHEET_NAME     = process.env.SHEET_NAME     || 'Sheet1';
const PHONE_COLUMN   = process.env.PHONE_COLUMN   || 'Mobile Number';
const MESSAGE_COLUMN = process.env.MESSAGE_COLUMN || 'Message';
const EMAIL_USER     = process.env.EMAIL_USER;
const EMAIL_PASS     = process.env.EMAIL_PASS;

console.log(`📋 Sheet ID: ${SHEET_ID}`);
console.log(`📄 Sheet Name: ${SHEET_NAME}`);
console.log(`📞 Phone Column: ${PHONE_COLUMN}`);
console.log(`💬 Message Column: ${MESSAGE_COLUMN}`);

const delay = ms => new Promise(res => setTimeout(res, ms));

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                res.resume();
                const location = res.headers.location;
                if (!location) return reject(new Error('Redirect with no Location header'));
                return httpGet(location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200)
                return reject(new Error(`HTTP ${res.statusCode} for URL: ${url}`));
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => resolve(raw));
        }).on('error', reject);
    });
}

async function fetchSheetRows(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`;
    const raw = await httpGet(url);
    if (raw.trim().startsWith('<!DOCTYPE') || raw.trim().startsWith('<html'))
        throw new Error(`Sheet "${sheetName}" not found or spreadsheet is not public.`);
    return parseCSV(raw);
}

function parseCSV(raw) {
    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows = splitCSVRows(normalized);
    const headers = rows[0].map(h => h.trim());
    console.log('   Headers:', headers);
    return rows.slice(1).map(cols => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = (cols[i] || '').trim());
        return obj;
    });
}

function splitCSVRows(raw) {
    const rows = [];
    let cols = [], cur = '', inQuote = false;
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === '"') {
            if (inQuote && raw[i + 1] === '"') { cur += '"'; i++; }
            else { inQuote = !inQuote; }
        } else if (ch === ',' && !inQuote) {
            cols.push(cur); cur = '';
        } else if (ch === '\n' && !inQuote) {
            cols.push(cur); cur = '';
            if (cols.some(c => c !== '') || rows.length === 0) rows.push(cols);
            cols = [];
        } else {
            cur += ch;
        }
    }
    if (cur || cols.length) { cols.push(cur); rows.push(cols); }
    return rows;
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

// ── QR Code → Terminal + Email ────────────────────────────────────────────────
client.on('qr', async (qr) => {
    console.log('📱 Scan the QR code:');
    qrcodeTerminal.generate(qr, { small: true });

    if (!EMAIL_USER || !EMAIL_PASS) {
        console.log('⚠️  EMAIL secrets not set — skipping email.');
        return;
    }

    try {
        const qrPath = '/tmp/whatsapp-qr.png';
        await qrcodeImage.toFile(qrPath, qr);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: EMAIL_USER, pass: EMAIL_PASS }
        });

        await transporter.sendMail({
            from: EMAIL_USER,
            to: EMAIL_USER,
            subject: '⚠️ WhatsApp Logged Out - Scan QR to Login',
            text: 'WhatsApp session expired! Open the attached QR image and scan it in WhatsApp → Linked Devices.',
            attachments: [{ filename: 'whatsapp-qr.png', path: qrPath }]
        });

        console.log('📧 QR code emailed to:', EMAIL_USER);
    } catch (err) {
        console.error('❌ Email send failed:', err.message);
    }
});

client.on('ready', async () => {
    console.log('✅ WhatsApp Client is ready!');
    try {
        console.log(`📄 Fetching sheet: "${SHEET_NAME}"`);
        const rows = await fetchSheetRows(SHEET_NAME);
        console.log(`   Rows found: ${rows.length}`);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const phoneRaw = row[PHONE_COLUMN];
            const message  = row[MESSAGE_COLUMN];

            if (!phoneRaw || !message) continue;

            let phone = String(phoneRaw).replace(/[^\d]/g, '');
            if (phone.length === 10) phone = '91' + phone;

            if (phone.length >= 12) {
                try {
                    await client.sendMessage(`${phone}@c.us`, message);
                    console.log(`   ✅ Sent to: ${phone}`);
                    await delay(40000);
                } catch (err) {
                    console.log(`   ❌ Failed for ${phone}: ${err.message}`);
                }
            } else {
                console.log(`   ⚠️  Invalid phone: "${phoneRaw}"`);
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    console.log('\n🎉 Done!');
    setTimeout(() => process.exit(0), 5000);
});

client.on('auth_failure', msg => console.error('❌ Auth failure:', msg));
client.on('disconnected', reason => console.log('⚠️ Disconnected:', reason));

client.initialize();
