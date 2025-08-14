// הגדרות גלובליות למערכת (Frontend)
// ניתוק מוחלט מ-Render: אין שימוש ב-*.onrender.com
// הפקה: ניתן להגדיר window.API_BASE_URL לפני טעינת קבצי הסקריפט
// דוגמה: <script>window.API_BASE_URL = 'https://api.your-domain.com';</script>
const config = {
    getApiBaseUrl: function () {
        try {
            if (typeof window !== 'undefined' && window.API_BASE_URL) {
                return window.API_BASE_URL;
            }
            const hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) || '';
            const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
            if (isDev) {
                return 'http://localhost:5000';
            }
            // ברירת מחדל: אותו מקור (במידה וה-API מאוחסן יחד עם האתר)
            if (typeof window !== 'undefined' && window.location) {
                return window.location.origin;
            }
        } catch {}
        // Fallback בטוח
        return 'http://localhost:5000';
    }
};

// הגדרות גלובליות למערכת
const config = {
    // פונקציה להשגת כתובת השרת
    getApiBaseUrl: function() {
        return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:5000'
            : 'https://nsion-chdash-api.onrender.com';
    }
};
