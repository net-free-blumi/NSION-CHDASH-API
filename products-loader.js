// מערכת טעינת מוצרים - גולדיס
// קובץ זה מחליף את הנתונים הקיימים בקוד עם מערכת המוצרים החדשה

class ProductsLoader {
    constructor() {
        this.products = {};
        this.categories = {};
        // יצירת גישה גלובלית למופע
        window.productsLoader = this;
        // Create bound function reference for event listener (normalizes Event/String)
        this.boundHandleSearchInput = (e) => {
            const val = (e && e.target && typeof e.target.value === 'string')
                ? e.target.value
                : (typeof e === 'string' ? e : '');
            this.handleSearchInput(val);
        };
        this.init();
    }

    // אתחול רכיב הטעינה
    async init() {
        try {
        await this.loadProducts();
        this.replaceExistingData();
        this.setupProductSearch();
            // אל תיצור כפתור רענון צף כפול
        this.addSystemStatus();
            console.log('🚀 ProductsLoader initialized');
        } catch (e) {
            console.warn('ProductsLoader init failed:', e);
            // נסה לטעון מהקובץ כגיבוי
            try {
                await this.loadFromFile();
                this.replaceExistingData();
                this.setupProductSearch();
            } catch {}
        }
    }

    // הגדרת חיפוש מוצרים
    setupProductSearch() {
        // תיבת חיפוש ראשית (id=searchInput אם קיימת, אחרת לפי placeholder)
        const searchInput = document.getElementById('searchInput') || document.querySelector('input[placeholder*="מקט"], input[placeholder*="מוצר"]');
        if (searchInput) {
            searchInput.removeEventListener('input', this.boundHandleSearchInput);
            searchInput.addEventListener('input', this.boundHandleSearchInput);
            // Enter בוחר את התוצאה הראשונה
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && Array.isArray(this.lastResults) && this.lastResults.length > 0) {
                    e.preventDefault();
                    this.selectSku(this.lastResults[0].code);
                }
            });
        }

        // תיבת מק"ט ייעודית (id=productCode) מפעילה גם תצוגת תוצאות
        const skuInput = document.getElementById('productCode');
        if (skuInput) {
            console.log('🔍 setupProductSearch: Setting up input listener for productCode');
            skuInput.addEventListener('input', (e) => {
                const val = e.target?.value || '';
                console.log('🔍 setupProductSearch: Input event received, value:', val);
                const si = document.getElementById('searchInput');
                if (si) si.value = val; // סנכרון לשדה החיפוש
                this.handleSearchInput(val);
            });
            console.log('🔍 setupProductSearch: Setting up paste listener for productCode');
            skuInput.addEventListener('paste', () => {
                console.log('🔍 setupProductSearch: Paste event received');
                setTimeout(() => {
                    const val = skuInput.value || '';
                    console.log('🔍 setupProductSearch: Processing paste after timeout, value:', val);
                    const si = document.getElementById('searchInput');
                    if (si) si.value = val; // סנכרון לשדה החיפוש
                    this.handleSearchInput(val);
                }, 0);
            });
            console.log('🔍 setupProductSearch: Event listeners set up for productCode');
        }

        // תאימות לקוד ישן שמריץ oninput="searchProduct()" ללא פרמטר
        window.searchProduct = () => {
            const val = (document.getElementById('searchInput') && document.getElementById('searchInput').value) || '';
            this.handleSearchInput(val);
        };
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
            // Fallback לקובץ products.json בשורש האתר
            await this.loadFromFile();
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
        // לא מוסיפים מאזינים כאן כדי למנוע כפילויות; המאזינים מנוהלים ב-setupProductSearch
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

    // חיפוש מוצר לפי מק"ט/שם/שם-חיפוש — מחזיר עד 10 תוצאות
    searchProduct(query) {
        if (!query) return [];
        const term = String(query).trim().toLowerCase();
        const isNumeric = /^\d+$/.test(term);
        const results = [];

        // 1) התאמה מדויקת למק"ט
        if (this.products[term]) results.push({ code: String(term), ...this.products[term] });

        // 2) התאמות קוד שמתחילות ב-term
        if (isNumeric) {
            for (const code of Object.keys(this.products)) {
                if (code !== term && code.startsWith(term)) results.push({ code, ...this.products[code] });
            }
        }

        // 3) שם/שם-חיפוש מתחיל
        for (const [code, product] of Object.entries(this.products)) {
            const name = (product.name || '').toLowerCase();
            const sname = (product.searchName || '').toLowerCase();
            if (name.startsWith(term) || sname.startsWith(term)) {
                if (!results.find(r => r.code === code)) results.push({ code, ...product });
            }
        }

        // 4) שם/שם-חיפוש מכיל
        for (const [code, product] of Object.entries(this.products)) {
            const name = (product.name || '').toLowerCase();
            const sname = (product.searchName || '').toLowerCase();
            if ((name.includes(term) || sname.includes(term)) && !name.startsWith(term) && !sname.startsWith(term)) {
                if (!results.find(r => r.code === code)) results.push({ code, ...product });
            }
        }

        return results.slice(0, 10);
    }

    // טיפול בקלט חיפוש
    async handleSearchInput(query) {
        try {
            console.log('🔍 handleSearchInput: Starting with query:', query, 'Type:', typeof query);
            const q = (typeof query === 'string') ? query : '';
            console.log('🔍 handleSearchInput: Normalized query:', q);
            if (!q.trim()) {
                console.log('🔍 handleSearchInput: Empty query, clearing results');
                this.clearSearchResults();
                return;
            }

        // חיפוש מהיר במוצרים
            console.log('🔍 handleSearchInput: Searching for:', q);
            let results = this.searchProduct(q);
            console.log('🔍 handleSearchInput: Search results:', results);
            this.lastResults = results;
            this.displaySearchResults(results, q);

            // אם אין תוצאות, נסה לרענן מה-API פעם אחת ואז חפש שוב
            if ((!results || results.length === 0) && !this._refreshOnMissInFlight) {
                try {
                    this._refreshOnMissInFlight = true;
                    await this.refreshData();
                    results = this.searchProduct(q);
                    this.lastResults = results;
                    this.displaySearchResults(results, q);
                } finally {
                    this._refreshOnMissInFlight = false;
                }
            }

        // הוספת אפקט חיפוש
            const searchInput = document.getElementById('searchInput') || document.querySelector('input[placeholder*="מקט"], input[placeholder*="מוצר"]');
        if (searchInput) {
                const ok = Array.isArray(results) ? results.length > 0 : !!results;
                searchInput.style.borderColor = ok ? '#28a745' : '#dc3545';
                searchInput.style.boxShadow = ok ? '0 0 0 3px rgba(40,167,69,0.1)' : '0 0 0 3px rgba(220,53,69,0.1)';

            // החזרה למצב רגיל אחרי 2 שניות
            setTimeout(() => {
                searchInput.style.borderColor = '';
                searchInput.style.boxShadow = '';
            }, 2000);
            }

            // אם יש התאמה מדויקת לקוד, קנפג את המוצר בממשק
            const term = String(q).trim();
            if (this.products[term]) {
                if (typeof window.configureProduct === 'function') {
                    try { window.configureProduct(term); } catch {}
                }
            }
        } catch (err) {
            console.warn('handleSearchInput error:', err);
        }
    }

    // הצגת תוצאות חיפוש מרובות
    displaySearchResults(results, query) {
        console.log('🔍 displaySearchResults: Displaying results for query:', query, 'Results:', results);
        // אם יש UL מוכן בדף (index.html), נשתמש בו
        const listEl = document.getElementById('searchResults');
        console.log('🔍 displaySearchResults: Found searchResults element:', listEl);
        if (listEl && listEl.tagName === 'UL') {
            if (results && results.length) {
                listEl.innerHTML = results.map(r => `
                    <li style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 6px; border-bottom:1px solid #eee;">
                        <div>
                            <div style="font-weight:600;">${r.name || ''}</div>
                            <div style="font-size:0.9em; color:#666;">מק"ט: <span class="sku">${r.code}</span></div>
                            <div style="font-size:0.9em; color:#28a745;">${(r.sizes && r.sizes.length>0) ? r.sizes.map(s=>`${s.size} - ₪${s.price}`).join(', ') : (r.price ? `₪${r.price}` : '')}</div>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button type="button" data-code="${r.code}" class="copy-sku-btn">📋 העתק מק"ט</button>
                            <button type="button" data-code="${r.code}" class="select-sku-btn">➕ בחר</button>
                        </div>
                    </li>
                `).join('');
            } else {
                listEl.innerHTML = `<li style="padding:10px; color:#666;">לא נמצאו תוצאות עבור "${query}"</li>`;
            }
            listEl.style.display = '';
            listEl.querySelectorAll('.copy-sku-btn').forEach(btn => btn.addEventListener('click', (e) => this.copySku(e.currentTarget.getAttribute('data-code'))));
            listEl.querySelectorAll('.select-sku-btn').forEach(btn => btn.addEventListener('click', (e) => this.selectSku(e.currentTarget.getAttribute('data-code'))));
            return;
        }

        // אחרת, ניצור קונטיינר צף
        let resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer || resultsContainer.tagName === 'UL') {
            resultsContainer = document.createElement('div');
            resultsContainer.id = 'searchResults';
            resultsContainer.style.cssText = 'position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #ddd; border-top:none; border-radius:0 0 8px 8px; box-shadow:0 4px 6px rgba(0,0,0,0.1); z-index:1000; max-height:300px; overflow-y:auto;';
            const si = document.getElementById('searchInput') || document.querySelector('input[placeholder*="מקט"], input[placeholder*="מוצר"]');
            if (si && si.parentElement) {
                si.parentElement.style.position = 'relative';
                si.parentElement.appendChild(resultsContainer);
            }
        }

        if (results && results.length) {
            resultsContainer.innerHTML = results.map(r => `
                <div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; gap:8px;">
                    <div>
                        <div style=\"font-weight:600;\">${r.name || ''}</div>
                        <div style=\"font-size:0.9em; color:#666;\">מק\"ט: <span class=\"sku\">${r.code}</span></div>
                        <div style=\"font-size:0.9em; color:#28a745;\">${(r.sizes && r.sizes.length>0) ? r.sizes.map(s=>`${s.size} - ₪${s.price}`).join(', ') : (r.price ? `₪${r.price}` : '')}</div>
                    </div>
                    <div style=\"display:flex; gap:6px;\">
                        <button type=\"button\" data-code=\"${r.code}\" class=\"copy-sku-btn\">📋 העתק מק\"ט</button>
                        <button type=\"button\" data-code=\"${r.code}\" class=\"select-sku-btn\">➕ בחר</button>
                    </div>
                        </div>
            `).join('');
            resultsContainer.style.display = 'block';
            resultsContainer.querySelectorAll('.copy-sku-btn').forEach(btn => btn.addEventListener('click', (e) => this.copySku(e.currentTarget.getAttribute('data-code'))));
            resultsContainer.querySelectorAll('.select-sku-btn').forEach(btn => btn.addEventListener('click', (e) => this.selectSku(e.currentTarget.getAttribute('data-code'))));
        } else {
            resultsContainer.innerHTML = `<div style="padding:10px; color:#666;">לא נמצאו תוצאות עבור "${query}"</div>`;
            resultsContainer.style.display = 'block';
        }
    }

    // העתקת מק"ט
    copySku(code) {
        try {
            navigator.clipboard.writeText(String(code));
            this.showSystemNotification('✅ המק"ט הועתק', 'success');
        } catch {}
    }

    // בחירת מק"ט לשדה הייעודי
    selectSku(code) {
        const skuInput = document.getElementById('productCode');
        if (skuInput) {
            skuInput.value = String(code);
            skuInput.focus();
            skuInput.select();
        }
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = String(code);
        }
        // קנפג את המוצר בממשק (מציג מפרט/גדלים/מחירים)
        if (typeof window.configureProduct === 'function') {
            try { window.configureProduct(String(code)); } catch {}
        }
        // אל תמחק את תוצאות החיפוש – השאר פתוח כדי לאפשר חיפוש נוסף מיד
    }

    // ניקוי תוצאות חיפוש
    clearSearchResults() {
        const el = document.getElementById('searchResults');
        if (!el) return;
        if (el.tagName === 'UL') {
            el.innerHTML = '';
            el.style.display = '';
        } else {
            el.style.display = 'none';
            el.innerHTML = '';
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
        try {
        await this.loadProducts();
        this.replaceExistingData();
        console.log('נתוני המוצרים רועננו בהצלחה');
            this.showSystemNotification('✅ המוצרים רועננו', 'success');
        } catch (e) {
            this.showSystemNotification('❌ שגיאה ברענון מוצרים', 'error');
        }
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

    // הוספת כפתור רענון מהיר לממשק — מבוטל כדי לא ליצור כפילות
    addQuickRefreshButton() { /* no-op */ }

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

        // הסתרה אחרי 3 שניות כדי שלא יישאר זמן רב במסך
        setTimeout(() => {
            const el = document.getElementById('systemStatus');
            if (el) el.remove();
        }, 3000);
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

// כפתור רענון עודף הוסר כדי למנוע כפילות

// אתחול המערכת כשהדף נטען
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔄 מאתחל מערכת טעינת מוצרים...');
    productsLoader = new ProductsLoader();

    // ללא הוספת כפתורי רענון כפולים
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