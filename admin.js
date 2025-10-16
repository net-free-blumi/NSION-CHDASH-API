// מערכת ניהול מוצרים - גולדיס
class ProductManager {
    constructor() {
        this.products = {};
        this.categories = {
            "kitchen": "מוצרי מטבח",
            "bakery": "קונדיטורייה",
            "fruits": "פירות",
            "sushi": "סושי",
            "amar": "קונדיטורייה עמר",
            "kitchenProducts": "מטבח מוסטפה",
            "online": "אונליין",
            "warehouse": "מחסן",
            "sizes": "מוצרי גדלים",
            "quantities": "מוצרי כמות",
        };
        this.selectedProducts = new Set(); // שמירת מוצרים נבחרים
        this.filteredProducts = new Set(); // שמירת מוצרים מסוננים
        this.currentFilters = {}; // שמירת המסננים הנוכחיים
        this.init();
    }

    async init() {
        const overlay = document.getElementById('serverWakeupOverlay');
        if (overlay) overlay.style.display = 'flex';
        try {
            window.productManager = this;
            await this.loadProducts();
            this.updateStats();
            if (overlay) overlay.style.display = 'none';
        } catch (error) {
            console.warn('Init failed:', error);
            this.showNotification('❌ ' + (error?.message || 'שגיאה בהתחלה'), 'error');
            if (overlay) overlay.style.display = 'none';
        }
    }


    async saveAllToServer(replace = false) {
        try {
            // נסיון שמירה עם ניסיונות חוזרים
            const MAX_RETRIES = 3;
            let lastError;
            
            for (let i = 0; i < MAX_RETRIES; i++) {
                try {
                    const response = await fetch(`${config.getApiBaseUrl()}/api/products/save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            products: this.products,
                            categories: this.categories,
                            timestamp: new Date().toISOString(),
                            replace
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || 'שגיאה בשמירת המוצרים');
                    }

                    const result = await response.json();
                    if (!result.success) {
                        throw new Error(result.error || 'שגיאה לא ידועה');
                    }

                    console.log('✅ המוצרים נשמרו בהצלחה:', result);
                    return true;
                } catch (error) {
                    console.warn(`ניסיון שמירה ${i + 1} נכשל:`, error);
                    lastError = error;
                    if (i < MAX_RETRIES - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            
            console.error('שגיאה בשמירה:', lastError);
            this.showNotification('❌ שגיאה בשמירת המוצרים: ' + lastError.message, 'error');
            throw lastError;
        } catch (error) {
            console.error('שגיאה בשמירה:', error);
            this.showNotification('❌ שגיאה בשמירת המוצרים: ' + error.message, 'error');
            throw error;
        }
    }

    // שמירת דלתא קטנה לשרת (מהיר יותר)
    async saveProductsDelta(deltaProducts, deltaCategories) {
        try {
            this.showNotification('⏳ שומר...', 'info');
            const response = await fetch(`${config.getApiBaseUrl()}/api/products/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
                body: JSON.stringify({
                    products: deltaProducts,
                    categories: deltaCategories,
                    timestamp: new Date().toISOString()
                })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'שגיאה בשמירת המוצר');
            }
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'שגיאה לא ידועה');
            }
            this.showNotification('✅ נשמר בהצלחה', 'success');
            return true;
        } catch (error) {
            console.error('שגיאה בשמירת דלתא:', error);
            this.showNotification('❌ שגיאה בשמירה: ' + error.message, 'error');
            throw error;
        }
    }

    async loadProducts() {
        try {
            const response = await fetch(`${config.getApiBaseUrl()}/api/products`);
            if (!response.ok) {
                throw new Error('שגיאה בטעינת מוצרים');
            }

            const data = await response.json();
            this.products = data.products || {};
            this.categories = data.categories || this.categories;

            this.updateProductsDisplay();
            this.updateStats();
            console.log('✅ המוצרים נטענו בהצלחה');
        } catch (error) {
            console.error('שגיאה בטעינת מוצרים:', error);
            this.showNotification('❌ שגיאה בטעינת המוצרים: ' + error.message, 'error');
        }
    }

    updateProductsDisplay() {
        const container = document.getElementById('products-container');
        if (!container) return;

        container.innerHTML = '';

        // קביעת איזה מוצרים להציג - מסוננים או כולם
        const productsToShow = this.filteredProducts.size > 0 ? 
            Array.from(this.filteredProducts) : 
            Object.keys(this.products);

        productsToShow.forEach(code => {
            const product = this.products[code];
            if (product) {
                const productCard = this.createProductCard(code, product);
                container.appendChild(productCard);
            }
        });
    }

    createProductCard(code, product) {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.setAttribute('data-product-code', code);
        
        // כפתור בחירה מרובה
        const checkbox = document.createElement('div');
        checkbox.className = 'product-checkbox';
        checkbox.onclick = (e) => {
            e.stopPropagation();
            this.toggleProductSelection(code, checkbox, card);
        };
        
        // הצגת שם המוצר - אם אין name, נציג searchName בצבע אפור
        const hasName = product.name || product.Name;
        const productName = hasName || product.searchName || '';
        const productType = product.type || 'none';
        
        // בניית מידע על המוצר
        let productInfo = `
            <div class="product-header">
                <h3${!hasName && product.searchName ? ' class="no-name-product"' : ''}>${productName}</h3>
                <span class="product-code">${code}</span>
            </div>
            <div class="product-details">
                <p><strong>קטגוריה:</strong> ${this.categories[product.category] || 'לא מוגדר'}</p>
                <p><strong>סוג:</strong> ${this.getTypeDisplay(productType)}</p>
        `;
        
        // הוספת מידע על טמפרטורת הגשה
        if (product.temperature) {
            const tempIcon = product.temperature === 'hot' ? '🔥' : '❄️';
            const tempText = product.temperature === 'hot' ? 'חם' : 'קר';
            productInfo += `<p><strong>טמפרטורה:</strong> ${tempText} ${tempIcon}</p>`;
        }
        
        // הוספת שם חיפוש אם קיים ושונה מהשם הראשי
        if (product.searchName && product.searchName !== productName) {
            productInfo += `<p><strong>שם לחיפוש:</strong> <span class="search-name">${product.searchName}</span></p>`;
        }
        
        // הצגת פרטים לפי סוג המוצר
        if (productType === 'quantity') {
            if (product.defaultQuantity) {
                productInfo += `<p><strong>כמות ברירת מחדל:</strong> ${product.defaultQuantity} ${product.unit || ''}</p>`;
            }
            if (product.predefinedQuantities && product.predefinedQuantities.length > 0) {
                productInfo += `<p><strong>כמויות זמינות:</strong> ${product.predefinedQuantities.join(', ')} ${product.unit || ''}</p>`;
            }
        } else if (productType === 'size' && product.defaultSize) {
            productInfo += `<p><strong>גודל ברירת מחדל:</strong> ${product.defaultSize}</p>`;
        }
        
        // הצגת יחידת מידה לכל סוגי המוצרים אם קיימת
        if (product.unit && productType !== 'quantity') {
            productInfo += `<p><strong>יחידת מידה:</strong> ${product.unit}</p>`;
        }
        
        // הצגת מחירים - תמיכה בכל הפורמטים
        if (product.sizes && product.sizes.length > 0) {
            const validSizes = product.sizes.filter(s => s.size && (s.price !== undefined && s.price !== null));
            if (validSizes.length > 0) {
                const pricesDisplay = validSizes.map(s => {
                    const price = s.price === 0 ? '0' : `₪${s.price}`;
                    return `${s.size}: ${price}`;
                }).join(', ');
                productInfo += `<p><strong>גדלים ומחירים:</strong> ${pricesDisplay}</p>`;
            }
        } else if (product.price !== undefined && product.price !== null) {
            const price = product.price === 0 ? '0' : `₪${product.price}`;
            productInfo += `<p><strong>מחיר:</strong> ${price}</p>`;
        }
        
        // הצגת יחידת מידה אם קיימת
        if (product.unit) {
            productInfo += `<p><strong>יחידת מידה:</strong> ${product.unit}</p>`;
        }
        
        // הצגת כמות רגילה אם קיימת (לא defaultQuantity)
        if (product.quantity && !product.defaultQuantity) {
            productInfo += `<p><strong>כמות:</strong> ${product.quantity}</p>`;
        }
        
        productInfo += `
            </div>
            <div class="product-actions">
                <button onclick="productManager.editProduct('${code}')" class="btn btn-primary">✏️ עריכה</button>
                <button onclick="productManager.deleteProductConfirm('${code}')" class="btn btn-danger">🗑️ מחיקה</button>
            </div>
        `;
        
        card.innerHTML = productInfo;
        card.appendChild(checkbox);
        return card;
    }

    getTypeDisplay(type) {
        const types = {
            'quantity': 'כמות',
            'size': 'גודל',
            'none': 'ללא כמות/גודל'
        };
        return types[type] || 'לא מוגדר';
    }

    updateStats() {
        const stats = this.calculateStats();
        const statsContainer = document.getElementById('stats-container');
        if (statsContainer) {
            const statItems = statsContainer.querySelectorAll('.stat-item .stat-number');
            if (statItems.length >= 4) {
                statItems[0].textContent = stats.total;
                statItems[1].textContent = stats.sizeType;
                statItems[2].textContent = stats.quantityType;
                statItems[3].textContent = stats.noneType;
            }
        }
    }

    calculateStats() {
        const products = Object.values(this.products);
        return {
            total: products.length,
            sizeType: products.filter(p => p.type === 'size').length,
            quantityType: products.filter(p => p.type === 'quantity').length,
            noneType: products.filter(p => p.type === 'none').length
        };
    }

    showNotification(message, type = 'info', { duration = 3000 } = {}) {
        const container = document.getElementById('notifications-container');
        if (!container) return;

        // הגבלת מספר טוסטים מוצגים בו-זמנית
        const maxToasts = 3;
        while (container.children.length >= maxToasts) {
            container.removeChild(container.firstChild);
        }

        const toast = document.createElement('div');
        toast.className = `notification ${type}`;
        toast.style.setProperty('--toast-duration', `${Math.max(1500, duration)}ms`);
        toast.innerHTML = `<div>${message}</div><div class="progress"></div>`;

        container.appendChild(toast);

        // הסרה אוטומטית עם אנימציית יציאה
        const removeToast = () => {
            if (!toast.isConnected) return;
            toast.classList.add('exit');
            setTimeout(() => toast.remove(), 180);
        };

        const timer = setTimeout(removeToast, Math.max(1500, duration));

        // סגירה בלחיצה
        toast.addEventListener('click', () => {
            clearTimeout(timer);
            removeToast();
        });
    }

    async saveProductsToFile() {
        try {
            const jsonContent = JSON.stringify({ 
                products: this.products, 
                categories: this.categories,
                exportDate: new Date().toISOString(),
                version: '1.0'
            }, null, 2);

            const blob = new Blob([jsonContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `products_export_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showNotification('✅ מוצרים יוצאו בהצלחה', 'success');
            
            // ננסה לשמור בשרת ברקע
            this.saveAllToServer().catch(error => {
                console.warn('שגיאה בשמירה לשרת אחרי ייצוא:', error);
            });
        } catch (error) {
            console.error('שגיאה בשמירת קובץ:', error);
            this.showNotification('❌ שגיאה בייצוא הקובץ: ' + error.message, 'error');
        }
    }

    // ייצוא מוצרים (עטיפה נוחה לכפתור בממשק)
    exportProducts() {
        return this.saveProductsToFile();
    }

    async refreshProducts() {
        this.showNotification('🔄 מרענן מוצרים...', 'info');
        // ניקוי תיבת החיפוש
        this.clearSearch();
        await this.loadProducts();
    }

    // פונקציה לניקוי החיפוש
    clearSearch() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = '';
            // הפעלת החיפוש כדי להציג את כל המוצרים
            this.searchProducts('');
        }
    }

    async importProducts() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadProductsFromFile(file);
            }
        };
        input.click();
    }

    async loadProductsFromFile(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.products) {
                throw new Error('קובץ לא תקין - חסרים מוצרים');
            }

            this.products = data.products;
            if (data.categories) {
                this.categories = { ...this.categories, ...data.categories };
            }

            // לאחר ייבוא קובץ: שמירה בהחלפה מלאה כדי לוודא שאין כפילויות/שאריות
            await this.saveAllToServer(true);

            this.updateProductsDisplay();
            this.updateStats();
            
            this.showNotification('✅ מוצרים יובאו בהצלחה', 'success');
        } catch (error) {
            console.error('שגיאה בייבוא:', error);
            this.showNotification('❌ שגיאה בייבוא הקובץ: ' + error.message, 'error');
        }
    }

    // פונקציה ליצירת גיבוי
    async backupProducts() {
        try {
            // קודם נוודא שהכל מעודכן בשרת
            await this.saveAllToServer();

            // יצירת קובץ גיבוי
            const backupData = {
                products: this.products,
                categories: this.categories,
                backupDate: new Date().toISOString(),
                version: '1.0'
            };

            const jsonContent = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `products_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.showNotification('✅ גיבוי נוצר בהצלחה', 'success');
        } catch (error) {
            console.error('שגיאה ביצירת גיבוי:', error);
            this.showNotification('❌ שגיאה ביצירת גיבוי: ' + error.message, 'error');
        }
    }

    async searchProducts(query) {
        if (!query.trim()) {
            this.updateProductsDisplay();
            return;
        }

        const filteredProducts = {};
        Object.entries(this.products).forEach(([code, product]) => {
            const name = product.name || '';
            const searchName = product.searchName || '';
            if (
                name.toLowerCase().includes(query.toLowerCase()) ||
                code.includes(query) ||
                searchName.toLowerCase().includes(query.toLowerCase())
            ) {
                filteredProducts[code] = product;
            }
        });

        const container = document.getElementById('products-container');
        if (!container) return;

        if (Object.keys(filteredProducts).length === 0) {
            container.innerHTML = '<p class="no-products">אין מוצרים להצגה</p>';
            return;
        }

        container.innerHTML = '';
        Object.entries(filteredProducts).forEach(([code, product]) => {
            const productCard = this.createProductCard(code, product);
            container.appendChild(productCard);
        });
    }

    openAddProductModal() {
        document.getElementById('productForm').reset();
        document.getElementById('editMode').value = 'false';
        document.getElementById('productCode').value = '';
        document.getElementById('productQuantity').value = '';
        document.getElementById('predefinedQuantities').value = '';
        this.resetSizeInputs();
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'הוספת מוצר חדש';
        }
        const sizesSection = document.getElementById('sizes-section');
        if (sizesSection) {
            sizesSection.style.display = 'block';
        }
        document.getElementById('productModal').style.display = 'block';
    }

    editProduct(code) {
        const product = this.products[code];
        if (!product) {
            this.showNotification('❌ מוצר לא נמצא', 'error');
            return;
        }

        // הצגת שם המוצר לעריכה - אם אין name, נציג searchName או ריק
        const productName = product.name || product.Name || product.searchName || 'מוצר ללא שם';
        const productType = product.type || 'none';

        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) {
            modalTitle.textContent = `עריכת מוצר: ${productName}`;
        }

        document.getElementById('editMode').value = 'true';
        const codeInput = document.getElementById('productCode');
        codeInput.value = code;
        codeInput.removeAttribute('disabled');
        this.lastEditedProductCode = code;
        
        // טעינת השדות - אם אין name אבל יש searchName, נשאיר את name ריק
        document.getElementById('productName').value = product.name || product.Name || '';
        document.getElementById('productCategory').value = product.category || '';
        document.getElementById('searchName').value = product.searchName || '';
        document.getElementById('productType').value = productType;
        document.getElementById('productTemperature').value = product.temperature || '';
        
        if (productType === 'quantity') {
            document.getElementById('productQuantity').value = product.defaultQuantity || '';
            const unitSelect = document.getElementById('unitType');
            if (unitSelect && product.unit) {
                if (unitSelect.querySelector(`option[value="${product.unit}"]`)) {
                    unitSelect.value = product.unit;
                } else {
                    const newOption = document.createElement('option');
                    newOption.value = product.unit;
                    newOption.textContent = product.unit;
                    unitSelect.appendChild(newOption);
                    unitSelect.value = product.unit;
                }
            }
            
            // טעינת רשימת כמויות מוגדרות מראש
            if (product.predefinedQuantities && Array.isArray(product.predefinedQuantities)) {
                document.getElementById('predefinedQuantities').value = product.predefinedQuantities.join(', ');
            }
        } else if (productType === 'size') {
            // טעינת גודל ברירת מחדל למוצרי גודל
            const defaultSizeSelect = document.getElementById('defaultSize');
            if (defaultSizeSelect && product.defaultSize) {
                if (defaultSizeSelect.querySelector(`option[value="${product.defaultSize}"]`)) {
                    defaultSizeSelect.value = product.defaultSize;
                } else {
                    const newOption = document.createElement('option');
                    newOption.value = product.defaultSize;
                    newOption.textContent = product.defaultSize;
                    defaultSizeSelect.appendChild(newOption);
                    defaultSizeSelect.value = product.defaultSize;
                }
            }
        } else {
            document.getElementById('productQuantity').value = product.quantity || product.defaultQuantity || '';
            
            const unitSelect = document.getElementById('unitType');
            if (unitSelect && product.unit) {
                if (unitSelect.querySelector(`option[value="${product.unit}"]`)) {
                    unitSelect.value = product.unit;
                } else {
                    const newOption = document.createElement('option');
                    newOption.value = product.unit;
                    newOption.textContent = product.unit;
                    unitSelect.appendChild(newOption);
                    unitSelect.value = product.unit;
                }
            }
        }

        this.toggleQuantityFields();

        if (product.sizes && product.sizes.length > 0) {
            this.loadProductSizes(product.sizes);
            const sizesSection = document.getElementById('sizes-section');
            if (sizesSection) {
                sizesSection.style.display = 'block';
            }
        } else {
            this.resetSizeInputs();
        }

        document.getElementById('productModal').style.display = 'block';
    }

    async saveProduct() {
        try {
            const form = document.getElementById('productForm');
            const formData = new FormData(form);

            const productData = {
                name: formData.get('productName'),
                category: formData.get('productCategory'),
                searchName: formData.get('searchName'),
                type: formData.get('productType'),
                sizes: []
            };
            
            // טיפול בטמפרטורה - אם ריקה, נמחקת
            const temperature = formData.get('productTemperature');
            if (temperature && temperature.trim()) {
                productData.temperature = temperature;
            } else if (temperature === '') {
                // אם הטמפרטורה ריקה, נשלח null למחיקה
                productData.temperature = null;
            }
            
            if (!productData.category) {
                this.showNotification('❌ יש למלא קטגוריה', 'error');
                return;
            }
            
            // אם אין שם וגם אין searchName, לא נוכל לשמור
            if (!productData.name && !productData.searchName) {
                this.showNotification('❌ יש למלא שם או שם לחיפוש', 'error');
                return;
            }

            const quantity = formData.get('productQuantity');
            
            const unitType = document.getElementById('unitType');
            if (unitType && unitType.value) {
                productData.unit = unitType.value;
            }
            
            if (productData.type === 'quantity' && quantity) {
                productData.defaultQuantity = parseInt(quantity);
                
                // שמירת רשימת כמויות מוגדרות מראש
                const predefinedQuantitiesStr = formData.get('predefinedQuantities');
                if (predefinedQuantitiesStr && predefinedQuantitiesStr.trim()) {
                    const quantities = predefinedQuantitiesStr.split(',').map(q => parseInt(q.trim())).filter(q => !isNaN(q));
                    if (quantities.length > 0) {
                        productData.predefinedQuantities = quantities;
                    }
                }
            } else if (productData.type === 'size') {
                // שמירת גודל ברירת מחדל למוצרי גודל
                const defaultSize = formData.get('defaultSize');
                if (defaultSize) {
                    productData.defaultSize = defaultSize;
                }
            } else if (quantity) {
                productData.quantity = quantity;
            }

            const sizeRows = document.querySelectorAll('.size-row');
            sizeRows.forEach(row => {
                const sizeInput = row.querySelector('.size-input');
                const priceInput = row.querySelector('.price-input');

                if (sizeInput && sizeInput.value.trim()) {
                    productData.sizes.push({
                        size: sizeInput.value.trim(),
                        price: priceInput && priceInput.value.trim() ? parseFloat(priceInput.value) : 0
                    });
                }
            });

            const isEdit = formData.get('editMode') === 'true';
            let productCode = formData.get('productCode');
            
            if (!isEdit && (!productCode || productCode.trim() === '')) {
                productCode = Date.now().toString();
            }

            this.products[productCode] = productData;
            // הודעת הצלחה מיידית (אופטימית)
            this.showNotification(`✅ המוצר ${isEdit ? 'עודכן' : 'נוסף'} בהצלחה`, 'success');
            // שמירת דלתא מהירה ברקע
            this.saveProductsDelta({ [productCode]: productData }).catch(err => {
                this.showNotification('❌ שגיאה בשמירה: ' + err.message, 'error');
            });
            this.updateProductsDisplay();
            this.updateStats();
            // ניקוי תיבת החיפוש אחרי שמירה
            this.clearSearch();
            this.closeProductModal();

        } catch (error) {
            console.error('שגיאה בשמירת מוצר:', error);
            this.showNotification('❌ שגיאה בשמירת המוצר: ' + error.message, 'error');
        }
    }

    async deleteProductConfirm(code) {
        const product = this.products[code];
        if (!product) {
            this.showNotification('❌ מוצר לא נמצא', 'error');
            return;
        }

        const productDisplayName = product.name || product.Name || product.searchName || 'מוצר ללא שם';
        const confirmDelete = confirm(`האם אתה בטוח שברצונך למחוק את המוצר "${productDisplayName}" (${code})?`);
        if (confirmDelete) {
            try {
                // מחיקה דרך ה-API
                const resp = await fetch(`${config.getApiBaseUrl()}/api/products/${code}`, { method: 'DELETE', cache: 'no-store' });
                if (!resp.ok) {
                    const errText = await resp.text();
                    throw new Error(errText || 'שגיאה במחיקה');
                }
                delete this.products[code];
                this.showNotification('✅ המוצר נמחק בהצלחה', 'success');
                this.updateProductsDisplay();
                this.updateStats();
            } catch (error) {
                console.error('שגיאה במחיקת מוצר:', error);
                this.showNotification('❌ שגיאה במחיקת המוצר: ' + error.message, 'error');
            }
        }
    }

    closeProductModal() {
        document.getElementById('productModal').style.display = 'none';
        document.getElementById('productForm').reset();
        document.getElementById('predefinedQuantities').value = '';
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'הוספת מוצר חדש';
        }
        this.resetSizeInputs();
        this.toggleQuantityFields();
    }

    createSizeRow() {
        const sizeRow = document.createElement('div');
        sizeRow.className = 'size-row';
        sizeRow.innerHTML = `
            <input type="text" class="size-input" placeholder="גודל/כמות">
            <input type="number" class="price-input" placeholder="מחיר" step="0.01">
            <button type="button" class="btn btn-remove" onclick="productManager.removeSize(this)">הסר</button>
        `;
        return sizeRow;
    }

    addSizeRow() {
        const sizesContainer = document.getElementById('sizes-container');
        if (sizesContainer) {
            const sizeRow = this.createSizeRow();
            sizesContainer.appendChild(sizeRow);
        }
    }

    removeSize(button) {
        const sizeRow = button.closest('.size-row');
        if (sizeRow) {
            sizeRow.remove();
        }
    }

    resetSizeInputs() {
        const sizesContainer = document.getElementById('sizes-container');
        if (sizesContainer) {
            sizesContainer.innerHTML = '';
            this.addSizeRow();
        }
    }

    toggleQuantityFields() {
        const productType = document.getElementById('productType').value;
        const quantityFields = document.getElementById('quantity-fields');
        const sizeFields = document.getElementById('size-fields');
        const basePriceField = document.getElementById('base-price-field');
        const sizesSection = document.getElementById('sizes-section');

        // הסתרת כל השדות תחילה
        if (quantityFields) quantityFields.style.display = 'none';
        if (sizeFields) sizeFields.style.display = 'none';
        if (basePriceField) basePriceField.style.display = 'none';
        if (sizesSection) sizesSection.style.display = 'none';

        if (productType === 'quantity') {
            // מוצרי כמות - מציגים שדה כמות + יחידת מידה + טבלת מחירים
            if (quantityFields) quantityFields.style.display = 'block';
            if (sizesSection) sizesSection.style.display = 'block';
        } else if (productType === 'size') {
            // מוצרי גודל - מציגים שדה גודל ברירת מחדל + טבלת מחירים
            if (sizeFields) sizeFields.style.display = 'block';
            if (sizesSection) sizesSection.style.display = 'block';
        } else if (productType === 'none') {
            // מוצרים ללא כמות/גודל - יכולים להיות עם או בלי מחיר
            if (sizesSection) sizesSection.style.display = 'block';
        }
    }

    loadProductSizes(sizes) {
        const sizesContainer = document.getElementById('sizes-container');
        if (!sizesContainer) return;

        sizesContainer.innerHTML = '';

        const sizesArray = Array.isArray(sizes) ? sizes : [];
        
        sizesArray.forEach((sizeData) => {
            if (sizeData && (sizeData.size || sizeData.Size)) {
                const sizeRow = this.createSizeRow();
                const sizeInput = sizeRow.querySelector('.size-input');
                const priceInput = sizeRow.querySelector('.price-input');

                sizeInput.value = sizeData.size || sizeData.Size || '';
                priceInput.value = (sizeData.price !== undefined && sizeData.price !== null) ? sizeData.price : '';

                sizesContainer.appendChild(sizeRow);
            }
        });
        
        if (sizesArray.length === 0) {
            this.addSizeRow();
        }
    }

    // מערכת בחירה מרובה - הוספת selectedProducts לconstructor הקיים

    toggleProductSelection(code, checkbox, card) {
        if (this.selectedProducts.has(code)) {
            this.selectedProducts.delete(code);
            checkbox.classList.remove('checked');
            card.classList.remove('selected');
        } else {
            this.selectedProducts.add(code);
            checkbox.classList.add('checked');
            card.classList.add('selected');
        }
        
        this.updateBulkActionsVisibility();
    }

    updateBulkActionsVisibility() {
        const bulkEditButton = document.getElementById('bulkEditButton');
        const selectedCount = document.getElementById('selectedCount');
        const selectAllButton = document.querySelector('.btn-select-all');
        
        if (bulkEditButton) {
            bulkEditButton.style.display = this.selectedProducts.size > 0 ? 'block' : 'none';
        }
        if (selectedCount) {
            selectedCount.textContent = this.selectedProducts.size;
        }
        if (selectAllButton) {
            selectAllButton.style.display = Object.keys(this.products).length > 0 ? 'inline-block' : 'none';
        }
        
        // נעילת כפתורי עריכה ומחיקה בודדים כשבחרתי מוצרים
        this.updateIndividualButtonsLock();
    }

    updateIndividualButtonsLock() {
        const hasSelection = this.selectedProducts.size > 0;
        const editButtons = document.querySelectorAll('.product-actions button');
        
        editButtons.forEach(button => {
            if (hasSelection) {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
                button.title = 'לא זמין - יש מוצרים נבחרים לעריכה מרובה';
            } else {
                button.disabled = false;
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
                button.title = '';
            }
        });
    }

    selectAllProducts() {
        // בחירת כל המוצרים הנראים (מסוננים או כולם)
        const productsToSelect = this.filteredProducts.size > 0 ? 
            Array.from(this.filteredProducts) : 
            Object.keys(this.products);
            
        this.selectedProducts.clear();
        
        productsToSelect.forEach(code => {
            this.selectedProducts.add(code);
        });
        
        // עדכון הממשק
        document.querySelectorAll('.product-checkbox').forEach(checkbox => {
            checkbox.classList.add('checked');
        });
        document.querySelectorAll('.product-card').forEach(card => {
            card.classList.add('selected');
        });
        
        this.updateBulkActionsVisibility();
        this.showNotification(`✅ נבחרו ${productsToSelect.length} מוצרים`, 'success');
    }

    // מערכת מסננים מתקדמת
    toggleAdvancedFilters() {
        const filtersDiv = document.getElementById('advancedFilters');
        if (filtersDiv) {
            const isVisible = filtersDiv.style.display !== 'none';
            filtersDiv.style.display = isVisible ? 'none' : 'block';
        }
    }

    applyFilters() {
        const categoryFilter = document.getElementById('filterCategory')?.value || '';
        const temperatureFilter = document.getElementById('filterTemperature')?.value || '';
        const typeFilter = document.getElementById('filterType')?.value || '';
        const priceFilter = document.getElementById('filterPrice')?.value || '';

        this.currentFilters = {
            category: categoryFilter,
            temperature: temperatureFilter,
            type: typeFilter,
            price: priceFilter
        };

        const filteredCodes = [];
        const allProductCodes = Object.keys(this.products);

        allProductCodes.forEach(code => {
            const product = this.products[code];
            if (!product) return;

            // בדיקת קטגוריה
            if (categoryFilter && product.category !== categoryFilter) return;

            // בדיקת טמפרטורה
            if (temperatureFilter) {
                if (temperatureFilter === 'none' && product.temperature) return;
                if (temperatureFilter !== 'none' && product.temperature !== temperatureFilter) return;
            }

            // בדיקת סוג מוצר
            if (typeFilter && product.type !== typeFilter) return;

            // בדיקת מחירים
            if (priceFilter) {
                const hasSizes = product.sizes && product.sizes.length > 0;
                const hasPrices = hasSizes && product.sizes.some(size => size.price > 0);
                const hasZeroPrices = hasSizes && product.sizes.some(size => size.price === 0);

                switch (priceFilter) {
                    case 'with_prices':
                        if (!hasPrices) return;
                        break;
                    case 'no_prices':
                        if (hasPrices) return;
                        break;
                    case 'zero_prices':
                        if (!hasZeroPrices) return;
                        break;
                }
            }

            filteredCodes.push(code);
        });

        this.filteredProducts.clear();
        filteredCodes.forEach(code => this.filteredProducts.add(code));

        // עדכון התצוגה
        this.updateProductsDisplay();
        
        // עדכון ספירת התוצאות
        const resultsSpan = document.getElementById('filterResults');
        if (resultsSpan) {
            resultsSpan.textContent = `נמצאו ${filteredCodes.length} מוצרים`;
        }

        this.showNotification(`🔍 נמצאו ${filteredCodes.length} מוצרים`, 'info');
    }

    clearFilters() {
        this.currentFilters = {};
        this.filteredProducts.clear();

        // איפוס השדות
        document.getElementById('filterCategory').value = '';
        document.getElementById('filterTemperature').value = '';
        document.getElementById('filterType').value = '';
        document.getElementById('filterPrice').value = '';

        // עדכון התצוגה
        this.updateProductsDisplay();
        
        // עדכון ספירת התוצאות
        const resultsSpan = document.getElementById('filterResults');
        if (resultsSpan) {
            resultsSpan.textContent = '';
        }

        this.showNotification('🗑️ המסננים נוקו', 'info');
    }

    selectFilteredProducts() {
        if (this.filteredProducts.size === 0) {
            this.showNotification('❌ אין מוצרים מסוננים לבחירה', 'error');
            return;
        }

        this.selectedProducts.clear();
        this.filteredProducts.forEach(code => {
            this.selectedProducts.add(code);
        });

        // עדכון הממשק
        document.querySelectorAll('.product-checkbox').forEach(checkbox => {
            const card = checkbox.closest('.product-card');
            const productCode = card?.getAttribute('data-product-code');
            if (productCode && this.selectedProducts.has(productCode)) {
                checkbox.classList.add('checked');
                card.classList.add('selected');
            } else {
                checkbox.classList.remove('checked');
                card.classList.remove('selected');
            }
        });

        this.updateBulkActionsVisibility();
        this.showNotification(`✅ נבחרו ${this.filteredProducts.size} מוצרים מסוננים`, 'success');
    }

    clearSelection() {
        this.selectedProducts.clear();
        document.querySelectorAll('.product-checkbox').forEach(checkbox => {
            checkbox.classList.remove('checked');
        });
        document.querySelectorAll('.product-card').forEach(card => {
            card.classList.remove('selected');
        });
        this.updateBulkActionsVisibility();
        this.showNotification('❌ בוטלה בחירה', 'info');
    }

    // פתיחת modal עריכה מרובה
    openBulkEditModal() {
        if (this.selectedProducts.size === 0) return;
        
        const modal = document.getElementById('bulkEditModal');
        const countElement = document.getElementById('bulkEditSelectedCount');
        
        if (modal) {
            modal.style.display = 'block';
        }
        if (countElement) {
            countElement.textContent = this.selectedProducts.size;
        }
    }

    // סגירת modal עריכה מרובה
    closeBulkEditModal() {
        const modal = document.getElementById('bulkEditModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // איפוס השדות
        const categorySelect = document.getElementById('bulkCategorySelect');
        const tempSelect = document.getElementById('bulkTemperatureSelect');
        const sizesInput = document.getElementById('bulkSizesInput');
        
        if (categorySelect) categorySelect.value = '';
        if (tempSelect) tempSelect.value = '';
        if (sizesInput) sizesInput.value = '';
    }

    // עריכת קטגוריה
    async bulkEditCategory() {
        if (this.selectedProducts.size === 0) return;
        
        const categorySelect = document.getElementById('bulkCategorySelect');
        if (!categorySelect || !categorySelect.value) {
            this.showNotification('❌ יש לבחור קטגוריה', 'error');
            return;
        }
        
        try {
            const updates = {};
            for (const code of this.selectedProducts) {
                if (this.products[code]) {
                    updates[code] = { ...this.products[code], category: categorySelect.value };
                }
            }
            
            await this.saveProductsDelta(updates);
            this.showNotification(`✅ עודכנו ${this.selectedProducts.size} מוצרים לקטגוריה: ${this.categories[categorySelect.value]}`, 'success');
            this.clearSelection();
            this.updateProductsDisplay();
            this.closeBulkEditModal();
        } catch (error) {
            this.showNotification('❌ שגיאה בעדכון קטגוריות: ' + error.message, 'error');
        }
    }

    // עריכת טמפרטורה
    async bulkEditTemperature() {
        if (this.selectedProducts.size === 0) return;
        
        const tempSelect = document.getElementById('bulkTemperatureSelect');
        if (!tempSelect || !tempSelect.value) {
            this.showNotification('❌ יש לבחור טמפרטורה', 'error');
            return;
        }
        
        let temperature = '';
        let tempText = '';
        
        if (tempSelect.value === 'default') {
            temperature = '';
            tempText = 'ברירת מחדל (הוסר)';
        } else {
            temperature = tempSelect.value;
            tempText = tempSelect.value === 'hot' ? 'חם 🔥' : 'קר ❄️';
        }
        
        try {
            const updates = {};
            for (const code of this.selectedProducts) {
                if (this.products[code]) {
                    const updatedProduct = { ...this.products[code] };
                    if (temperature) {
                        updatedProduct.temperature = temperature;
                    } else {
                        // שליחת null כדי לסמן לשרת למחוק את השדה
                        updatedProduct.temperature = null;
                    }
                    updates[code] = updatedProduct;
                }
            }
            
            await this.saveProductsDelta(updates);
            this.showNotification(`✅ עודכנו ${this.selectedProducts.size} מוצרים לטמפרטורה: ${tempText}`, 'success');
            this.clearSelection();
            this.updateProductsDisplay();
            this.closeBulkEditModal();
        } catch (error) {
            this.showNotification('❌ שגיאה בעדכון טמפרטורות: ' + error.message, 'error');
        }
    }

    // עריכת גדלים/מחירים
    async bulkEditSizes() {
        if (this.selectedProducts.size === 0) return;
        
        const sizesInput = document.getElementById('bulkSizesInput');
        if (!sizesInput) return;
        
        const sizesText = sizesInput.value.trim();
        if (!sizesText) {
            this.showNotification('❌ יש להזין גדלים ומחירים', 'error');
            return;
        }
        
        let sizes = [];
        try {
            sizes = sizesText.split(',').map(item => {
                const [size, price] = item.trim().split(':');
                return {
                    size: size.trim(),
                    price: parseFloat(price.trim()) || 0
                };
            });
        } catch (error) {
            this.showNotification('❌ פורמט שגוי. השתמש בפורמט: גודל:מחיר, גודל:מחיר', 'error');
            return;
        }
        
        try {
            const updates = {};
            for (const code of this.selectedProducts) {
                if (this.products[code]) {
                    const updatedProduct = { ...this.products[code] };
                    updatedProduct.sizes = sizes;
                    updates[code] = updatedProduct;
                }
            }
            
            await this.saveProductsDelta(updates);
            this.showNotification(`✅ עודכנו גדלים ל-${this.selectedProducts.size} מוצרים`, 'success');
            this.clearSelection();
            this.updateProductsDisplay();
            this.closeBulkEditModal();
        } catch (error) {
            this.showNotification('❌ שגיאה בעדכון גדלים: ' + error.message, 'error');
        }
    }

    async bulkDelete() {
        if (this.selectedProducts.size === 0) return;
        
        const confirmDelete = confirm(`האם אתה בטוח שברצונך למחוק ${this.selectedProducts.size} מוצרים נבחרים?`);
        if (!confirmDelete) return;
        
        try {
            for (const code of this.selectedProducts) {
                const resp = await fetch(`${config.getApiBaseUrl()}/api/products/${code}`, { 
                    method: 'DELETE', 
                    cache: 'no-store' 
                });
                if (!resp.ok) {
                    const errText = await resp.text();
                    throw new Error(`שגיאה במחיקת מוצר ${code}: ${errText}`);
                }
                delete this.products[code];
            }
            
            this.showNotification(`✅ נמחקו ${this.selectedProducts.size} מוצרים בהצלחה`, 'success');
            this.clearSelection();
            this.updateProductsDisplay();
            this.updateStats();
            this.closeBulkEditModal();
        } catch (error) {
            this.showNotification('❌ שגיאה במחיקה: ' + error.message, 'error');
        }
    }

}

// Global functions
function openAddProductModal() {
    if (window.productManager) {
        window.productManager.openAddProductModal();
    }
}

function closeProductModal() {
    if (window.productManager) {
        window.productManager.closeProductModal();
    }
}

function addSizeRow() {
    if (window.productManager) {
        window.productManager.addSizeRow();
    }
}

function removeSize(button) {
    if (window.productManager) {
        window.productManager.removeSize(button);
    }
}

function deleteProductConfirm(code) {
    if (window.productManager) {
        window.productManager.deleteProductConfirm(code);
    }
}

function searchProducts(query) {
    if (window.productManager) {
        window.productManager.searchProducts(query);
    }
}

function backupProducts() {
    if (window.productManager) {
        window.productManager.backupProducts();
    }
}

function exportProducts() {
    if (window.productManager) {
        window.productManager.exportProducts();
    }
}

function importProducts() {
    if (window.productManager) {
        window.productManager.importProducts();
    }
}

function refreshProducts() {
    if (window.productManager) {
        window.productManager.refreshProducts();
    }
}

function clearSearch() {
    if (window.productManager) {
        window.productManager.clearSearch();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ProductManager();

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            if (window.productManager) {
                window.productManager.searchProducts(e.target.value);
            }
        });
    }

    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (window.productManager) {
                window.productManager.saveProduct();
            }
        });
    }

    const typeSelect = document.getElementById('productType');
    if (typeSelect && window.productManager) {
        typeSelect.addEventListener('change', () => window.productManager.toggleQuantityFields());
        window.productManager.toggleQuantityFields();
    }
});

// Backup functions
async function backupNow() {
    try {
        const response = await fetch('https://nsion-chdash-api-1.onrender.com/api/backup-now', {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ גיבוי נוצר בהצלחה!\n\nמוצרים: ${data.totals.products}\nקטגוריות: ${data.totals.categories}`);
        } else {
            alert(`❌ שגיאה ביצירת גיבוי: ${data.error}`);
        }
    } catch (error) {
        console.error('Error creating backup:', error);
        alert('שגיאה ביצירת גיבוי');
    }
}

async function getBackupStatus() {
    try {
        const response = await fetch('https://nsion-chdash-api-1.onrender.com/api/backup-status');
        const data = await response.json();
        
        if (data.exists) {
            alert(`✅ גיבוי קיים!\n\nנתיב: ${data.latestPath}\nתיקיית Drive: ${data.folderId || 'לא מוגדר'}`);
        } else {
            alert('❌ לא נמצא גיבוי');
        }
    } catch (error) {
        console.error('Error getting backup status:', error);
        alert('שגיאה בקבלת סטטוס הגיבוי');
    }
}

async function restoreFromBackup() {
    if (!confirm('האם אתה בטוח שברצונך לשחזר את כל המוצרים מהגיבוי האחרון? זה יחליף את כל הנתונים הנוכחיים!')) {
        return;
    }
    
    try {
        const response = await fetch('https://nsion-chdash-api-1.onrender.com/api/restore-latest', {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ שחזור הושלם בהצלחה!\n\n${data.message}\n\nמוצרים: ${data.totals.products}\nקטגוריות: ${data.totals.categories}`);
            // Refresh the products list
            if (window.productManager) {
                window.productManager.refreshProducts();
            }
        } else {
            alert(`❌ שגיאה בשחזור: ${data.error}`);
        }
    } catch (error) {
        console.error('Error restoring from backup:', error);
        alert('שגיאה בשחזור מהגיבוי');
    }
}