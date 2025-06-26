import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();

// Enable CORS with specific settings
const allowedOrigins = [
    'http://localhost:3000',
    'https://venerable-rugelach-127f4b.netlify.app',
    'https://online-g.netlify.app/',
    'http://127.0.0.1:5500'
  ];
app.use(cors({
    origin: function(origin, callback){
        // allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            callback(new Error('Not allowed by CORS'))
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
    maxAge: 86400 // 24 hours
}));

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

// רשימת המיילים המורשים לשליחת הודעות WhatsApp
const ALLOWED_EMAILS = [
    'BLUMI@GOLDYS.CO.IL',
    'SERVICE@GOLDYS.CO.IL',
'tzvi@goldys.co.il',
'ch0548507825@gmail.com',
    'zadok@goldys.co.il'
    // הוסף כאן מיילים נוספים לפי הצורך
];

// Function to check if email is authorized
function isEmailAuthorized(email) {
    return ALLOWED_EMAILS.includes(email.toUpperCase());
}

// Function to check message status
async function checkMeageStatus(messageId) {
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
        // בדיקת המייל המורשה
        const userEmail = req.body.userEmail;
        if (!userEmail) {
            return res.status(401).json({ 
                error: 'אין מייל משתמש בבקשה',
                details: 'נדרשת התחברות עם Google' 
            });
        }
        
        if (!isEmailAuthorized(userEmail)) {
            return res.status(403).json({ 
                error: 'מייל לא מורשה',
                details: `המייל ${userEmail} אינו מורשה לשלוח הודעות WhatsApp` 
            });
        }
        
        // קבלת מזהה הקבוצה מהבקשה
        const groupId = req.body.groupId || GROUPS.CONDITORIA; // ברירת מחדל לקבוצת הקונדיטוריה
        
        const requestBody = {
            chatId: groupId,
            message: req.body.message
        };
        
        console.log('Sending to Green API:', requestBody);
        console.log('Authorized user:', userEmail);
        
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
    console.log(`Authorized emails: ${ALLOWED_EMAILS.join(', ')}`);
}); 