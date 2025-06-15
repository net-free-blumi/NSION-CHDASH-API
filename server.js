import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();

// Enable CORS for all origins
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Green API configuration
const INSTANCE_ID = '7105260862';
const API_TOKEN = '19d4910c994a45a58d22d1d7cc5d7121fc1575fd6ac143b295';
const BASE_URL = `https://7105.api.greenapi.com/waInstance${INSTANCE_ID}`;

// Function to check message status
async function checkMessageStatus(messageId) {
    try {
        const response = await fetch(`${BASE_URL}/getMessage/${API_TOKEN}/${messageId}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error checking message status:', error);
        throw error;
    }
}

// Proxy endpoint
app.post('/send-whatsapp', async (req, res) => {
    console.log('Received request:', req.body);
    
    try {
        // קבוצת וואטסאפ - חשוב לשמור על הפורמט הזה
        const requestBody = {
            chatId: "120363414923943659@g.us",  // מזהה קבוצה קבוע
            message: req.body.message
        };
        
        console.log('Sending to Green API:', requestBody);
        
        const response = await fetch(`${BASE_URL}/sendMessage/${API_TOKEN}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        console.log('Green API response:', data);
        
        if (!response.ok) {
            console.error('Green API error:', data);
            throw new Error(data.message || 'שגיאה בשליחת ההודעה');
        }

        // Check message status after 2 seconds
        setTimeout(async () => {
            try {
                const status = await checkMessageStatus(data.data.id);
                console.log('Message status after 2 seconds:', status);
            } catch (error) {
                console.error('Error checking message status:', error);
            }
        }, 2000);
        
        res.json(data);
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: 'Failed to send message',
            details: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
    console.log(`CORS enabled for all origins`);
}); 