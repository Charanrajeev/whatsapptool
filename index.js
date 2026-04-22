const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// GitHub Secrets నుండి చదవడం
const creds = JSON.parse(process.env.GOOGLE_JSON);

const doc = new GoogleSpreadsheet('1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY', new JWT({
  email: creds.client_email,
  // కీ లో ఉన్న లైన్ బ్రేక్స్ ని సరిచేసే పద్ధతి
  key: creds.private_key.replace(/\\n/g, '\n'), 
  scopes: ['https://googleapis.com'],
}));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

const delay = ms => new Promise(res => setTimeout(res, ms));

client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');
    try {
        await doc.loadInfo();
        // మీ షీట్ కింద ఉన్న పేరు 'Sheet1' అని ఉందో లేదో చూడండి
        const sheet = doc.sheetsByIndex[0]; 
        const rows = await sheet.getRows();
        console.log(`Total rows found: ${rows.length}`);

        for (let row of rows) {
            const name = row.get('Customer Name');
            const phone = row.get('Mobile Number');
            const message = row.get('Message');

            if (!phone || !message) continue;

            let cleanPhone = phone.toString().replace(/[^\d]/g, '');
            if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
            
            try {
                await client.sendMessage(`${cleanPhone}@c.us`, `Hi ${name}, ${message}`);
                console.log(`✅ Message sent to ${name}`);
                // వాట్సాప్ అకౌంట్ సేఫ్టీ కోసం 40 సెకన్ల గ్యాప్
                await delay(40000); 
            } catch (err) {
                console.log(`❌ Failed for ${name}: ${err.message}`);
            }
        }
    } catch (e) {
        console.error('Google API Error:', e.message);
    }
    console.log('Task finished.');
    setTimeout(() => process.exit(0), 5000);
});

client.initialize();
