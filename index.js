const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const https = require('https');

const SHEET_ID = '1JwR6E00bYYOmds5lINQrmFQnRpwjlfeHIMYFB9U7g3I';

// ── Set the sheet name you want to process ───────────────────────────────────
const SHEET_NAME = 'Sheet1'; // ← Change this to your sheet name

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

// ── Discover all sheets (name + gid) from the spreadsheet HTML ───────────────
async function getAllSheets() {
    const html = await httpGet(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);
    // Google embeds sheet metadata as: ["SheetName",null,GID]
    const matches = [...html.matchAll(/"([^"]+)",null,(\d+)/g)];
    if (!matches.length) throw new Error('Could not find any sheets. Is the spreadsheet public?');
    const sheets = matches.map(m => ({ name: m[1], gid: m[2] }));
    console.log('Found sheets:', sheets.map(s => `"${s.name}" (gid=${s.gid})`).join(', '));
    return sheets;
}

// ── CSV fetch + parse ─────────────────────────────────────────────────────────
async function fetchSheetRows(gid) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    const raw = await httpGet(url);
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
        const allSheets = await getAllSheets();
        const sheet = allSheets.find(s => s.name.toLowerCase() === SHEET_NAME.toLowerCase());
        if (!sheet) {
            throw new Error(`Sheet "${SHEET_NAME}" not found. Available sheets: ${allSheets.map(s => `"${s.name}"`).join(', ')}`);
        }

        console.log(`📄 Processing sheet: "${sheet.name}"`);
        const rows = await fetchSheetRows(sheet.gid);
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
                    const text = message;
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
