const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Load config from config.json ─────────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, 'config.json');
function loadConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        console.error('❌ config.json not found.');
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}
const config = loadConfig();
const SHEET_ID   = config.SHEET_ID;
const SHEET_NAME = config.SHEET_NAME;

// ── Sent log: tracks which phone numbers already received a message ───────────
const SENT_LOG_FILE = path.join(__dirname, 'sent_log.json');
function loadSentLog() {
    if (!fs.existsSync(SENT_LOG_FILE)) return {};
    try { return JSON.parse(fs.readFileSync(SENT_LOG_FILE, 'utf8')); } catch { return {}; }
}
function markSent(phone, name) {
    const log = loadSentLog();
    log[phone] = { name, sentAt: new Date().toISOString() };
    fs.writeFileSync(SENT_LOG_FILE, JSON.stringify(log, null, 2));
}
function alreadySent(phone) {
    return !!loadSentLog()[phone];
}

const delay = ms => new Promise(res => setTimeout(res, ms));

// ── HTTP GET with full redirect following ────────────────────────────────────
function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                res.resume();
                const location = res.headers.location;
                if (!location) return reject(new Error('Redirect with no Location header'));
                return httpGet(location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} for URL: ${url}`));
            }
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => resolve(raw));
        }).on('error', reject);
    });
}

// ── Fetch a specific sheet by name ───────────────────────────────────────────
async function fetchSheetRows(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`;
    const raw = await httpGet(url);
    if (raw.trim().startsWith('<!DOCTYPE') || raw.trim().startsWith('<html')) {
        throw new Error(`Sheet "${sheetName}" not found or spreadsheet is not public.`);
    }
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

// ── WhatsApp Client ───────────────────────────────────────────────────────────
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

client.on('qr', (qr) => {
    console.log('Scan the QR code below with WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ WhatsApp Client is ready!');
    console.log(`📋 Config: Sheet="${SHEET_NAME}", ID="${SHEET_ID}"`);

    try {
        console.log(`📄 Fetching sheet: "${SHEET_NAME}"`);
        const rows = await fetchSheetRows(SHEET_NAME);
        console.log(`   Total rows: ${rows.length}`);

        let sentCount = 0, skippedCount = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const name     = row['Customer Name'];
            const phoneRaw = row['Mobile Number'];
            const message  = row['Message'];

            if (!phoneRaw || !name) continue;

            let phone = String(phoneRaw).replace(/[^\d]/g, '');
            if (phone.length === 10) phone = '91' + phone;

            if (phone.length < 12) {
                console.log(`   ⚠️  Invalid phone for ${name}: "${phoneRaw}"`);
                continue;
            }

            // ── Skip if already sent in a previous run ──
            if (alreadySent(phone)) {
                console.log(`   ⏭️  Already sent, skipping: ${name} (${phone})`);
                skippedCount++;
                continue;
            }

            try {
                const text = message ? `Hi ${name}, ${message}` : `Hi ${name}!`;
                await client.sendMessage(`${phone}@c.us`, text);
                markSent(phone, name);
                console.log(`   ✅ Sent to: ${name} (${phone})`);
                sentCount++;
                await delay(40000);
            } catch (err) {
                console.log(`   ❌ Failed for ${name} (${phone}): ${err.message}`);
            }
        }

        console.log(`\n📊 Summary: ${sentCount} sent, ${skippedCount} skipped (already sent)`);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    console.log('🎉 Done!');
    setTimeout(() => process.exit(0), 5000);
});

client.on('auth_failure', msg => console.error('❌ WhatsApp auth failure:', msg));
client.on('disconnected', reason => console.log('⚠️  Disconnected:', reason));

client.initialize();
