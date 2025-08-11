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
        this.displayProducts();
        this.updateStats();
        window.productManager = this;
    }

    async loadProducts() {
        try {
            const response = await fetch('products.json');
            if (!response.ok) {
                throw new Error(`שגיאת HTTP! סטטוס: ${response.status}`);
            }
            const data = await response.json();
            
            if (!data || !data.products) {
                throw new Error('קובץ המוצרים לא מכיל מידע תקין');
            }
            
            this.products = data.products;
            if (data.categories) {
                this.categories = { ...this.categories, ...data.categories };
            }
            
            // הצגת הודעת הצלחה
            this.showNotification('✅ מוצרים נטענו בהצלחה', 'success');
            
        } catch (error) {
            console.error('שגיאה בטעינת מוצרים:', error);
            
            // הצגת הודעת שגיאה מפורטת
            let errorMessage = 'שגיאה בטעינת מוצרים';
            if (error.message.includes('HTTP')) {
                errorMessage = 'לא ניתן לטעון את קובץ המוצרים - בדוק שהקובץ קיים';
            } else if (error.message.includes('JSON')) {
                errorMessage = 'קובץ המוצרים פגום - בדוק את הפורמט';
            } else {
                errorMessage = `שגיאה בטעינת מוצרים: ${error.message}`;
            }
            
            this.showNotification(`❌ ${errorMessage}`, 'error');
            
            // יצירת נתונים ברירת מחדל במקרה של שגיאה
            this.createDefaultProducts();
        }
    }

    displayProducts(productsToDisplay = null) {
        const container = document.getElementById('products-container');
        if (!container) return;
        
        const productsToShow = productsToDisplay || this.products;
        const productsArray = Object.entries(productsToShow);
        
        if (productsArray.length === 0) {
            container.innerHTML = '<p class="no-products">אין מוצרים להצגה</p>';
            return;
        }
        
        // סינון מוצרי placeholder ריקים
        const filteredProducts = productsArray.filter(([code, product]) => {
            // אם המוצר ריק לחלוטין או שהוא placeholder (קוד 0-6)
            if (!product.name || product.name.trim() === '') {
                return false;
            }
            
            // אם זה מוצר placeholder עם קוד נמוך וריק
            if (parseInt(code) <= 6 && (!product.name || product.name.trim() === '')) {
                return false;
            }
            
            return true;
        });
        
        if (filteredProducts.length === 0) {
            container.innerHTML = '<p class="no-products">אין מוצרים להצגה</p>';
            return;
        }
        
        container.innerHTML = filteredProducts
            .map(([code, product]) => this.createProductCard(code, product))
            .join('');
    }

    createProductCard(code, product) {
        const typeText = product.type === 'size' ? 'גודל' : 
                        product.type === 'quantity' ? 'כמות' : 
                        product.type === 'unit' ? 'יחידה' : 'מוצר רגיל';
        
        const quantityText = product.quantity ? ` - ${product.quantity}` : '';
        const priceText = (product.price !== undefined && product.price !== null && product.price !== '') ? ` - ₪${product.price}` : '';
        
        // הצגת המחיר
        let priceHtml = '';
        if (product.price !== undefined && product.price !== null && product.price !== '') {
            priceHtml = `<p><strong>מחיר:</strong> ₪${product.price}</p>`;
        } else if (product.sizes && product.sizes.length > 0) {
            // אם יש גדלים, לא מציגים מחיר כללי
            priceHtml = `<p><strong>מחיר:</strong> לפי גודל</p>`;
        } else {
            priceHtml = `<p><strong>מחיר:</strong> <span style="color: #999;">לא מוגדר</span></p>`;
        }
        
        // יצירת רשימת הגדלים והמחירים
        let sizesHtml = '';
        if (product.sizes && product.sizes.length > 0) {
            sizesHtml = `
                <div class="product-sizes">
                    <strong>גדלים ומחירים:</strong>
                    ${product.sizes.map(size => 
                        `<div class="size-item">
                            <span class="size-name">${size.size}</span>
                            <span class="size-price">₪${size.price}</span>
                        </div>`
                    ).join('')}
                </div>
            `;
        }
        
        return `
            <div class="product-card" data-code="${code}">
                <div class="product-header">
                    <h3 class="product-title">${product.name}</h3>
                    <span class="product-code">${code}</span>
                </div>
                <div class="product-details">
                    <p><strong>קטגוריה:</strong> ${this.categories[product.category] || product.category}</p>
                    <p><strong>סוג:</strong> ${typeText}${quantityText}</p>
                    ${product.searchName ? `<p><strong>שם לחיפוש:</strong> ${product.searchName}</p>` : ''}
                    ${product.quantity ? `<p><strong>כמות:</strong> ${product.quantity}</p>` : ''}
                    ${priceHtml}
                </div>
                ${sizesHtml}
                <div class="product-actions">
                    <button onclick="productManager.editProduct('${code}')" class="btn btn-edit">ערוך</button>
                    <button onclick="productManager.deleteProduct('${code}')" class="btn btn-delete">מחק</button>
                </div>
            </div>
        `;
    }

    updateStats() {
        // סינון מוצרי placeholder ריקים
        const realProducts = Object.entries(this.products).filter(([code, product]) => {
            if (!product.name || product.name.trim() === '') {
                return false;
            }
            if (parseInt(code) <= 6 && (!product.name || product.name.trim() === '')) {
                return false;
            }
            return true;
        });
        
        const totalProducts = realProducts.length;
        const sizeProducts = realProducts.filter(([code, product]) => product.type === 'size').length;
        const quantityProducts = realProducts.filter(([code, product]) => product.type === 'quantity').length;
        const noQuantityProducts = realProducts.filter(([code, product]) => !product.type || product.type === 'none').length;
        
        const statsContainer = document.getElementById('stats-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stat-item">
                    <span class="stat-number">${totalProducts}</span>
                    <span class="stat-label">סה"כ מוצרים</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${sizeProducts}</span>
                    <span class="stat-label">מוצרי גדלים</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${quantityProducts}</span>
                    <span class="stat-label">מוצרי כמות</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${noQuantityProducts}</span>
                    <span class="stat-label">ללא כמות</span>
                </div>
            `;
        }
    }

    searchProducts(query) {
        if (!query.trim()) {
            this.displayProducts();
            return;
        }
        
        const filteredProducts = {};
        Object.entries(this.products).forEach(([code, product]) => {
            // סינון מוצרי placeholder
            if (!product.name || product.name.trim() === '') {
                return;
            }
            if (parseInt(code) <= 6 && (!product.name || product.name.trim() === '')) {
                return;
            }
            
            if (product.name.toLowerCase().includes(query.toLowerCase()) ||
                code.includes(query) ||
                (product.searchName && product.searchName.toLowerCase().includes(query.toLowerCase()))) {
                filteredProducts[code] = product;
            }
        });
        
        this.displayProducts(filteredProducts);
    }

    openAddProductModal() {
        document.getElementById('productForm').reset();
        document.getElementById('editMode').value = 'false';
        document.getElementById('productCode').value = '';
        document.getElementById('productQuantity').value = '';
        document.getElementById('productPrice').value = '';
        
        // איפוס שדות הגדלים
        this.resetSizeInputs();
        
        // עדכון כותרת המודל
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'הוספת מוצר חדש';
        }
        
        // הצגת שדות הגדלים
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
        
        // עדכון כותרת המודל
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) {
            modalTitle.textContent = `עריכת מוצר: ${product.name}`;
        }
        
        document.getElementById('editMode').value = 'true';
        document.getElementById('productCode').value = code;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('searchName').value = product.searchName || '';
        document.getElementById('productType').value = product.type || '';
        document.getElementById('productQuantity').value = product.quantity || '';
        document.getElementById('productPrice').value = (product.price ?? '');

        // עדכון תצוגת שדות לפי סוג
        this.toggleQuantityFields();
        

        
        // אם זה מוצר רגיל (type: "none"), נציג את שדות הגדלים
        if (product.type === 'none' && product.sizes && product.sizes.length > 0) {
            const sizesSection = document.getElementById('sizes-section');
            if (sizesSection) {
                sizesSection.style.display = 'block';
            }
        }
        
        if (product.sizes && product.sizes.length > 0) {
            this.loadProductSizes(product.sizes);
        } else {
            this.resetSizeInputs();
        }
        
        document.getElementById('productModal').style.display = 'block';
    }

    loadProductSizes(sizes) {
        const sizesContainer = document.getElementById('sizes-container');
        if (!sizesContainer) return;
        
        sizesContainer.innerHTML = '';
        
        sizes.forEach((sizeData) => {
            const sizeRow = this.createSizeRow();
            const sizeInput = sizeRow.querySelector('.size-input');
            const priceInput = sizeRow.querySelector('.price-input');
            
            sizeInput.value = sizeData.size;
            priceInput.value = sizeData.price;
            
            sizesContainer.appendChild(sizeRow);
        });
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
        
        // הצגת השדות הרלוונטיים לפי סוג המוצר
        if (productType === 'quantity') {
            if (quantityFields) quantityFields.style.display = 'block';
            if (basePriceField) basePriceField.style.display = 'block';
        } else if (productType === 'size') {
            if (sizeFields) sizeFields.style.display = 'block';
            if (sizesSection) sizesSection.style.display = 'block';
            if (basePriceField) basePriceField.style.display = 'block';
        } else if (productType === 'unit') {
            if (quantityFields) quantityFields.style.display = 'block';
            if (basePriceField) basePriceField.style.display = 'block';
        } else if (productType === 'none') {
            // מוצר רגיל - לא מציגים שדות מיוחדים
            // אבל אפשר להוסיף גדלים אופציונליים
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
                quantity: formData.get('productQuantity'),
                price: (() => {
                    const val = formData.get('productPrice');
                    if (val === null || val === undefined || val === '') return '';
                    const num = parseFloat(val);
                    return isNaN(num) ? '' : num;
                })(),
                sizes: []
            };
            
            if (!productData.name || !productData.category) {
                this.showNotification('❌ יש למלא את כל השדות הנדרשים', 'error');
                return;
            }
            
            // בדיקה אם המוצר הוא מסוג "size" ויש לו גדלים
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
                // מוצר רגיל - לא חייב כמות או גודל
                // אבל אפשר להוסיף גדלים אופציונליים
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
                // איסוף גדלים למוצרים אחרים (אופציונלי)
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
            }
            
            const isEdit = formData.get('editMode') === 'true';
            const productCode = formData.get('productCode');
            
            if (isEdit) {
                if (this.products[productCode]) {
                    // בדיקה שהקוד החדש לא קיים כבר (אם השתנה)
                    if (productData.code && productData.code !== productCode && this.isProductCodeExists(productData.code)) {
                        this.showNotification('❌ קוד המוצר קיים כבר במערכת', 'error');
                        return;
                    }
                    this.products[productCode] = { ...this.products[productCode], ...productData };
                    this.showNotification('✅ מוצר עודכן בהצלחה', 'success');
                } else {
                    this.showNotification('❌ מוצר לא נמצא', 'error');
                    return;
                }
            } else {
                const newCode = this.generateProductCode();
                // בדיקה כפולה שהקוד לא קיים
                if (this.isProductCodeExists(newCode)) {
                    this.showNotification('❌ שגיאה ביצירת קוד מוצר - נסה שוב', 'error');
                    return;
                }
                this.products[newCode] = productData;
                this.showNotification('✅ מוצר נוסף בהצלחה', 'success');
            }
            
            this.displayProducts();
            this.updateStats();
            this.closeProductModal();
            
        } catch (error) {
            console.error('שגיאה בשמירת מוצר:', error);
            this.showNotification('❌ שגיאה בשמירת המוצר', 'error');
        }
    }

    generateProductCode() {
        let code = 10000;
        // בדיקה שהקוד לא קיים כבר
        while (this.products[code.toString()]) {
            code++;
            // הגנה מפני לולאה אינסופית
            if (code > 99999) {
                throw new Error('לא ניתן ליצור קוד חדש - הגעת למגבלת הקודים');
            }
        }
        return code.toString();
    }

    async deleteProduct(code) {
        const product = this.products[code];
        if (!product) {
            this.showNotification('❌ מוצר לא נמצא', 'error');
            return;
        }
        
        const deleteModal = document.getElementById('delete-modal');
        const deleteProductName = document.getElementById('delete-product-name');
        
        if (deleteModal && deleteProductName) {
            deleteProductName.textContent = `${product.name} (${code})`;
            deleteModal.dataset.productCode = code;
            deleteModal.style.display = 'block';
        } else {
            // fallback למקרה שהמודל לא קיים
            if (confirm(`האם אתה בטוח שברצונך למחוק את המוצר ${product.name} (${code})?`)) {
                await this.performDelete(code);
            }
        }
    }

    async performDelete(code) {
        try {
            const productName = this.products[code].name;
            delete this.products[code];
            this.displayProducts();
            this.updateStats();
            
            this.showNotification(`✅ מוצר "${productName}" נמחק בהצלחה`, 'success');
            
        } catch (error) {
            console.error('שגיאה במחיקת מוצר:', error);
            this.showNotification('❌ שגיאה במחיקת המוצר', 'error');
        }
    }

    closeProductModal() {
        document.getElementById('productModal').style.display = 'none';
        
        // איפוס הטופס
        document.getElementById('productForm').reset();
        
        // איפוס כותרת המודל
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'הוספת מוצר חדש';
        }
        
        // איפוס שדות הגדלים
        this.resetSizeInputs();
        
        // הסתרת שדות הכמות והגדלים
        const quantityFields = document.getElementById('quantity-fields');
        const sizeFields = document.getElementById('size-fields');
        const sizesSection = document.getElementById('sizes-section');
        
        if (quantityFields) quantityFields.style.display = 'none';
        if (sizeFields) sizeFields.style.display = 'none';
        if (sizesSection) sizesSection.style.display = 'none';
    }

    closeDeleteModal() {
        document.getElementById('delete-modal').style.display = 'none';
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

    async backupProducts() {
        try {
            const backupData = {
                products: this.products,
                categories: this.categories,
                backupDate: new Date().toISOString(),
                totalProducts: Object.keys(this.products).length,
                sizeProducts: Object.values(this.products).filter(p => p.type === 'size').length,
                quantityProducts: Object.values(this.products).filter(p => p.type === 'quantity').length,
                unitProducts: Object.values(this.products).filter(p => p.type === 'unit').length,
                noQuantityProducts: Object.values(this.products).filter(p => !p.type || p.type === 'none').length
            };
            
            localStorage.setItem('products_backup', JSON.stringify(backupData));
            this.updateStats();
            
            this.showNotification('✅ גיבוי נוצר בהצלחה', 'success');
            
        } catch (error) {
            console.error('שגיאה ביצירת גיבוי:', error);
            this.showNotification('❌ שגיאה ביצירת הגיבוי', 'error');
        }
    }

    async refreshProducts() {
        try {
            await this.loadProducts();
            this.displayProducts();
            this.updateStats();
            
            this.showNotification('✅ מוצרים רועננו בהצלחה', 'success');
            
        } catch (error) {
            console.error('שגיאה ברענון מוצרים:', error);
            this.showNotification('❌ שגיאה ברענון המוצרים', 'error');
        }
    }

    async exportProducts() {
        try {
            const data = {
                products: this.products,
                categories: this.categories,
                exportDate: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `products_export_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            this.showNotification('✅ מוצרים יוצאו בהצלחה', 'success');
            
        } catch (error) {
            console.error('שגיאה בייצוא מוצרים:', error);
            this.showNotification('❌ שגיאה בייצוא המוצרים', 'error');
        }
    }

    async importProducts() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => this.handleFileImport(event);
        input.click();
    }

    async handleFileImport(event) {
        try {
            const file = event.target.files[0];
            if (!file) return;
            
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (data.products && data.categories) {
                this.products = data.products;
                this.categories = { ...this.categories, ...data.categories };
                
                this.displayProducts();
                this.updateStats();
                
                // הצגת הודעת הצלחה
                const notification = document.createElement('div');
                notification.className = 'system-notification success show';
                notification.innerHTML = `
                    <span class="notification-message">✅ מוצרים יובאו בהצלחה</span>
                    <span class="notification-close" onclick="this.parentElement.remove()">&times;</span>
                `;
                
                const container = document.getElementById('notifications-container');
                if (container) {
                    container.appendChild(notification);
                    
                    // הסרת ההודעה אחרי 3 שניות
                    setTimeout(() => {
                        if (notification.parentElement) {
                            notification.remove();
                        }
                    }, 3000);
                }
                
            } else {
                // הצגת הודעת שגיאה
                const notification = document.createElement('div');
                notification.className = 'system-notification error show';
                notification.innerHTML = `
                    <span class="notification-message">❌ קובץ לא תקין</span>
                    <span class="notification-close" onclick="this.parentElement.remove()">&times;</span>
                `;
                
                const container = document.getElementById('notifications-container');
                if (container) {
                    container.appendChild(notification);
                    
                    // הסרת ההודעה אחרי 5 שניות
                    setTimeout(() => {
                        if (notification.parentElement) {
                            notification.remove();
                        }
                    }, 5000);
                }
            }
            
        } catch (error) {
            console.error('שגיאה בייבוא קובץ:', error);
            
            // הצגת הודעת שגיאה
            const notification = document.createElement('div');
            notification.className = 'system-notification error show';
            notification.innerHTML = `
                <span class="notification-message">❌ שגיאה בייבוא הקובץ</span>
                <span class="notification-close" onclick="this.parentElement.remove()">&times;</span>
            `;
            
            const container = document.getElementById('notifications-container');
            if (container) {
                container.appendChild(notification);
                
                // הסרת ההודעה אחרי 5 שניות
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 5000);
            }
        }
    }

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

        // שינוי תצוגת שדות לפי סוג מוצר
        const typeSelect = document.getElementById('productType');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => this.toggleQuantityFields());
            // הפעלה ראשונית
            this.toggleQuantityFields();
        }
    }

    // פונקציה חדשה להצגת הודעות
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `system-notification ${type} show`;
        notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <span class="notification-close" onclick="this.parentElement.remove()">&times;</span>
        `;
        
        const container = document.getElementById('notifications-container');
        if (container) {
            container.appendChild(notification);
            
            // הסרת ההודעה אחרי 5 שניות
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 5000);
        }
    }

    // פונקציה חדשה ליצירת מוצרים ברירת מחדל
    createDefaultProducts() {
        this.products = {
            "10000": {
                name: "מוצר לדוגמה",
                category: "kitchen",
                type: "none",
                quantity: "20 יחידות",
                price: "50 שח",
                searchName: "מוצר לדוגמה",
                sizes: []
            }
        };
        this.showNotification('⚠️ נוצרו מוצרים ברירת מחדל', 'warning');
        this.displayProducts();
        this.updateStats();
    }

    // פונקציה לבדיקה אם קוד מוצר קיים כבר
    isProductCodeExists(code) {
        return this.products[code.toString()] !== undefined;
    }

    // פונקציה לקבלת קוד מוצר פנוי
    getNextAvailableCode() {
        return this.generateProductCode();
    }

    // פונקציה לשמירת מוצרים לקובץ JSON
    async saveProductsToFile() {
        try {
            // יצירת מבנה נתונים זהה למבנה המקורי
            const dataToSave = {
                products: this.products,
                categories: this.categories
            };
            
            // יצירת קובץ להורדה
            const dataStr = JSON.stringify(dataToSave, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            // יצירת קישור להורדה
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = 'products.json';
            link.click();
            
            // ניקוי הזיכרון
            URL.revokeObjectURL(link.href);
            
            this.showNotification('✅ קובץ המוצרים הורד בהצלחה', 'success');
            
        } catch (error) {
            console.error('שגיאה בשמירת קובץ:', error);
            this.showNotification('❌ שגיאה בשמירת הקובץ', 'error');
        }
    }

    // פונקציה לטעינת מוצרים מקובץ JSON
    async loadProductsFromFile(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!data.products) {
                throw new Error('קובץ לא מכיל מוצרים תקינים');
            }
            
            this.products = data.products;
            if (data.categories) {
                this.categories = { ...this.categories, ...data.categories };
            }
            
            this.displayProducts();
            this.updateStats();
            this.showNotification('✅ מוצרים נטענו מהקובץ בהצלחה', 'success');
            
        } catch (error) {
            console.error('שגיאה בטעינת קובץ:', error);
            this.showNotification('❌ שגיאה בטעינת הקובץ - בדוק שהפורמט תקין', 'error');
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ProductManager();
});
