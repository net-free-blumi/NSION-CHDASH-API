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
const ROOT_ORDERS_FILE = path.join(__dirname, '..', 'orders.json');
let DATA_DIR = process.env.DATA_DIR || __dirname;
let DATA_PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
let BACKUPS_DIR = path.join(DATA_DIR, 'backups');
let ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

async function ensureDataLocations() {
    try {
        // Always use local directory for Render compatibility
            DATA_DIR = __dirname;
            DATA_PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
            BACKUPS_DIR = path.join(DATA_DIR, 'backups');
        ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
        
        // Create directories if they don't exist
            await fs.mkdir(BACKUPS_DIR, { recursive: true });
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
        console.log('☁️ Cloud storage enabled:', process.env.BACKUP_UPLOAD_TO_CLOUD === 'true' ? 'YES' : 'NO');
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

function getFriendlyBackupName() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    // Avoid illegal '/' for Drive filenames
    const datePart = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    const timePart = `${pad(d.getHours())}-${pad(d.getMinutes())}`;
    return `גיבוי מוצרים מהבאַק ${datePart} - ${timePart}.json`;
}

function getCloudBackupName() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `products-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

// ===== Supabase helpers via REST (no external SDK) =====
function getSupabaseEnv() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    const bucket = process.env.SUPABASE_BUCKET || 'backups';
    if (!url || !key) return null;
    return { url, key, bucket };
}

async function uploadToSupabase(fullPath, destName) {
    if (process.env.BACKUP_UPLOAD_TO_CLOUD !== 'true') return;
    const env = getSupabaseEnv();
    if (!env) return;
    const fileBuffer = await fs.readFile(fullPath);
    const endpoint = `${env.url}/storage/v1/object/${encodeURIComponent(env.bucket)}/${encodeURIComponent(destName)}`;
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.key}`,
            'apikey': env.key,
            'x-upsert': 'true',
            'Content-Type': 'application/json'
        },
        body: fileBuffer
    });
    if (!resp.ok) {
        const t = await resp.text().catch(()=>resp.statusText);
        throw new Error(`supabase upload failed: ${resp.status} ${t}`);
    }
    console.log('✅ Uploaded to Supabase:', destName);
}

async function listSupabaseBackups() {
    const env = getSupabaseEnv();
    if (!env) return [];
    const endpoint = `${env.url}/storage/v1/object/list/${encodeURIComponent(env.bucket)}`;
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.key}`, 'apikey': env.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: '', limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
    });
    if (!resp.ok) return [];
    const data = await resp.json().catch(()=>[]);
    const results = [];
    for (const f of (data || []).filter(x => (x.name||'').endsWith('.json'))) {
        let totals = { products: 0, categories: 0 };
        try {
            const raw = await downloadSupabaseBackup(f.name);
            const parsed = JSON.parse(raw || '{}');
            totals.products = parsed.products ? Object.keys(parsed.products).length : 0;
            totals.categories = parsed.categories ? Object.keys(parsed.categories).length : 0;
        } catch {}
        results.push({ type: 'cloud', id: f.name, name: f.name, size: f.metadata?.size || f.size || 0, modifiedTime: f.updated_at || f.created_at || null, totals });
    }
    return results;
}

async function downloadSupabaseBackup(name) {
    const env = getSupabaseEnv();
    if (!env) throw new Error('supabase not configured');
    const endpoint = `${env.url}/storage/v1/object/${encodeURIComponent(env.bucket)}/${encodeURIComponent(name)}`;
    const resp = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${env.key}`, 'apikey': env.key } });
    if (!resp.ok) throw new Error(`download failed: ${resp.status}`);
    return await resp.text();
}

async function deleteSupabaseBackup(name) {
    const env = getSupabaseEnv();
    if (!env) throw new Error('supabase not configured');
    const endpoint = `${env.url}/storage/v1/object/${encodeURIComponent(env.bucket)}`;
    const resp = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${env.key}`, 'apikey': env.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [name] })
    });
    if (!resp.ok) throw new Error(`delete failed: ${resp.status}`);
}

async function writeBackupSnapshot(dataObject) {
    try {
        await fs.mkdir(BACKUPS_DIR, { recursive: true });
        const filename = `products-${getNowTimestamp()}.json`;
        const fullPath = path.join(BACKUPS_DIR, filename);
        await fs.writeFile(fullPath, JSON.stringify(dataObject, null, 2), 'utf8');
        console.log('Local backup created at', fullPath);
        // Upload to Supabase if enabled (manual backups only)
        try {
            await uploadToSupabase(fullPath, getCloudBackupName());
        } catch (e) {
            console.warn('Supabase upload failed:', e?.message || e);
        }
        
        console.log('=== BACKUP COMPLETED ===');
    } catch (e) {
        console.warn('Failed to create local backup:', e?.message || e);
    }
}

// Google Drive upload removed per product requirements (listing/restore still supported)

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

async function getLatestDriveBackup() {
    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!folderId) {
            console.log('No Google Drive folder ID configured');
            return null;
        }

        const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
        let auth;
        
        // Try Service Account first
        let svcAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT;
        if (svcAccountJson) {
            try {
                const creds = JSON.parse(svcAccountJson);
                auth = new google.auth.GoogleAuth({ credentials: creds, scopes });
                console.log('✅ Service Account auth created for auto-restore');
            } catch (e) {
                console.error('❌ Service Account auth failed for auto-restore:', e?.message);
            }
        }
        
        // Fallback to OAuth
        if (!auth) {
            const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
            const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
            if (clientId && clientSecret && refreshToken) {
                const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
                oauth2.setCredentials({ refresh_token: refreshToken });
                auth = oauth2;
                console.log('✅ OAuth auth created for auto-restore');
            }
        }
        
        if (!auth) {
            console.log('❌ No auth available for Drive auto-restore');
            return null;
        }

        const drive = google.drive({ version: 'v3', auth });
        const resp = await drive.files.list({ 
            q: `'${folderId}' in parents and name contains 'products-' and mimeType = 'application/json'`, 
            fields: 'files(id,name,modifiedTime)', 
            orderBy: 'modifiedTime desc',
            maxResults: 1,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });

        const files = resp.data.files || [];
        if (files.length === 0) {
            console.log('No backup files found in Google Drive');
            return null;
        }

        const latestFile = files[0];
        console.log('Found latest Drive backup:', latestFile.name);
        
        // Download the file
        const fileResp = await drive.files.get({ 
            fileId: latestFile.id, 
            alt: 'media',
            supportsAllDrives: true
        }, { responseType: 'stream' });
        
        const chunks = [];
        await new Promise((resolve, reject) => {
            fileResp.data.on('data', d => chunks.push(d));
            fileResp.data.on('end', resolve);
            fileResp.data.on('error', reject);
        });
        
        const data = Buffer.concat(chunks).toString('utf8');
        return { name: latestFile.name, data: data };
        
    } catch (e) {
        console.error('❌ Error getting latest Drive backup:', e?.message || e);
        return null;
    }
}

// Aggregate latest backup across all sources (local, drive, cloud)
async function findLatestBackupAcrossSources() {
    try {
        const candidates = [];

        // Local backups by mtime
        try {
            await fs.mkdir(BACKUPS_DIR, { recursive: true });
            const files = await fs.readdir(BACKUPS_DIR).catch(() => []);
            for (const f of files.filter(x => /^products-\d{8}-\d{6}\.json$/.test(x))) {
                const p = path.join(BACKUPS_DIR, f);
                const st = await fs.stat(p).catch(() => null);
                if (st) {
                    candidates.push({ source: 'local', when: st.mtimeMs, meta: { filename: f, path: p } });
                }
            }
        } catch {}

        // Google Drive backups by modifiedTime
        try {
            const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
            if (folderId) {
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
                if (auth) {
                    const drive = google.drive({ version: 'v3', auth });
                    const resp = await drive.files.list({
                        q: `'${folderId}' in parents and mimeType = 'application/json'`,
                        fields: 'files(id,name,modifiedTime)',
                        orderBy: 'modifiedTime desc',
                        supportsAllDrives: true,
                        includeItemsFromAllDrives: true
                    });
                    const files = resp.data.files || [];
                    for (const f of files) {
                        const when = Date.parse(f.modifiedTime || '') || 0;
                        candidates.push({ source: 'drive', when, meta: { id: f.id, name: f.name } });
                    }
                }
            }
        } catch {}

        // Supabase backups by updated_at/created_at
        try {
            const env = getSupabaseEnv();
            if (env) {
                const endpoint = `${env.url}/storage/v1/object/list/${encodeURIComponent(env.bucket)}`;
                const resp = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${env.key}`, 'apikey': env.key, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prefix: '', limit: 100, sortBy: { column: 'updated_at', order: 'desc' } })
                });
                if (resp.ok) {
                    const data = await resp.json().catch(() => []);
                    for (const f of (data || []).filter(x => (x.name||'').endsWith('.json'))) {
                        const when = Date.parse(f.updated_at || f.created_at || '') || 0;
                        candidates.push({ source: 'cloud', when, meta: { name: f.name } });
                    }
                }
            }
        } catch {}

        if (!candidates.length) return null;
        candidates.sort((a, b) => b.when - a.when);
        return candidates[0];
    } catch (e) {
        console.warn('findLatestBackupAcrossSources failed:', e?.message || e);
        return null;
    }
}

async function restoreFromDescriptor(desc) {
    if (!desc) return false;
    try {
        if (desc.source === 'local') {
            const raw = await fs.readFile(desc.meta.path, 'utf8');
            await fs.writeFile(DATA_PRODUCTS_FILE, raw, 'utf8');
            console.log('✅ Restored from local backup:', desc.meta.filename);
            return true;
        }
        if (desc.source === 'drive') {
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
            if (!auth) throw new Error('drive not configured');
            const drive = google.drive({ version: 'v3', auth });
            const fileResp = await drive.files.get({ fileId: desc.meta.id, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
            const chunks = [];
            await new Promise((resolve, reject) => {
                fileResp.data.on('data', d => chunks.push(d));
                fileResp.data.on('end', resolve);
                fileResp.data.on('error', reject);
            });
            const raw = Buffer.concat(chunks).toString('utf8');
            await fs.writeFile(DATA_PRODUCTS_FILE, raw, 'utf8');
            console.log('✅ Restored from Drive backup:', desc.meta.name);
            return true;
        }
        if (desc.source === 'cloud') {
            const raw = await downloadSupabaseBackup(desc.meta.name);
            await fs.writeFile(DATA_PRODUCTS_FILE, raw, 'utf8');
            console.log('✅ Restored from Cloud backup:', desc.meta.name);
            return true;
        }
        return false;
    } catch (e) {
        console.warn('restoreFromDescriptor failed:', e?.message || e);
        return false;
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

// Enable CORS (dev-friendly): reflect incoming Origin, allow credentials
app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Cache-Control');
    next();
});
app.use(cors({ origin: true, credentials: true }));
app.options('*', cors());

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
                
                // מחיקת שדות שמוגדרים כ-null (למחיקה)
                for (const [key, value] of Object.entries(p)) {
                    if (value === null) {
                        delete merged.products[code][key];
                    }
                }
            }
        }
        if (categories) {
            merged.categories = { ...merged.categories, ...categories };
        }
        await fs.writeFile(filePath, JSON.stringify(merged, null, 2), 'utf8');
        
        // שמירה אוטומטית לענן אחרי כל שמירת מוצרים
        try {
            await uploadProductsToCloud(merged);
            console.log('✅ Products automatically saved to cloud');
        } catch (cloudError) {
            console.warn('⚠️ Failed to save products to cloud:', cloudError.message);
            // לא נכשל את הבקשה אם השמירה לענן נכשלת
        }
        
        // Auto backups on save are disabled per product requirements

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
        
        if (productsCount === 0) {
            console.log('🔄 Products count is 0, attempting auto-restore from cloud...');
            try {
                const list = await listSupabaseBackups();
                if (list && list.length) {
                    const latest = list[0];
                    const rawCloud = await downloadSupabaseBackup(latest.name);
                    await fs.writeFile(filePath, rawCloud, 'utf8');
                    const parsed = JSON.parse(rawCloud || '{}');
                    console.log('✅ Products restored from cloud backup:', latest.name);
                    return res.json({ products: parsed.products || {}, categories: parsed.categories || {}, restoredFrom: 'cloud' });
                }
            } catch (e) {
                console.warn('Cloud auto-restore failed:', e?.message || e);
            }
            console.log('❌ No cloud backups found for auto-restore');
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

// Environment variables debug endpoint
app.get('/api/env-debug', (req, res) => {
    res.json({
        BACKUP_UPLOAD_TO_DRIVE: process.env.BACKUP_UPLOAD_TO_DRIVE,
        BACKUP_MODE: process.env.BACKUP_MODE,
        GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID,
        GOOGLE_SERVICE_ACCOUNT: process.env.GOOGLE_SERVICE_ACCOUNT ? 'EXISTS' : 'MISSING',
        GOOGLE_SERVICE_ACCOUNT_LENGTH: process.env.GOOGLE_SERVICE_ACCOUNT ? process.env.GOOGLE_SERVICE_ACCOUNT.length : 0,
        AUTO_RESTORE_ON_EMPTY: process.env.AUTO_RESTORE_ON_EMPTY,
        BACKUP_ENABLED: process.env.BACKUP_ENABLED
    });
});

// Test Google Drive connection
app.get('/api/test-drive', async (req, res) => {
    try {
    // Google Drive connection test (kept minimal logging)
        
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
        const result = await drive.files.list({ 
            q: `'${folderId}' in parents`, 
            maxResults: 1,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });
        
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
        const resp = await drive.files.list({ 
            q: `'${folderId}' in parents and mimeType = 'application/json'`, 
            fields: 'files(id,name,modifiedTime,size)', 
            orderBy: 'modifiedTime desc',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });

        const files = resp.data.files || [];
        const backups = [];
        for (const f of files) {
            let totals = { products: 0, categories: 0 };
            try {
                const fileResp = await drive.files.get({ fileId: f.id, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
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

// List Supabase cloud backups
app.get('/api/cloud-backups', async (req, res) => {
    try {
        const list = await listSupabaseBackups();
        res.json({ success: true, backups: list });
    } catch (e) {
        res.status(500).json({ error: 'cloud list failed', details: e?.message });
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
            const fileResp = await drive.files.get({ 
                fileId: id, 
                alt: 'media',
                supportsAllDrives: true
            }, { responseType: 'stream' });
            const chunks = [];
            await new Promise((resolve, reject) => {
                fileResp.data.on('data', d => chunks.push(d));
                fileResp.data.on('end', resolve);
                fileResp.data.on('error', reject);
            });
            raw = Buffer.concat(chunks).toString('utf8');
        } else if (source === 'cloud' && (id || filename)) {
            const name = filename || id;
            raw = await downloadSupabaseBackup(name);
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

// Restore-latest (local) removed from UI use; manual restore via modal remains

// Delete backup endpoint
app.post('/api/delete-backup', async (req, res) => {
    try {
        // Minimal logging for delete backup
        
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
            console.log('Deleting Drive backup');
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
            
            await drive.files.delete({ 
                fileId: id,
                supportsAllDrives: true
            });
            
            res.json({ success: true, message: 'Drive backup deleted' });
        } else if (source === 'cloud' && (id || filename)) {
            const name = filename || id;
            await deleteSupabaseBackup(name);
            res.json({ success: true, message: 'Cloud backup deleted' });
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

// ===== ORDERS MANAGEMENT SYSTEM =====

// Orders data structure
let ORDERS_BACKUPS_DIR = null; // Will be set in ensureDataLocations

// Initialize orders data
async function ensureOrdersData() {
    try {
        await ensureDataLocations(); // Make sure data locations are set
        
        // Set ORDERS_BACKUPS_DIR after ensureDataLocations
        ORDERS_BACKUPS_DIR = path.join(DATA_DIR, 'orders-backups');
        
        await fs.mkdir(ORDERS_BACKUPS_DIR, { recursive: true });
        const ordersExists = await fs.access(ORDERS_FILE).then(() => true).catch(() => false);
        if (!ordersExists) {
            await fs.writeFile(ORDERS_FILE, JSON.stringify({ orders: {}, currentOrder: null }, null, 2), 'utf8');
            console.log('Orders data initialized');
        }
    } catch (e) {
        console.error('Failed to initialize orders data:', e);
    }
}

// Upload products to cloud (Supabase)
async function uploadProductsToCloud(productsData) {
    if (process.env.BACKUP_UPLOAD_TO_CLOUD !== 'true') return;
    const env = getSupabaseEnv();
    if (!env) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `products-${timestamp}.json`;
    
    try {
        const endpoint = `${env.url}/storage/v1/object/${encodeURIComponent(env.bucket)}/${encodeURIComponent(filename)}`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productsData)
        });
        
        if (!response.ok) {
            throw new Error(`Supabase upload failed: ${response.status} ${response.statusText}`);
        }
        
        console.log(`✅ Products uploaded to cloud: ${filename}`);
    } catch (error) {
        console.error('❌ Failed to upload products to cloud:', error);
        throw error;
    }
}

// Save order to cloud (Supabase)
async function saveOrderToCloud(orderData) {
    if (process.env.BACKUP_UPLOAD_TO_CLOUD !== 'true') return;
    const env = getSupabaseEnv();
    if (!env) return;
    
    const orderId = orderData.id || `order-${Date.now()}`;
    const filename = `orders/${orderId}.json`;
    
    const fileBuffer = Buffer.from(JSON.stringify(orderData, null, 2), 'utf8');
    const endpoint = `${env.url}/storage/v1/object/${encodeURIComponent(env.bucket)}/${encodeURIComponent(filename)}`;
    
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.key}`,
            'apikey': env.key,
            'x-upsert': 'true',
            'Content-Type': 'application/json'
        },
        body: fileBuffer
    });
    
    if (!resp.ok) {
        const t = await resp.text().catch(() => resp.statusText);
        throw new Error(`supabase upload failed: ${resp.status} ${t}`);
    }
    
    console.log('✅ Order saved to cloud:', orderId);
}

// Delete order from cloud
app.delete('/api/orders/delete/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const env = getSupabaseEnv();
        
        if (!env) {
            return res.status(500).json({ error: 'Cloud storage not configured' });
        }
        
        // Delete from Supabase - תיקון URL
        const fileName = `${orderId}.json`;
        
        // נסה עם הקובץ עם/בלי "orders/" prefix
        const pathsToTry = [
            `orders/${fileName}`,
            fileName
        ];
        
        let deleted = false;
        for (const filePath of pathsToTry) {
            try {
                const deleteUrl = `${env.url}/storage/v1/object/${encodeURIComponent(env.bucket)}/${encodeURIComponent(filePath)}`;
                console.log(`🔗 מנסה למחוק: ${deleteUrl}`);
                
                const deleteResp = await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${env.key}`,
                        'apikey': env.key
                    }
                });
                
                console.log(`📥 תגובת מחיקה: ${deleteResp.status}`);
                
                if (deleteResp.ok || deleteResp.status === 404) {
                    console.log(`✅ Order deleted from cloud: ${fileName}`);
                    deleted = true;
                    break;
                }
            } catch (e) {
                console.warn(`⚠️ נכשל בנסיון למחוק את ${filePath}:`, e.message);
                continue;
            }
        }
        
        if (deleted) {
            res.json({ success: true, message: 'Order deleted successfully' });
        } else {
            console.error(`❌ Failed to delete order from cloud: ${fileName}`);
            // נשלח success בכל זאת כי זה לא משפיע על המשתמש
            res.json({ success: true, message: 'Order deletion attempted (may not have existed)' });
        }
    } catch (error) {
        console.error('Error deleting order from cloud:', error);
        // נשלח success כדי לא לשבור את החוויה
        res.json({ success: true, message: 'Order deletion attempted' });
    }
});

        // Get orders from cloud
        async function getOrdersFromCloud() {
            const env = getSupabaseEnv();
            if (!env) return { orders: [] };
            
            const endpoint = `${env.url}/storage/v1/object/list/${encodeURIComponent(env.bucket)}`;
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${env.key}`, 'apikey': env.key, 'Content-Type': 'application/json' },
                body: JSON.stringify({ prefix: 'orders/', limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
            });
            
            if (!resp.ok) {
                console.warn('Failed to list cloud orders:', resp.status, resp.statusText);
                return { orders: [] };
            }
            const data = await resp.json().catch(() => []);
            console.log('📋 Cloud orders list response:', data?.length || 0, 'files found');
            
            const results = [];
            for (const f of (data || []).filter(x => (x.name || '').endsWith('.json'))) {
                try {
                    console.log('🔍 Processing file:', f.name);
                    // הכנת שם הקובץ
                    const fileName = f.name.replace('orders/', '');
                    
                    // נסיון עם שני נתיבים אפשריים
                    const endpointsToTry = [
                        `${env.url}/storage/v1/object/public/${encodeURIComponent(env.bucket)}/orders/${fileName}`,
                        `${env.url}/storage/v1/object/public/${encodeURIComponent(env.bucket)}/${f.name}`,
                        `${env.url}/storage/v1/object/${encodeURIComponent(env.bucket)}/orders/${fileName}`
                    ];
                    
                    let orderResp = null;
                    for (const orderEndpoint of endpointsToTry) {
                        try {
                            console.log('🔗 Trying endpoint:', orderEndpoint);
                            orderResp = await fetch(orderEndpoint, {
                                headers: {
                                    'Authorization': `Bearer ${env.key}`,
                                    'apikey': env.key
                                }
                            });
                            console.log('📥 Order response status:', orderResp.status);
                            if (orderResp.ok) {
                                break;
                            }
                        } catch (e) {
                            console.warn('⚠️ Failed to fetch from:', orderEndpoint, e.message);
                            continue;
                        }
                    }
                    
                    if (orderResp && orderResp.ok) {
                        const orderData = await orderResp.json();
                        console.log('📋 Order data loaded successfully');
                        results.push({
                            id: fileName.replace('.json', ''),
                            orderNumber: orderData.orderNumber || fileName.replace('.json', ''),
                            date: orderData.orderDate || orderData.createdDate || new Date(orderData.createdAt).toLocaleDateString('he-IL'),
                            time: orderData.orderTime || orderData.createdTime || new Date(orderData.createdAt).toLocaleTimeString('he-IL'),
                            total: orderData.total || 0,
                            items: orderData.items || {},
                            status: orderData.status || 'completed',
                            data: orderData
                        });
                        console.log('✅ Loaded order from cloud:', fileName);
                    } else {
                        console.warn('❌ Failed to load order file:', fileName, 'status:', orderResp?.status);
                    }
                } catch (e) {
                    console.warn('❌ Failed to load order:', f.name, e);
                }
            }
            
            console.log('📋 Total cloud orders loaded:', results.length);
            return { orders: results };
        }

// Download specific order from cloud
async function downloadOrderFromCloud(orderId) {
    const env = getSupabaseEnv();
    if (!env) throw new Error('supabase not configured');
    
    const filename = `orders/${orderId}.json`;
    const endpoint = `${env.url}/storage/v1/object/${encodeURIComponent(env.bucket)}/${encodeURIComponent(filename)}`;
    const resp = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${env.key}`, 'apikey': env.key } });
    
    if (!resp.ok) throw new Error(`download failed: ${resp.status}`);
    return await resp.json();
}

// Create or update order
app.post('/api/orders/create', async (req, res) => {
    try {
        await ensureOrdersData();
        const { customerName, items, total, notes, orderNumber, orderDate, orderTime } = req.body;
        
        let orderId = `order-${Date.now()}`;
        let existingOrderId = null;
        
        // בדיקה אם יש הזמנה קיימת עם אותו מספר הזמנה
        if (orderNumber) {
            try {
                const env = getSupabaseEnv();
                if (env) {
                    const listResp = await fetch(`${env.url}/storage/v1/object/list/${encodeURIComponent(env.bucket)}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${env.key}`, 'apikey': env.key, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prefix: 'orders/', limit: 1000 })
                    });
                    
                    if (listResp.ok) {
                        const files = await listResp.json();
                        for (const file of files || []) {
                            if (file.name?.endsWith('.json')) {
                                try {
                                    const fileName = file.name.replace('orders/', '');
                                    const orderEndpoint = `${env.url}/storage/v1/object/public/${encodeURIComponent(env.bucket)}/orders/${fileName}`;
                                    const orderResp = await fetch(orderEndpoint, {
                                        headers: { 'Authorization': `Bearer ${env.key}`, 'apikey': env.key }
                                    });
                                    if (orderResp.ok) {
                                        const existingOrder = await orderResp.json();
                                        if (existingOrder.orderNumber == orderNumber) {
                                            existingOrderId = fileName.replace('.json', '');
                                            orderId = existingOrderId;
                                            console.log(`✅ נמצאה הזמנה קיימת עם אותו מספר: ${orderNumber}, מעדכן אותה`);
                                            break;
                                        }
                                    }
                                } catch (e) {
                                    console.warn('Error checking file:', e);
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('Failed to check for existing order:', e);
            }
        }
        
        const finalOrderNumber = orderNumber || (Math.floor(Math.random() * 9000) + 1000);
        const now = new Date();
        const orderData = {
            id: orderId,
            orderNumber: finalOrderNumber,
            customerName: customerName || 'הזמנה ללא שם',
            items: items || {},
            total: total || 0,
            notes: notes || '',
            status: 'completed',
            createdAt: existingOrderId ? undefined : now.toISOString(), // רק אם חדש
            orderDate: orderDate || now.toLocaleDateString('he-IL'),
            orderTime: orderTime || now.toLocaleTimeString('he-IL'),
            createdDate: now.toLocaleDateString('he-IL'),
            createdTime: now.toLocaleTimeString('he-IL'),
            updatedAt: now.toISOString()
        };
        
        // אם עדכן הזמנה קיימת, לא נמחק את createdAt
        if (existingOrderId && orderData.createdAt === undefined) {
            delete orderData.createdAt;
        }
        
        // Save locally
        const raw = await fs.readFile(ORDERS_FILE, 'utf8').catch(() => '{"orders":{},"currentOrder":null}');
        const data = JSON.parse(raw || '{}');
        data.orders[orderId] = orderData;
        data.currentOrder = orderId;
        await fs.writeFile(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8');
        
        // Save to cloud
        try {
            await saveOrderToCloud(orderData);
        } catch (e) {
            console.warn('Cloud save failed:', e?.message || e);
        }
        
        res.json({ success: true, orderId, order: orderData, updated: !!existingOrderId });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'שגיאה ביצירת ההזמנה' });
    }
});

// Update current order
app.post('/api/orders/update', async (req, res) => {
    try {
        await ensureOrdersData();
        const { items, total, notes, customerName } = req.body;
        
        const raw = await fs.readFile(ORDERS_FILE, 'utf8').catch(() => '{"orders":{},"currentOrder":null}');
        const data = JSON.parse(raw || '{}');
        
        if (!data.currentOrder || !data.orders[data.currentOrder]) {
            return res.status(404).json({ error: 'אין הזמנה פעילה' });
        }
        
        const order = data.orders[data.currentOrder];
        order.items = items || order.items;
        order.total = total !== undefined ? total : order.total;
        order.notes = notes !== undefined ? notes : order.notes;
        order.customerName = customerName || order.customerName;
        order.updatedAt = new Date().toISOString();
        
        await fs.writeFile(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8');
        
        // Update in cloud
        try {
            await saveOrderToCloud(order);
        } catch (e) {
            console.warn('Cloud update failed:', e?.message || e);
        }
        
        res.json({ success: true, order });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'שגיאה בעדכון ההזמנה' });
    }
});

// Complete current order
app.post('/api/orders/complete', async (req, res) => {
    try {
        await ensureOrdersData();
        const raw = await fs.readFile(ORDERS_FILE, 'utf8').catch(() => '{"orders":{},"currentOrder":null}');
        const data = JSON.parse(raw || '{}');
        
        if (!data.currentOrder || !data.orders[data.currentOrder]) {
            return res.status(404).json({ error: 'אין הזמנה פעילה' });
        }
        
        const order = data.orders[data.currentOrder];
        order.status = 'completed';
        order.completedAt = new Date().toISOString();
        order.updatedAt = new Date().toISOString();
        
        // Save final version to cloud
        try {
            await saveOrderToCloud(order);
        } catch (e) {
            console.warn('Cloud save failed:', e?.message || e);
        }
        
        // Clear current order
        data.currentOrder = null;
        await fs.writeFile(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8');
        
        res.json({ success: true, order });
    } catch (error) {
        console.error('Error completing order:', error);
        res.status(500).json({ error: 'שגיאה בהשלמת ההזמנה' });
    }
});

// Get current order
app.get('/api/orders/current', async (req, res) => {
    try {
        await ensureOrdersData();
        const raw = await fs.readFile(ORDERS_FILE, 'utf8').catch(() => '{"orders":{},"currentOrder":null}');
        const data = JSON.parse(raw || '{}');
        
        if (!data.currentOrder || !data.orders[data.currentOrder]) {
            return res.json({ success: true, order: null });
        }
        
        res.json({ success: true, order: data.orders[data.currentOrder] });
    } catch (error) {
        console.error('Error getting current order:', error);
        res.status(500).json({ error: 'שגיאה בקבלת ההזמנה הפעילה' });
    }
});

// Get orders history
app.get('/api/orders/history', async (req, res) => {
    try {
        await ensureOrdersData();
        
        // Get local orders
        const raw = await fs.readFile(ORDERS_FILE, 'utf8').catch(() => '{"orders":{},"currentOrder":null}');
        const data = JSON.parse(raw || '{}');
        const localOrders = Object.values(data.orders);
        
        // Get cloud orders
        let cloudOrders = [];
        try {
            const cloudData = await getOrdersFromCloud();
            cloudOrders = cloudData.orders || [];
        } catch (e) {
            console.warn('Failed to get cloud orders:', e?.message || e);
        }
        
        // Combine and deduplicate
        const allOrders = [...localOrders, ...cloudOrders];
        const uniqueOrders = allOrders.reduce((acc, order) => {
            if (!acc.find(o => o.id === order.id)) {
                acc.push(order);
            }
            return acc;
        }, []);
        
        // Sort by date
        uniqueOrders.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        
        res.json({ success: true, orders: uniqueOrders });
    } catch (error) {
        console.error('Error getting orders history:', error);
        res.status(500).json({ error: 'שגיאה בקבלת היסטוריית ההזמנות' });
    }
});

// Get all orders (for compatibility with frontend)
app.get('/api/orders', async (req, res) => {
    try {
        await ensureOrdersData();
        
        // Get local orders
        const raw = await fs.readFile(ORDERS_FILE, 'utf8').catch(() => '{"orders":{},"currentOrder":null}');
        const data = JSON.parse(raw || '{}');
        const localOrders = Object.values(data.orders || {});
        
        // If no local orders, try to load from cloud
        if (localOrders.length === 0) {
            console.log('🔄 No local orders found, attempting to load from cloud...');
            try {
                const cloudData = await getOrdersFromCloud();
                const cloudOrders = cloudData.orders || [];
                if (cloudOrders.length > 0) {
                    console.log(`✅ Loaded ${cloudOrders.length} orders from cloud`);
                    return res.json({ success: true, orders: cloudOrders, count: cloudOrders.length, source: 'cloud' });
                }
            } catch (e) {
                console.warn('Failed to load orders from cloud:', e?.message || e);
            }
        }
        
        // Get cloud orders for additional data
        let cloudOrders = [];
        try {
            const cloudData = await getOrdersFromCloud();
            cloudOrders = cloudData.orders || [];
        } catch (e) {
            console.log('Could not fetch cloud orders:', e.message);
        }
        
        // Combine and deduplicate orders
        const allOrders = [...localOrders, ...cloudOrders];
        const uniqueOrders = allOrders.reduce((acc, order) => {
            const existing = acc.find(o => o.id === order.id);
            if (!existing) {
                acc.push(order);
            } else {
                // Keep the more recent one
                if (new Date(order.updatedAt || order.createdAt) > new Date(existing.updatedAt || existing.createdAt)) {
                    const index = acc.indexOf(existing);
                    acc[index] = order;
                }
            }
            return acc;
        }, []);
        
        // Sort by date
        uniqueOrders.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        
        res.json({ success: true, orders: uniqueOrders });
    } catch (error) {
        console.error('Error getting orders:', error);
        res.status(500).json({ error: 'שגיאה בקבלת ההזמנות' });
    }
});

// Restore order (load into current order)
app.post('/api/orders/restore', async (req, res) => {
    try {
        await ensureOrdersData();
        const { orderId } = req.body;
        
        if (!orderId) {
            return res.status(400).json({ error: 'מזהה הזמנה חסר' });
        }
        
        let orderData;
        
        // Try to get from local first
        const raw = await fs.readFile(ORDERS_FILE, 'utf8').catch(() => '{"orders":{},"currentOrder":null}');
        const data = JSON.parse(raw || '{}');
        
        if (data.orders[orderId]) {
            orderData = data.orders[orderId];
        } else {
            // Try to get from cloud
            try {
                orderData = await downloadOrderFromCloud(orderId);
            } catch (e) {
                return res.status(404).json({ error: 'הזמנה לא נמצאה' });
            }
        }
        
        // Create new order based on restored data
        const newOrderId = `order-${Date.now()}`;
        const newOrder = {
            ...orderData,
            id: newOrderId,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            restoredFrom: orderId
        };
        
        // Save as current order
        data.orders[newOrderId] = newOrder;
        data.currentOrder = newOrderId;
        await fs.writeFile(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8');
        
        res.json({ success: true, order: newOrder });
    } catch (error) {
        console.error('Error restoring order:', error);
        res.status(500).json({ error: 'שגיאה בשחזור ההזמנה' });
    }
});

// Clear current order
app.post('/api/orders/clear', async (req, res) => {
    try {
        await ensureOrdersData();
        const raw = await fs.readFile(ORDERS_FILE, 'utf8').catch(() => '{"orders":{},"currentOrder":null}');
        const data = JSON.parse(raw || '{}');
        
        data.currentOrder = null;
        await fs.writeFile(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8');
        
        res.json({ success: true, message: 'ההזמנה הפעילה נוקתה' });
    } catch (error) {
        console.error('Error clearing order:', error);
        res.status(500).json({ error: 'שגיאה בניקוי ההזמנה' });
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
async function bootAutoRestoreIfNeeded() {
    try {
        await ensureDataLocations();
        const autoRestore = process.env.AUTO_RESTORE_ON_EMPTY === 'true';
        if (!autoRestore) {
            console.log('Boot auto-restore disabled (AUTO_RESTORE_ON_EMPTY!=true)');
            return;
        }
        const raw = await fs.readFile(DATA_PRODUCTS_FILE, 'utf8').catch(() => null);
        const data = raw ? JSON.parse(raw || '{}') : { products: {} };
        const count = data.products ? Object.keys(data.products).length : 0;
        if (count > 0) {
            console.log('Boot auto-restore skipped: products exist:', count);
            return;
        }
        console.log('🟡 Boot auto-restore: products are empty, searching latest backup across all sources...');
        const desc = await findLatestBackupAcrossSources();
        if (!desc) {
            console.log('Boot auto-restore: no backups found');
            return;
        }
        const ok = await restoreFromDescriptor(desc);
        console.log('Boot auto-restore result:', ok ? `restored from ${desc.source}` : 'failed');
    } catch (e) {
        console.warn('Boot auto-restore error:', e?.message || e);
    }
}

ensureDataLocations().then(() => initializeCategories()).then(() => importProductsIfEmpty()).then(() => ensureOrdersData()).then(() => bootAutoRestoreIfNeeded()).then(() => {
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

