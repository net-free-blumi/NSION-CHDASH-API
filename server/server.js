import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// נתיב לקובץ המוצרים - שמירה בתיקייה זמנית
const DATA_DIR = path.join(process.env.NODE_ENV === 'production' 
    ? process.env.HOME || '/tmp'  // בשרת הייצור - שימוש בתיקיית HOME או tmp
    : path.join(__dirname, '..'), 'data');  // בפיתוח מקומי
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');

const app = express();

// Enable CORS with specific settings
const allowedOrigins = [
    'http://localhost:3000',
    'https://venerable-rugelach-127f4b.netlify.app',
    'https://online-g.netlify.app',
    'https://nsion-chdash-api.onrender.com',
    'https://nsaion-golsya.netlify.app',
    'http://127.0.0.1:5500',
    'http://localhost:5000'
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
    maxAge: 86400 // 24 hours
}));

// Parse JSON bodies with increased limit
app.use(express.json({ limit: '50mb' }));

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// Ensure data directory and products file exist
async function ensureProductsFile() {
    try {
        // Create data directory if it doesn't exist
        try {
            await fs.access(DATA_DIR);
        } catch {
            console.log(`Creating data directory at: ${DATA_DIR}`);
            await fs.mkdir(DATA_DIR, { recursive: true });
        }

        // Check if products file exists
        try {
            await fs.access(PRODUCTS_FILE);
        } catch (error) {
            console.log('Creating initial products.json file...');
        const initialData = {
            products: {},
            categories: {
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
            }
        };
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(initialData, null, 2), 'utf8');
        console.log('Initial products.json file created successfully');
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
        await ensureProductsFile();
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        const stats = {
            total: Object.keys(products.products || {}).length,
            categories: Object.keys(products.categories || {}).length,
            status: 'ok',
            server: 'running'
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
        console.log('Save products request received:', req.body);
        const { products, categories, timestamp } = req.body;
        if (!products) {
            console.warn('Save request missing products data');
            return res.status(400).json({ error: 'products missing' });
        }

        // וידוא שהקובץ קיים
        await ensureProductsFile();

        // קריאת המצב הנוכחי
        let currentData = { products: {}, categories: {} };
        try {
            const fileData = await fs.readFile(PRODUCTS_FILE, 'utf8');
            currentData = JSON.parse(fileData);
            console.log('Current products file read successfully');
        } catch (error) {
            console.warn('Error reading current products file:', error);

        // עדכון נתונים
        currentData.products = { ...currentData.products, ...products };
        if (categories) {
            currentData.categories = { ...currentData.categories, ...categories };
        }

        // שמירת הקובץ
        await fs.writeFile(
            PRODUCTS_FILE, 
            JSON.stringify({ 
                products: currentData.products, 
                categories: currentData.categories,
                lastUpdate: timestamp || new Date().toISOString()
            }, null, 2), 
            'utf8'
        );

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
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        res.json(products);
    } catch (error) {
        console.error('Error reading products:', error);
        res.status(500).json({ error: 'שגיאה בקריאת המוצרים' });
    }
});

// Port configuration
const PORT = process.env.PORT || 5000;

// Ensure products file exists before starting server
ensureProductsFile().then(() => {
    // Server startup
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`Products file path: ${PRODUCTS_FILE}`);
        console.log('Server is ready to handle requests');
    });
}).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
