import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();

// Enable CORS with specific settings
app.use(cors({
    origin: true, // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
    maxAge: 86400 // 24 hours
}));

// Add headers middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Parse JSON bodies
app.use(express.json());

// Green API configuration
const INSTANCE_ID = '7105260862';
const API_TOKEN = '19d4910c994a45a58d22d1d7cc5d7121fc1575fd6ac143b295';
const BASE_URL = `https://7105.api.greenapi.com/waInstance${INSTANCE_ID}`;

// קבוצות וואטסאפ
const GROUPS = {
    CONDITORIA: "120363314468223287@g.us", //קונדיטורייה
    FRUITS: "120363314468223287@g.us" //פירות
};

// רשימת מיילים מורשים לשליחה
const allowedEmails = [
    "BLUMI@GOLDYS.CO.IL",
    "SERVICE@GOLDYS.CO.IL"
  ];
  
  window.onGoogleSignIn = function(response) {
    const id_token = response.credential;
    const payload = JSON.parse(atob(id_token.split('.')[1]));
    const email = payload.email.toUpperCase();
  
    if (!allowedEmails.includes(email)) {
      // לא מורשה
      localStorage.removeItem('userEmail');
      localStorage.removeItem('googleToken');
      updateSignInUI && updateSignInUI();
      updateSendButtonsState && updateSendButtonsState();
      showNotification && showNotification('אין לך הרשאה להתחבר לאתר', 'red');
      return;
    }
  
    // מורשה
    localStorage.setItem('userEmail', payload.email);
    localStorage.setItem('googleToken', id_token);
    updateSignInUI && updateSignInUI();
    updateSendButtonsState && updateSendButtonsState();
    showNotification && showNotification('התחברת בהצלחה!', 'green');
  };


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
    
    // בדיקת הרשאה לפי מייל
    const userEmail = req.body.userEmail;
    if (!userEmail || !allowedEmails.includes(userEmail.toUpperCase())) {
        return res.status(403).json({ error: 'Unauthorized: Email not allowed' });
    }
    
    try {
        // קבלת מזהה הקבוצה מהבקשה
        const groupId = req.body.groupId || GROUPS.CONDITORIA; // ברירת מחדל לקבוצת הקונדיטוריה
        
        const requestBody = {
            chatId: groupId,
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
    console.log(`CORS enabled with specific settings`);
}); 