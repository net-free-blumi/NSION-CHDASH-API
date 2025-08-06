window.onload = function () {
    google.accounts.id.initialize({
      client_id: "530661972828-l9qgtsui9d3aj40pbdnn6rvv15fr82kf.apps.googleusercontent.com", // ה-Client ID שלך
      callback: handleCredentialResponse,
      auto_select: true // זה ינסה לחבר אוטומטית אם המשתמש כבר אישר בעבר
    });
    google.accounts.id.renderButton(
      document.getElementById("loginSection"),
      { theme: "outline", size: "large" }
    );
  };


// Google Sign-In and Authorization System
let currentUser = null;
let isUserAuthorized = false;

// רשימת המיילים המורשים (צריכה להיות זהה לשרת)
const ALLOWED_EMAILS = [
    'BLUMI@GOLDYS.CO.IL',
    'SERVICE@GOLDYS.CO.IL',
    'tzvi@goldys.co.il',
    'ch0548507825@gmail.com',
'zadok@goldys.co.il'
    // הוסף כאן מיילים נוספים לפי הצורך
];

// בדיקה אם המייל מורשה
function isEmailAuthorized(email) {
    return ALLOWED_EMAILS.includes(email.toUpperCase());
}

// טיפול בתגובה מהתחברות Google
function handleCredentialResponse(response) {
    // פענוח ה-JWT token
    const responsePayload = decodeJwtResponse(response.credential);
    
    console.log("ID: " + responsePayload.sub);
    console.log('Full Name: ' + responsePayload.name);
    console.log('Given Name: ' + responsePayload.given_name);
    console.log('Family Name: ' + responsePayload.family_name);
    console.log("Image URL: " + responsePayload.picture);
    console.log("Email: " + responsePayload.email);
    
    const userEmail = responsePayload.email;
    currentUser = {
        email: userEmail,
        name: responsePayload.name,
        picture: responsePayload.picture
    };
    
    // שמירת פרטי המשתמש ב-localStorage
    localStorage.setItem('userEmail', userEmail);
    localStorage.setItem('userName', responsePayload.name);
    
    // בדיקה אם המייל מורשה
    isUserAuthorized = isEmailAuthorized(userEmail);
    
    // הצגת הממשק המתאים
    updateAuthUI();
}

// פענוח JWT token
function decodeJwtResponse(token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

// התנתקות
function signOut() {
    currentUser = null;
    isUserAuthorized = false;
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    
    // איפוס Google Sign-In
    google.accounts.id.disableAutoSelect();
    google.accounts.id.revoke(currentUser?.email, () => {
        console.log('User signed out');
    });
    
    updateAuthUI();
}

// עדכון ממשק המשתמש לפי מצב ההתחברות
function updateAuthUI() {
    const loginSection = document.getElementById('loginSection');
    const userSection = document.getElementById('userSection');
    const unauthorizedSection = document.getElementById('unauthorizedSection');
    const mainContent = document.getElementById('mainContent');
    const userEmailElement = document.getElementById('userEmail');
    
    if (currentUser) {
        loginSection.style.display = 'none';
        userEmailElement.textContent = currentUser.email;
        
        if (isUserAuthorized) {
            userSection.style.display = 'block';
            unauthorizedSection.style.display = 'none';
            mainContent.style.display = 'block';
            showNotification('התחברת בהצלחה! אתה מורשה לשלוח הודעות WhatsApp', 'green');
        } else {
            userSection.style.display = 'none';
            unauthorizedSection.style.display = 'block';
            mainContent.style.display = 'block';
            showNotification('התחברת בהצלחה, אך המייל שלך אינו מורשה לשלוח הודעות WhatsApp', 'orange');
        }
    } else {
        loginSection.style.display = 'block';
        userSection.style.display = 'none';
        unauthorizedSection.style.display = 'none';
        mainContent.style.display = 'block';
    }
}

// בדיקת התחברות בטעינת הדף
function checkAuthOnLoad() {
    const savedEmail = localStorage.getItem('userEmail');
    const savedName = localStorage.getItem('userName');
    
    if (savedEmail) {
        currentUser = {
            email: savedEmail,
            name: savedName
        };
        isUserAuthorized = isEmailAuthorized(savedEmail);
        updateAuthUI();
    }
}

// הוספת המייל לכל בקשה לשרת
function addUserEmailToRequest(requestBody) {
    if (currentUser) {
        requestBody.userEmail = currentUser.email;
    }
    return requestBody;
}

// בדיקה לפני שליחת הודעות WhatsApp
function checkAuthBeforeSending() {
    if (!currentUser) {
        showNotification('נדרשת התחברות לשליחת הודעות WhatsApp', 'red');
        return false;
    }
    
    if (!isUserAuthorized) {
        showNotification('המייל שלך אינו מורשה לשלוח הודעות WhatsApp', 'red');
        return false;
    }
    
    return true;
}

// אתחול המערכת בטעינת הדף
document.addEventListener('DOMContentLoaded', function() {
    checkAuthOnLoad();
});

function copyBakerySummary() {
    const waEditable = document.getElementById('waEditableBakery');
    const modal = document.getElementById('whatsappBakeryModal');
    // אם המודל פתוח (כלומר, המשתמש עורך ידנית)
    if (modal && waEditable && modal.style.display !== "none") {
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
            .then(() => showCopyNotification("סיכום קונדיטוריה הועתק בהצלחה!"))
            .catch(() => showCopyNotification("שגיאה בהעתקת סיכום קונדיטוריה.", true));
    } else {
        // אם המודל לא פתוח – העתק סיכום אוטומטי (כמו היום)
        const orderNumber = localStorage.getItem("orderNumber") || "";
        const orderDate = localStorage.getItem("orderDate") || "";
        const orderDay = getDayOfWeek(orderDate);
        const orderTime = document.getElementById("orderTime").value;
        const bakeryItems = Array.from(document.getElementById("bakeryList").children)
            .map(li => li.firstElementChild.textContent.replace(/\(מק"ט: \d+\)/g, '').trim());
        if (bakeryItems.length > 0) {
            const bakerySummary = `*ליום ${orderDay} עד השעה: ${orderTime}*\n\nמיהודה\n\n${bakeryItems.join('\n')}\n\n(הזמנה מס' *${orderNumber}*)`;
            navigator.clipboard
                .writeText(bakerySummary.trim())
                .then(() => showCopyNotification("סיכום קונדיטוריה הועתק בהצלחה!"))
                .catch(() => showCopyNotification("שגיאה בהעתקת סיכום קונדיטוריה.", true));
        } else {
            showNotification("אין פריטי קונדיטוריה בהזמנה.", "red");
        }
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
    const categories = ["kitchen",  "kitchenProducts", "bakery", "online", "warehouse"];
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
    // בדיקת הרשאה לפני שליחה
    if (!checkAuthBeforeSending()) {
        return;
    }
    
    const sendButton = document.querySelector('.send-btn');
    
    // עדכון מצב הכפתור
    isSendingMessage = true;
    sendButton.disabled = true;
    sendButton.innerHTML = '<span class="loading-spinner"></span> שולח...';
    showNotification('שולח הודעה...', 'info');
    
    // הכנת הבקשה עם המייל
    const requestBody = addUserEmailToRequest({ 
        message,
        groupId: "120363414923943659@g.us" // קבוצת הקונדיטוריה
    });
    
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.error || 'שגיאה בשליחת ההודעה');
            });
        }
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
        showNotification(`❌ ${error.message}`, 'red');
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
    // בדיקת הרשאה לפני שליחה
    if (!checkAuthBeforeSending()) {
        return;
    }
    
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
    
    // הכנת הבקשה עם המייל
    const requestBody = addUserEmailToRequest({ 
        message,
        groupId: "120363314468223287@g.us" // קבוצת הפירות
    });
    
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.error || 'שגיאה בשליחת ההודעה');
            });
        }
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
        showNotification(`❌ ${error.message}`, 'red');
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
        const bakerySummary = `*הזמנה אונליין ליום ${orderDay} עד השעה: ${orderTime}*\n\nמיהודה\n\n${bakeryItems.join('\n')}\n\n(הזמנה מס' *${orderNumber}*)`;
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
    // בדיקת הרשאה לפני שליחה
    if (!checkAuthBeforeSending()) {
        return;
    }
    
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
    
    // הכנת הבקשה עם המייל
    const requestBody = addUserEmailToRequest({ 
        message,
        groupId: "120363314468223287@g.us" // קבוצת הקונדיטוריה
    });
    
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.error || 'שגיאה בשליחת ההודעה');
            });
        }
        return response.json();
    })
    .then(() => {
        showNotification('✅ ההודעה נשלחה בהצלחה!', 'green');
        closeWhatsAppBakeryModal();
        lastSentBakeryMessage = currentMessage;
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification(`❌ ${error.message}`, 'red');
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
    // בדיקת הרשאה לפני שליחה
    if (!checkAuthBeforeSending()) {
        return;
    }
    
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
    
    // הכנת הבקשה עם המייל
    const requestBody = addUserEmailToRequest({ 
        message,
        groupId: "120363314468223287@g.us" // קבוצת עמר
    });
    
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.error || 'שגיאה בשליחת ההודעה');
            });
        }
        return response.json();
    })
    .then(() => {
        showNotification('✅ ההודעה נשלחה בהצלחה!', 'green');
        closeWhatsAppAmarModal();
        lastSentAmarMessage = currentMessage;
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification(`❌ ${error.message}`, 'red');
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
    // בדיקת הרשאה לפני שליחה
    if (!checkAuthBeforeSending()) {
        return;
    }
    
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
    
    // הכנת הבקשה עם המייל
    const requestBody = addUserEmailToRequest({ 
        message,
        groupId: "120363314468223287@g.us" // קבוצת הסושי
    });
    
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.error || 'שגיאה בשליחת ההודעה');
            });
        }
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
        showNotification(`❌ ${error.message}`, 'red');
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
    // בדיקת הרשאה לפני שליחה
    if (!checkAuthBeforeSending()) {
        return;
    }
    
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
    
    // הכנת הבקשה עם המייל
    const requestBody = addUserEmailToRequest({ 
        message,
        groupId: "120363314468223287@g.us" // קבוצת המחסן
    });
    
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.error || 'שגיאה בשליחת ההודעה');
            });
        }
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
        showNotification(`❌ ${error.message}`, 'red');
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
    // בדיקת הרשאה לפני שליחה
    if (!checkAuthBeforeSending()) {
        return;
    }
    
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
    
    // הכנת הבקשה עם המייל
    const requestBody = addUserEmailToRequest({ 
        message, 
        groupId 
    });
    
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.error || 'שגיאה בשליחת ההודעה');
            });
        }
        return response.json();
    })
    .then(() => {
        showNotification('✅ ההודעה נשלחה בהצלחה!', 'green');
        closeWhatsAppGeneralModal();
        lastSentGeneralMessage = message;
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification(`❌ ${error.message}`, 'red');
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
        case "kitchenProducts": return "מוצרי מטבח";
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



// מכאן הכל זה וואטסאפ



function openWhatsAppKitchenProductsModal() {
    const modal = document.getElementById('whatsappKitchenProductsModal');
    const waEditable = document.getElementById('waEditableKitchenProducts');
    const orderNumber = localStorage.getItem("orderNumber") || "";
    const orderDate = localStorage.getItem("orderDate") || "";
    const orderTime = document.getElementById("orderTime")?.value || "";
    const dayOfWeek = getDayOfWeek(orderDate);

    const kitchenProductsItems = getKitchenProductsItems();

    if (kitchenProductsItems.length === 0) {
      showNotification("אין מוצרים בקטגוריה זו.", "red");
      return;
    }

    let message = `*הזמנה מס: ${orderNumber}*\n*תאריך: ${formatDateToDDMMYYYY(orderDate)} (${dayOfWeek})*\n*שעה: ${orderTime}*\n\n*מוצרי מטבח:*\n${kitchenProductsItems.join("\n\n")}`;

    // הדגשה בתצוגה באתר (כמו בשאר)
    const htmlSummary = message.replace(/\*([^*]+)\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    waEditable.innerHTML = htmlSummary;
    modal.style.display = 'block';
    waEditable.focus();
}

function copyKitchenProductsSummary() {
  const waEditable = document.getElementById('waEditableKitchenProducts');
  if (!waEditable) {
    showNotification('שגיאה: לא נמצא אזור עריכה', 'red');
    return;
  }
  let summary = waEditable.innerHTML
    .replace(/<br><br>/g, '\n\n')
    .replace(/<div>/g, '\n')
    .replace(/<br>/g, '\n')
    .replace(/<b>(.*?)<\/b>/g, '*$1*')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!summary) {
    showNotification('אין טקסט להעתיק', 'error');
    return;
  }
  navigator.clipboard.writeText(summary)
    .then(() => showCopyNotification('סיכום מוצרי מטבח הועתק בהצלחה!'))
    .catch(() => showCopyNotification('שגיאה בהעתקת הסיכום.', true));
}

function getKitchenProductsItems() {
    return Array.from(document.getElementById("kitchenProductsList").children)
      .map(li => {
        const span = li.querySelector('span');
        return span ? span.textContent.trim() : li.textContent.trim();
      })
      .filter(text => text !== "");
  }
  


// ... existing code ...
function addToCategoryList(category, productSummary) {
  const categoryList = document.getElementById(category + "List");
  const listItem = document.createElement("li");
  listItem.textContent = productSummary; // תמיד טקסט ישיר, בלי span
  categoryList.appendChild(listItem);
  updateCategoryButtonsVisibility();
}


// משתנים גלובליים למעקב אחר הודעות מוצרי מטבח
let lastSentKitchenProductsMessage = null;
let isSendingKitchenProductsMessage = false;
let pendingKitchenProductsMessage = null;

function sendWhatsAppKitchenProductsMessage() {
  // בדיקת הרשאה לפני שליחה
  if (typeof checkAuthBeforeSending === 'function' && !checkAuthBeforeSending()) {
    return;
  }
  const waEditable = document.getElementById('waEditableKitchenProducts');
  const sendButton = document.querySelector('.send-kitchen-products-btn');
  if (!waEditable) {
    showNotification('שגיאה: לא נמצא אזור עריכה', 'red');
    return;
  }
  const currentMessage = waEditable.innerHTML;
  if (lastSentKitchenProductsMessage === currentMessage && lastSentKitchenProductsMessage !== null) {
    pendingKitchenProductsMessage = currentMessage;
    showDuplicateKitchenProductsModal();
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
  if (isSendingKitchenProductsMessage) {
    showNotification('שליחה בתהליך, אנא המתן...', 'info');
    return;
  }
  isSendingKitchenProductsMessage = true;
  sendButton.disabled = true;
  sendButton.innerHTML = '<span class="loading-spinner"></span> שולח...';
  showNotification('שולח הודעה...', 'info');

  // הכנת הבקשה עם המייל (כמו בקונדיטוריה)
  const requestBody = typeof addUserEmailToRequest === 'function'
    ? addUserEmailToRequest({
        message,
        groupId: '120363414923943659@g.us'   //מטבח מוסטפה
      })
    : { message, groupId: '120363414923943659@g.us' };

  fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })
    .then(res => {
      if (!res.ok) {
        return res.json().then(errorData => {
          throw new Error(errorData.error || 'שגיאה בשליחת ההודעה');
        });
      }
      return res.json();
    })
    .then(() => {
      showNotification('✅ ההודעה נשלחה בהצלחה!', 'green');
      closeWhatsAppKitchenProductsModal();
      lastSentKitchenProductsMessage = currentMessage;
    })
    .catch(error => {
      console.error('Error:', error);
      showNotification(`❌ ${error.message}`, 'red');
    })
    .finally(() => {
      isSendingKitchenProductsMessage = false;
      sendButton.disabled = false;
      sendButton.innerHTML = 'שלח לוואטסאפ';
    });
}

function showDuplicateKitchenProductsModal() {
  const modal = document.getElementById("duplicateKitchenProductsModal");
  if (modal) {
    modal.style.display = 'block';
  }
}

function closeDuplicateKitchenProductsModal() {
  const modal = document.getElementById("duplicateKitchenProductsModal");
  if (modal) {
    modal.style.display = 'none';
    pendingKitchenProductsMessage = null;
  }
}

function confirmKitchenProductsResend() {
  if (pendingKitchenProductsMessage) {
    lastSentKitchenProductsMessage = null;
    const waEditable = document.getElementById('waEditableKitchenProducts');
    if (waEditable) {
      waEditable.innerHTML = pendingKitchenProductsMessage;
      sendWhatsAppKitchenProductsMessage();
    }
    closeDuplicateKitchenProductsModal();
  }
}

// סגירה בלחיצה על הרקע (רק מאזין mousedown, כמו בקונדיטוריה)
window.addEventListener('DOMContentLoaded', function() {
    const kitchenProductsModal = document.getElementById('whatsappKitchenProductsModal');
    if (kitchenProductsModal) {
      kitchenProductsModal.addEventListener('mousedown', function(e) {
        if (e.target === kitchenProductsModal) closeWhatsAppKitchenProductsModal();
      });
    }
});

function closeWhatsAppKitchenProductsModal() {
  const modal = document.getElementById('whatsappKitchenProductsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// ... existing code ...
window.addEventListener('DOMContentLoaded', function() {
    const duplicateKitchenProductsModal = document.getElementById('duplicateKitchenProductsModal');
    if (duplicateKitchenProductsModal) {
        duplicateKitchenProductsModal.addEventListener('mousedown', function(e) {
            if (e.target === duplicateKitchenProductsModal) {
                closeDuplicateKitchenProductsModal();
            }
        });
    }
});

  // קרא לפונקציה הזו בכל פעם שמוסיפים/מסירים מוצר ממוצרי מטבח!

// ... existing code ...
function updateCategoryButtonsVisibility() {
  const categories = [
    { listId: 'kitchenProductsList', buttonId: 'whatsappKitchenProductsButton' },
    { listId: 'sushiList', buttonId: 'whatsappSushiButton' },
    { listId: 'warehouseList', buttonId: 'whatsappWarehouseButton' },
    { listId: 'bakeryList', buttonId: 'whatsappBakeryButton' },
    { listId: 'onlineList', buttonId: 'whatsappFruitsButton' },
  ];
  categories.forEach(({ listId, buttonId }) => {
    const btn = document.getElementById(buttonId);
    const list = document.getElementById(listId);
    if (!btn || !list) return;
    btn.style.display = list.children.length > 0 ? '' : 'none';
  });
}
// ... existing code ...
function removeProduct(button, category) {
  const listItem = button.closest("li");
  if (listItem) {
    document.getElementById(`${category}List`).removeChild(listItem);
    updateCategoryButtonsVisibility();
    saveOrderDetails();
  }
}
// ... existing code ...
window.addEventListener('DOMContentLoaded', function() {
  updateCategoryButtonsVisibility();
  // MutationObserver לכל קטגוריה
  ['kitchenProductsList','sushiList','bakeryList','warehouseList','onlineList'].forEach(listId => {
    const target = document.getElementById(listId);
    if (target) {
      const observer = new MutationObserver(updateCategoryButtonsVisibility);
      observer.observe(target, { childList: true });
    }
  });
});
// ... existing code ...

function generateAmarSummary() {
    const amarList = document.getElementById("amarList");
    const orderDate = new Date(document.getElementById("orderDate").value);
    const orderTime = document.getElementById("orderTime").value;
    const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
    const dayName = days[orderDate.getDay()];
    const orderNumber = document.getElementById("orderNumber").value;
  
    let summary = `*ליום ${dayName} עד השעה: ${orderTime}*\n\n`;
    let corassonTotal = 0, jabettaTotal = 0, grisiniTotal = 0;
    let focacciaTotal = 0, bakeryTotal = 0, finukimTotal = 0;
    let focaccinotTotal = 0;
    const bisTypeTotals = {};
    let hasAmarProducts = false;
  
    const corassonCodes = ["12626", "410", "415"];
    const amarProductCodes = [
      "12626", "12408", "12409", "19102", "12622", "12624", "13473", "410", "415", "19105"
    ];
    const allLists = [
      ...document.querySelectorAll("#kitchenList li, #bakeryList li, #onlineList li, #warehouseList li"),
      ...amarList.querySelectorAll("li")
    ];
  
    allLists.forEach((item) => {
      const codeEl = item.querySelector(".product-code");
      if (!codeEl) return;
      const productCode = codeEl.textContent.match(/מק"ט: (\d+)/)?.[1];
      const itemText = item.getAttribute("data-raw-summary") || item.querySelector("span")?.textContent || "";
  
      if (amarProductCodes.includes(productCode) || bisProducts.includes(productCode)) {
        hasAmarProducts = true;
      }
  
      // כמויות לפי מק"ט
      let match;
      if (corassonCodes.includes(productCode)) {
        match = itemText.match(/(\d+)\s*מגש.*?\((\d+)\s*יחי'?/) || itemText.match(/(\d+)\s*מגש/);
        corassonTotal += match ? parseInt(match[1]) * (match[2] ? parseInt(match[2]) : 15) : 0;
      } else if (productCode === "12409") {
        match = itemText.match(/(\d+)\s*מגש.*?\((\d+)\s*יחי'/);
        jabettaTotal += match ? parseInt(match[1]) * parseInt(match[2]) : 0;
    } else if (productCode === "19102") {
        match = itemText.match(/(\d+)\s*מגש.*?\((\d+)\s*יחי'/);
        jabettaTotal += match ? parseInt(match[1]) * parseInt(match[2]) : 0;
      } else if (productCode === "12408") {
        match = itemText.match(/(\d+)\s*מגש/);
        grisiniTotal += match ? parseInt(match[1]) * 13 : 0;
      } else if (productCode === "12622") {
        match = itemText.match(/(\d+)\s*מגש/);
        focacciaTotal += match ? parseInt(match[1]) * 8 : 0;
      } else if (productCode === "12624") {
        match = itemText.match(/(\d+)\s*מגש/);
        bakeryTotal += match ? parseInt(match[1]) * 9 : 0;
      } else if (productCode === "13473") {
        match = itemText.match(/(\d+)\s*מגש/);
        finukimTotal += match ? parseInt(match[1]) * 20 : 0;
      } else if (productCode === "19105") {
        match = itemText.match(/(\d+)\s*מגש/);
        focaccinotTotal += match ? parseInt(match[1]) * 12 : 0;
      }
  
      // ביס לפי bread_type
      if (bisProducts.includes(productCode)) {
        const qtyMatch = itemText.match(/(\d+)\s*מגש.*?\((\d+)\s*יחי'/);
        const breadMatch = itemText.match(/\|BREAD_TYPE:(ביס [^|]+)\|/);
        if (qtyMatch && breadMatch) {
          const total = parseInt(qtyMatch[1]) * parseInt(qtyMatch[2]);
          const breadType = breadMatch[1];
          bisTypeTotals[breadType] = (bisTypeTotals[breadType] || 0) + total;
        }
      }
    });
  
    if (!hasAmarProducts && amarList.children.length === 0) return null;
  
    if (corassonTotal) summary += `● ${corassonTotal} קרואסון מיני\n\n`;
    if (jabettaTotal) summary += `● ${jabettaTotal} ג'בטה מיני\n\n`;
    if (grisiniTotal) summary += `● ${grisiniTotal} מקלות גריסני\n\n`;
    if (focacciaTotal) summary += `● ${focacciaTotal} פוקאצות מ4 סוגים\n\n`;
    if (bakeryTotal) summary += `● ${bakeryTotal} יח' מאפי בוקר טריים של הבייקרי\n\n`;
    if (finukimTotal) summary += `● ${finukimTotal} בורקס תפו''א משולש מיני\n\n`;
    if (focaccinotTotal) summary += `● ${focaccinotTotal} פוקאצ'ינות קטנות\n\n`;
  
    // מוצרים ידניים ב־amarList
    amarList.querySelectorAll("li").forEach((item) => {
      let text = item.querySelector("span")?.textContent || "";
      text = text.replace(/\|BREAD_TYPE:[^|]+\|/g, "").trim();
      summary += `● ${text}\n\n`;
    });
  
    // ביסים לפי סוג
    Object.entries(bisTypeTotals).forEach(([type, total]) => {
      summary += `● ${total} ${type}\n\n`;
    });
  
    summary += `(הזמנה מס' *${orderNumber}*)`;
    return summary.trim();
  }

  
  function copyAmarSummary() {
    const waEditable = document.getElementById('waEditableAmar');
    const modal = document.getElementById('whatsappAmarModal');
    // אם המודל פתוח (כלומר, המשתמש עורך ידנית)
    if (modal && waEditable && modal.style.display !== "none") {
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
            .then(() => showNotification("הסיכום הערוך הועתק בהצלחה!", "green"))
            .catch(() => showNotification("שגיאה בהעתקה", "red"));
    } else {
        // אם המודל לא פתוח – העתק סיכום אוטומטי
        const summary = generateAmarSummary();
        if (!summary) {
            showNotification("אין מוצרי קונדיטוריית עמר בהזמנה.", "red");
            return;
        }
        navigator.clipboard.writeText(summary)
            .then(() => showNotification("סיכום קונדיטוריית עמר הועתק בהצלחה!", "green"))
            .catch(() => showNotification("שגיאה בהעתקת הסיכום", "red"));
    }
}
  





  function refreshAmarSummary() {
    const summary = generateAmarSummary();
    if (!summary) {
      document.getElementById("amarSummaryDisplay").innerText = "אין סיכום.";
      return;
    }
    document.getElementById("amarSummaryDisplay").innerText = summary;
  }

  
  function openWhatsAppAmarModal() {
    const summary = generateAmarSummary();
    const modal = document.getElementById("whatsappAmarModal");
    const waEditable = document.getElementById("waEditableAmar");

    if (!summary) {
        showNotification("אין מוצרי קונדיטוריית עמר בהזמנה.", "red");
        return;
    }
    if (!modal || !waEditable) {
        showNotification("שגיאה בפתיחת סיכום וואטסאפ", "red");
        return;
    }

    const htmlSummary = summary.replace(/\*([^*]+)\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
    waEditable.innerHTML = htmlSummary;
    modal.style.display = "block";
    waEditable.focus();

    const orderNumber = document.getElementById("orderNumber").value;
    window.currentWhatsAppSummary = {
      type: "amar",
      text: summary,
      orderNumber: orderNumber
    };
}