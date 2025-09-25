import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
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
        // Optionally upload to Google Drive (manual-only unless enabled)
        const uploadEnabled = process.env.BACKUP_UPLOAD_TO_DRIVE === 'true' || process.env.BACKUP_MODE === 'manual';
        console.log('Upload to Drive enabled:', uploadEnabled);
        console.log('BACKUP_UPLOAD_TO_DRIVE:', process.env.BACKUP_UPLOAD_TO_DRIVE);
        console.log('BACKUP_MODE:', process.env.BACKUP_MODE);
        if (uploadEnabled) {
            console.log('Attempting to upload to Google Drive...');
            await maybeUploadToGoogleDrive(fullPath, filename);
        } else {
            console.log('Google Drive upload disabled');
        }
        
        console.log('=== BACKUP COMPLETED ===');
    } catch (e) {
        console.warn('Failed to create local backup:', e?.message || e);
    }
}

async function maybeUploadToGoogleDrive(fullPath, filename) {
    try {
        console.log('=== STARTING GOOGLE DRIVE UPLOAD ===');
        console.log('Full path:', fullPath);
        console.log('Filename:', filename);
        
        // Destination folder ID (must be provided via env)
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        console.log('Google Drive folder ID:', folderId);
        if (!folderId) {
            console.log('❌ No folder ID configured, skipping upload');
            return; // not configured
        }

        const scopes = ['https://www.googleapis.com/auth/drive.file'];
        let auth;

        // Option A: Service Account (if allowed)
        let svcAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT; // stringified JSON
        console.log('Service Account JSON exists:', !!svcAccountJson);
        console.log('Service Account JSON length:', svcAccountJson ? svcAccountJson.length : 0);
        console.log('Service Account JSON preview:', svcAccountJson ? svcAccountJson.substring(0, 100) + '...' : 'null');
        
        if (!svcAccountJson) {
            console.log('No Service Account JSON in env, trying local file...');
            // Fallback: load from local file if exists (not committed; ignored via .gitignore)
            try {
                const localJson = await fs.readFile(path.join(__dirname, 'google-service-account.json'), 'utf8');
                svcAccountJson = localJson;
                console.log('Found local Service Account file');
            } catch (e) {
                console.log('No local Service Account file found');
            }
        }
        
        if (svcAccountJson) {
            try {
                console.log('🔑 Using Service Account credentials');
                console.log('Service Account JSON length:', svcAccountJson.length);
                const creds = JSON.parse(svcAccountJson);
                console.log('✅ Service Account parsed successfully');
                console.log('Client email:', creds.client_email);
                console.log('Project ID:', creds.project_id);
                auth = new google.auth.GoogleAuth({ credentials: creds, scopes });
                console.log('✅ GoogleAuth created successfully');
            } catch (e) {
                console.error('❌ Invalid GOOGLE_SERVICE_ACCOUNT JSON provided:', e?.message || e);
                console.error('JSON content preview:', svcAccountJson.substring(0, 100) + '...');
            }
        } else {
            console.log('❌ No Service Account JSON found');
        }

        // Option B: OAuth2 client with refresh token (no service account keys)
        if (!auth) {
            console.log('🔑 Service Account not found, trying OAuth2...');
            const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
            const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
            console.log('OAuth2 credentials check:', {
                clientId: !!clientId,
                clientSecret: !!clientSecret,
                refreshToken: !!refreshToken
            });
            if (clientId && clientSecret && refreshToken) {
                console.log('✅ Using OAuth2 credentials');
                const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
                oauth2.setCredentials({ refresh_token: refreshToken });
                auth = oauth2;
                console.log('✅ OAuth2 auth created successfully');
            } else {
                console.log('❌ OAuth2 credentials not found, skipping Google Drive upload');
            }
        }

        if (!auth) {
            console.error('❌ Google Drive not configured: no auth available');
            console.log('Available env vars:', {
                GOOGLE_SERVICE_ACCOUNT: !!process.env.GOOGLE_SERVICE_ACCOUNT,
                GOOGLE_DRIVE_FOLDER_ID: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
                GOOGLE_OAUTH_CLIENT_ID: !!process.env.GOOGLE_OAUTH_CLIENT_ID
            });
            console.log('Environment variables values:', {
                BACKUP_UPLOAD_TO_DRIVE: process.env.BACKUP_UPLOAD_TO_DRIVE,
                BACKUP_MODE: process.env.BACKUP_MODE,
                GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID
            });
            return;
        }

        const drive = google.drive({ version: 'v3', auth });
        console.log('🚀 Attempting to upload to Google Drive...', { filename, folderId });
        
        // Check if file exists
        const fileExists = await fs.access(fullPath).then(() => true).catch(() => false);
        console.log('File exists for upload:', fileExists);
        if (!fileExists) {
            console.error('❌ File does not exist for upload:', fullPath);
            return;
        }
        
        const res = await drive.files.create({
            requestBody: { name: filename, parents: [folderId] },
            media: { mimeType: 'application/json', body: createReadStream(fullPath) }
        });
        
        console.log('✅ Successfully uploaded to Google Drive!', {
            fileId: res.data.id,
            fileName: res.data.name,
            folderId: folderId
        });
        console.log('=== GOOGLE DRIVE UPLOAD COMPLETED ===');
    } catch (e) {
        console.error('❌ Google Drive upload failed:', e?.message || e);
        console.error('Error details:', e);
        console.log('=== GOOGLE DRIVE UPLOAD FAILED ===');
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

console.log('🚀 Server starting with version 2.0.0');
console.log('📅 Server start time:', new Date().toISOString());

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
        // Optional backup on save (disabled by default)
        if (process.env.BACKUP_ON_SAVE === 'true') {
            await writeBackupSnapshot(merged);
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
        res.set('Cache-Control', 'no-store');
        // Ensure data directory exists before any file operations
        await ensureDataLocations();
        
        const filePath = DATA_PRODUCTS_FILE;
        const raw = await fs.readFile(filePath, 'utf8').catch(() => '{"products":{},"categories":{}}');
        const data = JSON.parse(raw || '{}');
        // Auto-restore if products are empty and auto-restore is enabled
        const autoRestore = process.env.AUTO_RESTORE_ON_EMPTY === 'true';
        const productsCount = data.products ? Object.keys(data.products).length : 0;
        if (autoRestore && productsCount === 0) {
            const latest = await getLatestBackupFilePath();
            if (latest) {
                try {
                    const backupData = await fs.readFile(latest, 'utf8');
                    await fs.writeFile(filePath, backupData, 'utf8');
                    const parsed = JSON.parse(backupData || '{}');
                    return res.json({ products: parsed.products || {}, categories: parsed.categories || {}, restoredFrom: latest });
                } catch (e) {
                    console.warn('Auto-restore failed:', e?.message || e);
                }
            }
        }
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

// Debug endpoint to check if server is updated
app.get('/api/debug', (req, res) => {
    res.json({ 
        message: 'Server is updated with latest code',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

// Test Google Drive connection
app.get('/api/test-drive', async (req, res) => {
    try {
        console.log('=== TESTING GOOGLE DRIVE CONNECTION ===');
        console.log('Environment variables:', {
            BACKUP_UPLOAD_TO_DRIVE: process.env.BACKUP_UPLOAD_TO_DRIVE,
            GOOGLE_DRIVE_FOLDER_ID: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
            GOOGLE_SERVICE_ACCOUNT: !!process.env.GOOGLE_SERVICE_ACCOUNT
        });
        
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!folderId) {
            return res.json({ error: 'No Google Drive folder ID configured' });
        }
        
        const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
        let auth;
        
        // Try Service Account
        let svcAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT;
        if (svcAccountJson) {
            try {
                const creds = JSON.parse(svcAccountJson);
                auth = new google.auth.GoogleAuth({ credentials: creds, scopes });
                console.log('✅ Service Account auth created');
            } catch (e) {
                console.error('❌ Service Account auth failed:', e?.message);
            }
        }
        
        if (!auth) {
            return res.json({ error: 'No Google Drive authentication configured' });
        }
        
        const drive = google.drive({ version: 'v3', auth });
        const result = await drive.files.list({ q: `'${folderId}' in parents`, maxResults: 1 });
        
        res.json({ 
            success: true, 
            message: 'Google Drive connection working',
            folderId: folderId,
            filesFound: result.data.files?.length || 0
        });
    } catch (e) {
        console.error('Google Drive test failed:', e?.message);
        res.status(500).json({ error: 'Google Drive test failed', details: e?.message });
    }
});

// Manual backup endpoint (forces snapshot + optional Drive upload)
app.post('/api/backup-now', async (req, res) => {
    try {
        console.log('=== MANUAL BACKUP REQUEST ===');
        console.log('Environment check:', {
            BACKUP_UPLOAD_TO_DRIVE: process.env.BACKUP_UPLOAD_TO_DRIVE,
            BACKUP_MODE: process.env.BACKUP_MODE,
            GOOGLE_DRIVE_FOLDER_ID: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
            GOOGLE_SERVICE_ACCOUNT: !!process.env.GOOGLE_SERVICE_ACCOUNT
        });
        
        const raw = await fs.readFile(DATA_PRODUCTS_FILE, 'utf8').catch(() => null);
        if (!raw) {
            console.error('❌ No data file found for backup');
            return res.status(404).json({ error: 'no data file' });
        }
        console.log('✅ Data file found, size:', raw.length);
        
        const data = JSON.parse(raw || '{}');
        console.log('Data parsed, products:', Object.keys(data.products || {}).length);
        
        console.log('🚀 Starting backup snapshot...');
        await writeBackupSnapshot(data);
        console.log('✅ Backup snapshot completed');
        
        const totals = {
            products: data.products ? Object.keys(data.products).length : 0,
            categories: data.categories ? Object.keys(data.categories).length : 0
        };
        console.log('Backup totals:', totals);
        console.log('=== MANUAL BACKUP COMPLETED ===');
        res.json({ success: true, message: 'Backup created', totals });
    } catch (e) {
        console.error('❌ Manual backup failed:', e);
        console.error('Error details:', e);
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

// List local backups with metadata and counts
app.get('/api/backups', async (req, res) => {
    try {
        await ensureDataLocations();
        const files = await fs.readdir(BACKUPS_DIR).catch(() => []);
        const list = [];
        for (const f of files.filter(x => /^products-\d{8}-\d{6}\.json$/.test(x)).sort().reverse()) {
            const p = path.join(BACKUPS_DIR, f);
            const st = await fs.stat(p).catch(() => null);
            let totals = { products: 0, categories: 0 };
            try {
                const raw = await fs.readFile(p, 'utf8');
                const data = JSON.parse(raw || '{}');
                totals.products = data.products ? Object.keys(data.products).length : 0;
                totals.categories = data.categories ? Object.keys(data.categories).length : 0;
            } catch {}
            list.push({
                type: 'local',
                filename: f,
                path: p,
                size: st?.size || 0,
                mtime: st?.mtime || null,
                totals
            });
        }
        res.json({ success: true, backups: list });
    } catch (e) {
        res.status(500).json({ error: 'list failed', details: e?.message });
    }
});

// List Google Drive backups (if configured)
app.get('/api/drive-backups', async (req, res) => {
    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!folderId) return res.json({ success: true, backups: [] });

        const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
        let auth;
        let svcAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT;
        if (svcAccountJson) {
            try { auth = new google.auth.GoogleAuth({ credentials: JSON.parse(svcAccountJson), scopes }); } catch {}
        }
        if (!auth) {
            const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
            const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
            if (clientId && clientSecret && refreshToken) {
                const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
                oauth2.setCredentials({ refresh_token: refreshToken });
                auth = oauth2;
            }
        }
        if (!auth) return res.json({ success: true, backups: [] });

        const drive = google.drive({ version: 'v3', auth });
        const resp = await drive.files.list({ q: `'${folderId}' in parents and name contains 'products-' and mimeType = 'application/json'`, fields: 'files(id,name,modifiedTime,size)', orderBy: 'modifiedTime desc' });

        const files = resp.data.files || [];
        const backups = [];
        for (const f of files) {
            let totals = { products: 0, categories: 0 };
            try {
                const fileResp = await drive.files.get({ fileId: f.id, alt: 'media' }, { responseType: 'stream' });
                const chunks = [];
                await new Promise((resolve, reject) => {
                    fileResp.data.on('data', d => chunks.push(d));
                    fileResp.data.on('end', resolve);
                    fileResp.data.on('error', reject);
                });
                const raw = Buffer.concat(chunks).toString('utf8');
                const data = JSON.parse(raw || '{}');
                totals.products = data.products ? Object.keys(data.products).length : 0;
                totals.categories = data.categories ? Object.keys(data.categories).length : 0;
            } catch {}
            backups.push({ type: 'drive', id: f.id, name: f.name, modifiedTime: f.modifiedTime, size: parseInt(f.size || '0', 10), totals });
        }
        res.json({ success: true, backups });
    } catch (e) {
        res.status(500).json({ error: 'drive list failed', details: e?.message });
    }
});

// Restore from chosen backup (local or drive)
app.post('/api/restore', async (req, res) => {
    try {
        const { source, id, filename } = req.body || {};
        await ensureDataLocations();
        let raw;
        if (source === 'local' && filename) {
            const p = path.join(BACKUPS_DIR, filename);
            raw = await fs.readFile(p, 'utf8');
        } else if (source === 'drive' && id) {
            const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
            let auth;
            let svcAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT;
            if (svcAccountJson) {
                try { auth = new google.auth.GoogleAuth({ credentials: JSON.parse(svcAccountJson), scopes }); } catch {}
            }
            if (!auth) {
                const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
                const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
                const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
                if (clientId && clientSecret && refreshToken) {
                    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
                    oauth2.setCredentials({ refresh_token: refreshToken });
                    auth = oauth2;
                }
            }
            if (!auth) return res.status(400).json({ error: 'drive not configured' });
            const drive = google.drive({ version: 'v3', auth });
            const fileResp = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
            const chunks = [];
            await new Promise((resolve, reject) => {
                fileResp.data.on('data', d => chunks.push(d));
                fileResp.data.on('end', resolve);
                fileResp.data.on('error', reject);
            });
            raw = Buffer.concat(chunks).toString('utf8');
        } else {
            return res.status(400).json({ error: 'invalid source' });
        }

        await fs.writeFile(DATA_PRODUCTS_FILE, raw, 'utf8');
        const parsed = JSON.parse(raw || '{}');
        res.json({ success: true, totals: { products: Object.keys(parsed.products || {}).length, categories: Object.keys(parsed.categories || {}).length } });
    } catch (e) {
        res.status(500).json({ error: 'restore failed', details: e?.message });
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

// Delete backup endpoint
app.post('/api/delete-backup', async (req, res) => {
    try {
        console.log('=== DELETE BACKUP REQUEST ===');
        console.log('Delete backup request:', req.body);
        console.log('Server version 2.0.0 - Delete endpoint reached');
        
        // Simple test response first
        if (req.body.test === 'true') {
            return res.json({ success: true, message: 'Delete endpoint working', version: '2.0.0' });
        }
        
        const { source, id, filename } = req.body;
        console.log('Delete parameters:', { source, id, filename });
        
        if (source === 'local' && filename) {
            console.log('🗑️ Deleting local backup:', filename);
            const backupPath = path.join(BACKUPS_DIR, filename);
            console.log('Backup path:', backupPath);
            await fs.unlink(backupPath);
            console.log('✅ Local backup deleted successfully');
            res.json({ success: true, message: 'Local backup deleted' });
        } else if (source === 'drive' && id) {
            console.log('🗑️ Deleting Drive backup:', id);
            const scopes = ['https://www.googleapis.com/auth/drive.file'];
            let auth;
            
            // Try Service Account first
            let svcAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT;
            console.log('Service Account for delete:', !!svcAccountJson);
            if (svcAccountJson) {
                try { 
                    auth = new google.auth.GoogleAuth({ credentials: JSON.parse(svcAccountJson), scopes }); 
                    console.log('✅ Service Account auth created for delete');
                } catch (e) {
                    console.error('❌ Service Account auth failed for delete:', e?.message);
                }
            }
            
            // Fallback to OAuth
            if (!auth) {
                console.log('Trying OAuth for delete...');
                const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
                const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
                const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
                if (clientId && clientSecret && refreshToken) {
                    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
                    oauth2.setCredentials({ refresh_token: refreshToken });
                    auth = oauth2;
                    console.log('✅ OAuth auth created for delete');
                } else {
                    console.log('❌ No OAuth credentials for delete');
                }
            }
            
            if (!auth) {
                console.error('❌ No auth available for Drive delete');
                return res.status(400).json({ error: 'drive not configured' });
            }
            
            const drive = google.drive({ version: 'v3', auth });
            console.log('🚀 Attempting to delete from Drive...');
            await drive.files.delete({ fileId: id });
            console.log('✅ Drive backup deleted successfully');
            res.json({ success: true, message: 'Drive backup deleted' });
        } else {
            console.error('❌ Invalid delete parameters');
            res.status(400).json({ error: 'invalid parameters' });
        }
        console.log('=== DELETE BACKUP COMPLETED ===');
    } catch (e) {
        console.error('❌ Delete backup failed:', e?.message || e);
        console.error('Error details:', e);
        res.status(500).json({ error: 'delete failed', details: e?.message });
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
    // Start scheduled conditional backups only if explicitly enabled
    if (process.env.BACKUP_ENABLED === 'true') {
        scheduleDailyConditionalBackup();
    } else {
        console.log('Scheduled backups are disabled (BACKUP_ENABLED!=true)');
    }
}).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
