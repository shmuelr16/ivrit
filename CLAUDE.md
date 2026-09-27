# CLAUDE.md

הנחיות ל-Claude Code (claude.ai/code) לעבודה על המאגר הזה.

## מה זה

**עִבְרִית (Ivrit)** — שפת סימון בעברית שמתקמפלת ל-HTML ו-CSS נקיים, ממוקדת RTL מראש.
כותבים תגים, מאפיינים, משתנים, לולאות ו-CSS בעברית, ומקבלים קובץ HTML יחיד, רספונסיבי ונגיש.
**אין תלויות בזמן ריצה — רק Node.js.**

## פקודות עיקריות

```bash
# בנייה של קובץ .iv ל-HTML
node bin/ivrit.js build <קובץ.iv> -o dist/index.html

# שרת פיתוח עם טעינה מחדש
node bin/ivrit.js serve <קובץ.iv>

# בדיקת שגיאות בלי לייצר קובץ
node bin/ivrit.js check <קובץ.iv>

# מצב LTR לעורך: מוסיף סימני כיוון בלתי-נראים כדי שהעורך יציג את הקוד
# משמאל-לימין (הפלט לא מושפע). --off מסיר אותם.
node bin/ivrit.js ltr <קובץ.iv> [--off]

# בדיקות
npm test           # בדיקות השפה (test/ivrit.test.js)
npm run test:all   # כולל בדיקות ההרחבה

# בניית ההרחבה ל-VS Code / Cursor
cd editors/vscode && node scripts/vendor.js && node scripts/make-vsix.js
```

## ארכיטקטורה (`src/`)

| קובץ | תפקיד |
| --- | --- |
| `parser.js` | טקסט מקור → עץ תחביר (AST). מתעלם מסימני כיוון בלתי-נראים (דרך `ltr.js`). |
| `render.js` | AST → HTML + CSS. בונה את מעטפת המסמך (`<html><head><body>`). עוטף רצפי עברית בתוך קוד ב-`<bdi>` (תיקון RTL, ראה למטה). |
| `compiler.js` | נקודת הכניסה: `compile`, `compileFile`, `check`, `finalize`. מטפל בייבואים. |
| `dict.js` | מילון: תגים, מאפיינים ומילות CSS מעברית לאנגלית. |
| `expr.js` | מנוע הביטויים: `Scope`, `evaluate`, פונקציות מובנות. |
| `design.js` | ערכת העיצוב (`BASE_THEME`) ומחלקות העיצוב. |
| `ltr.js` | עזרי סימני כיוון (LRM) לעריכה נוחה בעורך + `stripBidiMarks` שהמהדר משתמש בו. |
| `server.js` | שרת הפיתוח (`serve`). |
| `newproject.js` | יצירת פרויקט חדש (`new`). |

## הרחבת העורך (`editors/vscode/`)

- `src/extension.js` — הפעלה, פקודות, אבחון (Diagnostics), תצוגה מקדימה, בנייה אוטומטית בשמירה.
- `src/preview.js` — בניית ה-HTML של חלונית התצוגה המקדימה.
- `vendor/` — **עותק** של `src/` + `bin/` (נוצר ע"י `scripts/vendor.js`). ההרחבה טוענת את המהדר מכאן כדי להיות עצמאית.
- פקודות וקיצורים: `ivrit.build` (⌘⌥B), `ivrit.preview` (⌘⌥V), `ivrit.open` (⌘⌥R), `ivrit.ltr` (⌘⌥L), `ivrit.check`.

> **חשוב:** אחרי כל שינוי בקבצי `src/`, יש להריץ `node editors/vscode/scripts/vendor.js` כדי לסנכרן ל-`vendor/`, אחרת ההרחבה תשתמש בגרסה ישנה.

## מה שנעשה בסשן הזה

1. **תיקון היפוך RTL בפלט** (`src/render.js`, `isolateBidi`): בבלוקי קוד מעורבים (עברית + `{ } < > ( )`) הפיסוק "התהפך" — למשל `פונקציה ברוכים(שם) { ... }` הוצג כ-`{ ... } פונקציה ברוכים(שם)`. הפתרון: לעטוף כל רצף עברית בתוך קוד ב-`<bdi>`, כך שתחת `direction: ltr` הסדר נשמר.
2. **מצב LTR לעורך** (`src/ltr.js`, פקודת `ltr`, `ivrit.ltr`/⌘⌥L): עורכי קוד מציגים שורה שמתחילה בעברית מימין-לשמאל ומפזרים את הסימנים. הוספת LRM בתחילת שורה מכריחה תצוגת שמאל-לימין. המהדר מתעלם מהסימנים כך שהפלט זהה.
3. **סובלנות המהדר לסימני כיוון** (`src/parser.js`): הפרסר מסיר סימני LRM/RLM וכו' לפני הניתוח.
4. **תיקון באג בהרחבה** (`src/extension.js`): `vscode.context.subscriptions` (לא קיים) הוחלף ב-`extContext.subscriptions`, מה שהפיל את התצוגה המקדימה.
5. **כלי הרצה למשתמש**: `הרץ-עברית.app` (droplet של AppleScript) — גוררים עליו כל קובץ `.iv` והדף נבנה ונפתח בדפדפן.

## איך מריצים קובץ `.iv` (למשתמש)

**דרך ההרחבה (VS Code / Cursor):** פותחים את הקובץ, **⌘S** בונה אוטומטית ל-`dist/`; **⌘⌥V** לתצוגה מקדימה בעורך; **⌘⌥R** לפתיחה בדפדפן.

**דרך הטרמינל:** `node bin/ivrit.js build קובץ.iv -o דף.html` ואז פותחים את `דף.html`.

**בלי עורך כלל (Mac):** לחיצה כפולה על `הרץ-עברית.app` ← בוחרים קובץ `.iv` ← הדף נפתח בדפדפן. עובד על כל קובץ.

## התקנת ההרחבה

```bash
cd editors/vscode
node scripts/vendor.js && node scripts/make-vsix.js
# VS Code:
code --install-extension ivrit-1.0.1.vsix
# Cursor:
cursor --install-extension ivrit-1.0.1.vsix
```
או דרך הממשק: Extensions (⌘⇧X) → תפריט "..." → Install from VSIX.

## מוסכמות

- הפלט תמיד RTL (`dir="rtl"`, `lang="he"`) אלא אם צוין אחרת ב-`<מסמך>`.
- כל תג עברי מקבל אוטומטית `class` בשמו (למשל `<פסקה>` → `class="פסקה ivrit-p"`).
- התוכן של `<קוד>` ו-`<קוד-בלוק>` מילולי (verbatim) — לא מריצים ולא מפרשים `{...}`.
- כל שינוי התנהגות → לעדכן/להוסיף בדיקה ב-`test/ivrit.test.js` ולוודא `npm run test:all` ירוק.
