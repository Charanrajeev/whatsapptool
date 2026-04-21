const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const creds = require('./credentials.json'); // మీ Google JSON ఫైల్

// Google Sheet సెటప్
const doc = new GoogleSpreadsheet('1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY', new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://googleapis.com'],
}));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome', // ఇది ఖచ్చితంగా ఉండాలి
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});



const delay = ms => new Promise(res => setTimeout(res, ms));

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
    console.log('QR Code generated. Please scan it if session is not saved.');
});

client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');
    
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    for (let row of rows) {
        const name = row.get('Customer Name');
        const phone = row.get('Mobile Number').replace('+', '').trim();
        const message = row.get('Message');
        const finalPhone = phone.includes('@c.us') ? phone : `${phone}@c.us`;

        try {
            await client.sendMessage(finalPhone, `Hi ${name}, ${message}`);
            console.log(`Message sent to ${name} (${phone})`);
            
            // 1 నిమిషం గ్యాప్ (60000 ms) - మీకు నచ్చినంత మార్చుకోండి
            await delay(60000); 
        } catch (err) {
            console.log(`Failed to send to ${name}:`, err);
        }
    }
    console.log('All messages sent!');
    process.exit();
});

client.initialize();
