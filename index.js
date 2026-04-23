const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeImage = require('qrcode');
const nodemailer = require('nodemailer');
const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// ── Environment Variables ─────────────────────────────────────────────────────
const SHEET_ID       = process.env.SHEET_ID       || '1JwR6E00bYYOmds5lINQrmFQnRpwjlfeHIMYFB9U7g3I';
const SHEET_NAME     = process.env.SHEET_NAME     || 'Sheet1';
const PHONE_COLUMN   = process.env.PHONE_COLUMN   || 'Mobile Number';
const MESSAGE_COLUMN = process.env.MESSAGE_COLUMN || 'Message';
const EMAIL_USER     = process.env.EMAIL_USER;
const EMAIL_PASS     = process.env.EMAIL_PASS;
const GOOGLE_CREDS   = process.env.GOOGLE_JSON;
const GDRIVE_FILE_ID = process.env.GDRIVE_FILE_ID; // session file ID in Drive

const SESSION_DIR    = '.wwebjs_auth';
const SESSION_FILE   = 'wa_session.tar.gz';

const delay = ms => new Promise(res => setTimeout(res, ms));

// ── Google Drive Auth ─────────────────────────────────────────────────────────
function getDriveClient() {
    const creds = JSON.parse(GOOGLE_CREDS);
    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/drive'],
    });
    return google.drive({ version: 'v3', auth });
}

// ── Download session from Google Drive ───────────────────────────────────────
async function downloadSession() {
    if (!GDRIVE_FILE_ID || !GOOGLE_CREDS) {
        console.log('⚠️  No GDRIVE_FILE_ID — skipping session download.');
        return false;
    }
    try {
        console.log('📥 Downloading session from Google Drive...');
        const drive = getDriveClient();
        const dest = fs.createWriteStream(SESSION_FILE);
        const res = await drive.files.get(
            { fileId: GDRIVE_FILE_ID, alt: 'media' },
            { responseType: 'stream' }
        );
        await new Promise((resolve, reject) => {
            res.data.pipe(dest);
            res.data.on('end', resolve);
            res.data.on('error', reject);
        });
        execSync(`mkdir -p ${SESSION_DIR} && tar -xzf ${SESSION_FILE} -C ${SESSION_DIR}`);
        console.log('✅ Session restored from Google Drive!');
        return true;
    } catch (err) {
        console.log('⚠️  Session download failed:', err.message);
        return false;
    }
}

// ── Upload session to Google Drive ───────────────────────────────────────────
async function uploadSession() {
    if (!GOOGLE_CREDS) return;
    try {
        console.log('📤 Uploading session to Google Drive...');
        execSync(`tar -czf ${SESSION_FILE} -C ${SESSION_DIR} .`);
        const drive = getDriveClient();
        const fileSize = fs.statSync(SESSION_FILE).size;
        console.log(`   Session size: ${(fileSize / 1024 / 1024).toFixed(1)} MB`);

        const media = {
            mimeType: 'application/gzip',
            body: fs.createReadStream(SESSION_FILE),
        };

        let fileId = GDRIVE_FILE_ID;

        if (fileId) {
            // Update existing file
            await drive.files.update({ fileId, media });
            console.log('✅ Session updated in Google Drive! File ID:', fileId);
        } else {
            // Create new file
            const res = await drive.files.create({
                requestBody: { name: 'wa_session.tar.gz' },
                media,
            });
            fileId = res.data.id;
            console.log('✅ Session uploaded to Google Drive!');
            console.log('🔑 IMPORTANT: Save this File ID as GDRIVE_FILE_ID secret:', fileId);
        }
    } catch (err) {
        console.error('❌ Session upload failed:', err.message);
    }
}

// ── HTTP GET ──────────────────────────────────────────────────────────────────
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
        throw new Error(`Sheet "${sheetName}" not found or not public.`);
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
        } else { cur += ch; }
    }
    if (cur || cols.length) { cols.push(cur); rows.push(cols); }
    return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    // Session download చేయండి
    await downloadSession();

    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            executablePath: '/usr/bin/google-chrome',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
    });

    // QR వస్తే email పంపండి
    client.on('qr', async (qr) => {
        console.log('📱 QR Code received!');
        qrcodeTerminal.generate(qr, { small: true });

        if (!EMAIL_USER || !EMAIL_PASS) return;
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
                subject: '⚠️ WhatsApp Logged Out - Scan QR',
                text: 'WhatsApp session expired! Scan the attached QR in WhatsApp → Linked Devices.',
                attachments: [{ filename: 'whatsapp-qr.png', path: qrPath }]
            });
            console.log('📧 QR emailed to:', EMAIL_USER);
        } catch (err) {
            console.error('❌ Email failed:', err.message);
        }
    });

    client.on('ready', async () => {
        console.log('✅ WhatsApp ready!');

        // Messages పంపండి
        try {
            const rows = await fetchSheetRows(SHEET_NAME);
            console.log(`   Rows: ${rows.length}`);

            for (const row of rows) {
                const phoneRaw = row[PHONE_COLUMN];
                const message  = row[MESSAGE_COLUMN];
                if (!phoneRaw || !message) continue;

                let phone = String(phoneRaw).replace(/[^\d]/g, '');
                if (phone.length === 10) phone = '91' + phone;

                if (phone.length >= 12) {
                    try {
                        await client.sendMessage(`${phone}@c.us`, message);
                        console.log(`   ✅ Sent: ${phone}`);
                        await delay(40000);
                    } catch (err) {
                        console.log(`   ❌ Failed ${phone}: ${err.message}`);
                    }
                }
            }
        } catch (err) {
            console.error('❌ Sheet error:', err.message);
        }

        // Session upload చేయండి
        await uploadSession();

        console.log('\n🎉 Done!');
        setTimeout(() => process.exit(0), 5000);
    });

    client.on('auth_failure', msg => console.error('❌ Auth failure:', msg));
    client.on('disconnected', reason => console.log('⚠️ Disconnected:', reason));

    client.initialize();
}

main();
