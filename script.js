function copyBakerySummary() {
    const orderNumber = localStorage.getItem("orderNumber") || "";
    const orderDate = localStorage.getItem("orderDate") || "";
    const orderDay = getDayOfWeek(orderDate);
    const orderTime = document.getElementById("orderTime").value;
    
    // מקבל את כל הפריטים מקטגוריית הקונדיטוריה
    const bakeryItems = Array.from(document.getElementById("bakeryList").children)
        .map(li => li.firstElementChild.textContent.replace(/\(מק"ט: \d+\)/g, '').trim());

    if (bakeryItems.length > 0) {
        const bakerySummary = `
*ליום ${orderDay} עד השעה: ${orderTime}*

מיהודה

${bakeryItems.join('\n')}

(הזמנה מס' *${orderNumber}*)`;
        
        navigator.clipboard.writeText(bakerySummary.trim())
            .then(() => {
                showCopyNotification("סיכום קונדיטוריה הועתק בהצלחה!");
            })
            .catch((err) => {
                console.error("שגיאה בהעתקה:", err);
                showCopyNotification("שגיאה בהעתקת סיכום קונדיטוריה.", true);
            });
    } else {
        showNotification("אין פריטי קונדיטוריה בהזמנה.", "red"); // הודעת שגיאה
    }
}

// WhatsApp functionality
function openWhatsAppModal() {
    const modal = document.getElementById('whatsappModal');
    const waEditable = document.getElementById('waEditable');
    if (!modal || !waEditable) {
        console.error('Modal elements not found!');
        return;
    }
    // יצירת הודעה בפורמט וואטסאפ עם ריווח בין שורות במטבח ורווח לפני כל כותרת
    const orderNumber = localStorage.getItem("orderNumber") || "";
    const orderDate = localStorage.getItem("orderDate") || "";
    const orderTime = localStorage.getItem("orderTime") || "";
    const temperature = localStorage.getItem("temperature") || "";
    const formattedDate = orderDate ? formatDateToDDMMYYYY(orderDate) : "";
    const categories = ["kitchen", "bakery", "online", "warehouse"];
    const hasProducts = categories.some((category) => {
        return document.getElementById(`${category}List`).children.length > 0;
    });
    if (!hasProducts) {
        showNotification("אין מוצרים בסיכום ההזמנה.", "red");
        return;
    }
    let message = `<b>הזמנה מס: ${orderNumber}</b>\n<b>תאריך: ${formattedDate}</b>\n<b>שעה: ${orderTime}</b>\n`;
    let firstCategory = true;
    categories.forEach((category) => {
        const categoryItems = Array.from(document.getElementById(`${category}List`).children)
            .map((li) => {
                let text = li.firstElementChild.textContent;
                text = text.replace(/\(מק"ט: \d+\)/g, '')
                          .replace(/\|BREAD_TYPE:(ביס (שומשום|בריוש|קמח מלא|דגנים|פרג))\|/g, ' $1')
                          .replace(/\s{2,}/g, ' ')
                          .trim();
                return text;
            })
            .filter((text) => text.trim() !== "");
        if (categoryItems.length > 0) {
            // רווח שורה לפני כל כותרת קטגוריה
            message += `\n<b>${getCategoryTitle(category)}:</b>\n`;
            // ריווח בין שורות רק במטבח
            if (category === 'kitchen') {
                message += categoryItems.map(item => item).join("\n<br><br>") + "\n";
            } else {
                message += categoryItems.join("\n") + "\n";
            }
        }
    });
    if (temperature) {
        message += `\n<b>הערות:</b> <b>"${temperature}"</b>\n`;
    }
    // ניקוי רווחים מיותרים בסוף כל שורה ובסוף ההודעה
    message = message.split('\n').map(line => line.replace(/\s+$/g, '').replace(/\s{2,}/g, ' ')).join('\n').trim();
    // המרה ל-html (הדגשה וכד')
    waEditable.innerHTML = message.replace(/\n/g, '<br>');
    modal.style.display = 'block';
    waEditable.focus();
}

function closeWhatsAppModal() {
    const modal = document.getElementById('whatsappModal');
    if (modal) {
        modal.style.display = "none";
    }
}

// משתנים גלובליים למעקב אחר הודעות
let lastSentMessage = null;
let isSendingMessage = false;
let pendingMessage = null;
let lastSentFruitsMessage = null;
let isSendingFruitsMessage = false;
let pendingFruitsMessage = null;

// איפוס המשתנים בטעינת הדף
window.addEventListener('DOMContentLoaded', function() {
    // איפוס משתני הודעות
    lastSentMessage = null;
    isSendingMessage = false;
    pendingMessage = null;
    lastSentFruitsMessage = null;
    isSendingFruitsMessage = false;
    pendingFruitsMessage = null;
    
    // הסתרת כל המודלים בטעינה
    const modals = [
        'whatsappModal',
        'whatsappFruitsModal',
        'duplicateMessageModal',
        'duplicateFruitsModal'
    ];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    });
});

function sendWhatsAppMessage() {
    const waEditable = document.getElementById('waEditable');
    const sendButton = document.querySelector('.send-btn');
    
    if (!waEditable) {
        showNotification('שגיאה: לא נמצא אזור עריכה', 'red');
        return;
    }

    // בדיקה אם ההודעה זהה להודעה האחרונה שנשלחה
    const currentMessage = waEditable.innerHTML;
    if (lastSentMessage === currentMessage && lastSentMessage !== null) {
        pendingMessage = currentMessage;
        showDuplicateMessageModal();
        return;
    }

    // המרת HTML לטקסט עם כוכביות (הדגשה) ושמירה על רווחים כפולים
    let message = waEditable.innerHTML
        .replace(/<br><br>/g, '\n\n')
        .replace(/<div>/g, '\n')
        .replace(/<br>/g, '\n')
        .replace(/<b>(.*?)<\/b>/g, '*$1*')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (!message) {
        showNotification('אנא הכנס הודעה', 'error');
        return;
    }

    // מניעת שליחה כפולה
    if (isSendingMessage) {
        showNotification('שליחה בתהליך, אנא המתן...', 'info');
        return;
    }

    sendMessageToWhatsApp(message, currentMessage);
}

function sendMessageToWhatsApp(message, currentMessage) {
    const sendButton = document.querySelector('.send-btn');
    
    // עדכון מצב הכפתור
    isSendingMessage = true;
    sendButton.disabled = true;
    sendButton.innerHTML = '<span class="loading-spinner"></span> שולח...';
    showNotification('שולח הודעה...', 'info');
    
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            message,
            groupId: "120363414923943659@g.us" // קבוצת הקונדיטוריה
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('שגיאה בשליחת ההודעה');
        return response.json();
    })
    .then(() => {
        showNotification('✅ ההודעה נשלחה בהצלחה!', 'green');
        closeWhatsAppModal();
        // שמירת ההודעה האחרונה שנשלחה
        lastSentMessage = currentMessage;
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('❌ שגיאה בשליחת ההודעה', 'red');
    })
    .finally(() => {
        // איפוס מצב הכפתור
        isSendingMessage = false;
        sendButton.disabled = false;
        sendButton.innerHTML = 'שלח לוואטסאפ';
    });
}

function showDuplicateMessageModal() {
    const modal = document.getElementById('duplicateMessageModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeDuplicateModal() {
    const modal = document.getElementById('duplicateMessageModal');
    if (modal) {
        modal.style.display = 'none';
        pendingMessage = null;
    }
}

function confirmResend() {
    if (pendingMessage) {
        const message = pendingMessage
            .replace(/<br><br>/g, '\n\n')
            .replace(/<div>/g, '\n')
            .replace(/<br>/g, '\n')
            .replace(/<b>(.*?)<\/b>/g, '*$1*')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
            
        sendMessageToWhatsApp(message, pendingMessage);
        closeDuplicateModal();
    }
}

// סגירת המודל בלחיצה מחוץ לתוכן
window.onclick = function(event) {
    const modals = {
        'whatsappModal': closeWhatsAppModal,
        'whatsappFruitsModal': closeWhatsAppFruitsModal,
        'duplicateMessageModal': closeDuplicateModal,
        'duplicateFruitsModal': closeDuplicateFruitsModal
    };
    
    Object.entries(modals).forEach(([modalId, closeFunction]) => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            closeFunction();
        }
    });
}

window.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('whatsappModal');
  if (modal) modal.style.display = 'none';
});

// Helper function to get day of week
function getDayOfWeek(dateStr) {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const date = new Date(dateStr);
    return days[date.getDay()];
}

// Helper function to show notifications
function showNotification(message, color = "green") {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 20px';
    notification.style.backgroundColor = color;
    notification.style.color = 'white';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '1000';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function copyCurrentSummary() {
    const waEditable = document.getElementById('waEditable');
    if (!waEditable) {
        showNotification('שגיאה: לא נמצא אזור עריכה', 'red');
        return;
    }
    // המרת HTML לטקסט עם כוכביות (הדגשה) ושמירה על רווחים כפולים
    let message = waEditable.innerHTML
        .replace(/<br><br>/g, '\n\n')
        .replace(/<div>/g, '\n')
        .replace(/<br>/g, '\n')
        .replace(/<b>(.*?)<\/b>/g, '*$1*')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (!message) {
        showNotification('אין מה להעתיק', 'red');
        return;
    }
    navigator.clipboard.writeText(message)
        .then(() => {
            showNotification('הסיכום הועתק בהצלחה!', 'green');
        })
        .catch(() => {
            showNotification('שגיאה בהעתקת הסיכום', 'red');
        });
}

function newOrder() {
    // איפוס כל השדות
    document.getElementById("orderNumber").value = "";
    document.getElementById("orderDate").value = "";
    document.getElementById("orderTime").value = "";
    document.getElementById("temperature").value = "";
    document.getElementById("notesSummary").value = "";
    
    // ניקוי כל הרשימות
    document.getElementById("kitchenList").innerHTML = "";
    document.getElementById("bakeryList").innerHTML = "";
    document.getElementById("onlineList").innerHTML = "";
    document.getElementById("warehouseList").innerHTML = "";
    document.getElementById("sushiList").innerHTML = "";
    
    // איפוס משתני הזיכרון של הודעות
    lastSentMessage = null;
    isSendingMessage = false;
    pendingMessage = null;
    
    // הסתרת המודלים
    const whatsappModal = document.getElementById('whatsappModal');
    const duplicateModal = document.getElementById('duplicateMessageModal');
    if (whatsappModal) whatsappModal.style.display = 'none';
    if (duplicateModal) duplicateModal.style.display = 'none';
    
    // איפוס שדות קלט נוספים
    resetInputFields();
    
    // עדכון הממשק
    updateSelectedRadio();
    showNotification("הזמנה חדשה נוצרה בהצלחה!", "green");
}

// פונקציה לפתיחת מודל וואטסאפ פירות
function openWhatsAppFruitsModal() {
    const modal = document.getElementById('whatsappFruitsModal');
    const waEditable = document.getElementById('waEditableFruits');
    
    if (!modal || !waEditable) {
        console.error('Modal elements not found!');
        return;
    }

    // יצירת סיכום פירות
    const orderNumber = localStorage.getItem("orderNumber") || "";
    const orderDate = localStorage.getItem("orderDate") || "";
    const orderDay = getDayOfWeek(orderDate);
    const orderTime = document.getElementById("orderTime").value;
    
    // מקבל את כל הפריטים מקטגוריית הפירות
    const fruitItems = getFruitItems();

    if (fruitItems.length > 0) {
        const fruitSummary = `*ליום ${orderDay} עד השעה: ${orderTime}*\n\nמיהודה\n\n${fruitItems.join('\n')}\n\n(הזמנה מס' *${orderNumber}*)`;
        
        // המרה ל-HTML עם הדגשות נכונות לוואטסאפ
        const htmlSummary = fruitSummary
            .replace(/\*([^*]+)\*/g, '<b>$1</b>')
            .replace(/\n/g, '<br>');
        waEditable.innerHTML = htmlSummary;
        modal.style.display = 'block';
        waEditable.focus();
    } else {
        showNotification("אין פריטי פירות בהזמנה.", "red");
    }
}

function closeWhatsAppFruitsModal() {
    const modal = document.getElementById('whatsappFruitsModal');
    if (modal) {
        modal.style.display = "none";
    }
}

function showDuplicateFruitsModal() {
    const modal = document.getElementById("duplicateFruitsModal");
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeDuplicateFruitsModal() {
    const modal = document.getElementById("duplicateFruitsModal");
    if (modal) {
        modal.style.display = 'none';
        pendingFruitsMessage = null;
    }
}

// פונקציה לשליחת הודעת פירות
function sendWhatsAppFruitsMessage() {
    const waEditable = document.getElementById('waEditableFruits');
    const sendButton = document.querySelector('.send-fruits-btn');
    
    if (!waEditable) {
        showNotification('שגיאה: לא נמצא אזור עריכה', 'red');
        return;
    }

    // בדיקה אם ההודעה זהה להודעה האחרונה שנשלחה
    const currentMessage = waEditable.innerHTML;
    if (lastSentFruitsMessage === currentMessage && lastSentFruitsMessage !== null) {
        pendingFruitsMessage = currentMessage;
        showDuplicateFruitsModal();
        return;
    }

    // המרת HTML לטקסט עם כוכביות (הדגשה) ושמירה על רווחים כפולים
    let message = waEditable.innerHTML
        .replace(/<br><br>/g, '\n\n')
        .replace(/<div>/g, '\n')
        .replace(/<br>/g, '\n')
        .replace(/<b>(.*?)<\/b>/g, '*$1*')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (!message) {
        showNotification('אנא הכנס הודעה', 'error');
        return;
    }

    // מניעת שליחה כפולה
    if (isSendingFruitsMessage) {
        showNotification('שליחה בתהליך, אנא המתן...', 'info');
        return;
    }

    // עדכון מצב הכפתור
    isSendingFruitsMessage = true;
    sendButton.disabled = true;
    sendButton.innerHTML = '<span class="loading-spinner"></span> שולח...';
    showNotification('שולח הודעה...', 'info');
    
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            message,
            groupId: "120363314468223287@g.us" // קבוצת הפירות
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('שגיאה בשליחת ההודעה');
        return response.json();
    })
    .then(() => {
        showNotification('✅ ההודעה נשלחה בהצלחה!', 'green');
        closeWhatsAppFruitsModal();
        // שמירת ההודעה האחרונה שנשלחה
        lastSentFruitsMessage = currentMessage;
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('❌ שגיאה בשליחת ההודעה', 'red');
    })
    .finally(() => {
        // איפוס מצב הכפתור
        isSendingFruitsMessage = false;
        sendButton.disabled = false;
        sendButton.innerHTML = 'שלח לוואטסאפ';
    });
}

function confirmFruitsResend() {
    if (pendingFruitsMessage) {
        // איפוס ההודעה האחרונה שנשלחה כדי לאפשר שליחה חוזרת
        lastSentFruitsMessage = null;
        
        // שליחת ההודעה
        const waEditable = document.getElementById('waEditableFruits');
        if (waEditable) {
            waEditable.innerHTML = pendingFruitsMessage;
            sendWhatsAppFruitsMessage();
        }
        
        closeDuplicateFruitsModal();
    }
}

// משתנים גלובליים למעקב אחר הודעות קונדיטוריה
let lastSentBakeryMessage = null;
let isSendingBakeryMessage = false;
let pendingBakeryMessage = null;

// איפוס המשתנים בטעינת הדף
window.addEventListener('DOMContentLoaded', function() {
    lastSentBakeryMessage = null;
    isSendingBakeryMessage = false;
    pendingBakeryMessage = null;
    // ... existing code ...
    const bakeryModals = [
        'whatsappBakeryModal',
        'duplicateBakeryModal'
    ];
    bakeryModals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    });
});

function openWhatsAppBakeryModal() {
    const modal = document.getElementById('whatsappBakeryModal');
    const waEditable = document.getElementById('waEditableBakery');
    if (!modal || !waEditable) {
        console.error('Modal elements not found!');
        return;
    }
    const orderNumber = localStorage.getItem("orderNumber") || "";
    const orderDate = localStorage.getItem("orderDate") || "";
    const orderDay = getDayOfWeek(orderDate);
    const orderTime = document.getElementById("orderTime").value;
    const bakeryItems = Array.from(document.getElementById("bakeryList").children)
        .map(li => li.firstElementChild.textContent.replace(/\(מק"ט: \d+\)/g, '').trim());
    if (bakeryItems.length > 0) {
        const bakerySummary = `*ליום ${orderDay} עד השעה: ${orderTime}*\n\nמיהודה\n\n${bakeryItems.join('\n')}\n\n(הזמנה מס' *${orderNumber}*)`;
        // המרה ל-HTML עם הדגשות נכונות לוואטסאפ
        const htmlSummary = bakerySummary
            .replace(/\*([^*]+)\*/g, '<b>$1</b>')
            .replace(/\n/g, '<br>');
        waEditable.innerHTML = htmlSummary;
        modal.style.display = 'block';
        waEditable.focus();
    } else {
        showNotification("אין פריטי קונדיטוריה בהזמנה.", "red");
    }
}

function closeWhatsAppBakeryModal() {
    const modal = document.getElementById('whatsappBakeryModal');
    if (modal) {
        modal.style.display = "none";
    }
}

function showDuplicateBakeryModal() {
    const modal = document.getElementById("duplicateBakeryModal");
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeDuplicateBakeryModal() {
    const modal = document.getElementById("duplicateBakeryModal");
    if (modal) {
        modal.style.display = 'none';
        pendingBakeryMessage = null;
    }
}

function sendWhatsAppBakeryMessage() {
    const waEditable = document.getElementById('waEditableBakery');
    const sendButton = document.querySelector('.send-bakery-btn');
    if (!waEditable) {
        showNotification('שגיאה: לא נמצא אזור עריכה', 'red');
        return;
    }
    const currentMessage = waEditable.innerHTML;
    if (lastSentBakeryMessage === currentMessage && lastSentBakeryMessage !== null) {
        pendingBakeryMessage = currentMessage;
        showDuplicateBakeryModal();
        return;
    }
    let message = waEditable.innerHTML
        .replace(/<br><br>/g, '\n\n')
        .replace(/<div>/g, '\n')
        .replace(/<br>/g, '\n')
        .replace(/<b>(.*?)<\/b>/g, '*$1*')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (!message) {
        showNotification('אנא הכנס הודעה', 'error');
        return;
    }
    if (isSendingBakeryMessage) {
        showNotification('שליחה בתהליך, אנא המתן...', 'info');
        return;
    }
    isSendingBakeryMessage = true;
    sendButton.disabled = true;
    sendButton.innerHTML = '<span class="loading-spinner"></span> שולח...';
    showNotification('שולח הודעה...', 'info');
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            message,
            groupId: "120363314468223287@g.us" // קבוצת הקונדיטוריה
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('שגיאה בשליחת ההודעה');
        return response.json();
    })
    .then(() => {
        showNotification('✅ ההודעה נשלחה בהצלחה!', 'green');
        closeWhatsAppBakeryModal();
        lastSentBakeryMessage = currentMessage;
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('❌ שגיאה בשליחת ההודעה', 'red');
    })
    .finally(() => {
        isSendingBakeryMessage = false;
        sendButton.disabled = false;
        sendButton.innerHTML = 'שלח לוואטסאפ';
    });
}

function confirmBakeryResend() {
    if (pendingBakeryMessage) {
        lastSentBakeryMessage = null;
        const waEditable = document.getElementById('waEditableBakery');
        if (waEditable) {
            waEditable.innerHTML = pendingBakeryMessage;
            sendWhatsAppBakeryMessage();
        }
        closeDuplicateBakeryModal();
    }
}

// סגירת מודל קונדיטוריה בלחיצה על overlay
window.addEventListener('DOMContentLoaded', function() {
    const bakeryModal = document.getElementById('whatsappBakeryModal');
    if (bakeryModal) {
        bakeryModal.addEventListener('mousedown', function(e) {
            if (e.target === bakeryModal) {
                closeWhatsAppBakeryModal();
            }
        });
    }
});

// משתנים גלובליים למעקב אחר הודעות עמר
let lastSentAmarMessage = null;
let isSendingAmarMessage = false;
let pendingAmarMessage = null;

window.addEventListener('DOMContentLoaded', function() {
    lastSentAmarMessage = null;
    isSendingAmarMessage = false;
    pendingAmarMessage = null;
    const amarModals = [
        'whatsappAmarModal',
        'duplicateAmarModal'
    ];
    amarModals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    });
    // סגירת מודל עמר בלחיצה על overlay
    const amarModal = document.getElementById('whatsappAmarModal');
    if (amarModal) {
        amarModal.addEventListener('mousedown', function(e) {
            if (e.target === amarModal) {
                closeWhatsAppAmarModal();
            }
        });
    }
});

function closeWhatsAppAmarModal() {
    const modal = document.getElementById('whatsappAmarModal');
    if (modal) {
        modal.style.display = "none";
    }
}

function showDuplicateAmarModal() {
    const modal = document.getElementById("duplicateAmarModal");
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeDuplicateAmarModal() {
    const modal = document.getElementById("duplicateAmarModal");
    if (modal) {
        modal.style.display = 'none';
        pendingAmarMessage = null;
    }
}

function sendWhatsAppAmarMessage() {
    const waEditable = document.getElementById('waEditableAmar');
    const sendButton = document.querySelector('.send-amar-btn');
    if (!waEditable) {
        showNotification('שגיאה: לא נמצא אזור עריכה', 'red');
        return;
    }
    const currentMessage = waEditable.innerHTML;
    if (lastSentAmarMessage === currentMessage && lastSentAmarMessage !== null) {
        pendingAmarMessage = currentMessage;
        showDuplicateAmarModal();
        return;
    }
    let message = waEditable.innerHTML
        .replace(/<br><br>/g, '\n\n')
        .replace(/<div>/g, '\n')
        .replace(/<br>/g, '\n')
        .replace(/<b>(.*?)<\/b>/g, '*$1*')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (!message) {
        showNotification('אנא הכנס הודעה', 'error');
        return;
    }
    if (isSendingAmarMessage) {
        showNotification('שליחה בתהליך, אנא המתן...', 'info');
        return;
    }
    isSendingAmarMessage = true;
    sendButton.disabled = true;
    sendButton.innerHTML = '<span class="loading-spinner"></span> שולח...';
    showNotification('שולח הודעה...', 'info');
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            message,
            groupId: "120363314468223287@g.us" // קבוצת עמר
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('שגיאה בשליחת ההודעה');
        return response.json();
    })
    .then(() => {
        showNotification('✅ ההודעה נשלחה בהצלחה!', 'green');
        closeWhatsAppAmarModal();
        lastSentAmarMessage = currentMessage;
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('❌ שגיאה בשליחת ההודעה', 'red');
    })
    .finally(() => {
        isSendingAmarMessage = false;
        sendButton.disabled = false;
        sendButton.innerHTML = 'שלח לוואטסאפ';
    });
}

function confirmAmarResend() {
    if (pendingAmarMessage) {
        lastSentAmarMessage = null;
        const waEditable = document.getElementById('waEditableAmar');
        if (waEditable) {
            waEditable.innerHTML = pendingAmarMessage;
            sendWhatsAppAmarMessage();
        }
        closeDuplicateAmarModal();
    }
}
// משתנים גלובליים למעקב אחר הודעות סושי
let lastSentSushiMessage = null;
let isSendingSushiMessage = false;
let pendingSushiMessage = null;

function closeWhatsAppSushiModal() {
    const modal = document.getElementById('whatsappSushiModal');
    if (modal) {
        modal.style.display = "none";
    }
}

function showDuplicateSushiModal() {
    const modal = document.getElementById("duplicateSushiModal");
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeDuplicateSushiModal() {
    const modal = document.getElementById("duplicateSushiModal");
    if (modal) {
        modal.style.display = 'none';
        pendingSushiMessage = null;
    }
}

function sendWhatsAppSushiMessage() {
    const waEditable = document.getElementById('waEditableSushi');
    const sendButton = document.querySelector('.send-sushi-btn');
    
    if (!waEditable) {
        showNotification('שגיאה: לא נמצא אזור עריכה', 'red');
        return;
    }

    // בדיקה אם ההודעה זהה להודעה האחרונה שנשלחה
    const currentMessage = waEditable.innerHTML;
    if (lastSentSushiMessage === currentMessage && lastSentSushiMessage !== null) {
        pendingSushiMessage = currentMessage;
        showDuplicateSushiModal();
        return;
    }

    // המרת HTML לטקסט עם כוכביות (הדגשה) ושמירה על רווחים כפולים
    let message = waEditable.innerHTML
        .replace(/<br><br>/g, '\n\n')
        .replace(/<div>/g, '\n')
        .replace(/<br>/g, '\n')
        .replace(/<b>(.*?)<\/b>/g, '*$1*')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (!message) {
        showNotification('אנא הכנס הודעה', 'error');
        return;
    }

    // מניעת שליחה כפולה
    if (isSendingSushiMessage) {
        showNotification('שליחה בתהליך, אנא המתן...', 'info');
        return;
    }

    // עדכון מצב הכפתור
    isSendingSushiMessage = true;
    sendButton.disabled = true;
    sendButton.innerHTML = '<span class="loading-spinner"></span> שולח...';
    showNotification('שולח הודעה...', 'info');
    
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            message,
            groupId: "120363314468223287@g.us" // קבוצת הסושי
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('שגיאה בשליחת ההודעה');
        return response.json();
    })
    .then(() => {
        showNotification('✅ ההודעה נשלחה בהצלחה!', 'green');
        closeWhatsAppSushiModal();
        // שמירת ההודעה האחרונה שנשלחה
        lastSentSushiMessage = currentMessage;
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('❌ שגיאה בשליחת ההודעה', 'red');
    })
    .finally(() => {
        isSendingSushiMessage = false;
        sendButton.disabled = false;
        sendButton.innerHTML = 'שלח לוואטסאפ';
    });
}

function confirmSushiResend() {
    if (pendingSushiMessage) {
        lastSentSushiMessage = null;
        const waEditable = document.getElementById('waEditableSushi');
        if (waEditable) {
            waEditable.innerHTML = pendingSushiMessage;
            sendWhatsAppSushiMessage();
        }
        closeDuplicateSushiModal();
    }
}

// הוספת מאזינים למודל סושי
window.addEventListener('DOMContentLoaded', function() {
    lastSentSushiMessage = null;
    isSendingSushiMessage = false;
    pendingSushiMessage = null;
    
    const sushiModals = [
        'whatsappSushiModal',
        'duplicateSushiModal'
    ];
    sushiModals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    });
    
    // סגירת מודל סושי בלחיצה על overlay
    const sushiModal = document.getElementById('whatsappSushiModal');
    if (sushiModal) {
        sushiModal.addEventListener('mousedown', function(e) {
            if (e.target === sushiModal) {
                closeWhatsAppSushiModal();
            }
        });
    }
});




// משתנים גלובליים למעקב אחר הודעות מחסן
let lastSentWarehouseMessage = null;
let isSendingWarehouseMessage = false;
let pendingWarehouseMessage = null;

function closeWhatsAppWarehouseModal() {
    const modal = document.getElementById('whatsappWarehouseModal');
    if (modal) {
        modal.style.display = "none";
    }
}

function showDuplicateWarehouseModal() {
    const modal = document.getElementById("duplicateWarehouseModal");
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeDuplicateWarehouseModal() {
    const modal = document.getElementById("duplicateWarehouseModal");
    if (modal) {
        modal.style.display = 'none';
        pendingWarehouseMessage = null;
    }
}

function sendWhatsAppWarehouseMessage() {
    const waEditable = document.getElementById('waEditableWarehouse');
    const sendButton = document.querySelector('.send-warehouse-btn');
    
    if (!waEditable) {
        showNotification('שגיאה: לא נמצא אזור עריכה', 'red');
        return;
    }

    // בדיקה אם ההודעה זהה להודעה האחרונה שנשלחה
    const currentMessage = waEditable.innerHTML;
    if (lastSentWarehouseMessage === currentMessage && lastSentWarehouseMessage !== null) {
        pendingWarehouseMessage = currentMessage;
        showDuplicateWarehouseModal();
        return;
    }

    // המרת HTML לטקסט עם כוכביות (הדגשה) ושמירה על רווחים כפולים
    let message = waEditable.innerHTML
        .replace(/<br><br>/g, '\n\n')
        .replace(/<div>/g, '\n')
        .replace(/<br>/g, '\n')
        .replace(/<b>(.*?)<\/b>/g, '*$1*')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (!message) {
        showNotification('אנא הכנס הודעה', 'error');
        return;
    }

    // מניעת שליחה כפולה
    if (isSendingWarehouseMessage) {
        showNotification('שליחה בתהליך, אנא המתן...', 'info');
        return;
    }

    // עדכון מצב הכפתור
    isSendingWarehouseMessage = true;
    sendButton.disabled = true;
    sendButton.innerHTML = '<span class="loading-spinner"></span> שולח...';
    showNotification('שולח הודעה...', 'info');
    
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            message,
            groupId: "120363314468223287@g.us" // קבוצת המחסן
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('שגיאה בשליחת ההודעה');
        return response.json();
    })
    .then(() => {
        showNotification('✅ ההודעה נשלחה בהצלחה!', 'green');
        closeWhatsAppWarehouseModal();
        // שמירת ההודעה האחרונה שנשלחה
        lastSentWarehouseMessage = currentMessage;
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('❌ שגיאה בשליחת ההודעה', 'red');
    })
    .finally(() => {
        isSendingWarehouseMessage = false;
        sendButton.disabled = false;
        sendButton.innerHTML = 'שלח לוואטסאפ';
    });
}

function confirmWarehouseResend() {
    if (pendingWarehouseMessage) {
        lastSentWarehouseMessage = null;
        const waEditable = document.getElementById('waEditableWarehouse');
        if (waEditable) {
            waEditable.innerHTML = pendingWarehouseMessage;
            sendWhatsAppWarehouseMessage();
        }
        closeDuplicateWarehouseModal();
    }
}

// הוספת מאזינים למודל מחסן
window.addEventListener('DOMContentLoaded', function() {
    lastSentWarehouseMessage = null;
    isSendingWarehouseMessage = false;
    pendingWarehouseMessage = null;
    
    const warehouseModals = [
        'whatsappWarehouseModal',
        'duplicateWarehouseModal'
    ];
    warehouseModals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    });
    
    // סגירת מודל מחסן בלחיצה על overlay
    const warehouseModal = document.getElementById('whatsappWarehouseModal');
    if (warehouseModal) {
        warehouseModal.addEventListener('mousedown', function(e) {
            if (e.target === warehouseModal) {
                closeWhatsAppWarehouseModal();
            }
        });
    }
});