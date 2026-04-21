const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const creds = require('./credentials.json');

// Google Sheet సెటప్
const doc = new GoogleSpreadsheet('1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY', new JWT({
  email: creds.client_email,
  key: creds.private_key.replace(/\\n/g, '\n'),
  scopes: ['https://googleapis.com'], // ఇక్కడ లింక్ సరిచేశాను
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

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
    console.log('QR Code generated. Please scan it if session is not saved.');
});

client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');
    
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        for (let row of rows) {
            const name = row.get('Customer Name');
            let phone = row.get('Mobile Number');
            const message = row.get('Message');

            if (!phone || !message) continue; // డేటా లేకపోతే స్కిప్ చేస్తుంది

            // ఫోన్ నంబర్ కి 91 యాడ్ చేయడం మరియు ఫార్మాట్ చేయడం
            phone = phone.toString().replace('+', '').trim();
            if (!phone.startsWith('91')) {
                phone = '91' + phone;
            }
            const finalPhone = `${phone}@c.us`;

            try {
                await client.sendMessage(finalPhone, `Hi ${name}, ${message}`);
                console.log(`Message sent to ${name} (${phone})`);
                
                // 30 సెకన్ల గ్యాప్ (మీరు కావాలంటే 60000 కి పెంచుకోవచ్చు)
                await delay(30000); 
            } catch (err) {
                console.log(`Failed to send to ${name}:`, err);
            }
        }
        console.log('All messages sent!');
    } catch (error) {
        console.error('Error accessing Google Sheet:', error);
    }
    process.exit();
});

client.initialize();
