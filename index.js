const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

const sheetUrl = "https://google.com";
const delay = ms => new Promise(res => setTimeout(res, ms));

client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');
    try {
        const response = await axios.get(sheetUrl);
        const rows = response.data.split('\n').map(row => row.split(','));
        
        console.log("Total rows found: " + (rows.length - 1));

        for (let i = 1; i < rows.length; i++) {
            let data = rows[i];

            // మీ షీట్ ప్రకారం కాలమ్స్ ఇక్కడ సెట్ చేస్తున్నాను:
            let name = data[1];    // Column B (Customer Name)
            let phoneRaw = data[6]; // Column G (Mobile Number)
            let message = data[9];  // Column J (Message)

            if (!phoneRaw || !message || !name) continue;

            name = name.replace(/"/g, '').trim();
            message = message.replace(/"/g, '').trim();
            let phone = phoneRaw.replace(/[^\d]/g, '').trim();

            if (phone.length === 10) phone = '91' + phone;
            if (phone.length < 12) continue; // నంబర్ సరిగ్గా లేకపోతే స్కిప్

            const finalPhone = `${phone}@c.us`;

            try {
                await client.sendMessage(finalPhone, `Hi ${name}, ${message}`);
                console.log(`✅ Message sent to ${name} (${phone})`);
                await delay(30000); 
            } catch (err) {
                console.log(`❌ Failed for ${name}:`, err.message);
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
    console.log('All tasks finished!');
    setTimeout(() => process.exit(0), 5000);
});

client.initialize();
