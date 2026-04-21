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

// 2. మీ Google Sheet డైరెక్ట్ లింక్ (CSV ఫార్మాట్ లో)
const sheetUrl = "https://google.com";

const delay = ms => new Promise(res => setTimeout(res, ms));

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
    console.log('QR Code generated.');
});

client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');

    try {
        // షీట్ డేటాను పొందడం
        const response = await axios.get(sheetUrl);
        const data = response.data;

        // డేటాను వరుసలుగా విడగొట్టడం
        const rows = data.split('\n').map(row => row.split(','));
        console.log("Total rows found: " + (rows.length - 1));

        for (let i = 1; i < rows.length; i++) {
            let [name, phoneRaw, message] = rows[i];

            // డేటా ఖాళీగా ఉంటే స్కిప్ చేయడం
            if (!phoneRaw || !message) continue;

            // అనవసరమైన గుర్తులు తీసేయడం
            name = name.replace(/"/g, '').trim();
            message = message.replace(/"/g, '').trim();
            let phone = phoneRaw.replace(/[^\d]/g, '').trim();

            // 10 అంకెల నంబర్ అయితే 91 యాడ్ చేయడం
            if (phone.length === 10) phone = '91' + phone;
            const finalPhone = `${phone}@c.us`;

            try {
                await client.sendMessage(finalPhone, `Hi ${name}, ${message}`);
                console.log(`✅ Message sent to ${name} (${phone})`);
                
                // 30 సెకన్ల గ్యాప్ (WhatsApp అకౌంట్ సేఫ్టీ కోసం)
                await delay(30000); 
            } catch (err) {
                console.log(`❌ Failed for ${name}:`, err.message);
            }
        }
    } catch (error) {
        console.error('Error fetching sheet data:', error.message);
    }

    console.log('All tasks finished!');
    // పని పూర్తయ్యాక 10 సెకన్ల తర్వాత బాట్ ని ఆపేయడం
    setTimeout(() => { process.exit(0); }, 10000);
});

client.initialize();
