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
                          .replace(/\|BREAD_TYPE:ביס (שומשום|בריוש|קמח מלא|דגנים|פרג|שחור|אדום-סלק|בריוש מלבן)\|/g, ' $1')
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
    const fruitItems = getFruitItems().map(item => {
        const match = item.match(/(\d+)\s+מגש.*?\((.*?)\)/);
        if (match) {
            const [_, quantity, size] = match;
            return `${quantity} מגש פירות *${size}*`;
        }
        return item;
    });

    if (fruitItems.length > 0) {
        const fruitSummary = `*ליום ${orderDay} עד השעה: ${orderTime}*\n\n${fruitItems.join('\n')}\n\n(הזמנה מס' *${orderNumber}*)`;
        
        // המרה ל-HTML עם שמירה על הפורמט
        const htmlSummary = fruitSummary
            .replace(/\n/g, '<br>')
            .replace(/\*(.*?)\*/g, '<b>$1</b>');
        
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

    // המרת HTML לטקסט עם שמירה על הפורמט המדויק
    let message = waEditable.innerHTML
        .replace(/<br>/g, '\n')
        .replace(/<b>(.*?)<\/b>/g, '*$1*')
        .replace(/<[^>]+>/g, '')
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
        const message = pendingFruitsMessage
            .replace(/<br><br>/g, '\n\n')
            .replace(/<div>/g, '\n')
            .replace(/<br>/g, '\n')
            .replace(/<b>(.*?)<\/b>/g, '*$1*')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
            
        sendWhatsAppFruitsMessage();
        closeDuplicateFruitsModal();
    }
}

