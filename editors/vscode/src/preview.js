// preview.js - בניית ה-HTML של התצוגה המקדימה.
// מופרד מהרשתה כדי שיהיה אפשר לבדוק אותו בלי VS Code.
// CommonJS - VS Code טוען הרשתות עם require() ולא עם import.

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * בונה את תוכן חלונית התצוגה המקדימה.
 * @param {{html: string, errors: Array<{message: string}>}|null} result תוצאת קומפילציה
 * @param {string} [fileName] שם הקובץ להצגה בכותרת השגיאות
 * @returns {string} מסמך HTML מלא להצגה בתוך התצוגה המקדימה
 */
function buildPreviewHtml(result, fileName = '') {
  if (!result) {
    return '<!DOCTYPE html><html dir="rtl" lang="he"><body style="font-family:system-ui;padding:2rem">'
      + 'פותח קובץ <code>.iv</code> כדי לראות תצוגה מקדימה.</body></html>';
  }
  if (result.errors.length) {
    const items = result.errors
      .map((e) => `<li>${escapeHtml(cleanMessage(e.message))}</li>`)
      .join('');
    return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<style>body{font-family:system-ui,-apple-system,sans-serif;padding:1.5rem;background:#1a1a1a;color:#ffb4b4}
ul{padding-inline-start:1.2rem}li{margin:.35rem 0}</style></head>
<body><h2>שגיאות בקובץ ${escapeHtml(fileName)}</h2><ul>${items}</ul></body></html>`;
  }
  // ה-HTML של עִבְרִית הוא עמוד שלם עם CSS מוטמע - אפשר להטמיע אותו ישירות
  return result.html.replace(/<script[\s\S]*?<\/script>/giu, '');
}

/** מסיר את הקידומת "קובץ:שורה:עמודה — " מהודעת שגיאה */
function cleanMessage(message) {
  return String(message).replace(/^[^:]*:\d+:\d+\s*—\s*/u, '');
}

module.exports = { buildPreviewHtml, cleanMessage };
