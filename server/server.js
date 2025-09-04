import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import fetch from 'node-fetch';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_PRODUCTS_FILE = path.join(__dirname, '..', 'products.json');
let DATA_DIR = process.env.DATA_DIR || '/data';
let DATA_PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
let BACKUPS_DIR = path.join(DATA_DIR, 'backups');

async function ensureDataLocations() {
    try {
        // Try primary data dir
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.mkdir(BACKUPS_DIR, { recursive: true });
        // Verify write access; if not, fallback to local server directory
        try {
            const probePath = path.join(DATA_DIR, '.write-probe');
            await fs.writeFile(probePath, 'ok', 'utf8');
            await fs.unlink(probePath).catch(() => {});
        } catch {
            console.warn('DATA_DIR not writable, falling back to local server directory');
            DATA_DIR = __dirname;
            DATA_PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
            BACKUPS_DIR = path.join(DATA_DIR, 'backups');
            await fs.mkdir(BACKUPS_DIR, { recursive: true });
        }
        // If data file does not exist but root products file exists with data, migrate once
        const dataExists = await fs.access(DATA_PRODUCTS_FILE).then(() => true).catch(() => false);
        if (!dataExists) {
            const rootRaw = await fs.readFile(ROOT_PRODUCTS_FILE, 'utf8').catch(() => '');
            if (rootRaw) {
                await fs.writeFile(DATA_PRODUCTS_FILE, rootRaw, 'utf8');
                console.log('Migrated products.json to persistent data disk');
            } else {
                // initialize empty structure
                await fs.writeFile(DATA_PRODUCTS_FILE, JSON.stringify({ products: {}, categories: {} }, null, 2), 'utf8');
            }
        } else {
            console.log('Products data already exists in persistent storage');
            // Verify the file has content
            const stats = await fs.stat(DATA_PRODUCTS_FILE).catch(() => null);
            if (stats) {
                console.log('Data file size:', stats.size, 'bytes');
            }
        }
        console.log('Data locations ensured. Using:', DATA_PRODUCTS_FILE);
    } catch (e) {
        console.error('Failed ensuring data locations:', e);
        // Emergency fallback to local directory
        DATA_DIR = __dirname;
        DATA_PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
        BACKUPS_DIR = path.join(DATA_DIR, 'backups');
        try {
            await fs.mkdir(BACKUPS_DIR, { recursive: true });
            await fs.writeFile(DATA_PRODUCTS_FILE, JSON.stringify({ products: {}, categories: {} }, null, 2), 'utf8');
            console.log('Emergency fallback: using local directory');
        } catch (fallbackError) {
            console.error('Emergency fallback failed:', fallbackError);
        }
    }
}

function getNowTimestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function writeBackupSnapshot(dataObject) {
    try {
        await fs.mkdir(BACKUPS_DIR, { recursive: true });
        const filename = `products-${getNowTimestamp()}.json`;
        const fullPath = path.join(BACKUPS_DIR, filename);
        await fs.writeFile(fullPath, JSON.stringify(dataObject, null, 2), 'utf8');
        console.log('Local backup created at', fullPath);
        // Optionally upload to Google Drive
        await maybeUploadToGoogleDrive(fullPath, filename);
    } catch (e) {
        console.warn('Failed to create local backup:', e?.message || e);
    }
}

async function maybeUploadToGoogleDrive(fullPath, filename) {
    try {
        // Destination folder ID (must be provided via env). Test fallback added.
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1lzqjieLaOaGMgrUjzRvYzMIZndfg1DGe'; // destination folder
        console.log('Google Drive folder ID:', folderId);
        if (!folderId) return; // not configured

        const scopes = ['https://www.googleapis.com/auth/drive.file'];
        let auth;

        // Option A: Service Account (if allowed)
        let svcAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT; // stringified JSON
        if (!svcAccountJson) {
            // Fallback: load from local file if exists (not committed; ignored via .gitignore)
            try {
                const localJson = await fs.readFile(path.join(__dirname, 'google-service-account.json'), 'utf8');
                svcAccountJson = localJson;
            } catch {}
        }
        if (svcAccountJson) {
            try {
                console.log('Using Service Account credentials');
                const creds = JSON.parse(svcAccountJson);
                auth = new google.auth.GoogleAuth({ credentials: creds, scopes });
            } catch (e) {
                console.warn('Invalid GOOGLE_SERVICE_ACCOUNT JSON provided:', e?.message || e);
            }
        }

        // Option B: OAuth2 client with refresh token (no service account keys)
        if (!auth) {
            console.log('Service Account not found, trying OAuth2...');
            const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
            const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
            if (clientId && clientSecret && refreshToken) {
                console.log('Using OAuth2 credentials');
                const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
                oauth2.setCredentials({ refresh_token: refreshToken });
                auth = oauth2;
            } else {
                console.log('OAuth2 credentials not found, skipping Google Drive upload');
            }
        }

        if (!auth) {
            console.warn('Google Drive not configured: no auth available');
            console.log('Available env vars:', {
                GOOGLE_SERVICE_ACCOUNT: !!process.env.GOOGLE_SERVICE_ACCOUNT,
                GOOGLE_DRIVE_FOLDER_ID: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
                GOOGLE_OAUTH_CLIENT_ID: !!process.env.GOOGLE_OAUTH_CLIENT_ID
            });
            return;
        }

        const drive = google.drive({ version: 'v3', auth });
        console.log('Attempting to upload to Google Drive...', { filename, folderId });
        
        const res = await drive.files.create({
            requestBody: { name: filename, parents: [folderId] },
            media: { mimeType: 'application/json', body: (await import('fs')).createReadStream(fullPath) }
        });
        
        console.log('✅ Successfully uploaded to Google Drive!', {
            fileId: res.data.id,
            fileName: res.data.name,
            folderId: folderId
        });
    } catch (e) {
        console.warn('Google Drive upload skipped/failed:', e?.message || e);
    }
}

async function getLatestBackupFilePath() {
    try {
        const files = await fs.readdir(BACKUPS_DIR).catch(() => []);
        const productBackups = files.filter(f => /^products-\d{8}-\d{6}\.json$/.test(f));
        if (productBackups.length === 0) return null;
        productBackups.sort();
        return path.join(BACKUPS_DIR, productBackups[productBackups.length - 1]);
    } catch {
        return null;
    }
}

async function readJsonSafe(filePath) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function createBackupIfChanged() {
    try {
        const current = await readJsonSafe(DATA_PRODUCTS_FILE);
        if (!current) return;
        const latestPath = await getLatestBackupFilePath();
        if (latestPath) {
            const latest = await readJsonSafe(latestPath);
            if (latest && JSON.stringify(latest) === JSON.stringify(current)) {
                console.log('Daily backup skipped: no changes since last snapshot');
                return;
            }
        }
        await writeBackupSnapshot(current);
    } catch (e) {
        console.warn('Daily backup check failed:', e?.message || e);
    }
}

function scheduleDailyConditionalBackup() {
    const days = Math.max(1, parseInt(process.env.BACKUP_INTERVAL_DAYS || '1', 10));
    const intervalMs = days * 24 * 60 * 60 * 1000;
    // run once shortly after start
    setTimeout(() => { createBackupIfChanged(); }, 60 * 1000);
    // schedule interval
    setInterval(() => { createBackupIfChanged(); }, intervalMs);
    console.log(`Scheduled conditional backups every ${days} day(s)`);
}

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
        await ensureDataLocations();
        // categories are managed by file; ensure they exist in DATA file
        const filePath = DATA_PRODUCTS_FILE;
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
        await ensureDataLocations();
        // Products are managed by file; ensure they exist in DATA file
        const filePath = DATA_PRODUCTS_FILE;
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
        const filePath = DATA_PRODUCTS_FILE;
        const raw = await fs.readFile(filePath, 'utf8').catch(() => '{"products":{},"categories":{}}');
        const data = JSON.parse(raw || '{}');
        const stats = {
            total: data.products ? Object.keys(data.products).length : 0,
            categories: data.categories ? Object.keys(data.categories).length : 0,
            status: 'ok',
            server: 'running(file+data)'
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

        // Ensure data directory exists before any file operations
        await ensureDataLocations();
        
        const filePath = DATA_PRODUCTS_FILE;
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
        // Write timestamped local backup and optionally upload to Google Drive
        await writeBackupSnapshot(merged);

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
        // Ensure data directory exists before any file operations
        await ensureDataLocations();
        
        const filePath = DATA_PRODUCTS_FILE;
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

        // Ensure data directory exists before any file operations
        await ensureDataLocations();
        
        const filePath = DATA_PRODUCTS_FILE;
        const raw = await fs.readFile(filePath, 'utf8').catch(() => '{"products":{},"categories":{}}');
        const data = JSON.parse(raw || '{}');
        if (data.products && data.products[code]) {
            delete data.products[code];
            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
            await writeBackupSnapshot(data);
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

// Manual backup endpoint (forces snapshot + optional Drive upload)
app.post('/api/backup-now', async (req, res) => {
    try {
        const raw = await fs.readFile(DATA_PRODUCTS_FILE, 'utf8').catch(() => null);
        if (!raw) return res.status(404).json({ error: 'no data file' });
        const data = JSON.parse(raw || '{}');
        await writeBackupSnapshot(data);
        const totals = {
            products: data.products ? Object.keys(data.products).length : 0,
            categories: data.categories ? Object.keys(data.categories).length : 0
        };
        res.json({ success: true, message: 'Backup created', totals });
    } catch (e) {
        console.error('Manual backup failed:', e);
        res.status(500).json({ error: 'backup failed', details: e?.message });
    }
});

// Backup status endpoint
app.get('/api/backup-status', async (req, res) => {
    try {
        const latest = await getLatestBackupFilePath();
        const exists = !!latest;
        res.json({
            exists,
            latestPath: latest || null,
            folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '1lzqjieLaOaGMgrUjzRvYzMIZndfg1DGe'
        });
    } catch (e) {
        res.status(500).json({ error: 'status failed', details: e?.message });
    }
});

// Restore from latest backup
app.post('/api/restore-latest', async (req, res) => {
    try {
        await ensureDataLocations();
        const latest = await getLatestBackupFilePath();
        
        if (!latest) {
            return res.status(404).json({ error: 'No backup found' });
        }
        
        const backupData = await fs.readFile(latest, 'utf8');
        await fs.writeFile(DATA_PRODUCTS_FILE, backupData, 'utf8');
        
        const parsed = JSON.parse(backupData);
        const totals = {
            products: Object.keys(parsed.products || {}).length,
            categories: Object.keys(parsed.categories || {}).length
        };
        
        res.json({
            success: true,
            message: `Restored from ${path.basename(latest)}`,
            totals
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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

// Initialize data locations, categories/products and start server
ensureDataLocations().then(() => initializeCategories()).then(() => importProductsIfEmpty()).then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log('Server is ready to handle requests');
    });
    // Start scheduled conditional backups (default daily, configurable)
    scheduleDailyConditionalBackup();
}).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
