// מערכת ניהול הזמנות - גולדיס
class OrderManager {
    constructor() {
        this.currentOrder = null;
        this.ordersHistory = [];
        this.init();
    }

    async init() {
        try {
            // טעינת הזמנה פעילה אם קיימת
            await this.loadCurrentOrder();
            // טעינת היסטוריית הזמנות
            await this.loadOrdersHistory();
            // עדכון הממשק
            this.updateUI();
            this.updateStats();
        } catch (error) {
            console.error('שגיאה באתחול מערכת ההזמנות:', error);
            this.showNotification('❌ שגיאה בטעינת מערכת ההזמנות', 'error');
        }
    }

    // טעינת הזמנה פעילה
    async loadCurrentOrder() {
        try {
            const response = await fetch(`${config.getApiBaseUrl()}/api/orders/current`);
            if (!response.ok) throw new Error('שגיאה בטעינת הזמנה פעילה');
            
            const data = await response.json();
            this.currentOrder = data.order;
            return this.currentOrder;
        } catch (error) {
            console.error('שגיאה בטעינת הזמנה פעילה:', error);
            return null;
        }
    }

    // טעינת היסטוריית הזמנות
    async loadOrdersHistory() {
        try {
            const response = await fetch(`${config.getApiBaseUrl()}/api/orders/history`);
            if (!response.ok) throw new Error('שגיאה בטעינת היסטוריית הזמנות');
            
            const data = await response.json();
            this.ordersHistory = data.orders || [];
            return this.ordersHistory;
        } catch (error) {
            console.error('שגיאה בטעינת היסטוריית הזמנות:', error);
            return [];
        }
    }

    // יצירת הזמנה חדשה
    async createNewOrder() {
        try {
            // בדיקה אם יש הזמנה פעילה
            if (this.currentOrder) {
                const confirm = await this.confirmAction(
                    'הזמנה פעילה קיימת',
                    'יש כבר הזמנה פעילה. האם ברצונך ליצור הזמנה חדשה? זה ימחק את ההזמנה הפעילה הנוכחית.',
                    'כן, צור חדשה',
                    'ביטול'
                );
                if (!confirm) return;
            }

            // יצירת הזמנה חדשה
            const response = await fetch(`${config.getApiBaseUrl()}/api/orders/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName: 'הזמנה חדשה',
                    items: [],
                    total: 0,
                    notes: ''
                })
            });

            if (!response.ok) throw new Error('שגיאה ביצירת הזמנה חדשה');
            
            const data = await response.json();
            this.currentOrder = data.order;
            
            this.showNotification('✅ הזמנה חדשה נוצרה בהצלחה', 'success');
            this.updateUI();
            this.updateStats();
            
            // מעבר לאתר הראשי ליצירת ההזמנה
            window.location.href = 'index.html';
            
        } catch (error) {
            console.error('שגיאה ביצירת הזמנה חדשה:', error);
            this.showNotification('❌ שגיאה ביצירת הזמנה חדשה: ' + error.message, 'error');
        }
    }

    // עריכת הזמנה פעילה
    async editCurrentOrder() {
        if (!this.currentOrder) {
            this.showNotification('❌ אין הזמנה פעילה לעריכה', 'error');
            return;
        }

        // פתיחת modal עריכה
        this.openEditModal();
    }

    // פתיחת modal עריכה
    openEditModal() {
        const modal = document.getElementById('editOrderModal');
        if (!modal) return;

        // מילוי הנתונים הנוכחיים
        document.getElementById('editCustomerName').value = this.currentOrder.customerName || '';
        document.getElementById('editOrderNotes').value = this.currentOrder.notes || '';
        
        // הצגת מוצרים בהזמנה
        this.displayOrderItems();
        
        modal.style.display = 'block';
    }

    // סגירת modal עריכה
    closeEditModal() {
        const modal = document.getElementById('editOrderModal');
        if (modal) modal.style.display = 'none';
    }

    // הצגת מוצרים בהזמנה
    displayOrderItems() {
        const container = document.getElementById('orderItemsList');
        if (!container) return;

        if (!this.currentOrder || !this.currentOrder.items || this.currentOrder.items.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">אין מוצרים בהזמנה</p>';
            return;
        }

        const itemsHtml = this.currentOrder.items.map((item, index) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: white; border-radius: 6px; margin-bottom: 8px; border: 1px solid #e9ecef;">
                <div>
                    <strong>${item.name || 'מוצר ללא שם'}</strong>
                    ${item.quantity ? `<span style="color: #6c757d;"> - כמות: ${item.quantity}</span>` : ''}
                    ${item.size ? `<span style="color: #6c757d;"> - גודל: ${item.size}</span>` : ''}
                </div>
                <div style="color: #28a745; font-weight: 600;">
                    ₪${item.price || 0}
                </div>
            </div>
        `).join('');

        container.innerHTML = itemsHtml;
    }

    // שמירת שינויים בהזמנה
    async saveOrderChanges() {
        try {
            const customerName = document.getElementById('editCustomerName').value.trim();
            const notes = document.getElementById('editOrderNotes').value.trim();

            if (!customerName) {
                this.showNotification('❌ יש להזין שם לקוח', 'error');
                return;
            }

            const response = await fetch(`${config.getApiBaseUrl()}/api/orders/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName: customerName,
                    notes: notes
                })
            });

            if (!response.ok) throw new Error('שגיאה בעדכון ההזמנה');
            
            const data = await response.json();
            this.currentOrder = data.order;
            
            this.showNotification('✅ ההזמנה עודכנה בהצלחה', 'success');
            this.closeEditModal();
            this.updateUI();
            
        } catch (error) {
            console.error('שגיאה בעדכון ההזמנה:', error);
            this.showNotification('❌ שגיאה בעדכון ההזמנה: ' + error.message, 'error');
        }
    }

    // השלמת הזמנה פעילה
    async completeCurrentOrder() {
        if (!this.currentOrder) {
            this.showNotification('❌ אין הזמנה פעילה להשלמה', 'error');
            return;
        }

        const confirm = await this.confirmAction(
            'השלמת הזמנה',
            'האם אתה בטוח שברצונך להשלים את ההזמנה? זה ישמור אותה בהיסטוריה וינקה את ההזמנה הפעילה.',
            'כן, השלם',
            'ביטול'
        );
        if (!confirm) return;

        try {
            const response = await fetch(`${config.getApiBaseUrl()}/api/orders/complete`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('שגיאה בהשלמת ההזמנה');
            
            const data = await response.json();
            
            this.showNotification('✅ ההזמנה הושלמה בהצלחה ונשמרה בהיסטוריה', 'success');
            
            // ניקוי הזמנה פעילה ועדכון הממשק
            this.currentOrder = null;
            await this.loadOrdersHistory();
            this.updateUI();
            this.updateStats();
            
        } catch (error) {
            console.error('שגיאה בהשלמת ההזמנה:', error);
            this.showNotification('❌ שגיאה בהשלמת ההזמנה: ' + error.message, 'error');
        }
    }

    // ניקוי הזמנה פעילה
    async clearCurrentOrder() {
        if (!this.currentOrder) {
            this.showNotification('❌ אין הזמנה פעילה לניקוי', 'error');
            return;
        }

        const confirm = await this.confirmAction(
            'ניקוי הזמנה',
            'האם אתה בטוח שברצונך לנקות את ההזמנה הפעילה? כל הנתונים יאבדו ולא יישמרו.',
            'כן, נקה',
            'ביטול'
        );
        if (!confirm) return;

        try {
            const response = await fetch(`${config.getApiBaseUrl()}/api/orders/clear`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('שגיאה בניקוי ההזמנה');
            
            this.showNotification('✅ ההזמנה נוקתה בהצלחה', 'success');
            
            // ניקוי הזמנה פעילה ועדכון הממשק
            this.currentOrder = null;
            this.updateUI();
            this.updateStats();
            
        } catch (error) {
            console.error('שגיאה בניקוי ההזמנה:', error);
            this.showNotification('❌ שגיאה בניקוי ההזמנה: ' + error.message, 'error');
        }
    }

    // שחזור הזמנה מהיסטוריה
    async restoreOrder(orderId) {
        if (!orderId) return;

        // פתיחת modal אישור
        this.openRestoreModal(orderId);
    }

    // פתיחת modal שחזור
    openRestoreModal(orderId) {
        const modal = document.getElementById('restoreOrderModal');
        if (!modal) return;

        // מציאת ההזמנה
        const order = this.ordersHistory.find(o => o.id === orderId);
        if (!order) {
            this.showNotification('❌ הזמנה לא נמצאה', 'error');
            return;
        }

        // הצגת פרטי ההזמנה
        const infoContainer = document.getElementById('restoreOrderInfo');
        infoContainer.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong>שם לקוח:</strong> ${order.name || 'ללא שם'}
            </div>
            <div style="margin-bottom: 10px;">
                <strong>תאריך:</strong> ${new Date(order.date || order.createdAt).toLocaleString('he-IL')}
            </div>
            <div style="margin-bottom: 10px;">
                <strong>סך הכל:</strong> ₪${order.total || 0}
            </div>
            <div>
                <strong>מוצרים:</strong> ${order.items || 0}
            </div>
        `;

        // שמירת מזהה ההזמנה
        modal.dataset.orderId = orderId;
        modal.style.display = 'block';
    }

    // סגירת modal שחזור
    closeRestoreModal() {
        const modal = document.getElementById('restoreOrderModal');
        if (modal) modal.style.display = 'none';
    }

    // אישור שחזור הזמנה
    async confirmRestore() {
        const modal = document.getElementById('restoreOrderModal');
        if (!modal) return;

        const orderId = modal.dataset.orderId;
        if (!orderId) return;

        try {
            const response = await fetch(`${config.getApiBaseUrl()}/api/orders/restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: orderId })
            });

            if (!response.ok) throw new Error('שגיאה בשחזור ההזמנה');
            
            const data = await response.json();
            this.currentOrder = data.order;
            
            this.showNotification('✅ ההזמנה שוחזרה בהצלחה', 'success');
            this.closeRestoreModal();
            this.updateUI();
            this.updateStats();
            
            // מעבר לאתר הראשי לעריכת ההזמנה המשוחזרת
            window.location.href = 'index.html';
            
        } catch (error) {
            console.error('שגיאה בשחזור ההזמנה:', error);
            this.showNotification('❌ שגיאה בשחזור ההזמנה: ' + error.message, 'error');
        }
    }

    // רענון רשימת הזמנות
    async refreshOrders() {
        try {
            this.showNotification('🔄 מרענן רשימת הזמנות...', 'info');
            
            await this.loadCurrentOrder();
            await this.loadOrdersHistory();
            
            this.updateUI();
            this.updateStats();
            
            this.showNotification('✅ רשימת הזמנות עודכנה', 'success');
            
        } catch (error) {
            console.error('שגיאה ברענון הזמנות:', error);
            this.showNotification('❌ שגיאה ברענון הזמנות: ' + error.message, 'error');
        }
    }

    // עדכון הממשק
    updateUI() {
        this.updateCurrentOrderDisplay();
        this.updateOrdersHistoryDisplay();
    }

    // עדכון תצוגת הזמנה פעילה
    updateCurrentOrderDisplay() {
        const section = document.getElementById('currentOrderSection');
        const editBtn = document.getElementById('editOrderBtn');
        const completeBtn = document.getElementById('completeOrderBtn');
        const clearBtn = document.getElementById('clearOrderBtn');

        if (this.currentOrder) {
            // הצגת הזמנה פעילה
            if (section) section.style.display = 'block';
            if (editBtn) editBtn.style.display = 'block';
            if (completeBtn) completeBtn.style.display = 'block';
            if (clearBtn) clearBtn.style.display = 'block';

            // עדכון פרטים
            document.getElementById('currentOrderCustomer').textContent = this.currentOrder.customerName || 'ללא שם';
            document.getElementById('currentOrderTotal').textContent = `₪${this.currentOrder.total || 0}`;
            document.getElementById('currentOrderItems').textContent = this.currentOrder.items ? this.currentOrder.items.length : 0;
            document.getElementById('currentOrderDate').textContent = new Date(this.currentOrder.createdAt).toLocaleString('he-IL');
        } else {
            // הסתרת הזמנה פעילה
            if (section) section.style.display = 'none';
            if (editBtn) editBtn.style.display = 'none';
            if (completeBtn) completeBtn.style.display = 'none';
            if (clearBtn) clearBtn.style.display = 'none';
        }
    }

    // עדכון תצוגת היסטוריית הזמנות
    updateOrdersHistoryDisplay() {
        const container = document.getElementById('ordersList');
        if (!container) return;

        if (this.ordersHistory.length === 0) {
            container.innerHTML = `
                <div class="no-orders">
                    <p>אין הזמנות בהיסטוריה</p>
                    <p style="font-size: 0.9rem; color: #6c757d; margin-top: 10px;">
                        צור הזמנה חדשה כדי להתחיל
                    </p>
                </div>
            `;
            return;
        }

        const ordersHtml = this.ordersHistory.map(order => `
            <div class="order-item" onclick="orderManager.viewOrderDetails('${order.id}')">
                <div class="order-item-header">
                    <h3 class="order-item-title">${order.name || 'הזמנה ללא שם'}</h3>
                    <span class="order-item-date">${new Date(order.date || order.createdAt).toLocaleString('he-IL')}</span>
                </div>
                <div class="order-item-details">
                    <div class="order-detail">
                        <div class="order-detail-label">סך הכל</div>
                        <div class="order-detail-value">₪${order.total || 0}</div>
                    </div>
                    <div class="order-detail">
                        <div class="order-detail-label">מוצרים</div>
                        <div class="order-detail-value">${order.items || 0}</div>
                    </div>
                    <div class="order-detail">
                        <div class="order-detail-label">סטטוס</div>
                        <div class="order-detail-value" style="color: #28a745;">הושלמה</div>
                    </div>
                </div>
                <div class="order-actions-buttons">
                    <button class="btn btn-success" onclick="event.stopPropagation(); orderManager.restoreOrder('${order.id}')">
                        🔄 שחזר
                    </button>
                    <button class="btn btn-primary" onclick="event.stopPropagation(); orderManager.viewOrderDetails('${order.id}')">
                        👁️ צפה
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = ordersHtml;
    }

    // צפייה בפרטי הזמנה
    viewOrderDetails(orderId) {
        const order = this.ordersHistory.find(o => o.id === orderId);
        if (!order) {
            this.showNotification('❌ הזמנה לא נמצאה', 'error');
            return;
        }

        // פתיחת modal פרטי הזמנה
        this.showOrderDetailsModal(order);
    }

    // הצגת modal פרטי הזמנה
    showOrderDetailsModal(order) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2>📋 פרטי הזמנה</h2>
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body" style="padding: 30px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div>
                            <strong>שם לקוח:</strong> ${order.name || 'ללא שם'}
                        </div>
                        <div>
                            <strong>תאריך:</strong> ${new Date(order.date || order.createdAt).toLocaleString('he-IL')}
                        </div>
                        <div>
                            <strong>סך הכל:</strong> ₪${order.total || 0}
                        </div>
                        <div>
                            <strong>מוצרים:</strong> ${order.items || 0}
                        </div>
                    </div>
                    ${order.data && order.data.notes ? `
                        <div style="margin-bottom: 20px;">
                            <strong>הערות:</strong>
                            <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-top: 5px;">
                                ${order.data.notes}
                            </div>
                        </div>
                    ` : ''}
                    <div style="text-align: center; margin-top: 30px;">
                        <button class="btn btn-success" onclick="orderManager.restoreOrder('${order.id}'); this.closest('.modal').remove();">
                            🔄 שחזר הזמנה
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove();" style="margin-right: 10px;">
                            סגור
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // סגירה בלחיצה על הרקע
        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.remove();
        });
    }

    // עדכון סטטיסטיקות
    updateStats() {
        const totalOrders = this.ordersHistory.length;
        const activeOrders = this.currentOrder ? 1 : 0;
        const today = new Date().toDateString();
        const completedToday = this.ordersHistory.filter(order => {
            const orderDate = new Date(order.date || order.createdAt).toDateString();
            return orderDate === today;
        }).length;

        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('activeOrders').textContent = activeOrders;
        document.getElementById('completedToday').textContent = completedToday;
    }

    // הצגת הודעות
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

    // אישור פעולה
    async confirmAction(title, message, confirmText = 'אישור', cancelText = 'ביטול') {
        return new Promise(resolve => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>${title}</h2>
                        <span class="close" onclick="this.closest('.modal').remove(); resolve(false)">&times;</span>
                    </div>
                    <div class="modal-body" style="padding: 30px; text-align: center;">
                        <p>${message}</p>
                    </div>
                    <div class="modal-actions" style="display: flex; gap: 15px; justify-content: center; padding: 0 30px 30px;">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove(); resolve(false)">${cancelText}</button>
                        <button class="btn btn-danger" onclick="this.closest('.modal').remove(); resolve(true)">${confirmText}</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // סגירה בלחיצה על הרקע
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.remove();
                    resolve(false);
                }
            });
        });
    }
}

// אתחול מערכת ההזמנות
document.addEventListener('DOMContentLoaded', () => {
    window.orderManager = new OrderManager();
});

// פונקציות גלובליות
function createNewOrder() {
    if (window.orderManager) {
        window.orderManager.createNewOrder();
    }
}

function editCurrentOrder() {
    if (window.orderManager) {
        window.orderManager.editCurrentOrder();
    }
}

function completeCurrentOrder() {
    if (window.orderManager) {
        window.orderManager.completeCurrentOrder();
    }
}

function clearCurrentOrder() {
    if (window.orderManager) {
        window.orderManager.clearCurrentOrder();
    }
}

function refreshOrders() {
    if (window.orderManager) {
        window.orderManager.refreshOrders();
    }
}

function restoreOrder(orderId) {
    if (window.orderManager) {
        window.orderManager.restoreOrder(orderId);
    }
}

function viewOrderDetails(orderId) {
    if (window.orderManager) {
        window.orderManager.viewOrderDetails(orderId);
    }
}
