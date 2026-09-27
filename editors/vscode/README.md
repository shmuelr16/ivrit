# עִבְרִית לעורך הקוד

הרשתה ל־VS Code ול־Cursor עבור שפת עִבְרִית: תחביר צבעוני, השלמות, בנייה ל-HTML
והצגה מקדימה בתוך העורך.

## התקנה

מתיקיית `editors/vscode`:

```bash
node scripts/vendor.js        # מעתיק את המקמפל לתוך ההרשתה
node scripts/make-vsix.js     # אורז ivrit-1.0.0.vsix
cursor --install-extension ivrit-1.0.0.vsix
# או ב-VS Code: Extensions: Install from VSIX...
```

לפיתוח: פתחו את `editors/vscode` בעורך ולחצו `F5` (Extension Development Host).

## שימוש

| פקודה | קיצור | מה זה עושה |
| --- | --- | --- |
| עִבְרִית: בנה ל-HTML | `⌘⌥B` | מקמפל את הקובץ ל־`dist/<שם>.html` |
| עִבְרִית: הצג בתצוגה מקדימה | `⌘⌥V` | פותח חלונית עם התוצאה |
| עִבְרִית: בדוק קובץ | - | מציג שגיאות ואזהרות |

הקובץ נבנה אוטומטית בכל שמירה (`ivrit.build.autoSave`), והתצוגה המקדימה
מתעדכנת אוטומטית אם היא פתוחה. שגיאות מופיעות בלוח הבעיות עם שורה ועמודה.

## הגדרות

| הגדרה | ברירת מחדל | תיאור |
| --- | --- | --- |
| `ivrit.build.autoSave` | `true` | בנייה בכל שמירה |
| `ivrit.build.outputDir` | `dist` | תיקיית הפלט |
| `ivrit.check.showWarnings` | `true` | הצגת אזהרות בלוח הבעיות |
