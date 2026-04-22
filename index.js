const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// మీ షీట్ ఐడి మరియు నేరుగా CSV లింక్
const sheetId = '1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY';
const sheetUrl = `https://google.com{sheetId}/gviz/tq?tqx=out:csv`;

const delay = ms => new Promise(res => setTimeout(res, ms));

client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');
    try {
        const response = await axios.get(sheetUrl);
        const csvData = response.data;
        
        // డేటాను క్లీన్ గా వరుసలుగా మార్చడం
        const rows = csvData.split('\n').map(row => {
            return row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/"/g, '').trim());
        });

        console.log(`Total rows found: ${rows.length - 1}`);

        for (let i = 1; i < rows.length; i++) {
            const data = rows[i];
            
            // మీ షీట్ కాలమ్స్ ప్రకారం (B=1, G=6, J=9)
            const name = data[1];    // Column B
            const phoneRaw = data[6]; // Column G
            const message = data[9];  // Column J

            if (!phoneRaw || !message || !name) continue;

            let phone = phoneRaw.replace(/[^\d]/g, '');
            if (phone.length === 10) phone = '91' + phone;
            
            if (phone.length >= 12) {
                try {
                    await client.sendMessage(`${phone}@c.us`, `Hi ${name}, ${message}`);
                    console.log(`✅ Message sent to ${name} (${phone})`);
                    await delay(40000); 
                } catch (err) {
                    console.log(`❌ Failed for ${name}`);
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
