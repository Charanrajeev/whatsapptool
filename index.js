const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// మీ Sheet ID ఇక్కడ ఇవ్వండి
const sheetId = '1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY';
// CSV ఫార్మాట్ లో డేటా పొందడానికి URL
const sheetUrl = `https://google.com{sheetId}/export?format=csv`;

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
});

client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');

    try {
        // Sheet డేటాను CSV ఫార్మాట్‌లో డౌన్‌లోడ్ చేయడం
        const response = await axios.get(sheetUrl);
        const data = response.data.split('\n').map(row => row.split(','));

        // మొదటి వరుసలో హెడర్స్ ఉంటాయి, కాబట్టి i = 1 నుండి మొదలుపెట్టాలి
        for (let i = 1; i < data.length; i++) {
            const [name, phoneRaw, message] = data[i];

            if (!phoneRaw || !message) continue;

            // ఫోన్ నంబర్ క్లీన్ చేయడం
            let phone = phoneRaw.replace(/[^\d]/g, '').trim();
            if (phone.length === 10) phone = '91' + phone;
            const finalPhone = `${phone}@c.us`;

            try {
                await client.sendMessage(finalPhone, `Hi ${name}, ${message}`);
                console.log(`✅ Sent to ${name} (${phone})`);
                await delay(30000); // 30 సెకన్ల గ్యాప్
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
