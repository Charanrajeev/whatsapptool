const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

const sheetUrl = "https://google.com";

const delay = ms => new Promise(res => setTimeout(res, ms));

client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');
    try {
        const response = await axios.get(sheetUrl);
        // డేటాను క్లీన్ గా వరుసలుగా మార్చడం
        const rows = response.data.split('\n').map(row => {
            return row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/"/g, '').trim());
        });

        console.log(`Total rows fetched: ${rows.length}`);

        // i=1 (Header) నుండి మొదలుపెట్టి ప్రతి వరుసను చెక్ చేద్దాం
        for (let i = 1; i < rows.length; i++) {
            const data = rows[i];
            
            // మీ స్క్రీన్‌షాట్ ప్రకారం డేటా ఈ కాలమ్స్ లో ఉంది:
            let name = data[1];    // Column B
            let phoneRaw = data[6]; // Column G
            let message = data[9];  // Column J

            console.log(`Row ${i}: Name=${name}, Phone=${phoneRaw}`);

            if (!phoneRaw || phoneRaw === "" || !name) {
                console.log(`Skipping row ${i} due to empty data`);
                continue;
            }

            let phone = phoneRaw.replace(/[^\d]/g, '').trim();
            if (phone.length === 10) phone = '91' + phone;
            
            if (phone.length >= 12) {
                try {
                    await client.sendMessage(`${phone}@c.us`, `Hi ${name}, ${message}`);
                    console.log(`✅ Sent to: ${name} (${phone})`);
                    await delay(40000); 
                } catch (err) {
                    console.log(`❌ Failed for ${name}: ${err.message}`);
                }
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
    console.log('Task Completed!');
    setTimeout(() => process.exit(0), 5000);
});

client.initialize();
