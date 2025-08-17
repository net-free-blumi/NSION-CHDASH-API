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


    async saveAllToServer() {
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
                            timestamp: new Date().toISOString()
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

        Object.entries(this.products).forEach(([code, product]) => {
            const productCard = this.createProductCard(code, product);
            container.appendChild(productCard);
        });
    }

    createProductCard(code, product) {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        // וידוא שיש לפחות שם למוצר - אם אין name, נשתמש ב-searchName
        const productName = product.name || product.Name || product.searchName || 'ללא שם';
        const productType = product.type || 'none';
        
        // בניית מידע על המוצר
        let productInfo = `
            <div class="product-header">
                <h3>${productName}</h3>
                <span class="product-code">${code}</span>
            </div>
            <div class="product-details">
                <p><strong>קטגוריה:</strong> ${this.categories[product.category] || 'לא מוגדר'}</p>
                <p><strong>סוג:</strong> ${this.getTypeDisplay(productType)}</p>
        `;
        
        // הוספת שם חיפוש אם קיים
        if (product.searchName) {
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
                    const price = s.price === 0 ? 'חינם' : `₪${s.price}`;
                    return `${s.size}: ${price}`;
                }).join(', ');
                productInfo += `<p><strong>גדלים ומחירים:</strong> ${pricesDisplay}</p>`;
            }
        } else if (product.price !== undefined && product.price !== null) {
            const price = product.price === 0 ? 'חינם' : `₪${product.price}`;
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

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        container.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
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

    async refreshProducts() {
        this.showNotification('🔄 מרענן מוצרים...', 'info');
        await this.loadProducts();
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

            // לאחר ייבוא קובץ: שמירה מלאה כדי לוודא סנכרון
            await this.saveAllToServer();

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

        // וידוא שיש שם למוצר - אם אין name, נשתמש ב-searchName
        const productName = product.name || product.Name || product.searchName || 'ללא שם';
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
            
            if (!productData.category) {
                this.showNotification('❌ יש למלא קטגוריה', 'error');
                return;
            }
            
            // אם אין שם אבל יש searchName, נשתמש ב-searchName כשם
            if (!productData.name && productData.searchName) {
                productData.name = productData.searchName;
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

        const productDisplayName = product.name || product.Name || product.searchName || 'ללא שם';
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
            <input type="text" class="size-input" placeholder="גודל/כמות" required>
            <input type="number" class="price-input" placeholder="מחיר" step="0.01" required>
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
