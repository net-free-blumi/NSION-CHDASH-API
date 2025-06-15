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
    const messageTextarea = document.getElementById('whatsappMessage');
    
    if (!modal || !messageTextarea) {
        console.error('Modal elements not found!');
        return;
    }
    
    // Get the current order summary
    const orderNumber = localStorage.getItem("orderNumber") || "";
    const orderDate = localStorage.getItem("orderDate") || "";
    const orderTime = localStorage.getItem("orderTime") || "";
    const temperature = localStorage.getItem("temperature") || "";
    const formattedDate = orderDate ? formatDateToDDMMYYYY(orderDate) : "";

    // בדוק אם יש מוצרים בסיכום ההזמנה
    const hasProducts = ["kitchen", "bakery", "online", "warehouse"].some((category) => {
        return document.getElementById(`${category}List`).children.length > 0;
    });

    if (!hasProducts) {
        showNotification("אין מוצרים בסיכום ההזמנה.", "red");
        return;
    }

    let message = `*הזמנה מס: ${orderNumber}*\n*תאריך: ${formattedDate}*\n*שעה: ${orderTime}*\n\n`;

    // רשימת הקטגוריות שיכללו בסיכום הכללי
    ["kitchen", "bakery", "online", "warehouse"].forEach((category) => {
        const categoryItems = Array.from(document.getElementById(`${category}List`).children)
            .map((li) => {
                let text = li.firstElementChild.textContent;
                text = text.replace(/\(מק"ט: \d+\)/g, '')
                          .replace(/\|BREAD_TYPE:(ביס (שומשום|בריוש|קמח מלא|דגנים|פרג))\|/g, ' $1')
                          .trim();
                return text;
            })
            .filter((text) => text.trim() !== "");

        if (categoryItems.length > 0) {
            const categoryTitle = getCategoryTitle(category);
            message += `*${categoryTitle}:*\n${categoryItems.join("\n\n")}\n\n`;
        }
    });

    if (temperature) {
        message += `*הערות:* *"${temperature}"*\n`;
    }
    
    // Set the message in the textarea
    messageTextarea.value = message;
    
    // Show the modal
    modal.style.display = "block";
    
    // Focus on the textarea
    messageTextarea.focus();
}

function closeWhatsAppModal() {
    const modal = document.getElementById('whatsappModal');
    if (modal) {
        modal.style.display = "none";
    }
}

async function sendWhatsAppMessage() {
    const message = document.getElementById('whatsappMessage').value;
    const modal = document.getElementById('whatsappModal');
    
    if (!message.trim()) {
        showNotification("אין תוכן לשליחה!", "red");
        return;
    }
    
    // Show loading notification
    showNotification("שולח הודעה...", "blue");
    
    // Use our proxy server
    const url = 'http://localhost:3000/send-whatsapp';
    
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: message
        })
    };
    
    try {
        console.log('Sending message through proxy:', {
            url: url,
            messageLength: message.length
        });
        
        const response = await fetch(url, options);
        const responseData = await response.json();
        
        console.log('Proxy Response:', responseData);
        
        if (!response.ok) {
            throw new Error(responseData.details || responseData.error || 'שגיאה לא ידועה');
        }
        
        console.log('Message sent successfully:', responseData);
        showNotification("✅ ההודעה נשלחה בהצלחה!", "green");
        closeWhatsAppModal();
        
    } catch (error) {
        console.error('Error sending message:', error);
        let errorMessage = "❌ שגיאה בשליחת ההודעה!";
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage = "❌ השרת המקומי לא פעיל - יש להפעיל את השרת";
        } else if (error.message.includes('Unauthorized')) {
            errorMessage = "❌ שגיאת אימות - הטוקן לא תקין";
        } else if (error.message.includes('Forbidden')) {
            errorMessage = "❌ אין הרשאה לשלוח הודעה לקבוצה זו";
        } else if (error.message.includes('Not Found')) {
            errorMessage = "❌ קבוצת WhatsApp לא נמצאה";
        } else if (error.message.includes('Too Many Requests')) {
            errorMessage = "❌ חרגת ממכסת ההודעות היומית";
        }
        
        showNotification(errorMessage, "red");
    }
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

