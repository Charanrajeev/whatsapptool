const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const creds = require('./credentials.json');


// Google Sheet సెటప్
const doc = new GoogleSpreadsheet('1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY', new JWT({
  email: "whatsapp-bot@whatsappservice-494021.iam.gserviceaccount.com",
  // కీ ని పక్కాగా ఫార్మాట్ చేసే పద్ధతి
  // key: creds.private_key.replace(/\\n/g, '\n'), 
  key: "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDL2xXTem0KPF90\nOq0gjK+Pkpqv1FEYKQFNje/TVjoajXVtXDEhBq32DIHVtg4u1XwDCgZXc7qboIJV\nzqqei+xJ92/gBU6i3KH6gWShNYWhrPGuQAIc/gp3L4xzBgyC7ziRiEl/jh2A6A0r\nTGVoG7lpFKYBVtKmrLBd6uT7L/DExRRk8Mc3vQW8WvN+v5zFOEEM9sfhcUaXuU9Y\nJYT+nKYk6YY5B6SeMr2rrHtTRj6/Jpz7wmbAI83/wFrywIYSBt44B7q8l3M0Kndf\n3Z5GqUI+bMEULhSmT9M8+rdox2L/CEjx84yun+EZrFRBuw1mP/8fjyKEuP5VpCaV\nCE42X7ELAgMBAAECggEACG1w5DfrdMDfhq6Q+bIsj9g/t4Uk1Rrc3ZfrPOa+VYVY\n6sHPm3iV4yt2h/SUIYYx2kOlKiMJU+W5faf4OxW4bwELtEyD3mJrT9qJjnXn+wcV\n9rOEDYQdv/pMlB9r5P3UGNrJhGcbpnicEsOAbbgNB4sS/HsvujQ+wPiKVC1nMWXh\nYz2y3ER68Wkic67juXsiKUs3fYwF3InSKvXtLVwuKRo5snFa2mucUWoBTJkmEw5l\nxzx79U3rV7g4LsAH3lJBMdrHO8t3USvp71/nLQLyRdCrFEUhZ2ISodIzAdR900Oq\noTuj4QhfUnxi39VdU7XHrECEEZ1EIX8wIsmtBD4mAQKBgQD7SG4mcKi5IcVQ0MuQ\np6eYIJvK6GRsjmVj1K8RrFXgsl0xFRcPYgE7/kpRhtNy1jnA5ibB0ne99mSLf4YY\nXtvtoHIojfkJ9J+Jj8SNi26maIbwozkDIDJl7zJM9PIE73whecSV22MfgjA2MMm9\nXjy5qiuCtxi0gxbCYJrRweP7TwKBgQDPrr0DHI8VHjsQ1qU8tdypg0fDtC7MIAj0\novMpb6DlM0SCTjvs0L976UIoq7aTUtVZCEq2Za8GbtE8pluRIZTP865pwABigsPV\nD6wZlv82OGQ3ySBf9qsYRkVwn3is8y+g9ZNEvu4bx0KqhJLXPKHxnO4tNU+emcw6\nsf0gbmOPhQKBgQCsar5p0dNzdCCXmyySTPdKAtXjHCIL+ojHPyAA2Gb0jm4zR21T\nOMPwDkOgPQrJOQTXvxPI2kkfJvlGXnH8Ntpg6j5qZUAD/L2a/fK3zHxX4lD0vIpa\nArWSC9ZPx6JokIpzzcF9sdMJw6KhDEjgjtDL9F92iXuCIJB1PyP72TY9MQKBgBGP\n7z/iHF9mzQvhetulbWGQTnNIO2TbmKZHWVS5sdtv+G0kfIDMLkUmNogF7UyMBqqe\nvuKpuqFKobsFPl0Jf/IN40PiDqZF9JWB28XWNQK6xg7JnUlALLvCxYB+m8/USMTN\nv4RiuPP0Z7jPuTMmV3N9F88O4QrCarjT8Fnbu+OZAoGAXZ2REymhHXKd2d/CYT5W\nr1wgevZ4qO2l41eC/KUTgSQElHvb6rirMlufrWcOKaw5aYBEP4FGvQeUWJ6Tn/3y\nxiJ3EeNi0xi9jPC5NodPoRnJAoxd1KT/n+9ZgzokLFT8jVRPDRofowAM3T1WGDwA\nCVTA7b9sSBUW/Xuk8I/jX0c=",
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
