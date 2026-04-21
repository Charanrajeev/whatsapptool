const sheetId = '1AMYRuTswLl8QvjdZl0WcpnbLEiyRFTDw8f1qZWDeoNY';
const sheetUrl = `https://google.com{sheetId}/export?format=csv`;

client.on('ready', async () => {
    console.log('WhatsApp Client is ready!');

    try {
        const response = await axios.get(sheetUrl);
        // డేటాను క్లీన్ గా వరుసలుగా మార్చడం
        const rows = response.data.split('\r\n').map(row => row.split(','));
        
        console.log("Total rows found: " + (rows.length - 1));

        for (let i = 1; i < rows.length; i++) {
            let [name, phoneRaw, message] = rows[i];

            if (!phoneRaw || !message) continue;

            // డబుల్ కోట్స్ ఏమైనా ఉంటే తీసేయడానికి
            name = name.replace(/"/g, '');
            message = message.replace(/"/g, '');
            
            let phone = phoneRaw.replace(/[^\d]/g, '').trim();
            if (phone.length === 10) phone = '91' + phone;
            const finalPhone = `${phone}@c.us`;

            try {
                await client.sendMessage(finalPhone, `Hi ${name}, ${message}`);
                console.log(`✅ Sent to ${name} (${phone})`);
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
