const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// GitHub Secrets నుండి JSON ని పొందడం
const creds = JSON.parse(process.env.GOOGLE_JSON);

const doc = new GoogleSpreadsheet('1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY', new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://googleapis.com'],
}));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

const delay = ms => new Promise(res => setTimeout(res, ms));

client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['Sheet1']; // మీ షీట్ పేరు సరిచూసుకోండి
        const rows = await sheet.getRows();
        console.log(`Total rows found: ${rows.length}`);

        for (let row of rows) {
            // మీ షీట్ లోని హెడర్ నేమ్స్ ఇవే ఉండాలి
            const name = row.get('Customer Name');
            const phone = row.get('Mobile Number');
            const message = row.get('Message');

            if (!phone || !message) continue;

            let cleanPhone = phone.toString().replace(/[^\d]/g, '');
            if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
            
            const finalPhone = `${cleanPhone}@c.us`;

            try {
                await client.sendMessage(finalPhone, `Hi ${name}, ${message}`);
                console.log(`✅ Message sent to ${name} (${cleanPhone})`);
                await delay(30000); // 30 సెకన్ల గ్యాప్
            } catch (err) {
                console.log(`❌ Failed for ${name}:`, err.message);
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
    console.log('All tasks finished!');
    setTimeout(() => { process.exit(0); }, 5000);
});

client.initialize();
