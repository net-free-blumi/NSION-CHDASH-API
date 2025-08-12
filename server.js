import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable CORS with specific settings
const allowedOrigins = [
    'http://localhost:3000',
    'https://venerable-rugelach-127f4b.netlify.app',
    'https://online-g.netlify.app/',
     'https://nsaion-golsya.netlify.app/',
    'http://127.0.0.1:5500',
    'http://localhost:5000'
  ];
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
    maxAge: 86400 // 24 hours
}));

// Parse JSON bodies
app.use(express.json());

// הגשת קבצים סטטיים
app.use(express.static('.'));

// נתיב ספציפי לקובץ המוצרים
app.get('/products.json', async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
    } catch (error) {
        console.error('Error serving products.json:', error);
        res.status(500).json({ error: 'שגיאה בטעינת קובץ המוצרים' });
    }
});

// נתיב לקובץ המוצרים
const PRODUCTS_FILE = path.join(__dirname, 'products.json');

// ===== API לניהול מוצרים =====

// קריאת כל המוצרים
app.get('/api/products', async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        res.json(products);
    } catch (error) {
        console.error('Error reading products:', error);
        res.status(500).json({ error: 'שגיאה בקריאת המוצרים' });
    }
});

// קריאת מוצר ספציפי לפי קוד
app.get('/api/products/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        
        if (products.products[code]) {
            res.json(products.products[code]);
        } else {
            res.status(404).json({ error: 'מוצר לא נמצא' });
        }
    } catch (error) {
        console.error('Error reading product:', error);
        res.status(500).json({ error: 'שגיאה בקריאת המוצר' });
    }
});

// הוספת מוצר חדש
app.post('/api/products', async (req, res) => {
    try {
        const newProduct = req.body;
        
        // בדיקות תקינות בסיסיות
        if (!newProduct.code || !newProduct.name || !newProduct.category) {
            return res.status(400).json({ 
                error: 'חסרים פרטים חיוניים: קוד, שם וקטגוריה נדרשים' 
            });
        }
        
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        
        // בדיקה שהקוד לא קיים כבר
        if (products.products[newProduct.code]) {
            return res.status(409).json({ 
                error: 'קוד מוצר כבר קיים במערכת' 
            });
        }
        
        // הוספת המוצר
        products.products[newProduct.code] = newProduct;
        
        // שמירה לקובץ
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
        
        res.status(201).json({ 
            message: 'מוצר נוסף בהצלחה',
            product: newProduct 
        });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ error: 'שגיאה בהוספת המוצר' });
    }
});

// עדכון מוצר קיים
app.put('/api/products/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const updatedProduct = req.body;
        
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        
        if (!products.products[code]) {
            return res.status(404).json({ error: 'מוצר לא נמצא' });
        }
        
        // עדכון המוצר
        products.products[code] = { ...products.products[code], ...updatedProduct };
        
        // שמירה לקובץ
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
        
        res.json({ 
            message: 'מוצר עודכן בהצלחה',
            product: products.products[code] 
        });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'שגיאה בעדכון המוצר' });
    }
});

// מחיקת מוצר
app.delete('/api/products/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        
        if (!products.products[code]) {
            return res.status(404).json({ error: 'מוצר לא נמצא' });
        }
        
        // מחיקת המוצר
        delete products.products[code];
        
        // שמירה לקובץ
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
        
        res.json({ message: 'מוצר נמחק בהצלחה' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'שגיאה במחיקת המוצר' });
    }
});

// קבלת קטגוריות
app.get('/api/categories', async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        res.json(products.categories || {});
    } catch (error) {
        console.error('Error reading categories:', error);
        res.status(500).json({ error: 'שגיאה בקריאת הקטגוריות' });
    }
});

// עדכון קטגוריות
app.put('/api/categories', async (req, res) => {
    try {
        const updatedCategories = req.body;
        
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        
        // עדכון הקטגוריות
        products.categories = { ...products.categories, ...updatedCategories };
        
        // שמירה לקובץ
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
        
        res.json({ 
            message: 'קטגוריות עודכנו בהצלחה',
            categories: products.categories 
        });
    } catch (error) {
        console.error('Error updating categories:', error);
        res.status(500).json({ error: 'שגיאה בעדכון הקטגוריות' });
    }
});

// גיבוי מוצרים
app.post('/api/products/backup', async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        
        const backupData = {
            ...products,
            backupDate: new Date().toISOString(),
            backupVersion: '1.0'
        };
        
        const backupFileName = `products_backup_${Date.now()}.json`;
        const backupPath = path.join(__dirname, 'backups', backupFileName);
        
        // יצירת תיקיית גיבויים אם לא קיימת
        await fs.mkdir(path.join(__dirname, 'backups'), { recursive: true });
        
        await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
        
        res.json({ 
            message: 'גיבוי נוצר בהצלחה',
            backupFile: backupFileName,
            backupPath: backupPath
        });
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({ error: 'שגיאה ביצירת הגיבוי' });
    }
});

// שחזור מגיבוי
app.post('/api/products/restore', async (req, res) => {
    try {
        const { backupFile } = req.body;
        
        if (!backupFile) {
            return res.status(400).json({ error: 'שם קובץ הגיבוי נדרש' });
        }
        
        const backupPath = path.join(__dirname, 'backups', backupFile);
        const backupData = await fs.readFile(backupPath, 'utf8');
        const products = JSON.parse(backupData);
        
        // הסרת פרטי הגיבוי
        delete products.backupDate;
        delete products.backupVersion;
        
        // שמירה לקובץ הראשי
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
        
        res.json({ 
            message: 'שחזור הושלם בהצלחה',
            restoredProducts: Object.keys(products.products).length
        });
    } catch (error) {
        console.error('Error restoring backup:', error);
        res.status(500).json({ error: 'שגיאה בשחזור הגיבוי' });
    }
});

// ייבוא מוצרים
app.post('/api/products/import', async (req, res) => {
    try {
        const importData = req.body;
        
        if (!importData.products) {
            return res.status(400).json({ error: 'נתוני ייבוא לא תקינים' });
        }
        
        // שמירה לקובץ
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(importData, null, 2), 'utf8');
        
        res.json({ 
            message: 'מוצרים יובאו בהצלחה',
            importedProducts: Object.keys(importData.products).length
        });
    } catch (error) {
        console.error('Error importing products:', error);
        res.status(500).json({ error: 'שגיאה בייבוא המוצרים' });
    }
});

// סטטיסטיקות מערכת
app.get('/api/stats', async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        
        const stats = {
            totalProducts: Object.keys(products.products).length,
            categories: Object.keys(products.categories).length,
            lastUpdate: new Date().toISOString(),
            systemStatus: 'online'
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'שגיאה בקבלת הסטטיסטיקות' });
    }
});

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
                const status = await checkMeageStatus(data.data.id);
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 WhatsApp API: Active`);
    console.log(`🛍️ Products API: Active`);
    console.log(`🔒 CORS enabled with specific settings`);
    console.log(`✅ Authorized emails: ${ALLOWED_EMAILS.join(', ')}`);
    console.log(`📊 Available endpoints:`);
    console.log(`   GET  /api/products - כל המוצרים`);
    console.log(`   GET  /api/products/:code - מוצר ספציפי`);
    console.log(`   POST /api/products - הוספת מוצר`);
    console.log(`   PUT  /api/products/:code - עדכון מוצר`);
    console.log(`   DELETE /api/products/:code - מחיקת מוצר`);
    console.log(`   GET  /api/categories - קטגוריות`);
    console.log(`   PUT  /api/categories - עדכון קטגוריות`);
    console.log(`   POST /api/products/backup - יצירת גיבוי`);
    console.log(`   POST /api/products/restore - שחזור מגיבוי`);
    console.log(`   GET  /api/stats - סטטיסטיקות מערכת`);
}); 