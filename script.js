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
    let message = `*הזמנה מס: ${orderNumber}*\n*תאריך: ${formattedDate}*\n*שעה: ${orderTime}*\n`;
    let firstCategory = true;
    categories.forEach((category) => {
        const categoryItems = Array.from(document.getElementById(`${category}List`).children)
            .map((li) => {
                let text = li.firstElementChild.textContent;
                text = text.replace(/\(מק"ט: \d+\)/g, '')
                          .replace(/\|BREAD_TYPE:(ביס (שומשום|בריוש|קמח מלא|דגנים|פרג))\|/g, ' $1')
                          .replace(/\s{2,}/g, ' ')
                          .replace(/\*([^*]+)\*/g, '$1') // מסיר כוכביות מהמוצרים עצמם
                          .trim();
                return text;
            })
            .filter((text) => text.trim() !== "");
        if (categoryItems.length > 0) {
            // רווח שורה לפני כל כותרת קטגוריה
            message += `\n*${getCategoryTitle(category)}:*\n`;
            // ריווח בין שורות רק במטבח
            if (category === 'kitchen') {
                message += categoryItems.map(item => item).join("\n\n") + "\n";
            } else {
                message += categoryItems.join("\n") + "\n";
            }
        }
    });
    if (temperature) {
        message += `\n*הערות:* *\"${temperature}\"*\n`;
    }
    // ניקוי רווחים מיותרים בסוף כל שורה ובסוף ההודעה
    message = message.split('\n').map(line => line.replace(/\s+$/g, '').replace(/\s{2,}/g, ' ')).join('\n').trim();
    // המרה ל-HTML והצגה במודל
    const htmlSummary = message.replace(/\*([^*]+)\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    waEditable.innerHTML = htmlSummary;
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




window.addEventListener('click', function(event) {
    const modals = {
      'whatsappModal': closeWhatsAppModal,
      'whatsappFruitsModal': closeWhatsAppFruitsModal,
      'duplicateMessageModal': closeDuplicateModal,
      'duplicateFruitsModal': closeDuplicateFruitsModal,
      'whatsappBakeryModal': closeWhatsAppBakeryModal,
      'duplicateBakeryModal': closeDuplicateBakeryModal,
      'whatsappAmarModal': closeWhatsAppAmarModal,
      'duplicateAmarModal': closeDuplicateAmarModal,
      'whatsappSushiModal': closeWhatsAppSushiModal,
      'duplicateSushiModal': closeDuplicateSushiModal,
      'whatsappWarehouseModal': closeWhatsAppWarehouseModal,
      'duplicateWarehouseModal': closeDuplicateWarehouseModal,
      'whatsappGeneralModal': closeWhatsAppGeneralModal,
      'duplicateGeneralModal': closeDuplicateGeneralModal
    };
    Object.entries(modals).forEach(([modalId, closeFunction]) => {
      const modal = document.getElementById(modalId);
      if (modal && event.target === modal) {
        closeFunction();
      }
    });
  });

function sendWhatsAppMessage() {
    saveCurrentOrderToHistory();
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
            groupId: "120363414923943659@g.us",
            userEmail: getUserEmail()
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
        'duplicateFruitsModal': closeDuplicateFruitsModal,
        'whatsappBakeryModal': closeWhatsAppBakeryModal,
        'duplicateBakeryModal': closeDuplicateBakeryModal,
        'whatsappAmarModal': closeWhatsAppAmarModal,
        'duplicateAmarModal': closeDuplicateAmarModal,
        'whatsappSushiModal': closeWhatsAppSushiModal,
        'duplicateSushiModal': closeDuplicateSushiModal,
        'whatsappWarehouseModal': closeWhatsAppWarehouseModal,
        'duplicateWarehouseModal': closeDuplicateWarehouseModal,
        'whatsappGeneralModal': closeWhatsAppGeneralModal,
        'duplicateGeneralModal': closeDuplicateGeneralModal
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
    // שמור היסטוריה רק אם יש יותר משני מוצרים (לפני איפוס)
    const totalProducts = ['kitchenList','bakeryList','onlineList','warehouseList','amarList','sushiList']
      .map(id => {
        const ul = document.getElementById(id);
        return ul ? ul.children.length : 0;
      })
      .reduce((a, b) => a + b, 0);
    if (totalProducts > 2) saveCurrentOrderToHistory();
    
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
            groupId: "120363314468223287@g.us",
            userEmail: getUserEmail()
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
    saveCurrentOrderToHistory();
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
            groupId: "120363314468223287@g.us",
            userEmail: getUserEmail()
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
    saveCurrentOrderToHistory();
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
            groupId: "120363314468223287@g.us",
            userEmail: getUserEmail()
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
    saveCurrentOrderToHistory();
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
            groupId: "120363314468223287@g.us",
            userEmail: getUserEmail()
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
    saveCurrentOrderToHistory();
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
            groupId: "120363314468223287@g.us",
            userEmail: getUserEmail()
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




const whatsappGroupsByDay = {
    'ראשון': '120363414923943659@g.us',
    'שני': '120363414923943659@g.us',
    'שלישי': '120363414923943659@g.us',
    'רביעי': '120363414923943659@g.us',
    'חמישי': '120363414923943659@g.us',
    'שישי': '120363414923943659@g.us'
};

let lastSentGeneralMessage = null;
let isSendingGeneralMessage = false;
let pendingGeneralMessage = null;

function openWhatsAppGeneralModal() {
    const modal = document.getElementById('whatsappGeneralModal');
    const waEditable = document.getElementById('waEditableGeneral');
    const daySelect = document.getElementById('waDaySelect');
    if (!modal || !waEditable || !daySelect) return;

    // בדיקה אם יש מוצרים בכלל
    const categories = ['kitchen', 'bakery', 'online', 'warehouse'];
    const hasProducts = categories.some(category => document.getElementById(`${category}List`).children.length > 0);
    if (!hasProducts) {
        showNotification("אין מוצרים בסיכום ההזמנה.", "red");
        return;
    }

    // ברירת מחדל לפי תאריך ההזמנה
    const orderDate = localStorage.getItem('orderDate') || '';
    let defaultDay = 'ראשון';
    if (orderDate) {
        defaultDay = getDayOfWeek(orderDate);
        if (!whatsappGroupsByDay[defaultDay]) defaultDay = 'ראשון';
    }
    daySelect.value = defaultDay;

    // יצירת סיכום כללי בפורמט כמו הכפתור הקיים
    const orderNumber = localStorage.getItem('orderNumber') || '';
    const orderDateFormatted = orderDate ? formatDateToDDMMYYYY(orderDate) : '';
    const orderDay = orderDate ? getDayOfWeek(orderDate) : '';
    const orderTime = localStorage.getItem('orderTime') || '';
    const temperature = localStorage.getItem('temperature') || '';
    let message = `*הזמנה מס: ${orderNumber}*\n*תאריך: ${orderDateFormatted}${orderDay ? ' (יום ' + orderDay + ')' : ''}*\n*שעה: ${orderTime}*\n`;
    categories.forEach((category) => {
        const categoryItems = Array.from(document.getElementById(`${category}List`).children)
            .map((li) => {
                let text = li.firstElementChild.textContent;
                text = text.replace(/\(מק\"ט: \d+\)/g, '')
                          .replace(/\|BREAD_TYPE:(ביס (שומשום|בריוש|קמח מלא|דגנים|פרג|שחור|אדום-סלק|בריוש מלבן))\|/g, ' $1')
                          .replace(/\s{2,}/g, ' ')
                          .replace(/\*([^*]+)\*/g, '$1') // מסיר כוכביות מהמוצרים עצמם
                          .trim();
                return text;
            })
            .filter((text) => text.trim() !== '');
        if (categoryItems.length > 0) {
            // רווח שורה לפני כל כותרת קטגוריה
            message += `\n*${getCategoryTitle(category)}:*\n`;
            // ריווח בין שורות רק במטבח
            if (category === 'kitchen') {
                message += categoryItems.map(item => item).join("\n\n") + "\n";
            } else {
                message += categoryItems.join("\n") + "\n";
            }
        }
    });
    if (temperature) {
        message += `\n*הערות:* *\"${temperature}\"*\n`;
    }
    // ניקוי רווחים מיותרים בסוף כל שורה ובסוף ההודעה
    message = message.split('\n').map(line => line.replace(/\s+$/g, '').replace(/\s{2,}/g, ' ')).join('\n').trim();
    // המרה ל-html: כל טקסט בין כוכביות יהפוך ל-<b>
    message = message.replace(/\*([^*]+)\*/g, '<b>$1</b>');
    waEditable.innerHTML = message.replace(/\n/g, '<br>');
    modal.style.display = 'block';
    waEditable.focus();
}

function closeWhatsAppGeneralModal() {
    const modal = document.getElementById('whatsappGeneralModal');
    if (modal) modal.style.display = 'none';
}

function sendWhatsAppGeneralMessage() {
    saveCurrentOrderToHistory();
    const waEditable = document.getElementById('waEditableGeneral');
    const daySelect = document.getElementById('waDaySelect');
    const sendButton = document.querySelector('.send-general-btn');
    if (!waEditable || !daySelect) return;
    const selectedDay = daySelect.value;
    const groupId = whatsappGroupsByDay[selectedDay];
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
    if (lastSentGeneralMessage === message && lastSentGeneralMessage !== null) {
        pendingGeneralMessage = message;
        showDuplicateGeneralModal();
        return;
    }
    if (isSendingGeneralMessage) {
        showNotification('שליחה בתהליך, אנא המתן...', 'info');
        return;
    }
    isSendingGeneralMessage = true;
    sendButton.disabled = true;
    sendButton.innerHTML = '<span class="loading-spinner"></span> שולח...';
    showNotification('שולח הודעה...', 'info');
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, groupId, userEmail: getUserEmail() })
    })
    .then(response => {
        if (!response.ok) throw new Error('שגיאה בשליחת ההודעה');
        return response.json();
    })
    .then(() => {
        showNotification('✅ ההודעה נשלחה בהצלחה!', 'green');
        closeWhatsAppGeneralModal();
        lastSentGeneralMessage = message;
    })
    .catch(() => {
        showNotification('שגיאה בשליחת ההודעה', 'red');
    })
    .finally(() => {
        isSendingGeneralMessage = false;
        sendButton.disabled = false;
        sendButton.innerHTML = 'שלח לוואטסאפ';
    });
}

function copyGeneralSummary() {
    const waEditable = document.getElementById('waEditableGeneral');
    if (!waEditable) return;
    let message = waEditable.innerHTML
        .replace(/<br><br>/g, '\n\n')
        .replace(/<div>/g, '\n')
        .replace(/<br>/g, '\n')
        .replace(/<b>(.*?)<\/b>/g, '*$1*')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    // הוספת היום בשבוע רק אם הוא לא קיים כבר
    const orderDate = localStorage.getItem('orderDate') || '';
    const orderDateFormatted = orderDate ? formatDateToDDMMYYYY(orderDate) : '';
    const orderDay = orderDate ? getDayOfWeek(orderDate) : '';
    if (orderDateFormatted && orderDay && !message.includes(`(יום ${orderDay})`)) {
        message = message.replace(
            /\*תאריך: ([^*]+)\*/,
            `*תאריך: $1 (יום ${orderDay})*`
        );
    }
    navigator.clipboard.writeText(message).then(() => {
        showNotification('הסיכום הועתק בהצלחה!', 'green');
    }).catch(() => {
        showNotification('שגיאה בהעתקת הסיכום', 'red');
    });
}

// מודל למניעת שליחה כפולה
function showDuplicateGeneralModal() {
    let modal = document.getElementById('duplicateGeneralModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'duplicateGeneralModal';
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
        <div class="modal-content confirmation-modal">
            <div class="confirmation-icon">⚠️</div>
            <h3>שליחה חוזרת</h3>
            <p>ההודעה כבר נשלחה בעבר. האם אתה בטוח שברצונך לשלוח שוב?</p>
            <div class="confirmation-buttons">
                <button onclick="confirmGeneralResend()" class="confirm-btn">כן, שלח שוב</button>
                <button onclick="closeDuplicateGeneralModal()" class="cancel-btn">ביטול</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'block';
    }
}
function closeDuplicateGeneralModal() {
    const modal = document.getElementById('duplicateGeneralModal');
    if (modal) modal.style.display = 'none';
}
function confirmGeneralResend() {
    if (pendingGeneralMessage) {
        lastSentGeneralMessage = null;
        sendWhatsAppGeneralMessage();
        closeDuplicateGeneralModal();
    }
}
// פונקציה עזר: קבלת שם יום מהתאריך (אם לא קיימת)
function getDayOfWeek(dateStr) {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const date = new Date(dateStr);
    return days[date.getDay()];
}
// פונקציה עזר: כותרת קטגוריה
function getCategoryTitle(category) {
    switch (category) {
        case 'kitchen': return 'מטבח';
        case 'bakery': return 'קונדיטוריה';
        case 'online': return 'אונליין';
        case 'warehouse': return 'מחסן';
        default: return '';
    }
}
// פונקציה עזר: פורמט תאריך DD/MM/YYYY
function formatDateToDDMMYYYY(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function displayOrderInfo() {
    const orderNumber = localStorage.getItem("orderNumber") || "";
    const orderDate = localStorage.getItem("orderDate") || "";
    const orderTime = localStorage.getItem("orderTime") || "";
    const temperature = localStorage.getItem("temperature") || ""; // הצגת חם/קר
    const formattedDate = orderDate ? formatDateToDDMMYYYY(orderDate) : "תאריך לא תקין";
    const orderDay = orderDate ? getDayOfWeek(orderDate) : '';
    document.getElementById("orderInfo").innerHTML = `<strong>הזמנה מס: ${orderNumber}</strong><br>
                <strong>לתאריך: ${formattedDate}${orderDay ? ' (יום ' + orderDay + ')' : ''}</strong><br>
                <strong>לשעה: ${orderTime}</strong>`;
    document.getElementById("notesSummary").textContent = temperature ? `''${temperature}''` : '';
}

// === Google Sign-In Integration ===
const GOOGLE_CLIENT_ID = '530661972828-l9qgtsui9d3aj40pbdnn6rvv15fr82kf.apps.googleusercontent.com';

function insertGoogleSignInButton() {
    // אתחל את Google Sign-In
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: onGoogleSignIn
        });
        google.accounts.id.renderButton(
            document.getElementById('googleSignInBtn'),
            { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'sign_in_with' }
        );
    }
    
    // הוסף event listener לכפתור התנתקות
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.onclick = function() {
            localStorage.removeItem('userEmail');
            localStorage.removeItem('googleToken');
            updateSignInUI();
            updateSendButtonsState();
            showNotification('התנתקת מהחשבון', 'red');
        };
    }
}

// רשימת מיילים מורשים להתחברות ושליחה (שימוש יחיד בקובץ)
const allowedEmails = [
  "BLUMI@GOLDYS.CO.IL",
  "SERVICE@GOLDYS.CO.IL"
];

function showMainContent(isAllowed) {
  const mainContent = document.getElementById('mainContent');
  const notAllowedMsg = document.getElementById('notAllowedMsg');
  if (mainContent && notAllowedMsg) {
    if (isAllowed) {
      mainContent.style.display = '';
      notAllowedMsg.style.display = 'none';
    } else {
      mainContent.style.display = 'none';
      notAllowedMsg.style.display = '';
    }
  }
}

function updateSignInUI() {
  const email = (localStorage.getItem('userEmail') || '').toUpperCase();
  const isAllowed = allowedEmails.includes(email);
  const isLoggedIn = !!localStorage.getItem('userEmail') && isAllowed;
  const signOutBtn = document.getElementById('signOutBtn');
  const signInBtn = document.getElementById('googleSignInBtn');
  if (signOutBtn) signOutBtn.style.display = isLoggedIn ? 'inline-block' : 'none';
  if (signInBtn) signInBtn.style.display = isLoggedIn ? 'none' : 'block';
}

window.onGoogleSignIn = function(response) {
  try {
    const id_token = response.credential;
    const payload = JSON.parse(atob(id_token.split('.')[1]));
    const email = payload.email.toUpperCase();

    if (!allowedEmails.includes(email)) {
      // לא מורשה – לא שומר כלום, מציג הודעה, מסתיר פיצ'רים
      localStorage.removeItem('userEmail');
      localStorage.removeItem('googleToken');
      showMainContent && showMainContent(false);
      updateSignInUI && updateSignInUI();
      updateSendButtonsState && updateSendButtonsState();
      showNotification && showNotification('אין לך הרשאה להתחבר לאתר', 'red');
      return;
    }

    // מורשה – המשך רגיל
    localStorage.setItem('userEmail', payload.email);
    localStorage.setItem('googleToken', id_token);
    showMainContent && showMainContent(true);
    updateSignInUI && updateSignInUI();
    updateSendButtonsState && updateSendButtonsState();
    showNotification && showNotification('התחברת בהצלחה!', 'green');
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    showNotification('שגיאה בהתחברות, נסה שוב', 'red');
  }
};

function isUserLoggedIn() {
    return !!localStorage.getItem('userEmail');
}

function getUserEmail() {
    return localStorage.getItem('userEmail') || '';
}

function updateSendButtonsState() {
    // לא משבית כפתורים, רק משנה title
    const sendBtns = document.querySelectorAll('.send-btn, .send-fruits-btn, .send-bakery-btn, .send-amar-btn, .send-sushi-btn, .send-warehouse-btn, .send-general-btn');
    sendBtns.forEach(btn => {
        btn.disabled = false;
        btn.title = isUserLoggedIn() ? '' : 'יש להתחבר עם גוגל כדי לשלוח';
    });
}

window.addEventListener('DOMContentLoaded', function() {
    // חכה ל-Google API לטעון
    if (typeof google !== 'undefined' && google.accounts) {
        insertGoogleSignInButton();
    } else {
        // אם Google API לא נטען עדיין, חכה קצת ונסה שוב
        setTimeout(() => {
            if (typeof google !== 'undefined' && google.accounts) {
                insertGoogleSignInButton();
            }
        }, 1000);
    }
    
    updateSendButtonsState();
    // בדוק אם יש התחברות קיימת ומורשית
    const email = (localStorage.getItem('userEmail') || '').toUpperCase();
    showMainContent(allowedEmails.includes(email));
});

// בדיקת תוקף טוקן Google
function checkTokenValidity() {
  const token = localStorage.getItem('googleToken');
  const email = localStorage.getItem('userEmail');
  
  // אם אין מייל, אין התחברות
  if (!email) return false;
  
  // אם אין טוקן, אבל יש מייל - נניח שההתחברות תקינה (למקרה של בעיות עם Google)
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp > currentTime;
  } catch (error) {
    // אם יש שגיאה בפענוח הטוקן, אבל יש מייל - נניח שההתחברות תקינה
    return true;
  }
}

// עוטף פונקציות שדורשות התחברות לבדוק תוקף טוקן
function requireValidLogin(fn) {
  return function(...args) {
    console.log('requireValidLogin called');
    const email = localStorage.getItem('userEmail');
    console.log('Current email:', email);
    
    // אם יש מייל תקין, תן לעבור (גם אם הטוקן פג תוקף)
    if (email && allowedEmails.includes(email.toUpperCase())) {
      console.log('Email is valid, proceeding');
      return fn.apply(this, args);
    }
    
    // אם אין מייל או המייל לא מורשה
    if (!checkTokenValidity()) {
      console.log('Token invalid, logging out');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('googleToken');
      showNotification('התחברות פגה, יש להתחבר מחדש', 'red');
      updateSignInUI && updateSignInUI();
      return;
    }
    
    console.log('Proceeding with function call');
    return fn.apply(this, args);
  }
}

function requireSendPermission(fn) {
  return function(...args) {
    console.log('requireSendPermission called');
    const email = (localStorage.getItem('userEmail') || '').toUpperCase();
    console.log('Email in requireSendPermission:', email);
    
    if (!email) {
      console.log('No email found');
      showNotification('כדי לשלוח לוואטסאפ, יש להתחבר עם חשבון מורשה!', 'red');
      return;
    }
    if (!allowedEmails.includes(email)) {
      showNotification('אין לך הרשאה לשלוח הודעות לוואטסאפ!', 'red');
      return;
    }
    return fn.apply(this, args);
  }
}

// עטוף את כל פונקציות השליחה רק פעם אחת
window.sendWhatsAppMessage = requireValidLogin(sendWhatsAppMessage);
window.sendWhatsAppFruitsMessage = requireValidLogin(sendWhatsAppFruitsMessage);
window.sendWhatsAppBakeryMessage = requireValidLogin(sendWhatsAppBakeryMessage);
window.sendWhatsAppAmarMessage = requireValidLogin(sendWhatsAppAmarMessage);
window.sendWhatsAppSushiMessage = requireValidLogin(sendWhatsAppSushiMessage);
window.sendWhatsAppWarehouseMessage = requireValidLogin(sendWhatsAppWarehouseMessage);
window.sendWhatsAppGeneralMessage = requireValidLogin(sendWhatsAppGeneralMessage);

// בדוק תוקף טוקן כל 5 דקות
setInterval(() => {
  const email = localStorage.getItem('userEmail');
  
  // אם יש מייל תקין, אל תנתק (גם אם הטוקן פג תוקף)
  if (email && allowedEmails.includes(email.toUpperCase())) {
    return;
  }
  
  // אם אין מייל או המייל לא מורשה, בדוק טוקן
  if (isUserLoggedIn() && !checkTokenValidity()) {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('googleToken');
    showNotification('התחברות פגה, יש להתחבר מחדש', 'red');
    updateSignInUI && updateSignInUI();
  }
}, 5 * 60 * 1000);

// === Order History (localStorage) ===
function saveCurrentOrderToHistory() {
  const email = localStorage.getItem('userEmail');
  if (!email) return;
  const order = {
    orderNumber: document.getElementById('orderNumber').value,
    orderDate: document.getElementById('orderDate').value,
    orderTime: document.getElementById('orderTime').value,
    temperature: document.getElementById('temperature') ? document.getElementById('temperature').value : '',
    kitchen: getListItems('kitchenList'),
    bakery: getListItems('bakeryList'),
    online: getListItems('onlineList'),
    warehouse: getListItems('warehouseList'),
    amar: getListItems('amarList'),
    sushi: getListItems('sushiList')
  };
  const key = 'orders_' + email;
  const allOrders = JSON.parse(localStorage.getItem(key) || '[]');
  allOrders.push(order);
  localStorage.setItem(key, JSON.stringify(allOrders));
}

function getListItems(listId) {
  const ul = document.getElementById(listId);
  if (!ul) return [];
  return Array.from(ul.children).map(li => li.innerHTML);
}

function loadOrderHistory() {
  const email = localStorage.getItem('userEmail');
  if (!email) return [];
  const key = 'orders_' + email;
  return JSON.parse(localStorage.getItem(key) || '[]');
}

function deleteOrderFromHistory(idx) {
  const email = localStorage.getItem('userEmail');
  if (!email) return;
  const key = 'orders_' + email;
  const allOrders = JSON.parse(localStorage.getItem(key) || '[]');
  allOrders.splice(idx, 1);
  localStorage.setItem(key, JSON.stringify(allOrders));
  showOrderHistory();
}

function showOrderHistory() {
  const orders = loadOrderHistory();
  if (!orders.length) {
    showNotification('אין היסטוריית הזמנות', 'red');
    return;
  }
  let html = '<h3>היסטוריית הזמנות</h3>';
  orders.forEach((order, idx) => {
    html += `<div style="border-bottom:1px solid #ccc;padding:8px;">
      <b>הזמנה #${order.orderNumber}</b> | תאריך: ${order.orderDate} | שעה: ${order.orderTime}
      <button onclick="restoreOrderFromHistory(${idx})">שחזר</button>
      <button onclick="deleteOrderFromHistory(${idx})" style="color:red;">מחק</button>
    </div>`;
  });
  // תוכל להציג את זה במודל/דיב קופץ
  const modal = document.createElement('div');
  modal.id = 'orderHistoryModal';
  modal.style = 'position:fixed;top:10%;left:50%;transform:translateX(-50%);background:#fff;padding:20px;z-index:9999;max-width:400px;box-shadow:0 0 20px #0003;';
  modal.innerHTML = html + '<button onclick="document.body.removeChild(this.parentNode)">סגור</button>';
  document.body.appendChild(modal);
}

function restoreOrderFromHistory(idx) {
    const orders = loadOrderHistory();
    const order = orders[idx];
    if (!order) return;
    document.getElementById('orderNumber').value = order.orderNumber;
    document.getElementById('orderDate').value = order.orderDate;
    document.getElementById('orderTime').value = order.orderTime;
    if (document.getElementById('temperature')) document.getElementById('temperature').value = order.temperature || '';
    // שחזור כל קטגוריה
    ['kitchen','bakery','online','warehouse','amar','sushi'].forEach(cat => {
      const ul = document.getElementById(cat + 'List');
      ul.innerHTML = '';
      (order[cat] || []).forEach(html => {
        const li = document.createElement('li');
        li.innerHTML = html;
        ul.appendChild(li);
      });
    });
    // סגור את המודל
    const modal = document.getElementById('orderHistoryModal');
    if (modal) document.body.removeChild(modal);
    showNotification('ההזמנה שוחזרה!', 'green');
  }


  console.log('userEmail before newOrder:', localStorage.getItem('userEmail'));
console.log('googleToken before newOrder:', localStorage.getItem('googleToken'));

console.log('userEmail before newOrder:', localStorage.getItem('userEmail'));
setTimeout(() => {
  console.log('userEmail after newOrder:', localStorage.getItem('userEmail'));
}, 2000);

