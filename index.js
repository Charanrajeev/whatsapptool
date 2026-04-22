const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const https = require('https');

// ── Google Sheet: make the sheet public ("Anyone with the link" = Viewer) ───
// Then use this CSV export URL (no login / service account needed)
const SHEET_ID = '1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

const delay = ms => new Promise(res => setTimeout(res, ms));

// ── Fetch CSV and parse into array of objects ────────────────────────────────
function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            // Follow ALL redirects (301, 302, 303, 307, 308)
            if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                res.resume(); // drain to free socket
                const location = res.headers.location;
                if (!location) return reject(new Error('Redirect received but no Location header'));
                return fetchCSV(location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} fetching sheet. Make sure the sheet is set to "Anyone with the link can view".`));
            }
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => resolve(raw));
        }).on('error', reject);
    });
}

function parseCSV(raw) {
    const lines = raw.trim().split('\n');
    const headers = splitCSVRow(lines[0]);
    console.log('Sheet headers:', headers);
    return lines.slice(1).map(line => {
        const cols = splitCSVRow(line);
        const obj = {};
        headers.forEach((h, i) => obj[h.trim()] = (cols[i] || '').trim());
        return obj;
    });
}

// Handles quoted fields with commas inside
function splitCSVRow(row) {
    const result = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === ',' && !inQuote) { result.push(cur); cur = ''; }
        else { cur += ch; }
    }
    result.push(cur);
    return result;
}

// ── WhatsApp Client ──────────────────────────────────────────────────────────
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

// Show QR code for login
client.on('qr', (qr) => {
    console.log('Scan the QR code below with WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ WhatsApp Client is ready!');
    try {
        console.log('Fetching sheet data...');
        const csv = await fetchCSV(CSV_URL);
        const rows = parseCSV(csv);
        console.log(`Total rows: ${rows.length}`);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            // These must match your exact column header names in the sheet
            const name     = row['Name'];    // Column B
            const phoneRaw = row['Phone'];   // Column G
            const message  = row['Message']; // Column J

            console.log(`Row ${i + 1}: Name=${name}, Phone=${phoneRaw}`);

            if (!phoneRaw || !name) {
                console.log(`Skipping row ${i + 1}: missing name or phone`);
                continue;
            }

            let phone = String(phoneRaw).replace(/[^\d]/g, '');
            if (phone.length === 10) phone = '91' + phone;

            if (phone.length >= 12) {
                try {
                    const text = message ? `Hi ${name}, ${message}` : `Hi ${name}!`;
                    await client.sendMessage(`${phone}@c.us`, text);
                    console.log(`✅ Sent to: ${name} (${phone})`);
                    await delay(40000);
                } catch (err) {
                    console.log(`❌ Failed for ${name} (${phone}): ${err.message}`);
                }
            } else {
                console.log(`⚠️  Invalid phone for ${name}: "${phoneRaw}"`);
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    console.log('🎉 Task Completed!');
    setTimeout(() => process.exit(0), 5000);
});

client.on('auth_failure', msg => console.error('❌ WhatsApp auth failure:', msg));
client.on('disconnected', reason => console.log('⚠️  Disconnected:', reason));

client.initialize();
