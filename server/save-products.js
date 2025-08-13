const fs = require('fs').promises;
const path = require('path');

// נתיב לקובץ products.json
const PRODUCTS_FILE = path.join(__dirname, '..', 'products.json');

// פונקציה לשמירת מוצרים
async function saveProducts(products, categories) {
    try {
        const data = {
            products,
            categories,
            lastUpdate: new Date().toISOString()
        };
        
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(data, null, 2));
        return { success: true, message: 'המוצרים נשמרו בהצלחה' };
    } catch (error) {
        console.error('Error saving products:', error);
        throw new Error('שגיאה בשמירת המוצרים');
    }
}

module.exports = { saveProducts };
