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
    
    // בדיקת כפתור ניהול המוצרים
    // יצירת כפתור ניהול מוצרים אם לא קיים
    let productManagementBtn = document.getElementById('product-management-btn');
    if (!productManagementBtn) {
        productManagementBtn = document.createElement('button');
        productManagementBtn.id = 'product-management-btn';
        productManagementBtn.textContent = 'ניהול מוצרים';
        productManagementBtn.onclick = openProductManagement;
        productManagementBtn.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            z-index: 999;
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: #fff;
            border: none;
            padding: 10px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            display: none;
        `;
        document.body.appendChild(productManagementBtn);
    }
    
    if (currentUser) {
        loginSection.style.display = 'none';
        userEmailElement.textContent = currentUser.email;
        
        if (isUserAuthorized) {
            userSection.style.display = 'block';
            unauthorizedSection.style.display = 'none';
            mainContent.style.display = 'block';
            // showNotification('התחברת בהצלחה! אתה מורשה לשלוח הודעות WhatsApp', 'green');
            
            // הצגת כפתור ניהול מוצרים רק למנהל המערכת
            if (currentUser.email && currentUser.email.toUpperCase() === 'BLUMI@GOLDYS.CO.IL') {
                if (productManagementBtn) {
                    productManagementBtn.style.display = 'inline-block';
                    productManagementBtn.style.animation = 'fadeIn 0.5s ease-in';
                }
                
                // הצגת כפתור היסטוריית הזמנות רק למנהל המערכת
                const ordersManagementBtn = document.getElementById('orders-management-btn');
                if (ordersManagementBtn) {
                    ordersManagementBtn.style.display = 'inline-block';
                    ordersManagementBtn.style.animation = 'fadeIn 0.5s ease-in';
                }
            }
        } else {
            userSection.style.display = 'none';
            unauthorizedSection.style.display = 'block';
            mainContent.style.display = 'block';
            showNotification('התחברת בהצלחה, אך המייל שלך אינו מורשה לשלוח הודעות WhatsApp', 'orange');
            
            // הסתרת כפתור ניהול מוצרים למשתמשים לא מורשים
            if (productManagementBtn) productManagementBtn.style.display = 'none';
            
            // הסתרת כפתור היסטוריית הזמנות למשתמשים לא מורשים
            const ordersManagementBtn = document.getElementById('orders-management-btn');
            if (ordersManagementBtn) ordersManagementBtn.style.display = 'none';
        }
    } else {
        loginSection.style.display = 'block';
        userSection.style.display = 'none';
        unauthorizedSection.style.display = 'none';
        mainContent.style.display = 'block';
        
        // הסתרת כפתור ניהול מוצרים כשהמשתמש לא מחובר
        if (productManagementBtn) productManagementBtn.style.display = 'none';
        
        // הסתרת כפתור היסטוריית הזמנות כשהמשתמש לא מחובר
        const ordersManagementBtn = document.getElementById('orders-management-btn');
        if (ordersManagementBtn) ordersManagementBtn.style.display = 'none';
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

// פונקציה להעיר את השרת
function wakeUpServer() {    try {
        const base = (typeof config !== 'undefined' && typeof config.getApiBaseUrl === 'function')
            ? config.getApiBaseUrl()
            : (window.API_BASE_URL || window.location.origin);
        fetch(base + '/health')
            .then(() => console.log('Server is awake'))
            .catch(() => console.log('Server waking up...'));
    } catch (e) {
        console.log('Server wake-up skipped');
    }
}

// אתחול המערכת בטעינת הדף
document.addEventListener('DOMContentLoaded', function() {
    checkAuthOnLoad();
    // העיר את השרת בטעינת הדף
    wakeUpServer();
    
    // וידוא שמערכת המוצרים נטענת
    setTimeout(() => {
        if (!window.productsLoader && !window.unifiedProductData) {
            console.warn('⚠️ מערכת המוצרים לא נטענה, מנסה לטעון שוב...');
            if (typeof ProductsLoader !== 'undefined') {
                window.productsLoader = new ProductsLoader();
            } else {
                alert('products-loader.js לא נטען. ודא שהקובץ קיים ושהנתיב נכון ב-index.html');
            }
        }
    }, 2000);

    // נסה לטעון ProductsLoader גם אם לא נטען אוטומטית (למקרה של טעינה איטית)
    setTimeout(() => {
        if (!window.productsLoader && typeof ProductsLoader !== 'undefined') {
            window.productsLoader = new ProductsLoader();
        }
    }, 4000);
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
        const shortDate = orderDate ? (function(d){
            const dt = new Date(d);
            return String(dt.getDate()).padStart(2,'0') + '/' + String(dt.getMonth()+1).padStart(2,'0');
        })(orderDate) : ''
        const orderTime = document.getElementById("orderTime").value;
        
        // איסוף פריטים מ-bakeryList
        const bakeryItems = Array.from(document.getElementById("bakeryList").children)
            .map(li => li.firstElementChild.textContent.replace(/\(מק"ט: \d+\)/g, '').trim());
        
        if (bakeryItems.length > 0) {
            const dayWithDate = shortDate ? `${orderDay} ${shortDate}` : orderDay;
            const bakerySummary = `*הזמנה אונליין ליום ${dayWithDate} עד השעה: ${orderTime}*\n\n${bakeryItems.join('\n')}\n\n(הזמנה מס' *${orderNumber}*)`;
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

    // עדכון מיידי של חם/קר לסיכום ול-localStorage בעת שינוי בחירה
    const temperatureSelect = document.getElementById('temperature');
    if (temperatureSelect) {
        temperatureSelect.addEventListener('change', function() {
            const value = this.value || '';
            try { localStorage.setItem('temperature', value); } catch {}
            const notesEl = document.getElementById('notesSummary');
            if (notesEl) notesEl.textContent = value ? `''${value}''` : '';
            if (typeof displayOrderInfo === 'function') {
                try { displayOrderInfo(); } catch {}
            }
        });
    }
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
    
    fetch(((typeof config !== 'undefined' && typeof config.getApiBaseUrl === 'function') ? config.getApiBaseUrl() : (window.API_BASE_URL || window.location.origin)) + '/send-whatsapp', {
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

// Helper function to show notifications (copied from admin)
function showNotification(message, color = 'green', { duration = 3000 } = {}) {
    // Convert legacy color names to types
    const type = color === 'green' ? 'success'
               : color === 'red' ? 'error'
               : color === 'orange' ? 'warning'
               : color === 'blue' ? 'info'
               : color;

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
    // שמירה אוטומטית של ההזמנה הישנה לפני איפוס
    const orderNumber = document.getElementById("orderNumber")?.value || "";
    const hasItems = calculateOrderTotal() > 0;
    
    if (orderNumber && hasItems) {
        // שמירה אוטומטית ברקע ללא הפרעה למשתמש (ללא אינדיקטור)
        saveCurrentOrderToCloud(false).catch(err => {
            console.warn('Auto-save failed:', err);
        });
    }
    
    // העיר את השרת בהתחלת הזמנה חדשה
    wakeUpServer();
    // רענון נתוני מוצרים רק בעת התחלת הזמנה חדשה
    if (window.productsLoader && typeof window.productsLoader.refreshData === 'function') {
        try { window.productsLoader.refreshData(); } catch {}
    }
    
    // ניקוי localStorage של ההזמנה
    localStorage.removeItem("orderNumber");
    localStorage.removeItem("orderDate");
    localStorage.removeItem("orderTime");
    localStorage.removeItem("temperature");
    
    // ניקוי localStorage של פריטי הקטגוריות
    const categories = ["kitchen", "bakery", "online", "warehouse", "sushi", "kitchenProducts", "amar"];
    categories.forEach(category => {
        localStorage.removeItem(`${category}Items`);
    });
    
    // איפוס כל השדות
    document.getElementById("orderNumber").value = "";
    document.getElementById("orderDate").value = "";
    document.getElementById("orderTime").value = "";
    document.getElementById("temperature").value = "";
    document.getElementById("notesSummary").value = "";
    document.getElementById("notesSummary").textContent = "";
    
    // רענון תצוגת פרטי הזמנה לאחר איפוס
    if (typeof displayOrderInfo === 'function') {
        try { displayOrderInfo(); } catch {}
    }
    
    // איפוס בחירת סוג לחם והסתרת התיבה
    const breadTypeDiv = document.getElementById("breadTypeDiv");
    if (breadTypeDiv) breadTypeDiv.style.display = "none";
    const breadTypeSelect = document.getElementById("breadType");
    if (breadTypeSelect && typeof breadTypeSelect.selectedIndex === 'number') {
        breadTypeSelect.selectedIndex = 0;
    }
    
    // ניקוי כל הרשימות
    document.getElementById("kitchenList").innerHTML = "";
    document.getElementById("bakeryList").innerHTML = "";
    document.getElementById("onlineList").innerHTML = "";
    document.getElementById("warehouseList").innerHTML = "";
    document.getElementById("sushiList").innerHTML = "";
    document.getElementById("kitchenProductsList").innerHTML = "";
    document.getElementById("amarList").innerHTML = "";
    
    // ניקוי תצוגת קונדיטוריית עמר
    const amarSummaryDisplay = document.getElementById("amarSummaryDisplay");
    if (amarSummaryDisplay) {
        amarSummaryDisplay.innerText = "";
    }
    
    // איפוס משתני הזיכרון של הודעות
    lastSentMessage = null;
    isSendingMessage = false;
    pendingMessage = null;
    lastSentFruitsMessage = null;
    isSendingFruitsMessage = false;
    pendingFruitsMessage = null;
    lastSentBakeryMessage = null;
    isSendingBakeryMessage = false;
    pendingBakeryMessage = null;
    lastSentAmarMessage = null;
    isSendingAmarMessage = false;
    pendingAmarMessage = null;
    lastSentSushiMessage = null;
    isSendingSushiMessage = false;
    pendingSushiMessage = null;
    lastSentWarehouseMessage = null;
    isSendingWarehouseMessage = false;
    pendingWarehouseMessage = null;
    lastSentGeneralMessage = null;
    isSendingGeneralMessage = false;
    pendingGeneralMessage = null;
    lastSentKitchenProductsMessage = null;
    isSendingKitchenProductsMessage = false;
    pendingKitchenProductsMessage = null;
    
    // הסתרת המודלים
    const modals = [
        'whatsappModal', 'duplicateMessageModal',
        'whatsappFruitsModal', 'duplicateFruitsModal',
        'whatsappBakeryModal', 'duplicateBakeryModal',
        'whatsappAmarModal', 'duplicateAmarModal',
        'whatsappSushiModal', 'duplicateSushiModal',
        'whatsappWarehouseModal', 'duplicateWarehouseModal',
        'whatsappGeneralModal', 'duplicateGeneralModal',
        'whatsappKitchenProductsModal', 'duplicateKitchenProductsModal'
    ];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    });
    
    // איפוס שדות קלט נוספים
    resetInputFields();
    
    // עדכון הממשק
    updateSelectedRadio();
    updateCategoryButtonsVisibility();
    showNotification("הזמנה חדשה נוצרה בהצלחה!", "green");

    // לא מרענן מוצרים - רק מאפס את הסיכום
    // אם (window.productsLoader && typeof window.productsLoader.refreshData === 'function') {
    //   window.productsLoader.refreshData();
    // }
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
        const fruitSummary = `*הזמנה אונליין ליום ${orderDay} עד השעה: ${orderTime}*\n\n${fruitItems.join('\n')}\n\n(הזמנה מס' *${orderNumber}*)`;
        
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
    
    fetch(((typeof config !== 'undefined' && typeof config.getApiBaseUrl === 'function') ? config.getApiBaseUrl() : (window.API_BASE_URL || window.location.origin)) + '/send-whatsapp', {
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
        console.error('Modal elements not found1!');
        return;
    }
    const orderNumber = localStorage.getItem("orderNumber") || "";
    const orderDate = localStorage.getItem("orderDate") || "";
    const orderDay = getDayOfWeek(orderDate);
    const shortDate = orderDate ? (function(d){
        const dt = new Date(d);
        return String(dt.getDate()).padStart(2,'0') + '/' + String(dt.getMonth()+1).padStart(2,'0');
    })(orderDate) : '';
    const orderTime = document.getElementById("orderTime").value;
    
    // איסוף פריטים מ-bakeryList
    const bakeryItems = Array.from(document.getElementById("bakeryList").children)
        .map(li => li.firstElementChild.textContent.replace(/\(מק"ט: \d+\)/g, '').trim());
    
    if (bakeryItems.length > 0) {
        const dayWithDate = shortDate ? `${orderDay} ${shortDate}` : orderDay;
        const bakerySummary = `*הזמנה אונליין ליום ${dayWithDate} עד השעה: ${orderTime}*\n\n${bakeryItems.join('\n')}\n\n(הזמנה מס' *${orderNumber}*)`;
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
    
    fetch(((typeof config !== 'undefined' && typeof config.getApiBaseUrl === 'function') ? config.getApiBaseUrl() : (window.API_BASE_URL || window.location.origin)) + '/send-whatsapp', {
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
    
    fetch(((typeof config !== 'undefined' && typeof config.getApiBaseUrl === 'function') ? config.getApiBaseUrl() : (window.API_BASE_URL || window.location.origin)) + '/send-whatsapp', {
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
    
    fetch(((typeof config !== 'undefined' && typeof config.getApiBaseUrl === 'function') ? config.getApiBaseUrl() : (window.API_BASE_URL || window.location.origin)) + '/send-whatsapp', {
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
    
    fetch(((typeof config !== 'undefined' && typeof config.getApiBaseUrl === 'function') ? config.getApiBaseUrl() : (window.API_BASE_URL || window.location.origin)) + '/send-whatsapp', {
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
            .filter(li => !li.classList.contains('temperature-header')) // רק מוצרים אמיתיים, לא כותרות
            .map((li) => {
                let text = li.firstElementChild.textContent;
                text = text.replace(/\(מק\"ט: \d+\)/g, '')
                          .replace(/\|BREAD_TYPE:(ביס [^|]+)\|/g, ' $1')
                          .replace(/\s{2,}/g, ' ')
                          .replace(/\*([^*]+)\*/g, '$1') // מסיר כוכביות מהמוצרים עצמם
                          .trim();
                const temperature = li.getAttribute('data-temperature') || '';
                return { text, temperature };
            })
            .filter((item) => item.text.trim() !== '');
        
        // אם זה קטגוריית קונדיטוריה, הוסף גם מוצר 19100 מכל הרשימות
        if (category === 'bakery') {
            const allListsFor19100 = document.querySelectorAll("#kitchenList li, #bakeryList li, #onlineList li, #warehouseList li, #amarList li");
            allListsFor19100.forEach((item) => {
                const codeEl = item.querySelector(".product-code");
                if (codeEl) {
                    const productCode = codeEl.textContent.match(/מק"ט: (\d+)/)?.[1];
                    if (productCode === "19100") {
                        let text = item.firstElementChild.textContent;
                        text = text.replace(/\(מק\"ט: \d+\)/g, '')
                                  .replace(/\|BREAD_TYPE:(ביס [^|]+)\|/g, ' $1')
                                  .replace(/\s{2,}/g, ' ')
                                  .replace(/\*([^*]+)\*/g, '$1')
                                  .trim();
                        // Only add if not already present to avoid duplicates
                        if (text && !categoryItems.some(ci => ci.text === text)) {
                            categoryItems.push({ text: text, temperature: '' });
                        }
                    }
                }
            });
        }
            
        if (categoryItems.length > 0) {
            // רווח שורה לפני כל כותרת קטגוריה
            message += `\n*${getCategoryTitle(category)}:*\n`;
            
            // רק לקטגוריית מוצרי מטבח נוסיף הפרדה בין חם וקר
            if (category === 'kitchenProducts') {
                // חלוקה למוצרים חמים וקרים
                const hotItems = categoryItems.filter(item => item.temperature === 'hot');
                const coldItems = categoryItems.filter(item => item.temperature === 'cold');
                const defaultItems = categoryItems.filter(item => !item.temperature || item.temperature === '');

                // מוצרים חמים
                if (hotItems.length > 0) {
                    message += '*מטבח חם: 🔥*\n';
                    message += hotItems.map(item => item.text).join("\n") + "\n";
                }

                // מוצרים קרים
                if (coldItems.length > 0) {
                    message += '*מטבח קר: ❄️*\n';
                    message += coldItems.map(item => item.text).join("\n") + "\n";
                }

                // מוצרים רגילים
                if (defaultItems.length > 0) {
                    message += defaultItems.map(item => item.text).join("\n") + "\n";
                }
            } else {
                // לקטגוריות אחרות - תצוגה רגילה
            if (category === 'kitchen') {
                    message += categoryItems.map(item => item.text).join("\n\n") + "\n";
            } else {
                    message += categoryItems.map(item => item.text).join("\n") + "\n";
                }
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
    
    fetch(((typeof config !== 'undefined' && typeof config.getApiBaseUrl === 'function') ? config.getApiBaseUrl() : (window.API_BASE_URL || window.location.origin)) + '/send-whatsapp', {
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
    const formattedDate = orderDate ? formatDateToDDMMYYYY(orderDate) : "";
    const orderDay = orderDate ? getDayOfWeek(orderDate) : '';
    const dateLine = formattedDate ? `<strong>לתאריך: ${formattedDate}${orderDay ? ' (יום ' + orderDay + ')' : ''}</strong><br>` : '';
    const timeLine = orderTime ? `<strong>לשעה: ${orderTime}</strong>` : '';
    document.getElementById("orderInfo").innerHTML = `<strong>הזמנה מס: ${orderNumber}</strong><br>${dateLine}${timeLine}`;
    document.getElementById("notesSummary").textContent = temperature ? `''${temperature}''` : '';
    
    // עדכון תצוגת סיכום ההזמנה (ללא הפרדה חם/קר בדף הראשי)
    updateOrderSummaryDisplay();
}

// פונקציה לעדכון תצוגת סיכום ההזמנה (הסיכום הקטן מוסתר)
function updateOrderSummaryDisplay() {
    // הסיכום הקטן מוסתר - אין צורך לעדכן אותו
    return;
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
    const items = Array.from(document.getElementById("kitchenProductsList").children)
      .filter(li => !li.classList.contains('temperature-header')) // רק מוצרים אמיתיים, לא כותרות
      .map(li => {
        const span = li.querySelector('span');
        const text = span ? span.textContent.trim() : li.textContent.trim();
        const temperature = li.getAttribute('data-temperature') || '';
        return { text, temperature };
      })
      .filter(item => item.text !== "");

    // חלוקה למוצרים חמים וקרים
    const hotItems = items.filter(item => item.temperature === 'hot');
    const coldItems = items.filter(item => item.temperature === 'cold');
    const defaultItems = items.filter(item => !item.temperature || item.temperature === '');

    let result = [];
    
    // מוצרים חמים
    if (hotItems.length > 0) {
        result.push('*מטבח חם:🔥*');
        result.push(...hotItems.map(item => item.text));
    }
    
    // מוצרים קרים
    if (coldItems.length > 0) {
        result.push('*מטבח קר:❄️*');
        result.push(...coldItems.map(item => item.text));
    }
    
    // מוצרים רגילים (ללא טמפרטורה)
    if (defaultItems.length > 0) {
        result.push(...defaultItems.map(item => item.text));
    }

    return result;
  }
  


// ... existing code ...
function addToCategoryList(category, productSummary, temperature = '') {
  const categoryList = document.getElementById(category + "List");
  
  // NOTE: Allow duplicates by design (user requirement). No pre-insert filtering here.
  const listItem = document.createElement("li");
  
  // שמירת מידע הטמפרטורה באטריבוט
  if (temperature) {
    listItem.setAttribute('data-temperature', temperature);
  }
  
  // תוכן טקסט כדיפולט בתוך span, כדי שידית הגרירה לא תבלבל את הטקסט
  const textSpan = document.createElement('span');
  textSpan.textContent = productSummary;
  listItem.appendChild(textSpan);
  // מוסיף ידית גרירה ייעודית
  ensureDragHandle(listItem);
  categoryList.appendChild(listItem);
  
  // סידור אוטומטי לפי טמפרטורה רק לקטגוריית מוצרי מטבח
  if (category === 'kitchenProducts') {
    // המתן קצת כדי שהפריט יתווסף ל-DOM
    setTimeout(() => {
      sortKitchenProductsByTemperature();
    }, 100);
  }
  
  updateCategoryButtonsVisibility();
  saveOrderDetails();
  
  // עדכון תצוגת סיכום ההזמנה
  if (typeof updateOrderSummaryDisplay === 'function') {
    updateOrderSummaryDisplay();
  }
  
  // עדכון תצוגת קונדיטוריית עמר
  if (typeof refreshAmarSummary === 'function') {
    refreshAmarSummary();
  }
  
  // עדכון תצוגת מוצרי מטבח בסיכום
  if (category === 'kitchenProducts' && typeof updateKitchenProductsSummary === 'function') {
    updateKitchenProductsSummary();
  }
}

// ===== Drag & Drop (סידור ידני ורב-קטגוריות) =====
let dragState = { sourceListId: null, draggingEl: null };

function setupDragAndDrop() {
  const lists = ['kitchenProductsList','sushiList','bakeryList','warehouseList','onlineList','kitchenList','amarList'];
  lists.forEach(id => {
    const ul = document.getElementById(id);
    if (!ul) return;
    attachDropZoneHandlers(ul);
    // הפיכת פריטים קיימים לגרירים
    Array.from(ul.children).forEach(li => {
      ensureDragHandle(li);
      li.removeAttribute('draggable');
    });
  });
}

function ensureDragHandle(li) {
  if (!li) return;
  let handle = li.querySelector('.dnd-handle');
  if (!handle) {
    handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'dnd-handle';
    handle.title = 'גרור לשינוי סדר';
    handle.textContent = '⇅';
    // מקם את הידית ליד כפתורי הפעולה אם יש, אחרת בסוף ה-li
    const buttons = li.querySelectorAll('button');
    if (buttons && buttons.length > 0) {
      const lastBtn = buttons[buttons.length - 1];
      lastBtn.after(handle);
    } else {
      li.appendChild(handle);
    }
  }
  
  // תמיכה במובייל - לחיצה ארוכה ואז גרירה
  let touchStartTime = 0;
  let touchStartY = 0;
  let isLongPress = false;
  let longPressTimer = null;
  
  // אירועי מגע למובייל
  handle.addEventListener('touchstart', (e) => {
    touchStartTime = Date.now();
    touchStartY = e.touches[0].clientY;
    isLongPress = false;
    
    // טיימר ללחיצה ארוכה
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      handle.style.backgroundColor = '#ffc107';
      handle.style.color = '#212529';
      handle.textContent = 'גרור';
      
      // הוספת אפקט ויזואלי
      li.style.transform = 'scale(1.05)';
      li.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      li.style.zIndex = '1000';
    }, 500);
  });
  
  handle.addEventListener('touchmove', (e) => {
    if (isLongPress) {
      e.preventDefault();
      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartY;
      
      // הזזת הפריט עם האצבע
      li.style.transform = `translateY(${deltaY}px) scale(1.05)`;
      
      // מציאת מיקום הנפילה
      const afterElement = getDragAfterElement(li.parentNode, touch.clientY);
      if (afterElement == null) {
        li.parentNode.appendChild(li);
      } else {
        li.parentNode.insertBefore(li, afterElement);
      }
    }
  });
  
  handle.addEventListener('touchend', (e) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    
    if (isLongPress) {
      e.preventDefault();
      // שחזור עיצוב
      li.style.transform = '';
      li.style.boxShadow = '';
      li.style.zIndex = '';
      handle.style.backgroundColor = '';
      handle.style.color = '';
      handle.textContent = '⇅';
      
      // שמירת הסדר החדש
      saveOrderDetails();
      showNotification('✅ הסדר עודכן', 'green', { duration: 1500 });
    }
    
    isLongPress = false;
  });
  
  // רק הידית היא draggable (למחשב)
  handle.setAttribute('draggable', 'true');
  handle.addEventListener('dragstart', (e) => onDragStart(e, li));
  handle.addEventListener('dragend', onDragEnd);
  
  // שכפול עדין בקליק ימני על הידית (ללא הוספת כפתורים גלויים)
  if (!handle._dupBound) {
    handle.addEventListener('contextmenu', (e) => {
      try { e.preventDefault(); } catch {}
      tinyConfirm({ title: 'שכפול פריט', message: 'לשכפל פריט זה?', confirmText: 'שכפל', cancelText: 'ביטול' })
        .then(ok => { if (ok) duplicateListItem(li); });
    });
    handle._dupBound = true;
  }
}

function attachDropZoneHandlers(listEl) {
  listEl.addEventListener('dragover', onDragOver);
  listEl.addEventListener('drop', onDrop);
  listEl.addEventListener('dragenter', onDragEnter);
  listEl.addEventListener('dragleave', onDragLeave);
  // מוסיף observer כדי להוסיף ידיות לגרירה לכל פריט חדש
  try {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        m.addedNodes && m.addedNodes.forEach(node => {
          if (node && node.nodeType === 1 && node.tagName === 'LI') {
            ensureDragHandle(node);
            // ודא שאין draggable על ה-li עצמו
            node.removeAttribute('draggable');
          }
        });
      });
    });
    observer.observe(listEl, { childList: true });
  } catch (e) {}
}

function onDragStart(e, liEl) {
  const el = liEl || e.target.closest('li');
  dragState.draggingEl = el;
  dragState.sourceListId = el?.closest('ul')?.id || null;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', (el?.textContent || '').trim());
  try { e.dataTransfer.setDragImage(el, 10, 10); } catch (err) {}
  requestAnimationFrame(() => {
    if (el) el.classList.add('dragging');
  });
}

function onDragEnd(e) {
  const el = e.target.closest('li') || e.target;
  if (el && el.classList) el.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  dragState.draggingEl = null;
  dragState.sourceListId = null;
}

function onDragEnter(e) {
  if (e.currentTarget.tagName === 'UL') {
    e.currentTarget.classList.add('drag-over');
  }
}

function onDragLeave(e) {
  if (e.currentTarget.tagName === 'UL') {
    e.currentTarget.classList.remove('drag-over');
  }
}

function onDragOver(e) {
  e.preventDefault();
  const list = e.currentTarget;
  const dragging = dragState.draggingEl || document.querySelector('.dragging');
  if (!dragging) return;
  if (e.dataTransfer) { e.dataTransfer.dropEffect = 'move'; }
  const afterEl = getDragAfterElement(list, e.clientY);
  if (afterEl == null) {
    list.appendChild(dragging);
  } else {
    list.insertBefore(dragging, afterEl);
  }
}

function onDrop(e) {
  e.preventDefault();
  const targetList = e.currentTarget;
  targetList.classList.remove('drag-over');
  
  // עדכון כפתורי מחיקה/עריכה בפריט שנגרר לקטגוריה החדשה
  const draggedLi = dragState.draggingEl || document.querySelector('.dragging');
  if (draggedLi && targetList) {
    const newCategory = (targetList.id || '').replace('List', '');
    if (newCategory) {
      updateListItemButtons(draggedLi, newCategory);
    }
  }
  
  // עדכון כפתורים ושמירת סדר
  updateCategoryButtonsVisibility();
  saveOrderDetails();
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// שכפול פריט בסיכום — נוצר חדש מיד אחרי המקור, בעדינות
function duplicateListItem(sourceLi) {
  if (!sourceLi || sourceLi.tagName !== 'LI') return;
  const list = sourceLi.closest('ul');
  if (!list) return;
  // שכפול מלא של ה-LI כולל כפתורים/תויות
  const clone = sourceLi.cloneNode(true);
  // הסרת ידיות גרירה קיימות בקלון כדי לא ליצור כפילויות מאזינים
  Array.from(clone.querySelectorAll('.dnd-handle')).forEach(h => h.remove());
  // הוספת ידית חדשה ו-binding תקין
  ensureDragHandle(clone);
  
  // עדכון כפתורי מחיקה/עריכה בפריט המשוכפל לקטגוריה הנוכחית
  const currentCategory = (list.id || '').replace('List', '');
  updateListItemButtons(clone, currentCategory);
  
  list.insertBefore(clone, sourceLi.nextSibling);
  updateCategoryButtonsVisibility();
  saveOrderDetails();
  try { if (typeof showNotification === 'function') showNotification('✅ הפריט שוכפל', 'green', { duration: 1500 }); } catch {}
  // פתח מיד עריכה עבור השכפול החדש כדי לאפשר שינוי כמות/תוכן
  try {
    const editBtn = clone.querySelector('.edit-btn');
    if (editBtn) {
      setTimeout(() => {
        try { openEditPopup(editBtn, currentCategory); } catch {}
      }, 0);
    }
  } catch {}
  return clone;
}

// עדכון כפתורי מחיקה/עריכה בפריט לקטגוריה חדשה (לאחר גרירה/שכפול)
function updateListItemButtons(li, category) {
  if (!li || !category) return;
  
  // עדכון כפתור מחיקה
  const deleteBtn = li.querySelector('.delete-btn');
  if (deleteBtn) {
    // הסרת מאזינים ישנים
    deleteBtn.removeAttribute('onclick');
    deleteBtn.onclick = null;
    // הוספת מאזין חדש עם הקטגוריה הנכונה
    deleteBtn.setAttribute('onclick', `removeProduct(this, '${category}')`);
    deleteBtn.onclick = function() { 
      if (typeof removeProduct === 'function') {
        removeProduct(this, category);
      }
    };
  }
  
  // עדכון כפתור עריכה
  const editBtn = li.querySelector('.edit-btn');
  if (editBtn) {
    // הסרת מאזינים ישנים
    editBtn.removeAttribute('onclick');
    editBtn.onclick = null;
    // הוספת מאזין חדש עם הקטגוריה הנכונה
    editBtn.setAttribute('onclick', `openEditPopup(this, '${category}')`);
    editBtn.onclick = function() { 
      if (typeof openEditPopup === 'function') {
        openEditPopup(this, category);
      }
    };
  }
}

// מודאל אישור קטן ועדין במרכז המסך
function tinyConfirm({ title='אישור פעולה', message='האם לבצע?', confirmText='אישור', cancelText='ביטול' } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.25);z-index:10000;display:flex;align-items:center;justify-content:center;';
    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.2);min-width:240px;max-width:90vw;padding:16px 16px;direction:rtl;text-align:center;border:1px solid #e9ecef;';
    card.innerHTML = `
      <div style="font-weight:700;color:#333;margin-bottom:8px;">${title}</div>
      <div style="color:#555;margin-bottom:14px;">${message}</div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button type="button" data-act="cancel" style="padding:8px 14px;border:1px solid #ced4da;background:#fff;color:#495057;border-radius:8px;cursor:pointer;">${cancelText}</button>
        <button type="button" data-act="ok" style="padding:8px 14px;border:none;background:#28a745;color:#fff;border-radius:8px;cursor:pointer;">${confirmText}</button>
      </div>`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    const cleanup = (result) => { try { document.body.removeChild(overlay); } catch {}; resolve(result); };
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) cleanup(false); });
    card.querySelector('[data-act="cancel"]').addEventListener('click', () => cleanup(false));
    card.querySelector('[data-act="ok"]').addEventListener('click', () => cleanup(true));
  });
}

// ===== שמירת/טעינת סדר ההזמנה =====
function saveOrderDetails() {
  const lists = ['kitchenProductsList','sushiList','bakeryList','warehouseList','onlineList'];
  const data = {};
  lists.forEach(id => {
    const ul = document.getElementById(id);
    if (!ul) return;
    data[id] = Array.from(ul.children).map(li => ({
      text: li.textContent,
      temperature: li.getAttribute('data-temperature') || ''
    }));
  });
  try {
    sessionStorage.setItem('orderSummaryLists', JSON.stringify(data));
    
    // שמירת פרטי הזמנה ל-localStorage
    const orderNumber = document.getElementById('orderNumber')?.value || '';
    const orderDate = document.getElementById('orderDate')?.value || '';
    const orderTime = document.getElementById('orderTime')?.value || '';
    
    localStorage.setItem('orderNumber', orderNumber);
    localStorage.setItem('orderDate', orderDate);
    localStorage.setItem('orderTime', orderTime);
  } catch (e) {}
}

function loadOrderDetails() {
  let data = null;
  try {
    data = JSON.parse(sessionStorage.getItem('orderSummaryLists') || 'null');
  } catch (e) { data = null; }
  if (!data) return;
  Object.keys(data).forEach(listId => {
    const ul = document.getElementById(listId);
    if (!ul) return;
    ul.innerHTML = '';
    (data[listId] || []).forEach(item => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      
      // תמיכה בפורמט הישן (טקסט בלבד) והחדש (אובייקט עם טקסט וטמפרטורה)
      if (typeof item === 'string') {
        span.textContent = item;
      } else {
        span.textContent = item.text;
        if (item.temperature) {
          li.setAttribute('data-temperature', item.temperature);
        }
      }
      
      li.appendChild(span);
      ensureDragHandle(li);
      ul.appendChild(li);
    });
  });
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

  fetch(((typeof config !== 'undefined' && typeof config.getApiBaseUrl === 'function') ? config.getApiBaseUrl() : (window.API_BASE_URL || window.location.origin)) + '/send-whatsapp', {
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
    { listId: 'bakeryList', buttonId: 'whatsappBakeryButton', checkProduct19100: true },
    { listId: 'onlineList', buttonId: 'whatsappFruitsButton' },
  ];
  categories.forEach(({ listId, buttonId, checkProduct19100 }) => {
    const btn = document.getElementById(buttonId);
    const list = document.getElementById(listId);
    if (!btn || !list) return;
    
    let hasItems = list.children.length > 0;
    
    // בדיקה מיוחדת לקונדיטורייה - גם אם יש מוצר 19100 בכל רשימה
    if (checkProduct19100 && !hasItems) {
      const allLists = document.querySelectorAll("#kitchenList li, #bakeryList li, #onlineList li, #warehouseList li, #amarList li");
      for (const item of allLists) {
        const codeEl = item.querySelector(".product-code");
        if (codeEl) {
          const productCode = codeEl.textContent.match(/מק"ט: (\d+)/)?.[1];
          const parentListId = item.closest("ul")?.id;
          // Ignore product 19100 when it belongs to Amar's bakery list
          if (productCode === "19100" && parentListId !== "amarList") {
            hasItems = true;
            break;
          }
        }
      }
    }
    
    btn.style.display = hasItems ? '' : 'none';
  });
}
// ... existing code ...
function removeProduct(button, category) {
  const listItem = button.closest("li");
  if (!listItem) return;
  
  // מציאת הקטגוריה האמיתית מהרשימה שבה הפריט נמצא (למקרה שהפריט נגרר)
  const actualList = listItem.closest('ul');
  let actualCategory = category;
  if (actualList && actualList.id) {
    actualCategory = actualList.id.replace('List', '');
  }
  
  // מחיקה מהרשימה האמיתית (לא מהקטגוריה שהועברה לכפתור)
  if (actualList) {
    actualList.removeChild(listItem);
  } else if (category) {
    // fallback: נסה עם הקטגוריה שהועברה (למקרה שלא מצאנו רשימה)
    const fallbackList = document.getElementById(`${category}List`);
    if (fallbackList && fallbackList.contains(listItem)) {
      fallbackList.removeChild(listItem);
    }
  }
  
    updateCategoryButtonsVisibility();
    saveOrderDetails();
  
  // עדכון תצוגת סיכום ההזמנה
  if (typeof updateOrderSummaryDisplay === 'function') {
    updateOrderSummaryDisplay();
  }
  
  // עדכון תצוגת קונדיטוריית עמר
  if (typeof refreshAmarSummary === 'function') {
    refreshAmarSummary();
  }
}
// ... existing code ...
window.addEventListener('DOMContentLoaded', function() {
  updateCategoryButtonsVisibility();
  // MutationObserver לכל קטגוריה - כולל כל הרשימות כדי לזהות מוצר 19100
  ['kitchenProductsList','sushiList','bakeryList','warehouseList','onlineList','kitchenList','amarList'].forEach(listId => {
    const target = document.getElementById(listId);
    if (target) {
      const observer = new MutationObserver(() => {
        updateCategoryButtonsVisibility();
        if (typeof updateOrderSummaryDisplay === 'function') {
          updateOrderSummaryDisplay();
        }
        if (typeof refreshAmarSummary === 'function') {
          refreshAmarSummary();
        }
      });
      observer.observe(target, { childList: true });
    }
  });
  // אתחול גרירה ושחרור ושחזור סדר שמור
  setupDragAndDrop();
  loadOrderDetails();
  
  // עדכון תצוגת סיכום ההזמנה בטעינת הדף
  setTimeout(() => {
    if (typeof updateOrderSummaryDisplay === 'function') {
      updateOrderSummaryDisplay();
    }
    if (typeof refreshAmarSummary === 'function') {
      refreshAmarSummary();
    }
  }, 100);
});
// ... existing code ...

function generateAmarSummary() {
    const amarList = document.getElementById("amarList");
    const orderDateInput = document.getElementById("orderDate").value;
    const orderDate = new Date(orderDateInput);
    const orderTime = document.getElementById("orderTime").value;
    const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
    const dayName = days[orderDate.getDay()];
    const orderNumber = document.getElementById("orderNumber").value;
  
    // הוספת תאריך קצר (יום/חודש) בכותרת כמו בקונדיטוריה הרגילה
    const shortDate = orderDateInput
      ? `${String(orderDate.getDate()).padStart(2, '0')}/${String(orderDate.getMonth() + 1).padStart(2, '0')}`
      : '';
    const dayWithDate = shortDate ? `${dayName} ${shortDate}` : dayName;

    let summary = `*הזמנה אונליין ליום ${dayWithDate} עד השעה: ${orderTime}*\n\n`;
    let corassonTotal = 0, jabettaTotal = 0, grisiniTotal = 0;
    let focacciaTotal = 0, bakeryTotal = 0, finukimTotal = 0;
    let focaccinotTotal = 0;
    const bisTypeTotals = {};
    let hasAmarProducts = false;
  
    const corassonCodes = ["12626", "410", "415"];
    const amarProductCodes = [
      "12626", "12408", "12409", "19102", "12622", "12624", "13473", "410", "415", "19105"
    ];

    // Track seen items to avoid double-printing later
    const seenCodes = new Set();
    const seenTexts = new Set();

    const allLists = [
      ...document.querySelectorAll("#kitchenList li, #bakeryList li, #onlineList li, #warehouseList li"),
      ...amarList.querySelectorAll("li")
    ];
  
    allLists.forEach((item) => {
      const codeEl = item.querySelector(".product-code");
      if (!codeEl) return;
      const productCode = codeEl.textContent.match(/מק"ט: (\d+)/)?.[1];
      const itemText = item.getAttribute("data-raw-summary") || item.querySelector("span")?.textContent || "";
  
      if (amarProductCodes.includes(String(productCode)) || (typeof bisProducts !== 'undefined' && bisProducts.includes(String(productCode)))) {
        hasAmarProducts = true;
      }
  
      // כמויות לפי מק"ט
      let match;
      if (corassonCodes.includes(String(productCode))) {
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
        grisiniTotal += match ? parseInt(match[1]) * 14 : 0;
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
      if (typeof bisProducts !== 'undefined' && bisProducts.includes(String(productCode))) {
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
  
    // מוצרים ידניים ב־amarList (נוסיף רק כאלה שלא נספרו קודם)
    amarList.querySelectorAll("li").forEach((item) => {
      const codeEl = item.querySelector(".product-code");
      const textSpan = item.querySelector("span");
      const text = (textSpan?.textContent || "").replace(/\|BREAD_TYPE:[^|]+\|/g, "").trim();
      const code = codeEl?.textContent.match(/מק"ט: (\d+)/)?.[1] || null;

      const textKey = text.replace(/\s+/g, ' ').trim();
      const alreadyCounted = (code && seenCodes.has(code)) || (textKey && seenTexts.has(textKey));
      if (text && !alreadyCounted) {
      summary += `● ${text}\n\n`;
      }
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
            .then(() => showNotification("הסיכום  הועתק בהצלחה!", "green"))
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
    // Hide small Amar summary under the list; keep only main product display
    const el = document.getElementById("amarSummaryDisplay");
    if (el) {
      el.innerText = '';
      el.style.display = 'none';
    }
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

// פונקציה לפתיחת מערכת ניהול המוצרים
function openProductManagement() {
    // פתיחת הבאק בדף חדש
    window.open('admin.html', '_blank');
}

// פונקציה לפתיחת מערכת ניהול ההזמנות
function openOrdersManagement() {
    console.log('openOrdersManagement נקרא');
    
    // בדיקה ישירה של המודל
    const modal = document.getElementById('ordersManagementModal');
    console.log('המודל נמצא?', !!modal);
    
    if (modal) {
        console.log('פותח את המודל ישירות');
        modal.style.display = 'block';
        
        // טעינת הזמנות אם המודל נפתח
        if (window.orderManager) {
            window.orderManager.loadOrdersHistory();
        } else {
            // יצירת OrderManager אם לא קיים
            if (typeof OrderManager !== 'undefined') {
                window.orderManager = new OrderManager();
                window.orderManager.init();
            }
        }
    } else {
        console.error('המודל ordersManagementModal לא נמצא');
        alert('שגיאה: המודל לא נמצא. בדוק שהקוד נטען נכון.');
    }
}

// פונקציה לשמירת הזמנה נוכחית בענן
async function saveCurrentOrderToCloud(showIndicator = true) {
    try {
        console.log('💾 saveCurrentOrderToCloud נקרא');
        
        // הצגת אינדיקטור טעינה (רק אם לא שמירה אוטומטית)
        if (showIndicator) {
            showSaveLoadingIndicator();
        }
        
        // שמירה תמיד מעדכנת - אין מניעת שמירה כפולה
        console.log('💾 המערכת שומרת/מעדכנת את ההזמנה בענן');
        
        const orderData = {
            customerName: 'הזמנה ללא שם',
            orderNumber: document.getElementById('orderNumber')?.value || '',
            orderDate: document.getElementById('orderDate')?.value || '',
            orderTime: document.getElementById('orderTime')?.value || '',
            items: {
                kitchen: Array.from(document.getElementById('kitchenList')?.children || []).map(li => {
                  const cloned = li.cloneNode(true);
                  return cloned.outerHTML;
                }),
                kitchenProducts: Array.from(document.getElementById('kitchenProductsList')?.children || []).map(li => {
                  const cloned = li.cloneNode(true);
                  return cloned.outerHTML;
                }),
                fruits: Array.from(document.getElementById('fruitsList')?.children || []).map(li => {
                  const cloned = li.cloneNode(true);
                  return cloned.outerHTML;
                }),
                bakery: Array.from(document.getElementById('bakeryList')?.children || []).map(li => {
                  const cloned = li.cloneNode(true);
                  return cloned.outerHTML;
                }),
                warehouse: Array.from(document.getElementById('warehouseList')?.children || []).map(li => {
                  const cloned = li.cloneNode(true);
                  return cloned.outerHTML;
                }),
                sushi: Array.from(document.getElementById('sushiList')?.children || []).map(li => {
                  const cloned = li.cloneNode(true);
                  return cloned.outerHTML;
                }),
                amar: Array.from(document.getElementById('amarList')?.children || []).map(li => {
                  const cloned = li.cloneNode(true);
                  return cloned.outerHTML;
                }),
                online: Array.from(document.getElementById('onlineList')?.children || []).map(li => {
                  const cloned = li.cloneNode(true);
                  return cloned.outerHTML;
                })
            },
            total: calculateOrderTotal(),
            notes: document.getElementById('orderNotes')?.value || ''
        };

        // בדיקה אם יש פריטים לשמירה
        const totalItems = Object.values(orderData.items).reduce((sum, items) => sum + items.length, 0);
        if (totalItems === 0) {
            showNotification('אין פריטים לשמירה!', 'error');
            return;
        }

        console.log('📦 פריטים שנאספו:', orderData.items);
        console.log('📊 סה"כ פריטים:', totalItems);

        const response = await fetch(`${window.API_BASE_URL || window.location.origin}/api/orders/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ הזמנה נשמרה בהצלחה:', result);
            
            // שמירת מספר ההזמנה מקומית לבדיקות עתידיות
            if (orderData.orderNumber) {
                const savedOrderNumbers = JSON.parse(localStorage.getItem('savedOrderNumbers') || '[]');
                if (!savedOrderNumbers.includes(orderData.orderNumber)) {
                    savedOrderNumbers.push(orderData.orderNumber);
                    localStorage.setItem('savedOrderNumbers', JSON.stringify(savedOrderNumbers));
                    console.log('💾 מספר הזמנה נשמר מקומית:', orderData.orderNumber);
                }
            }
            
            showNotification('ההזמנה נשמרה בענן בהצלחה!', 'green');
        } else {
            const errorText = await response.text();
            console.error('❌ שגיאה בשמירת ההזמנה:', response.status, errorText);
            throw new Error(`שגיאה בשמירת ההזמנה: ${errorText}`);
        }
    } catch (error) {
        console.error('❌ שגיאה בשמירת ההזמנה:', error);
        showNotification('שגיאה בשמירת ההזמנה בענן: ' + error.message, 'red');
    } finally {
        // הסתרת אינדיקטור הטעינה
        hideSaveLoadingIndicator();
    }
}

function showSaveLoadingIndicator() {
    // יצירת אינדיקטור טעינה יפה
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'saveLoadingIndicator';
    loadingDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;
    loadingDiv.innerHTML = `
        <div style="width: 80px; height: 80px; border: 6px solid #f3f3f3; border-top: 6px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
        <div style="font-size: 1.3rem; font-weight: bold; color: #007bff; text-align: center;">
            שומר הזמנה בענן...<br>
            <span style="font-size: 1rem; color: #666; font-weight: normal;">אנא המתן</span>
        </div>
    `;
    document.body.appendChild(loadingDiv);
}

function hideSaveLoadingIndicator() {
    const loadingDiv = document.getElementById('saveLoadingIndicator');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// פונקציה לחישוב סה"כ ההזמנה
function calculateOrderTotal() {
    // נחזיר מספר פריטים פשוט כרגע
    const categories = ['kitchenProductsList', 'fruitsList', 'bakeryList', 'warehouseList', 'sushiList', 'amarList'];
    let totalItems = 0;
    
    categories.forEach(categoryId => {
        const list = document.getElementById(categoryId);
        if (list) {
            totalItems += list.children.length;
        }
    });
    
    return totalItems;
}

// פונקציה לניקוי כפילויות ברשימה
function removeDuplicatesFromList(categoryList) {
    const items = Array.from(categoryList.children);
    const seenItems = new Set();
    const itemsToRemove = [];
    
    items.forEach((item, index) => {
        const span = item.querySelector('span');
        const codeEl = item.querySelector('.product-code');
        let itemKey = '';
        
        if (codeEl) {
            // מוצר עם מק"ט - השתמש במק"ט כמפתח
            const productCode = codeEl.textContent.match(/מק"ט: (\d+)/)?.[1];
            if (productCode) {
                itemKey = `code_${productCode}`;
            }
        }
        
        if (!itemKey && span) {
            // מוצר ללא מק"ט - השתמש בטקסט כמפתח
            itemKey = `text_${span.textContent.trim()}`;
        }
        
        if (itemKey) {
            if (seenItems.has(itemKey)) {
                itemsToRemove.push(item);
            } else {
                seenItems.add(itemKey);
            }
        }
    });
    
    // הסר כפילויות
    itemsToRemove.forEach(item => item.remove());
    
    return itemsToRemove.length;
}

// פונקציית סידור חכם לפי טמפרטורה באתר הראשי
function smartSortByTemperature() {
    const categories = ['kitchen', 'bakery', 'online', 'warehouse', 'sushi', 'kitchenProducts', 'amar'];
    
    categories.forEach(category => {
        const categoryList = document.getElementById(category + 'List');
        if (!categoryList || categoryList.children.length === 0) return;
        
        // לא מסירים כפילויות בשום קטגוריה
        
        // רק לקטגוריית מוצרי מטבח נוסיף הפרדה חם/קר
        if (category === 'kitchenProducts') {
            // המרה לרשימה מסודרת - רק מוצרים אמיתיים (לא כותרות)
            const items = Array.from(categoryList.children).filter(item => 
                !item.classList.contains('temperature-header')
            );
            
            // חלוקה לפי טמפרטורה
            const hotItems = items.filter(item => item.getAttribute('data-temperature') === 'hot');
            const coldItems = items.filter(item => item.getAttribute('data-temperature') === 'cold');
            const defaultItems = items.filter(item => !item.getAttribute('data-temperature') || item.getAttribute('data-temperature') === '');
            
            // ניקוי הרשימה לחלוטין
            categoryList.innerHTML = '';
            
            // הוספת מוצרים חמים עם כותרת
            if (hotItems.length > 0) {
                const hotHeader = document.createElement('div');
                hotHeader.className = 'temperature-header hot-header';
                hotHeader.innerHTML = '<strong>🔥 מטבח חם:</strong>';
                categoryList.appendChild(hotHeader);
                hotItems.forEach(item => categoryList.appendChild(item));
            }
            
            // הוספת מוצרים קרים עם כותרת
            if (coldItems.length > 0) {
                const coldHeader = document.createElement('div');
                coldHeader.className = 'temperature-header cold-header';
                coldHeader.innerHTML = '<strong>❄️ מטבח קר:</strong>';
                categoryList.appendChild(coldHeader);
                coldItems.forEach(item => categoryList.appendChild(item));
            }
            
            // הוספת מוצרים רגילים
            defaultItems.forEach(item => categoryList.appendChild(item));
        } else {
            // לקטגוריות אחרות - סידור רגיל
            const items = Array.from(categoryList.children);
            
            // סידור לפי טמפרטורה: חם קודם, ברירת מחדל באמצע, קר אחרון
            items.sort((a, b) => {
                const tempA = a.getAttribute('data-temperature') || '';
                const tempB = b.getAttribute('data-temperature') || '';
                
                // חם קודם
                if (tempA === 'hot' && tempB !== 'hot') return -1;
                if (tempB === 'hot' && tempA !== 'hot') return 1;
                
                // קר אחרון
                if (tempA === 'cold' && tempB !== 'cold') return 1;
                if (tempB === 'cold' && tempA !== 'cold') return -1;
                
                // ברירת מחדל באמצע - שמירה על סדר יחסי
                return 0;
            });
            
            // עדכון הרשימה
            categoryList.innerHTML = '';
            items.forEach(item => categoryList.appendChild(item));
        }
    });
    
    showNotification('✅ המוצרים סודרו לפי טמפרטורה!', 'success');
    saveOrderDetails();
    
    // עדכון תצוגת הסיכום הראשי
    if (typeof updateOrderSummaryDisplay === 'function') {
        updateOrderSummaryDisplay();
    }
    if (typeof refreshAmarSummary === 'function') {
        refreshAmarSummary();
    }
}

// פונקציה לסידור אוטומטי של מוצרי מטבח לפי טמפרטורה
function sortKitchenProductsByTemperature() {
    const categoryList = document.getElementById('kitchenProductsList');
    if (!categoryList || categoryList.children.length === 0) return;
    
    // המרה לרשימה מסודרת - רק מוצרים אמיתיים (לא כותרות)
    const items = Array.from(categoryList.children).filter(item => 
        !item.classList.contains('temperature-header')
    );
    
    // חלוקה לפי טמפרטורה
    const hotItems = items.filter(item => item.getAttribute('data-temperature') === 'hot');
    const coldItems = items.filter(item => item.getAttribute('data-temperature') === 'cold');
    const defaultItems = items.filter(item => !item.getAttribute('data-temperature') || item.getAttribute('data-temperature') === '');
    
    // ניקוי הרשימה לחלוטין
    categoryList.innerHTML = '';
    
    // הוספת מוצרים חמים עם כותרת
    if (hotItems.length > 0) {
        const hotHeader = document.createElement('div');
        hotHeader.className = 'temperature-header hot-header';
        hotHeader.innerHTML = '<strong>🔥 מטבח חם:</strong>';
        categoryList.appendChild(hotHeader);
        hotItems.forEach(item => {
            // הוספת ידית גרירה מחדש
            ensureDragHandle(item);
            categoryList.appendChild(item);
        });
    }
    
    // הוספת מוצרים קרים עם כותרת
    if (coldItems.length > 0) {
        const coldHeader = document.createElement('div');
        coldHeader.className = 'temperature-header cold-header';
        coldHeader.innerHTML = '<strong>❄️ מטבח קר:</strong>';
        categoryList.appendChild(coldHeader);
        coldItems.forEach(item => {
            // הוספת ידית גרירה מחדש
            ensureDragHandle(item);
            categoryList.appendChild(item);
        });
    }
    
    // הוספת מוצרים רגילים
    defaultItems.forEach(item => {
        // הוספת ידית גרירה מחדש
        ensureDragHandle(item);
        categoryList.appendChild(item);
    });
    
    // עדכון תצוגת הסיכום הראשי
    if (typeof updateOrderSummaryDisplay === 'function') {
        updateOrderSummaryDisplay();
    }
}

// פונקציה לעדכון תצוגת מוצרי מטבח בסיכום
function updateKitchenProductsSummary() {
    const kitchenProductsList = document.getElementById('kitchenProductsList');
    if (!kitchenProductsList) return;
    
    // סידור אוטומטי לפי טמפרטורה
    sortKitchenProductsByTemperature();
}





