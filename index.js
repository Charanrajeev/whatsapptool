const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

// 1. WhatsApp Client సెటప్
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

// 2. మీ Google Sheet డైరెక్ట్ CSV లింక్
// ఇందులో ఎటువంటి వేరియబుల్స్ లేవు, నేరుగా లింక్ ఇచ్చాను కాబట్టి Error రాదు
const sheetUrl = "https://docs.google.com/spreadsheets/d/1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY/edit?usp=sharing";

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
        const csvData = response.data;
        
        // డేటాను వరుసలుగా విడగొట్టడం (కామాలు ఉన్నా దెబ్బతినకుండా ఉండే లాజిక్)
        const rows = csvData.split('\n').map(row => {
            return row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/"/g, '').trim());
        });

        console.log(`Total rows found: ${rows.length - 1}`);

        for (let i = 1; i < rows.length; i++) {
            const data = rows[i];
            
            // మీ షీట్ కాలమ్స్ ప్రకారం:
            // Column B (Index 1) = Customer Name
            // Column G (Index 6) = Mobile Number
            // Column J (Index 9) = Message
            const name = data[1];    
            const phoneRaw = data[6]; 
            const message = data[9];  

            if (!phoneRaw || !message || !name) {
                console.log(`Skipping row ${i} due to empty data`);
                continue;
            }

            // ఫోన్ నంబర్ క్లీనింగ్
            let phone = phoneRaw.replace(/[^\d]/g, '');
            if (phone.length === 10) phone = '91' + phone;
            
            if (phone.length >= 12) {
                const finalPhone = `${phone}@c.us`;
                try {
                    await client.sendMessage(finalPhone, `Hi ${name}, ${message}`);
                    console.log(`✅ Message sent to ${name} (${phone})`);
                    
                    // 40 సెకన్ల గ్యాప్ (వాట్సాప్ అకౌంట్ సేఫ్టీ కోసం)
                    await delay(40000); 
                } catch (err) {
                    console.log(`❌ Failed for ${name}: ${err.message}`);
                }
            }
        }
    } catch (error) {
        console.error('Error fetching sheet data:', error.message);
    }
    console.log('Task Completed!');
    setTimeout(() => process.exit(0), 5000);
});

client.initialize();
