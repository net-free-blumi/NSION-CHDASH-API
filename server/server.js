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

// Green API configuration (env with safe defaults)
const GREEN_INSTANCE_ID = process.env.GREEN_INSTANCE_ID || '7105260862';
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN || '19d4910c994a45a58d22d1d7cc5d7121fc1575fd6ac143b295';
const GREEN_DOMAIN = process.env.GREEN_DOMAIN || 'https://7105.api.greenapi.com';
const GREEN_BASE_URL = `${GREEN_DOMAIN}/waInstance${GREEN_INSTANCE_ID}`;

// Basic health endpoint (used by frontend wake-up)
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Allowed emails for sending WhatsApp (mirror of frontend)
const ALLOWED_EMAILS = [
    'BLUMI@GOLDYS.CO.IL',
    'SERVICE@GOLDYS.CO.IL',
    'tzvi@goldys.co.il',
    'ch0548507825@gmail.com',
    'zadok@goldys.co.il'
].map(e => e.toUpperCase());

// WhatsApp send endpoint - proxies to Green API
app.post('/send-whatsapp', async (req, res) => {
    try {
        const { message, groupId, userEmail } = req.body || {};
        if (!message || !groupId) {
            return res.status(400).json({ error: 'message and groupId are required' });
        }

        // Optional auth check (frontend already enforces)
        if (userEmail && !ALLOWED_EMAILS.includes(String(userEmail).toUpperCase())) {
            return res.status(403).json({ error: 'unauthorized email' });
        }

        // Send to Green API
        const response = await fetch(`${GREEN_BASE_URL}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GREEN_API_TOKEN}`
            },
            body: JSON.stringify({
                chatId: groupId,
                message: message
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Green API error:', errorData);
            return res.status(500).json({ error: 'Failed to send WhatsApp message' });
        }

        const result = await response.json();
        console.log('WhatsApp sent successfully:', result);
        res.json({ success: true, message: 'WhatsApp message sent successfully' });

    } catch (error) {
        console.error('Error sending WhatsApp:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Initialize categories function
async function initializeCategories() {
    try {
        let filePathToUse = ROOT_PRODUCTS_FILE;
        try { await fs.access(filePathToUse); } catch { filePathToUse = PRODUCTS_FILE; }
        
        const raw = await fs.readFile(filePathToUse, 'utf8').catch(() => '{"products":{},"categories":{}}');
        const data = JSON.parse(raw || '{}');
        
        if (!data.categories || Object.keys(data.categories).length === 0) {
            const defaultCategories = {
                "1": "מטבח",
                "2": "קונדיטוריה", 
                "3": "אונליין",
                "4": "מחסן",
                "5": "סושי",
                "6": "מוצרי מטבח",
                "7": "עמר"
            };
            
            data.categories = defaultCategories;
            await fs.writeFile(filePathToUse, JSON.stringify(data, null, 2), 'utf8');
            console.log('Categories initialized');
        }
    } catch (error) {
        console.error('Error initializing categories:', error);
    }
}

// Import products if empty
async function importProductsIfEmpty() {
    try {
        let filePathToUse = ROOT_PRODUCTS_FILE;
        try { await fs.access(filePathToUse); } catch { filePathToUse = PRODUCTS_FILE; }
        
        const raw = await fs.readFile(filePathToUse, 'utf8').catch(() => '{"products":{},"categories":{}}');
        const data = JSON.parse(raw || '{}');
        
        if (!data.products || Object.keys(data.products).length === 0) {
            // Import from server/products.json if exists
            try {
                const serverProductsRaw = await fs.readFile(PRODUCTS_FILE, 'utf8');
                const serverProducts = JSON.parse(serverProductsRaw);
                data.products = { ...data.products, ...serverProducts.products };
                await fs.writeFile(filePathToUse, JSON.stringify(data, null, 2), 'utf8');
                console.log('Products imported from server/products.json');
            } catch (importError) {
                console.log('No server/products.json found, starting with empty products');
            }
        }
    } catch (error) {
        console.error('Error importing products:', error);
    }
}

// Save products endpoint
app.post('/api/products', async (req, res) => {
    try {
        const { products, categories, timestamp } = req.body;
        if (!products && !categories) {
            return res.status(400).json({ error: 'products or categories required' });
        }

        let filePathToUse = ROOT_PRODUCTS_FILE;
        try { await fs.access(filePathToUse); } catch { filePathToUse = PRODUCTS_FILE; }
        
        const raw = await fs.readFile(filePathToUse, 'utf8').catch(() => '{"products":{},"categories":{}}');
        const merged = JSON.parse(raw || '{}');

        if (products) {
            if (timestamp && merged.timestamp && new Date(timestamp) <= new Date(merged.timestamp)) {
                return res.status(409).json({ error: 'Data is outdated' });
            } else {
                // כתיבת דלתא: עדכון רק מה שהגיע בבקשה
                for (const [code, p] of Object.entries(products)) {
                    merged.products[code] = { ...(merged.products[code] || {}), ...p };
                }
            }
        }
        if (categories) {
            merged.categories = { ...merged.categories, ...categories };
        }
        await fs.writeFile(filePathToUse, JSON.stringify(merged, null, 2), 'utf8');

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
        
        // File mode only
        let filePathToUse = ROOT_PRODUCTS_FILE;
        try { await fs.access(filePathToUse); } catch { filePathToUse = PRODUCTS_FILE; }
        const raw = await fs.readFile(filePathToUse, 'utf8').catch(() => '{"products":{},"categories":{}}');
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

        // File mode deletion
        let filePathToUse = ROOT_PRODUCTS_FILE;
        try { await fs.access(filePathToUse); } catch { filePathToUse = PRODUCTS_FILE; }
        const raw = await fs.readFile(filePathToUse, 'utf8').catch(() => '{"products":{},"categories":{}}');
        const data = JSON.parse(raw || '{}');
        if (data.products && data.products[code]) {
            delete data.products[code];
            await fs.writeFile(filePathToUse, JSON.stringify(data, null, 2), 'utf8');
        }

        res.json({ success: true, message: `Product ${code} deleted` });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'שגיאה במחיקת המוצר' });
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
