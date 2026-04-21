const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// 1. WhatsApp Client సెటప్
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// 2. Google Sheet సెటప్ (CSV పద్ధతి)
const sheetId = '1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY';
const sheetUrl = `https://google.com{sheetId}/export?format=csv`;

const delay = ms => new Promise(res => setTimeout(res, ms));

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
    console.log('QR Code generated.');
});

client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');

    try {
        const response = await axios.get(sheetUrl);
        // CSV డేటాను వరుసలుగా మార్చడం
        const rows = response.data.split('\n').map(row => row.split(','));
        
        console.log("Total rows found: " + (rows.length - 1));

        for (let i = 1; i < rows.length; i++) {
            let [name, phoneRaw, message] = rows[i];

            if (!phoneRaw || !message) continue;

            // డేటాలో అనవసరమైన గుర్తులు తీసేయడం
            name = name.replace(/"/g, '').trim();
            message = message.replace(/"/g, '').trim();
            let phone = phoneRaw.replace(/[^\d]/g, '').trim();

            if (phone.length === 10) phone = '91' + phone;
            const finalPhone = `${phone}@c.us`;

            try {
                await client.sendMessage(finalPhone, `Hi ${name}, ${message}`);
                console.log(`✅ Message sent to ${name} (${phone})`);
                
                // 30 సెకన్ల గ్యాప్
                await delay(30000); 
            } catch (err) {
                console.log(`❌ Failed for ${name}:`, err.message);
            }
        }
    } catch (error) {
        console.error('Error fetching sheet data:', error.message);
    }

    console.log('All tasks finished!');
    setTimeout(() => process.exit(0), 5000);
});

client.initialize();
