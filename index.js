const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const https = require('https');

const SHEET_ID = '1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY';

// ── Set the exact sheet tab name you want to process ─────────────────────────
const SHEET_NAME = 'interest calls'; // ← Change this to your sheet tab name

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

// ── Fetch a specific sheet by name directly ───────────────────────────────────
async function fetchSheetRows(sheetName) {
    // Google supports fetching by sheet name via the 'sheet' parameter
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`;
    const raw = await httpGet(url);
    if (raw.trim().startsWith('<!DOCTYPE') || raw.trim().startsWith('<html')) {
        throw new Error(`Sheet "${sheetName}" not found or spreadsheet is not public.`);
    }
    return parseCSV(raw);
}

function parseCSV(raw) {
    const lines = raw.trim().split('\n');
    const headers = splitCSVRow(lines[0]).map(h => h.trim().replace(/\r/g, ''));
    return lines.slice(1).map(line => {
        const cols = splitCSVRow(line);
        const obj = {};
        headers.forEach((h, i) => obj[h] = (cols[i] || '').trim().replace(/\r/g, ''));
        return obj;
    });
}

function splitCSVRow(row) {
    const result = [];
    let cur = '', inQuote = false;
    for (const ch of row) {
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === ',' && !inQuote) { result.push(cur); cur = ''; }
        else { cur += ch; }
    }
    result.push(cur);
    return result;
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
    try {
        console.log(`📄 Fetching sheet: "${SHEET_NAME}"`);
        const rows = await fetchSheetRows(SHEET_NAME);
        console.log(`   Rows found: ${rows.length}`);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const name     = row['Customer Name'];
            const phoneRaw = row['Mobile Number'];
            const message  = row['Message'];

            if (!phoneRaw || !name) continue;

            let phone = String(phoneRaw).replace(/[^\d]/g, '');
            if (phone.length === 10) phone = '91' + phone;

            if (phone.length >= 12) {
                try {
                    const text = message ? `Hi ${name}, ${message}` : `Hi ${name}!`;
                    await client.sendMessage(`${phone}@c.us`, text);
                    console.log(`   ✅ Sent to: ${name} (${phone})`);
                    await delay(40000);
                } catch (err) {
                    console.log(`   ❌ Failed for ${name} (${phone}): ${err.message}`);
                }
            } else {
                console.log(`   ⚠️  Invalid phone for ${name}: "${phoneRaw}"`);
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    console.log('\n🎉 All sheets processed!');
    setTimeout(() => process.exit(0), 5000);
});

client.on('auth_failure', msg => console.error('❌ WhatsApp auth failure:', msg));
client.on('disconnected', reason => console.log('⚠️  Disconnected:', reason));

client.initialize();
