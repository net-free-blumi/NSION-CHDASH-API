// מערכת טעינת מוצרים - גולדיס
// קובץ זה מחליף את הנתונים הקיימים בקוד עם מערכת המוצרים החדשה

class ProductsLoader {
    constructor() {
        this.products = {};
        this.categories = {};
        // יצירת גישה גלובלית למופע
        window.productsLoader = this;
        // Create bound function reference for event listener
        this.boundHandleSearchInput = this.handleSearchInput.bind(this);
        this.init();
    }

    // הגדרת חיפוש מוצרים
    setupProductSearch() {
        // חיפוש תיבת חיפוש קיימת
        const searchInput = document.querySelector('input[placeholder*="מקט"], input[placeholder*="מוצר"]');
        if (searchInput) {
            // הסרת event listeners קיימים
            searchInput.removeEventListener('input', this.boundHandleSearchInput);
            searchInput.addEventListener('input', this.boundHandleSearchInput);

            console.log('🔍 תיבת חיפוש מוצרים הוגדרה בהצלחה');
        } else {
            console.log('⚠️ לא נמצאה תיבת חיפוש מוצרים');
        }
    }

    // טעינת מוצרים מה-API (MongoDB) עם נפילה לנתוני דיפולט
    async loadProducts() {
        try {
            const baseUrl = (typeof config !== 'undefined' && config.getApiBaseUrl) ? config.getApiBaseUrl() : window.location.origin;
            const response = await fetch(`${baseUrl}/api/products`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`API ${response.status}`);
            const data = await response.json();
            this.products = data.products || {};
            this.categories = data.categories || {};
        } catch (err) {
            console.error('טעינת מוצרים מה-API נכשלה:', err);
            this.createDefaultData();
        }
    }

    // טעינה מקובץ JSON (fallback ידני)
    async loadFromFile() {
        try {
            const response = await fetch('products.json');
            if (response.ok) {
                const data = await response.json();
                this.products = data.products || {};
                this.categories = data.categories || {};
                this.saveToLocalStorage();
            } else {
                console.error(`שגיאה בטעינת קובץ מוצרים: ${response.status} ${response.statusText}`);
                // יצירת נתונים בסיסיים אם הקובץ לא קיים או יש שגיאה
                this.createDefaultData();
            }
        } catch (error) {
            console.error('שגיאה בטעינת קובץ מוצרים:', error);
            // יצירת נתונים בסיסיים אם הקובץ לא קיים
            this.createDefaultData();
        }
    }

    // יצירת נתונים בסיסיים
    createDefaultData() {
        this.products = {
            "12628": {
                name: "מגש ביס טונה",
                category: "kitchen",
                type: "quantity",
                defaultQuantity: 20,
                unit: "יחי'",
                predefinedQuantities: [12, 20],
                sizes: [
                    { size: "12 יחי", price: 170 },
                    { size: "20 יחי", price: 285 }
                ]
            }
        };
        this.categories = {
            "kitchen": "מוצרי מטבח",
            "bakery": "מוצרי מאפה",
            "fruits": "מוצרי פירות",
            "general": "מוצרים כלליים"
        };
        this.saveToLocalStorage();
    }

    // שמירה ל-localStorage
    saveToLocalStorage() {
        try {
            const data = {
                products: this.products,
                categories: this.categories,
                lastUpdated: new Date().toISOString()
            };
            localStorage.setItem('goldis_products', JSON.stringify(data));
        } catch (error) {
            console.error('שגיאה בשמירה ל-localStorage:', error);
        }
    }

    // החלפת הנתונים הקיימים בקוד
    replaceExistingData() {
        // החלפת unifiedProductData
        if (typeof window.unifiedProductData !== 'undefined') {
            window.unifiedProductData = this.products;
        }

        // החלפת פונקציות חיפוש קיימות
        this.replaceSearchFunctions();

        // עדכון ממשק המשתמש
        this.updateUI();

        // הודעה על הצלחה
        console.log('✅ מערכת המוצרים הוחלפה בהצלחה');
        console.log('📊 סה"כ מוצרים:', Object.keys(this.products).length);
        console.log('🏷️ קטגוריות:', Object.keys(this.categories).length);
    }

    // החלפת פונקציות חיפוש
    replaceSearchFunctions() {
        // החלפת פונקציית חיפוש מוצרים
        if (typeof searchProduct === 'function') {
            window.searchProduct = this.searchProduct.bind(this);
        }

        // החלפת פונקציות אחרות שקשורות למוצרים
        this.replaceProductFunctions();
    }

    // החלפת פונקציות מוצרים
    replaceProductFunctions() {
        // פונקציה לחיפוש מוצר לפי מק"ט או שם
        window.searchProduct = (query) => {
            if (!query) return null;

            const searchTerm = query.toLowerCase();

            // חיפוש לפי מק"ט
            if (this.products[query]) {
                return { ...this.products[query], code: query };
            }

            // חיפוש לפי שם
            for (const [code, product] of Object.entries(this.products)) {
                if (product.name && product.name.toLowerCase().includes(searchTerm)) {
                    return { ...product, code: code };
                }
                if (product.searchName && product.searchName.toLowerCase().includes(searchTerm)) {
                    return { ...product, code: code };
                }
            }

            return null;
        };

        // פונקציה לקבלת פרטי מוצר
        window.getProductDetails = (code) => {
            return this.products[code] || null;
        };

        // פונקציה לקבלת כל המוצרים
        window.getAllProducts = () => {
            return this.products;
        };

        // פונקציה לקבלת מוצרים לפי קטגוריה
        window.getProductsByCategory = (category) => {
            const filtered = {};
            for (const [code, product] of Object.entries(this.products)) {
                if (product.category === category) {
                    filtered[code] = product;
                }
            }
            return filtered;
        };


        // פונקציה לקבלת גדלים זמינים
        window.getProductSizes = (code) => {
            const product = this.products[code];
            return product ? product.sizes : [];
        };

        // פונקציה לקבלת כמויות מוגדרות
        window.getProductQuantities = (code) => {
            const product = this.products[code];
            return product && product.type === 'quantity' ? product.predefinedQuantities : [];
        };

        // פונקציה לקבלת יחידת מידה
        window.getProductUnit = (code) => {
            const product = this.products[code];
            return product && product.type === 'quantity' ? product.unit : null;
        };

        // פונקציה להגדרת מוצר בממשק - עובדת עם הנתונים החדשים
        window.configureProduct = (productCode) => {
            console.log("מנסה להגדיר מוצר:", productCode);

            const config = window.productsLoader.products[productCode];
            if (!config) {
                console.log("מוצר לא מוגדר ברשימה, משאיר הגדרות ברירת מחדל");
                const existingList = document.getElementById("quantityOptionsList");
                const existingButton = document.querySelector(".quantity-toggle-btn");
                if (existingList) existingList.remove();
                if (existingButton) existingButton.remove();
                return;
            }

            try {
                if (config.type === "none") {
                    const noneRadio = document.getElementById("noneOption");
                    if (noneRadio) {
                        noneRadio.checked = true;
                        noneRadio.dispatchEvent(new Event("change"));
                    }
                } else if (config.type === "size") {
                    const sizeRadio = document.getElementById("sizeOption");
                    if (sizeRadio) {
                        sizeRadio.checked = true;
                        sizeRadio.dispatchEvent(new Event("change"));

                        setTimeout(() => {
                            const sizeSelect = document.getElementById("productSize");
                            if (sizeSelect) {
                                sizeSelect.value = config.defaultSize;
                                sizeSelect.dispatchEvent(new Event("change"));
                            }
                        }, 100);
                    }
                } else if (config.type === "quantity") {
                    const quantityRadio = document.getElementById("quantityOption");
                    if (quantityRadio) {
                        quantityRadio.checked = true;
                        quantityRadio.dispatchEvent(new Event("change"));

                        setTimeout(() => {
                            const quantityInput = document.getElementById("unitQuantity");
                            const unitSelect = document.getElementById("unitType");

                            if (quantityInput) {
                                quantityInput.value = config.defaultQuantity;
                                if (config.predefinedQuantities) {
                                    // קריאה לפונקציה קיימת ליצירת רשימת כמויות
                                    if (typeof createQuantityDatalist === 'function') {
                                        createQuantityDatalist(
                                            config.predefinedQuantities,
                                            config.defaultQuantity
                                        );
                                    }
                                }
                                quantityInput.dispatchEvent(new Event("change"));
                            }
                            if (unitSelect) {
                                unitSelect.value = config.unit;
                                unitSelect.dispatchEvent(new Event("change"));
                            }
                        }, 100);
                    }
                }
            } catch (error) {
                console.log("שגיאה בהגדרת המוצר:", error);
            }
        };
    }

    // עדכון ממשק המשתמש
    updateUI() {
        // עדכון תיבת חיפוש אם קיימת
        const searchInput = document.querySelector('input[placeholder*="מקט"]');
        if (searchInput) {
            // הסרת מאזין קודם (אם הוגדר) והוספת מאזין אחד קבוע
            searchInput.removeEventListener('input', this.boundHandleSearchInput);
            searchInput.addEventListener('input', (e) => {
                this.handleSearchInput(e.target.value);
            });
        }

        // עדכון רשימות מוצרים אם קיימות
        this.updateProductLists();

        // הודעה על עדכון מוצלח
        this.showSystemNotification('מערכת המוצרים עודכנה בהצלחה!', 'success');
    }

    // הצגת הודעת מערכת
    showSystemNotification(message, type = 'info') {
        // בדיקה אם כבר קיימת הודעה
        let notification = document.getElementById('systemNotification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'systemNotification';
            notification.className = `system-notification ${type}`;
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.className = `system-notification ${type}`;
        notification.classList.add('show');

        // הסתרת ההודעה אחרי 3 שניות
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // טיפול בקלט חיפוש
    handleSearchInput(query) {
        if (!query.trim()) {
            this.clearSearchResults();
            return;
        }

        // חיפוש מהיר במוצרים
        const results = this.searchProduct(query);
        this.displaySearchResults(results, query);

        // הוספת אפקט חיפוש
        const searchInput = document.querySelector('input[placeholder*="מקט"], input[placeholder*="מוצר"]');
        if (searchInput) {
            searchInput.style.borderColor = results ? '#28a745' : '#dc3545';
            searchInput.style.boxShadow = results ? '0 0 0 3px rgba(40,167,69,0.1)' : '0 0 0 3px rgba(220,53,69,0.1)';

            // החזרה למצב רגיל אחרי 2 שניות
            setTimeout(() => {
                searchInput.style.borderColor = '';
                searchInput.style.boxShadow = '';
            }, 2000);
        }
    }

    // הצגת תוצאות חיפוש
    displaySearchResults(results, query) {
        // יצירת או עדכון תיבת תוצאות חיפוש
        let resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) {
            resultsContainer = document.createElement('div');
            resultsContainer.id = 'searchResults';
            resultsContainer.style.cssText = `
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 1px solid #ddd;
                border-top: none;
                border-radius: 0 0 8px 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 1000;
                max-height: 300px;
                overflow-y: auto;
                animation: fadeIn 0.3s ease-in;
            `;

            const searchInput = document.querySelector('input[placeholder*="מקט"], input[placeholder*="מוצר"]');
            if (searchInput && searchInput.parentElement) {
                searchInput.parentElement.style.position = 'relative';
                searchInput.parentElement.appendChild(resultsContainer);
            }
        }

        if (results) {
            resultsContainer.innerHTML = `
                <div style="padding: 15px; border-bottom: 1px solid #eee;">
                    <div style="font-weight: bold; color: #333; font-size: 1.1rem;">${results.name}</div>
                    <div style="color: #666; font-size: 0.9em; margin: 5px 0;">מק"ט: ${results.code || query}</div>
                    <div style="color: #28a745; font-weight: bold; margin-top: 8px;">
                        💰 מחירים: ${results.sizes && results.sizes.length > 0 ? results.sizes.map(s => `${s.size} - ₪${s.price}`).join(', ') : 'ללא מחירים'}
                    </div>
                    <div style="color: #6c757d; font-size: 0.9em; margin-top: 5px;">
                        📁 קטגוריה: ${this.categories[results.category] || 'לא מוגדר'}
                    </div>
                    ${results.type === 'quantity' ? `
                        <div style="color: #17a2b8; font-size: 0.9em; margin-top: 5px;">
                            📦 יחידת מידה: ${results.unit || 'לא מוגדר'}
                        </div>
                    ` : ''}
                </div>
            `;
            resultsContainer.style.display = 'block';

            // הוספת אפקט הצלחה
            resultsContainer.style.borderColor = '#28a745';
            resultsContainer.style.boxShadow = '0 4px 15px rgba(40,167,69,0.2)';
        } else {
            resultsContainer.innerHTML = `
                <div style="padding: 15px; color: #666; text-align: center;">
                    <div style="font-size: 1.2rem; margin-bottom: 5px;">🔍</div>
                    לא נמצאו תוצאות עבור "${query}"
                    <div style="font-size: 0.9em; margin-top: 5px; color: #999;">
                        נסה לחפש לפי מק"ט או שם מוצר
                    </div>
                </div>
            `;
            resultsContainer.style.display = 'block';

            // הוספת אפקט שגיאה
            resultsContainer.style.borderColor = '#dc3545';
            resultsContainer.style.boxShadow = '0 4px 15px rgba(220,53,69,0.2)';
        }

        // הוספת אנימציה
        resultsContainer.classList.add('fade-in');
    }

    // ניקוי תוצאות חיפוש
    clearSearchResults() {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    }

    // עדכון רשימות מוצרים
    updateProductLists() {
        // עדכון רשימת מוצרי מטבח
        this.updateKitchenProductsList();

        // עדכון רשימות אחרות אם קיימות
        this.updateOtherProductLists();
    }

    // עדכון רשימת מוצרי מטבח - רק מוצרים שצריכים להיות מוצגים
    updateKitchenProductsList() {
        const kitchenList = document.getElementById('kitchenProductsList');
        if (kitchenList) {
            // רק מוצרים שצריכים להיות מוצגים בממשק הראשי
            const visibleKitchenProducts = this.getVisibleKitchenProducts();
            kitchenList.innerHTML = '';

            Object.entries(visibleKitchenProducts).forEach(([code, product]) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${product.name}</span>
                    <span style="color: #666; font-size: 0.9em;">(${code})</span>
                    <span style="color: #28a745; font-weight: bold;">
                        ₪${product.sizes && product.sizes.length > 0 ? Math.min(...product.sizes.map(s => s.price)) : 'N/A'}
                    </span>
                `;
                kitchenList.appendChild(li);
            });
        }
    }

    // קבלת רק מוצרי מטבח שצריכים להיות מוצגים בממשק הראשי
    getVisibleKitchenProducts() {
        // רשימת קודי מוצרים שצריכים להיות מוצגים בממשק הראשי
        const visibleCodes = [
            '12628', '12617', '12627', '16331', '12618', '12616', '12626', '12408', '12409'
        ];

        const visibleProducts = {};
        visibleCodes.forEach(code => {
            if (this.products[code]) {
                visibleProducts[code] = this.products[code];
            }
        });

        return visibleProducts;
    }

    // עדכון רשימות מוצרים אחרות
    updateOtherProductLists() {
        // כאן אפשר להוסיף עדכונים לרשימות נוספות
        // כמו מוצרי מאפה, פירות וכו'
    }

    // פונקציה לרענון נתונים
    async refreshData() {
        await this.loadProducts();
        this.replaceExistingData();
        console.log('נתוני המוצרים רועננו בהצלחה');
    }

    // פונקציה לקבלת סטטיסטיקות
    getStats() {
        return {
            totalProducts: Object.keys(this.products).length,
            totalCategories: Object.keys(this.categories).length,
            categories: this.categories,
            lastUpdated: localStorage.getItem('goldis_products') ?
                JSON.parse(localStorage.getItem('goldis_products')).lastUpdated : null
        };
    }

    // הוספת כפתור רענון מהיר לממשק
    addQuickRefreshButton() {
        // בדיקה אם כבר קיים כפתור
        if (document.getElementById('quickRefreshBtn')) return;

        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'quickRefreshBtn';
        refreshBtn.className = 'quick-refresh-btn';
        refreshBtn.innerHTML = '🔄';
        refreshBtn.title = 'רענן מוצרים (מהשרת)';
        refreshBtn.onclick = () => {
            this.refreshData();
        };

        document.body.appendChild(refreshBtn);
    }

    // הוספת סטטוס מערכת
    addSystemStatus() {
        // בדיקה אם כבר קיים סטטוס
        if (document.getElementById('systemStatus')) return;

        const statusDiv = document.createElement('div');
        statusDiv.id = 'systemStatus';
        statusDiv.className = 'system-status online';
        statusDiv.innerHTML = `
            <div>🟢 מערכת מוצרים פעילה</div>
            <div style="font-size: 0.8rem; margin-top: 5px;">
                ${Object.keys(this.products).length} מוצרים |
                ${Object.keys(this.categories).length} קטגוריות
            </div>
        `;

        document.body.appendChild(statusDiv);

        // עדכון אוטומטי כל 30 שניות
        setInterval(() => {
            this.updateSystemStatus();
        }, 30000);
    }

    // עדכון סטטוס מערכת
    updateSystemStatus() {
        const statusDiv = document.getElementById('systemStatus');
        if (statusDiv) {
            const stats = this.getStats();
            statusDiv.innerHTML = `
                <div>🟢 מערכת מוצרים פעילה</div>
                <div style="font-size: 0.8rem; margin-top: 5px;">
                    ${stats.totalProducts} מוצרים |
                    ${stats.totalCategories} קטגוריות
                </div>
            `;
        }
    }

    // פונקציה לרענון מהיר
    async quickRefresh() {
        try {
            const statusDiv = document.getElementById('systemStatus');
            if (statusDiv) {
                statusDiv.innerHTML = '<div>🔄 מרענן...</div>';
                statusDiv.className = 'system-status offline';
            }

            await this.refreshData();

            if (statusDiv) {
                statusDiv.innerHTML = `
                    <div>✅ רוענן בהצלחה</div>
                    <div style="font-size: 0.8rem; margin-top: 5px;">
                        ${Object.keys(this.products).length} מוצרים
                    </div>
                `;
                statusDiv.className = 'system-status online';

                // החזרה למצב רגיל אחרי 3 שניות
                setTimeout(() => {
                    this.updateSystemStatus();
                }, 3000);
            }
        } catch (error) {
            console.error('שגיאה ברענון מהיר:', error);
            const statusDiv = document.getElementById('systemStatus');
            if (statusDiv) {
                statusDiv.innerHTML = '<div>❌ שגיאה ברענון</div>';
                statusDiv.className = 'system-status offline';
            }
        }
    }
}

// הוספת כפתור רענון לממשק
function addRefreshButton() {
    // חיפוש מקום מתאים להוספת כפתור רענון
    const header = document.querySelector('h1');
    if (header && header.parentElement) {
        const refreshBtn = document.createElement('button');
        refreshBtn.innerHTML = '🔄 רענן מוצרים';
        refreshBtn.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
        `;
        refreshBtn.onclick = () => {
            if (productsLoader) {
                productsLoader.refreshData();
            }
        };

        header.parentElement.style.position = 'relative';
        header.parentElement.appendChild(refreshBtn);
    }
}

// אתחול המערכת כשהדף נטען
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔄 מאתחל מערכת טעינת מוצרים...');
    productsLoader = new ProductsLoader();

    // הוספת כפתור רענון לממשק (אופציונלי)
    setTimeout(() => {
        addRefreshButton();
    }, 1000);
});

// ודוא שהמערכת נטענת גם אם DOMContentLoaded כבר עבר
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.productsLoader) {
            console.log('🔄 מאתחל מערכת טעינת מוצרים (fallback)...');
            productsLoader = new ProductsLoader();
        }
    });
} else {
    // הדף כבר נטען
    if (!window.productsLoader) {
        console.log('🔄 מאתחל מערכת טעינת מוצרים (immediate)...');
        productsLoader = new ProductsLoader();
    }
}

// פונקציות גלובליות לשימוש בקוד הקיים
window.refreshProductsData = () => {
    if (productsLoader) {
        productsLoader.refreshData();
    }
};

window.getProductsData = () => {
    return productsLoader ? productsLoader.getStats() : null;
};

// ייצוא המערכת לשימוש חיצוני
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductsLoader;
}