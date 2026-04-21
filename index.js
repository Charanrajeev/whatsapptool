const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const creds = require('./credentials.json');


// Google Sheet సెటప్
const doc = new GoogleSpreadsheet('1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY', new JWT({
  email: creds.client_email,
  // కీ ని పక్కాగా ఫార్మాట్ చేసే పద్ధతి
  key: creds.private_key.replace(/\\n/g, '\n'), 
  scopes: [
    'https://googleapis.com',
    'https://googleapis.com'
  ],
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

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
    console.log('QR Code generated. Please scan it if session is not saved.');
});

client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');
    
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0]; // మొదటి షీట్ తీసుకుంటుంది
        
        // మీ షీట్‌లో హెడర్స్ ఎక్కడ ఉన్నాయో స్పష్టంగా చెప్పడానికి offset వాడుతున్నాం
        // ఒకవేళ మీ హెడర్స్ Row 1 లో ఉంటే { offset: 0 } వాడాలి
        const rows = await sheet.getRows({ offset: 0 }); 
        console.log(`Total rows found: ${rows.length}`);

        for (let row of rows) {
            // షీట్ లో ఉన్న కాలమ్ పేర్లు ఖచ్చితంగా ఇవే అయి ఉండాలి
            const name = row.get('Customer Name');
            let phone = row.get('Mobile Number');
            const message = row.get('Message');

            console.log(`Checking Row: Name=${name}, Phone=${phone}`);

            if (!phone || !message) {
                console.log("Skipping row due to missing Phone or Message");
                continue;
            }

            // ఫోన్ నంబర్ క్లీనింగ్ మరియు 91 యాడ్ చేయడం
            let formattedPhone = phone.toString().replace(/[^\d]/g, '').trim();
            if (formattedPhone.length === 10) {
                formattedPhone = '91' + formattedPhone;
            }
            const finalPhone = `${formattedPhone}@c.us`;

            try {
                await client.sendMessage(finalPhone, `Hi ${name}, ${message}`);
                console.log(`✅ Message sent to ${name} (${formattedPhone})`);
                await delay(30000); // 30 సెకన్ల గ్యాప్
            } catch (err) {
                console.log(`❌ Failed to send to ${name}:`, err.message);
            }
        }
        console.log('All messages processed!');
    } catch (error) {
        console.error('Error accessing Google Sheet:', error);
    }
    
    // అన్ని మెసేజ్‌లు వెళ్ళాక బాట్ ని ఆపేయడానికి
    console.log("Task finished. Closing...");
    setTimeout(() => { process.exit(); }, 5000); 
});

client.initialize();
