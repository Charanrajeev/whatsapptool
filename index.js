const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// GitHub Secrets నుండి JSON పొందడం
let creds;
try {
    creds = JSON.parse(process.env.GOOGLE_JSON);
} catch (e) {
    console.error("Error parsing GOOGLE_JSON secret. Check if it's a valid JSON.");
    process.exit(1);
}

// Private Key ని సరిగ్గా ఫార్మాట్ చేసే పద్ధతి
const formattedKey = creds.private_key.replace(/\\n/g, '\n');

const doc = new GoogleSpreadsheet('1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY', new JWT({
  email: creds.client_email,
  key: formattedKey,
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
        // ఇక్కడ మీ షీట్ కింద ఉన్న పేరు ఇవ్వండి (ఉదా: 'InterestDemand')
        const sheet = doc.sheetsByTitle['InterestDemand'] || doc.sheetsByIndex[0];
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
                await delay(35000); // 35 సెకన్ల గ్యాప్
            } catch (err) {
                console.log(`❌ Failed for ${name}: ${err.message}`);
            }
        }
    } catch (e) {
        console.error('Google API Error Detail:', e.message);
    }
    console.log('Task finished.');
    setTimeout(() => process.exit(0), 5000);
});

client.initialize();
