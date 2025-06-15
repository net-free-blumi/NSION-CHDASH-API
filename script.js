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
        message += `\n<b>הערות:</b> <b>\"${temperature}\"</b>\n`;
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

function sendWhatsAppMessage() {
    const waEditable = document.getElementById('waEditable');
    if (!waEditable) {
        showNotification('שגיאה: לא נמצא אזור עריכה', 'red');
        return;
    }
    // המרת HTML לטקסט עם כוכביות (הדגשה) ושמירה על רווחים כפולים
    let message = waEditable.innerHTML
        .replace(/<br><br>/g, '\n\n') // רווח כפול
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

    showNotification('שולח הודעה...', 'info');
    
    fetch('https://whatsapp-order-system.onrender.com/send-whatsapp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
    })
    .then(response => {
        if (!response.ok) throw new Error('שגיאה בשליחת ההודעה');
        return response.json();
    })
    .then(() => {
        showNotification('✅ ההודעה נשלחה בהצלחה!', 'green');
        closeWhatsAppModal();
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('❌ שגיאה בשליחת ההודעה', 'red');
    });
}

// Add event listener for the close button
document.addEventListener('DOMContentLoaded', function() {
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.onclick = closeWhatsAppModal;
    }
    
    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('whatsappModal');
        if (event.target == modal) {
            closeWhatsAppModal();
        }
    }
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

