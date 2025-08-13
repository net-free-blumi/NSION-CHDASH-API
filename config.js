// הגדרות גלובליות למערכת
const config = {
    // פונקציה להשגת כתובת השרת
    getApiBaseUrl: function() {
        return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:5000'
            : window.location.origin;
    }
};
