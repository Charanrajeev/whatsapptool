const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// GitHub Secrets నుండి కీ ని చదవడం
const creds = JSON.parse(process.env.GOOGLE_JSON);

const doc = new GoogleSpreadsheet('1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY', new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://googleapis.com'],
}));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }
});

const delay = ms => new Promise(res => setTimeout(res, ms));

client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        console.log(`Total rows found: ${rows.length}`);

        for (let row of rows) {
            // మీ షీట్ కాలమ్ హెడర్స్ ఖచ్చితంగా ఇవే ఉండాలి
            const name = row.get('Customer Name');
            const phone = row.get('Mobile Number');
            const message = row.get('Message');

            if (!phone) continue;

            let cleanPhone = phone.toString().replace(/[^\d]/g, '');
            if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
            
            try {
                await client.sendMessage(`${cleanPhone}@c.us`, `Hi ${name}, ${message}`);
                console.log(`✅ Sent to ${name}`);
                await delay(30000); 
            } catch (err) {
                console.log(`❌ Failed for ${name}`);
            }
        }
    } catch (e) { console.log("Error: " + e.message); }
    process.exit(0);
});

client.initialize();
