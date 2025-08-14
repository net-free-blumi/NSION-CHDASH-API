import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import Product from './models/Product.js';
import Category from './models/Category.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const ROOT_PRODUCTS_FILE = path.join(__dirname, '..', 'products.json');

// Load environment variables
dotenv.config();

// Connect to MongoDB (optional)
const MONGODB_URI = process.env.MONGODB_URI;
let mongoEnabled = Boolean(MONGODB_URI);
if (mongoEnabled) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('Connected to MongoDB successfully'))
        .catch(err => {
            mongoEnabled = false;
            console.error('MongoDB connection error, falling back to file mode:', err.message);
        });
} else {
    console.warn('MONGODB_URI not set. Running in file mode (no database).');
}

const app = express();

// Enable CORS with specific settings
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://localhost:5000',
    'https://venerable-rugelach-127f4b.netlify.app',
    // הוסף כאן דומיינים של הפרונט שלך בפרודקשן (Netlify/דומיין פרטי)
    'https://online-g.netlify.app',
    'https://nsaion-golsya.netlify.app'
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

// Initialize default categories if none exist
async function initializeCategories() {
    try {
        if (!mongoEnabled) throw new Error('Mongo disabled');
        const count = await Category.countDocuments();
        if (count === 0) {
            const defaultCategories = {
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
            
            for (const [code, name] of Object.entries(defaultCategories)) {
                await Category.create({ code, name });
            }
            console.log('Default categories initialized');
        }
    } catch (error) {
        console.error('Error initializing categories:', error);
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

// One-time import from root products.json into MongoDB (if DB is empty)
async function importProductsIfEmpty() {
    try {
        if (!mongoEnabled) return;
        const productCount = await Product.countDocuments();
        if (productCount > 0) {
            return;
        }
        // Prefer root products.json if exists
        let filePathToUse = ROOT_PRODUCTS_FILE;
        try {
            await fs.access(filePathToUse);
        } catch {
            // fallback to server/products.json
            filePathToUse = PRODUCTS_FILE;
            await fs.access(filePathToUse);
        }
        const raw = await fs.readFile(filePathToUse, 'utf8');
        const parsed = JSON.parse(raw);
        const products = parsed.products || {};
        const categories = parsed.categories || {};

        // Upsert categories
        for (const [code, name] of Object.entries(categories)) {
            await Category.findOneAndUpdate({ code }, { name }, { upsert: true });
        }
        // Upsert products
        for (const [code, productData] of Object.entries(products)) {
            await Product.findOneAndUpdate(
                { code },
                { ...productData, code, lastUpdate: new Date() },
                { upsert: true, new: true }
            );
        }
        console.log('Imported products from file into MongoDB successfully');
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
        let stats;
        if (mongoEnabled && mongoose.connection.readyState === 1) {
            const [productsCount, categoriesCount] = await Promise.all([
                Product.countDocuments(),
                Category.countDocuments()
            ]);
            stats = { total: productsCount, categories: categoriesCount, status: 'ok', server: 'running' };
        } else {
            // file mode
            let filePathToUse = ROOT_PRODUCTS_FILE;
            try { await fs.access(filePathToUse); } catch { filePathToUse = PRODUCTS_FILE; }
            const raw = await fs.readFile(filePathToUse, 'utf8').catch(() => '{"products":{},"categories":{}}');
            const data = JSON.parse(raw || '{}');
            stats = {
                total: data.products ? Object.keys(data.products).length : 0,
                categories: data.categories ? Object.keys(data.categories).length : 0,
                status: 'ok',
                server: 'running(file)'
            };
        }
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
        const { products, categories, timestamp } = req.body;
        
        if (!products) {
            return res.status(400).json({ error: 'products missing' });
        }

        if (mongoEnabled && mongoose.connection.readyState === 1) {
            // עדכון מוצרים ב-DB
            for (const [code, productData] of Object.entries(products)) {
                await Product.findOneAndUpdate(
                    { code },
                    { ...productData, lastUpdate: timestamp || new Date() },
                    { upsert: true, new: true }
                );
            }
            // עדכון קטגוריות ב-DB
            if (categories) {
                for (const [code, name] of Object.entries(categories)) {
                    await Category.findOneAndUpdate(
                        { code },
                        { name },
                        { upsert: true }
                    );
                }
            }
        } else {
            // מצב קובץ: כתיבה לקובץ מוצרים
            let filePathToUse = ROOT_PRODUCTS_FILE;
            try { await fs.access(filePathToUse); } catch { filePathToUse = PRODUCTS_FILE; }
            const raw = await fs.readFile(filePathToUse, 'utf8').catch(() => '{"products":{},"categories":{}}');
            const data = JSON.parse(raw || '{}');
            const merged = {
                products: { ...(data.products || {}), ...products },
                categories: { ...(data.categories || {}), ...(categories || {}) }
            };
            await fs.writeFile(filePathToUse, JSON.stringify(merged, null, 2), 'utf8');
        }

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
        if (mongoEnabled && mongoose.connection.readyState === 1) {
            const [products, categories] = await Promise.all([
                Product.find().lean(),
                Category.find().lean()
            ]);

            const productsMap = {};
            products.forEach(product => {
                productsMap[product.code] = product;
            });

            const categoriesMap = {};
            categories.forEach(category => {
                categoriesMap[category.code] = category.name;
            });

            res.json({ products: productsMap, categories: categoriesMap });
        } else {
            // File mode
            let filePathToUse = ROOT_PRODUCTS_FILE;
            try { await fs.access(filePathToUse); } catch { filePathToUse = PRODUCTS_FILE; }
            const raw = await fs.readFile(filePathToUse, 'utf8').catch(() => '{"products":{},"categories":{}}');
            const data = JSON.parse(raw || '{}');
            res.json({ products: data.products || {}, categories: data.categories || {} });
        }
    } catch (error) {
        console.error('Error reading products:', error);
        res.status(500).json({ error: 'שגיאה בקריאת המוצרים' });
    }
});

// Port configuration
const PORT = process.env.PORT || 5000;

// Initialize categories and start server
initializeCategories().then(() => importProductsIfEmpty()).then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log('Connected to MongoDB database');
        console.log('Server is ready to handle requests');
    });
}).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
