import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const ROOT_PRODUCTS_FILE = path.join(__dirname, '..', 'products.json');

// Green API configuration
const INSTANCE_ID = '7105260862';
const API_TOKEN = '19d4910c994a45a58d22d1d7cc5d7121fc1575fd6ac143b295';
const BASE_URL = `https://7105.api.greenapi.com/waInstance${INSTANCE_ID}`;

// קבוצות וואטסאפ
const GROUPS = {
    CONDITORIA: "120363414923943659@g.us", //קונדיטורייה
    FRUITS: "120363414923943659@g.us" //פירות
};

// רשימת המיילים המורשים לשליחת הודעות WhatsApp
const ALLOWED_EMAILS = [
    'BLUMI@GOLDYS.CO.IL',
    'SERVICE@GOLDYS.CO.IL',
    'tzvi@goldys.co.il',
    'ch0548507825@gmail.com',
    'zadok@goldys.co.il'
];

// בדיקה אם המייל מורשה
function isEmailAuthorized(email) {
    return ALLOWED_EMAILS.includes(email.toUpperCase());
}

const app = express();

// Enable CORS with specific settings
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://localhost:5000',
    'https://venerable-rugelach-127f4b.netlify.app',
    'https://online-g.netlify.app',
    'https://nsaion-golsya.netlify.app',
    'https://nsion-chdash-api-1.onrender.com'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control'],
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
    maxAge: 86400 // 24 hours
}));

// Parse JSON bodies with increased limit
app.use(express.json({ limit: '50mb' }));

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// Initialize default categories if none exist
async function initializeCategories() {
    try {
        // This function is no longer needed as categories are managed by the file
        // and the file itself contains the default categories.
        // Keeping it for now, but it will not create categories if the file exists.
        const filePath = ROOT_PRODUCTS_FILE; // Use ROOT_PRODUCTS_FILE for consistency
        const raw = await fs.readFile(filePath, 'utf8').catch(() => '{"products":{},"categories":{}}');
        const data = JSON.parse(raw || '{}');
        if (data.categories) {
            console.log('Categories already exist in products.json');
            return;
        }
        console.log('Creating initial categories in products.json...');
        const initialCategories = {
            "kitchen": "מוצרי מטבח",
            "bakery": "קונדיטורייה",
            "fruits": "פירות",
            "sushi": "סושי",
            "amar": "קונדיטורייה עמר",
            "kitchenProducts": "מטבח מוסטפה",
            "online": "אונליין",
            "warehouse": "מחסן",
            "sizes": "מוצרי גדלים",
            "quantities": "מוצרי כמות"
        };
        await fs.writeFile(filePath, JSON.stringify({ ...data, categories: initialCategories }, null, 2), 'utf8');
        console.log('Initial categories created in products.json');
    } catch (error) {
        console.error('Error initializing categories:', error);
    }
}

// One-time import from root products.json into MongoDB (if DB is empty)
async function importProductsIfEmpty() {
    try {
        // This function is no longer needed as products are managed by the file
        // and the file itself contains the default products.
        // Keeping it for now, but it will not import products if the file exists.
        const filePath = ROOT_PRODUCTS_FILE; // Use ROOT_PRODUCTS_FILE for consistency
        const raw = await fs.readFile(filePath, 'utf8').catch(() => '{"products":{},"categories":{}}');
        const data = JSON.parse(raw || '{}');
        if (data.products) {
            console.log('Products already exist in products.json');
            return;
        }
        console.log('Creating initial products in products.json...');
        const initialProducts = {
            "kitchen": {
                "code": "KITCHEN_001",
                "name": "מוצרי מטבח",
                "price": 100,
                "quantity": 10,
                "category": "kitchen",
                "description": "מוצרי מטבח כללי"
            },
            "bakery": {
                "code": "BAKERY_001",
                "name": "קונדיטורייה",
                "price": 50,
                "quantity": 20,
                "category": "bakery",
                "description": "קונדיטורייה כללית"
            },
            "fruits": {
                "code": "FRUITS_001",
                "name": "פירות",
                "price": 20,
                "quantity": 50,
                "category": "fruits",
                "description": "פירות כלליים"
            },
            "sushi": {
                "code": "SUSHI_001",
                "name": "סושי",
                "price": 150,
                "quantity": 15,
                "category": "sushi",
                "description": "סושי כללי"
            },
            "amar": {
                "code": "AMAR_001",
                "name": "קונדיטורייה עמר",
                "price": 80,
                "quantity": 10,
                "category": "amar",
                "description": "קונדיטורייה עמר כללית"
            },
            "kitchenProducts": {
                "code": "KITCHEN_PRODUCTS_001",
                "name": "מטבח מוסטפה",
                "price": 200,
                "quantity": 5,
                "category": "kitchenProducts",
                "description": "מטבח מוסטפה כללית"
            },
            "online": {
                "code": "ONLINE_001",
                "name": "אונליין",
                "price": 500,
                "quantity": 1,
                "category": "online",
                "description": "אונליין כללי"
            },
            "warehouse": {
                "code": "WAREHOUSE_001",
                "name": "מחסן",
                "price": 1000,
                "quantity": 1,
                "category": "warehouse",
                "description": "מחסן כללי"
            },
            "sizes": {
                "code": "SIZES_001",
                "name": "מוצרי גדלים",
                "price": 50,
                "quantity": 100,
                "category": "sizes",
                "description": "מוצרי גדלים כלליים"
            },
            "quantities": {
                "code": "QUANTITIES_001",
                "name": "מוצרי כמות",
                "price": 10,
                "quantity": 200,
                "category": "quantities",
                "description": "מוצרי כמות כלליים"
            }
        };
        await fs.writeFile(filePath, JSON.stringify({ ...data, products: initialProducts }, null, 2), 'utf8');
        console.log('Initial products created in products.json');
    } catch (error) {
        console.error('Error importing products into MongoDB:', error.message);
    }
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'שגיאה בשרת',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// API Stats endpoint for health check
app.get('/api/stats', async (req, res) => {
    try {
        const filePath = ROOT_PRODUCTS_FILE; // Use ROOT_PRODUCTS_FILE for consistency
        const raw = await fs.readFile(filePath, 'utf8').catch(() => '{"products":{},"categories":{}}');
        const data = JSON.parse(raw || '{}');
        const stats = {
            total: data.products ? Object.keys(data.products).length : 0,
            categories: data.categories ? Object.keys(data.categories).length : 0,
            status: 'ok',
            server: 'running(file)'
        };
        console.log('Stats request successful:', stats);
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'שגיאה בקבלת סטטיסטיקות' });
    }
});

// Save products endpoint
app.post('/api/products/save', async (req, res) => {
    try {
        console.log('Save products request received');
        const { products, categories, timestamp, replace } = req.body;
        
        if (!products) {
            return res.status(400).json({ error: 'products missing' });
        }

        const filePath = ROOT_PRODUCTS_FILE; // Use ROOT_PRODUCTS_FILE for consistency
        const raw = await fs.readFile(filePath, 'utf8').catch(() => '{"products":{},"categories":{}}');
        const data = JSON.parse(raw || '{}');
        const merged = { products: data.products || {}, categories: data.categories || {} };

        if (replace) {
            // החלפה מלאה של המוצרים
            merged.products = products;
        } else {
            // כתיבת דלתא: עדכון רק מה שהגיע בבקשה
            for (const [code, p] of Object.entries(products)) {
                merged.products[code] = { ...(merged.products[code] || {}), ...p };
            }
        }
        if (categories) {
            merged.categories = { ...merged.categories, ...categories };
        }
        await fs.writeFile(filePath, JSON.stringify(merged, null, 2), 'utf8');

        res.json({
            success: true,
            message: 'המוצרים נשמרו בהצלחה',
            timestamp: timestamp || new Date().toISOString()
        });
    } catch (error) {
        console.error('Error saving products:', error);
        res.status(500).json({ error: 'שגיאה בשמירת המוצרים' });
    }
});

// Get all products
app.get('/api/products', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        const filePath = ROOT_PRODUCTS_FILE; // Use ROOT_PRODUCTS_FILE for consistency
        const raw = await fs.readFile(filePath, 'utf8').catch(() => '{"products":{},"categories":{}}');
        const data = JSON.parse(raw || '{}');
        res.json({ products: data.products || {}, categories: data.categories || {} });
    } catch (error) {
        console.error('Error reading products:', error);
        res.status(500).json({ error: 'שגיאה בקריאת המוצרים' });
    }
});

// Delete a single product by code
app.delete('/api/products/:code', async (req, res) => {
    try {
        const { code } = req.params;
        if (!code) return res.status(400).json({ error: 'missing code' });

        const filePath = ROOT_PRODUCTS_FILE; // Use ROOT_PRODUCTS_FILE for consistency
        const raw = await fs.readFile(filePath, 'utf8').catch(() => '{"products":{},"categories":{}}');
        const data = JSON.parse(raw || '{}');
        if (data.products && data.products[code]) {
            delete data.products[code];
            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        }

        res.json({ success: true, message: `Product ${code} deleted` });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'שגיאה במחיקת המוצר' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WhatsApp message sending endpoint
app.post('/send-whatsapp', async (req, res) => {
    console.log('Received WhatsApp request:', req.body);
    
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
        
        res.json(data);
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: 'Failed to send message',
            details: error.message 
        });
    }
});

// Port configuration
const PORT = process.env.PORT || 5000;

// Initialize categories and start server
initializeCategories().then(() => importProductsIfEmpty()).then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log('Server is ready to handle requests');
    });
}).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
