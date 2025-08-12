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
        await this.loadProducts();
        this.setupEventListeners();
        // this.displayProducts(); // Removed: Replaced by updateProductsDisplay
        this.updateStats();
        window.productManager = this;
    }

    // פונקציה לטעינת מוצרים מ-API
    async loadProducts() {
        try {
            const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                ? 'http://localhost:5000' 
                : 'https://nsion-chdash-api.onrender.com';

            const response = await fetch(`${API_BASE_URL}/api/products`);
            if (!response.ok) {
                throw new Error('שגיאה בטעינת מוצרים מהשרת');
            }

            const data = await response.json();
            this.products = data.products || {};
            this.categories = data.categories || {};

            this.updateProductsDisplay();
            this.updateStats();

            console.log('✅ מוצרים נטענו בהצלחה מהשרת');
        } catch (error) {
            console.error('שגיאה בטעינת מוצרים:', error);
            this.showNotification(`❌ ${error.message}`, 'error');
        }
    }

    // פונקציה לעדכון תצוגת המוצרים
    updateProductsDisplay() {
        const container = document.getElementById('products-container');
        if (!container) return;

        container.innerHTML = '';

        Object.entries(this.products).forEach(([code, product]) => {
            const productCard = this.createProductCard(code, product);
            container.appendChild(productCard);
        });
    }

    // פונקציה ליצירת כרטיס מוצר
    createProductCard(code, product) {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        // וידוא שיש לפחות שם למוצר
        const productName = product.name || product.Name || 'ללא שם';
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
                <!-- Removed redundant line about base price -->
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

    // פונקציה להצגת סוג המוצר
    getTypeDisplay(type) {
        const types = {
            'quantity': 'כמות',
            'size': 'גודל',
            'none': 'ללא כמות/גודל'
        };
        return types[type] || 'לא מוגדר';
    }

    // פונקציה לעדכון סטטיסטיקות
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

    // פונקציה לחישוב סטטיסטיקות
    calculateStats() {
        const products = Object.values(this.products);
        return {
            total: products.length,
            sizeType: products.filter(p => p.type === 'size').length,
            quantityType: products.filter(p => p.type === 'quantity').length,
            noneType: products.filter(p => p.type === 'none').length
        };
    }

    // פונקציה להצגת הודעות
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

    // פונקציה לשמירת מוצרים לקובץ JSON
    async saveProductsToFile() {
        try {
            const response = await fetch('/api/products/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ products: this.products, categories: this.categories })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `products_export_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                this.showNotification('✅ מוצרים יוצאו בהצלחה', 'success');
            } else {
                throw new Error('שגיאה ביצירת קובץ לייצוא');
            }
        } catch (error) {
            console.error('שגיאה בשמירת קובץ:', error);
            this.showNotification('❌ שגיאה בשמירת הקובץ', 'error');
        }
    }

    // פונקציה לרענון המוצרים
    async refreshProducts() {
        this.showNotification('🔄 מרענן מוצרים...', 'info');
        await this.loadProducts();
    }

    // פונקציה לייבוא מוצרים
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

    // פונקציה לטעינת מוצרים מקובץ
    async loadProductsFromFile(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (data.products) {
                // שליחה לשרת לעדכון
                const response = await fetch('/api/products/import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    this.products = data.products;
                    this.categories = data.categories || {};
                    this.updateProductsDisplay();
                    this.updateStats();
                    this.showNotification('✅ מוצרים יובאו בהצלחה', 'success');
                } else {
                    throw new Error('שגיאה בשליחה לשרת');
                }
            } else {
                throw new Error('קובץ לא תקין');
            }
        } catch (error) {
            console.error('שגיאה בייבוא:', error);
            this.showNotification('❌ שגיאה בייבוא הקובץ', 'error');
        }
    }

    // פונקציה לייצוא מוצרים
    exportProducts() {
        this.saveProductsToFile();
    }

    // פונקציה ליצירת גיבוי
    async backupProducts() {
        try {
            const response = await fetch('/api/products/backup', {
                method: 'POST'
            });

            if (response.ok) {
                const result = await response.json();
                this.showNotification('✅ גיבוי נוצר בהצלחה', 'success');
            } else {
                throw new Error('שגיאה ביצירת גיבוי');
            }
        } catch (error) {
            console.error('שגיאה ביצירת גיבוי:', error);
            this.showNotification('❌ שגיאה ביצירת גיבוי', 'error');
        }
    }

    searchProducts(query) {
        if (!query.trim()) {
            this.displayProducts(); // Fallback to original display if query is empty
            return;
        }

        const filteredProducts = {};
        Object.entries(this.products).forEach(([code, product]) => {
            if (product.name.toLowerCase().includes(query.toLowerCase()) ||
                code.includes(query) ||
                (product.searchName && product.searchName.toLowerCase().includes(query.toLowerCase()))) {
                filteredProducts[code] = product;
            }
        });

        this.displayProducts(filteredProducts); // Use the existing displayProducts which now calls updateProductsDisplay
    }

    displayProducts(productsToDisplay = null) {
        // This function is largely replaced by updateProductsDisplay, but kept for backward compatibility if needed.
        // It's recommended to use updateProductsDisplay directly.
        const container = document.getElementById('products-container');
        if (!container) return;

        const productsToShow = productsToDisplay || this.products;
        const productsArray = Object.entries(productsToShow);

        if (productsArray.length === 0) {
            container.innerHTML = '<p class="no-products">אין מוצרים להצגה</p>';
            return;
        }

        container.innerHTML = productsArray
            .map(([code, product]) => this.createProductCard(code, product))
            .join('');
    }

    openAddProductModal() {
        document.getElementById('productForm').reset();
        document.getElementById('editMode').value = 'false';
        document.getElementById('productCode').value = '';
        document.getElementById('productQuantity').value = '';
        document.getElementById('productPrice').value = '';
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

        // וידוא שיש שם למוצר
        const productName = product.name || product.Name || 'ללא שם';
        const productType = product.type || 'none';

        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) {
            modalTitle.textContent = `עריכת מוצר: ${productName}`;
        }

        document.getElementById('editMode').value = 'true';
        document.getElementById('productCode').value = code;
        document.getElementById('productName').value = productName;
        document.getElementById('productCategory').value = product.category || '';
        document.getElementById('searchName').value = product.searchName || '';
        document.getElementById('productType').value = productType;
        
        // טעינת נתונים ספציפיים לפי סוג המוצר
        if (productType === 'quantity') {
            document.getElementById('productQuantity').value = product.defaultQuantity || '';
            const unitSelect = document.getElementById('unitType');
            if (unitSelect && product.unit) {
                // תמיכה בכל יחידות המידה הקיימות
                if (unitSelect.querySelector(`option[value="${product.unit}"]`)) {
                    unitSelect.value = product.unit;
                } else {
                    // הוספת יחידת מידה חדשה אם לא קיימת ברשימה
                    const newOption = document.createElement('option');
                    newOption.value = product.unit;
                    newOption.textContent = product.unit;
                    unitSelect.appendChild(newOption);
                    unitSelect.value = product.unit;
                }
            }
        } else {
            // עבור מוצרים אחרים - נבדוק אם יש כמות רגילה
            document.getElementById('productQuantity').value = product.quantity || product.defaultQuantity || '';
            
            // טעינת יחידת מידה גם למוצרים שאינם מסוג quantity
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
        
        // טעינת מחיר בסיסי
        document.getElementById('productPrice').value = (product.price !== undefined && product.price !== null) ? product.price : '';

        this.toggleQuantityFields();

        // טעינת גדלים ומחירים אם קיימים
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

    loadProductSizes(sizes) {
        const sizesContainer = document.getElementById('sizes-container');
        if (!sizesContainer) return;

        sizesContainer.innerHTML = '';

        // וידוא שsizes הוא מערך
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
        
        // אם אין גדלים, נוסיף שורה ריקה אחת לנוחות
        if (sizesArray.length === 0) {
            this.addSizeRow();
        }
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
        if (!sizesContainer) return;

        const sizeRow = this.createSizeRow();
        sizesContainer.appendChild(sizeRow);
    }

    removeSize(button) {
        const sizeRow = button.closest('.size-row');
        if (sizeRow) {
            sizeRow.remove();
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

        // הצגת שדות לפי סוג המוצר
        if (productType === 'quantity') {
            // מוצרי כמות - מציגים שדה כמות + יחידת מידה + טבלת מחירים
            if (quantityFields) quantityFields.style.display = 'block';
            if (sizesSection) sizesSection.style.display = 'block';
        } else if (productType === 'size') {
            // מוצרי גודל - טבלת גדלים ומחירים + יחידת מידה (אופציונלי)
            if (quantityFields) quantityFields.style.display = 'block'; // מציג גם יחידת מידה
            if (sizesSection) sizesSection.style.display = 'block';
        } else if (productType === 'none') {
            // מוצרים ללא כמות/גודל - יכולים להיות עם או בלי מחיר + יחידת מידה
            if (quantityFields) quantityFields.style.display = 'block'; // מציג גם יחידת מידה
            if (sizesSection) sizesSection.style.display = 'block';
            if (basePriceField) basePriceField.style.display = 'block';
        }
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
            
            // הוספת נתונים ספציפיים לפי סוג המוצר
            const quantity = formData.get('productQuantity');
            
            // הוספת יחידת מידה לכל סוגי המוצרים
            const unitType = document.getElementById('unitType');
            if (unitType && unitType.value) {
                productData.unit = unitType.value;
            }
            
            if (productData.type === 'quantity') {
                if (quantity) {
                    productData.defaultQuantity = parseInt(quantity);
                    // אם יש כמויות מוגדרות מראש, נוסיף אותן
                    productData.predefinedQuantities = productData.predefinedQuantities || [];
                    if (!productData.predefinedQuantities.includes(parseInt(quantity))) {
                        productData.predefinedQuantities.push(parseInt(quantity));
                    }
                }
            } else if (productData.type === 'size') {
                // עבור מוצרי גודל, נשמור את הגודל הברירת מחדל אם הוגדר
                const defaultSize = document.getElementById('defaultSize');
                if (defaultSize && defaultSize.value) {
                    productData.defaultSize = defaultSize.value;
                }
                
                // אם יש כמות גם במוצרי גודל
                if (quantity) {
                    productData.quantity = quantity;
                }
            } else {
                // עבור מוצרים אחרים (none)
                if (quantity) {
                    productData.quantity = quantity;
                }
            }
            
            // מחיר בסיסי (רק אם הוזן)
            const priceValue = formData.get('productPrice');
            if (priceValue && priceValue.trim() !== '') {
                const num = parseFloat(priceValue);
                if (!isNaN(num)) {
                    productData.price = num;
                }
            }

            if (!productData.name || !productData.category) {
                this.showNotification('❌ יש למלא את כל השדות הנדרשים', 'error');
                return;
            }

            if (productData.type === 'size') {
                const sizeRows = document.querySelectorAll('.size-row');
                let hasValidSizes = false;

                sizeRows.forEach(row => {
                    const sizeInput = row.querySelector('.size-input');
                    const priceInput = row.querySelector('.price-input');

                    if (sizeInput.value.trim() && priceInput.value.trim()) {
                        productData.sizes.push({
                            size: sizeInput.value.trim(),
                            price: parseFloat(priceInput.value)
                        });
                        hasValidSizes = true;
                    }
                });

                if (!hasValidSizes) {
                    this.showNotification('❌ מוצר מסוג "גודל" חייב לכלול לפחות גודל אחד עם מחיר', 'error');
                    return;
                }
            } else if (productData.type === 'none') {
                const sizeRows = document.querySelectorAll('.size-row');
                sizeRows.forEach(row => {
                    const sizeInput = row.querySelector('.size-input');
                    const priceInput = row.querySelector('.price-input');

                    if (sizeInput.value.trim() && priceInput.value.trim()) {
                        productData.sizes.push({
                            size: sizeInput.value.trim(),
                            price: parseFloat(priceInput.value)
                        });
                    }
                });
            } else {
                // עבור כל סוגי המוצרים האחרים - טוען גדלים ומחירים
                const sizeRows = document.querySelectorAll('.size-row');
                sizeRows.forEach(row => {
                    const sizeInput = row.querySelector('.size-input');
                    const priceInput = row.querySelector('.price-input');

                    if (sizeInput.value.trim()) {
                        const price = priceInput.value.trim() ? parseFloat(priceInput.value) : 0;
                        productData.sizes.push({
                            size: sizeInput.value.trim(),
                            price: price
                        });
                    }
                });
            }

            const isEdit = formData.get('editMode') === 'true';
            const productCode = formData.get('productCode');

            const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                ? 'http://localhost:5000' 
                : 'https://nsion-chdash-api.onrender.com';

            const url = isEdit ? `${API_BASE_URL}/api/products/${productCode}` : `${API_BASE_URL}/api/products`;
            const method = isEdit ? 'PUT' : 'POST';

            // Prepare data for API call
            const apiPayload = { ...productData };
            if (isEdit) {
                apiPayload.code = productCode; // Include code for PUT request if needed by API
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(apiPayload)
            });

            if (response.ok) {
                const result = await response.json();
                const message = result.message || (isEdit ? '✅ מוצר עודכן בהצלחה' : '✅ מוצר נוסף בהצלחה');
                this.showNotification(message, 'success');

                // Update local state and UI
                if (isEdit) {
                    this.products[productCode] = { ...this.products[productCode], ...productData };
            } else {
                    // Assuming the API returns the new product with its code
                    const newProductCode = result.code || this.generateProductCode(); // Fallback to generate if API doesn't return it
                    this.products[newProductCode] = { ...productData, code: newProductCode };
                }

                this.displayProducts(); // Refresh display
                this.updateStats();
                this.closeProductModal();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'שגיאה בשמירת המוצר');
            }

        } catch (error) {
            console.error('שגיאה בשמירת מוצר:', error);
            this.showNotification(`❌ ${error.message}`, 'error');
        }
    }


    // Function to confirm deletion before performing it
    async deleteProductConfirm(code) {
        const product = this.products[code];
        if (!product) {
            this.showNotification('❌ מוצר לא נמצא', 'error');
            return;
        }

        const confirmDelete = confirm(`האם אתה בטוח שברצונך למחוק את המוצר "${product.name}" (${code})?`);

        if (confirmDelete) {
            await this.deleteProduct(code);
        }
    }

    // Function to actually delete the product (API call)
    async deleteProduct(code) {
        try {
            const response = await fetch(`/api/products/${code}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                const result = await response.json();
                const message = result.message || `✅ מוצר "${this.products[code]?.name || code}" נמחק בהצלחה`;
                this.showNotification(message, 'success');

                delete this.products[code]; // Remove from local state
                this.displayProducts(); // Update UI
                this.updateStats();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'שגיאה במחיקת מוצר מהשרת');
            }
        } catch (error) {
            console.error('שגיאה במחיקת מוצר:', error);
            this.showNotification(`❌ ${error.message}`, 'error');
        }
    }

    closeProductModal() {
        document.getElementById('productModal').style.display = 'none';
        document.getElementById('productForm').reset();
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'הוספת מוצר חדש';
        }
        this.resetSizeInputs();
        const quantityFields = document.getElementById('quantity-fields');
        const sizeFields = document.getElementById('size-fields');
        const sizesSection = document.getElementById('sizes-section');

        if (quantityFields) quantityFields.style.display = 'none';
        if (sizeFields) sizeFields.style.display = 'none';
        if (sizesSection) sizesSection.style.display = 'none';
    }

    closeDeleteModal() {
        // Assuming there's a modal for confirmation, if not, this does nothing.
        // If a modal exists with id 'delete-modal', its display should be set to 'none'.
        const deleteModal = document.getElementById('delete-modal');
        if (deleteModal) {
            deleteModal.style.display = 'none';
        }
    }

    confirmDelete() {
        const deleteModal = document.getElementById('delete-modal');
        const productCode = deleteModal.dataset.productCode;

        if (productCode) {
            this.deleteProduct(productCode);
            this.closeDeleteModal();
        }
    }

    resetSizeInputs() {
        const sizesContainer = document.getElementById('sizes-container');
        if (sizesContainer) {
            sizesContainer.innerHTML = '';
        }
    }

    // generateProductCode() and isProductCodeExists() are likely not needed if API handles code generation
    // Keeping them commented out for now, but they might be useful for fallback or specific client-side logic.
    /*
    generateProductCode() {
        let code = 10000;
        while (this.products[code.toString()]) {
            code++;
            if (code > 99999) {
                throw new Error('לא ניתן ליצור קוד חדש - הגעת למגבלת הקודים');
            }
        }
        return code.toString();
    }

    isProductCodeExists(code) {
        return this.products[code.toString()] !== undefined;
    }
    */


    setupEventListeners() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchProducts(e.target.value);
            });
        }

        const productForm = document.getElementById('productForm');
        if (productForm) {
            productForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProduct();
            });
        }

        const typeSelect = document.getElementById('productType');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => this.toggleQuantityFields());
            this.toggleQuantityFields(); // Initial call
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

function deleteProductConfirm(code) { // Renamed from deleteProduct for clarity
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
});