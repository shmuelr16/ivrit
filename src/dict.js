// dict.js - מילוני התרגום של עִבְרִית
// כל מה שהמשתמש כותב בעברית מתורגם כאן ל-HTML / CSS רגיל.

const normalizeKey = (k) => k.replace(/[֑-ׇ]/g, '').toLowerCase();

// ── אלמנטים: עברית -> HTML ────────────────────────────────────────────────
export const ELEMENTS = {
  // מבנה המסמך
  'מסמך': { tag: 'html' },
  'ראש': { tag: 'head' },
  'גוף': { tag: 'body' },
  'נתיב': { tag: 'link', void: true },
  'תסריט': { tag: 'script', void: true },
  'מטא': { tag: 'meta', void: true },
  'גולמי': { raw: true },          // תוכן HTML גולמי, נכנס כמו שהוא

  // מבנה
  'עמוד': { tag: 'div' },
  'דיב': { tag: 'div' },
  'מקטע': { tag: 'span' },
  'ספן': { tag: 'span' },
  'מאגר': { tag: 'div', cls: 'ivrit-container' },
  'כרטיס': { tag: 'div', cls: 'ivrit-card' },
  'עמודות': { tag: 'div', cls: 'ivrit-cols' },
  'עמודה': { tag: 'div', cls: 'ivrit-col' },
  'שורה': { tag: 'div', cls: 'ivrit-row' },
  'פריסה': { tag: 'div', cls: 'ivrit-flex' },
  'מרכז': { tag: 'div', cls: 'ivrit-center' },
  'חלונית': { tag: 'div', cls: 'ivrit-glass' },
  'הצל': { tag: 'div', cls: 'ivrit-shadow' },
  'מודגש-ריבוע': { tag: 'span', cls: 'ivrit-badge' },
  'קישור': { tag: 'a' },

  // טקסט
  'פסקה': { tag: 'p', cls: 'ivrit-p' },
  'כותרת': { tag: 'h1' },
  'כותרת1': { tag: 'h1' },
  'כותרת2': { tag: 'h2' },
  'כותרת3': { tag: 'h3' },
  'כותרת4': { tag: 'h4' },
  'כותרת5': { tag: 'h5' },
  'כותרת6': { tag: 'h6' },
  'כותרת-עליונית': { tag: 'header', cls: 'ivrit-header' },
  'תת-כותרת': { tag: 'small', cls: 'ivrit-sub' },
  'מודגש': { tag: 'strong' },
  'חזק': { tag: 'strong' },
  'נטוי': { tag: 'em' },
  'קווט': { tag: 'blockquote', cls: 'ivrit-quote' },
  'ציטוט': { tag: 'q' },
  'קוד': { tag: 'code', cls: 'ivrit-code' },
  'קוד-בלוק': { tag: 'pre', cls: 'ivrit-pre' },
  'רשימה': { tag: 'ul', cls: 'ivrit-ul' },
  'רשימה-ממוספרת': { tag: 'ol', cls: 'ivrit-ol' },
  'רשימת-תפריטים': { tag: 'dl' },
  'פריט': { tag: 'li' },
  'הפסקה': { tag: 'br', void: true },
  'מסף': { tag: 'hr', void: true, cls: 'ivrit-hr' },
  'סימון': { tag: 'mark' },
  'כתב-ביט': { tag: 'b' },
  'כתב-נטוי': { tag: 'i' },
  'כתב-קטן': { tag: 'small' },
  'גופן-קטן': { tag: 'small', cls: 'ivrit-muted' },
  'מטושטש': { tag: 's' },
  'עליון': { tag: 'sup' },
  'תחתון': { tag: 'sub' },

  // קישורים וניווט
  'קישור': { tag: 'a' },
  'ניווט': { tag: 'nav', cls: 'ivrit-nav' },
  'רגל': { tag: 'footer', cls: 'ivrit-footer' },
  'עמוד-נוכחי': { tag: 'span', cls: 'ivrit-current' },

  // מדיה
  'תמונה': { tag: 'img', void: true },
  'וידאו': { tag: 'video', void: true },
  'שמע': { tag: 'audio', void: true },
  'מסגרת': { tag: 'iframe' },
  'צורה': { tag: 'svg' },
  'מיפה': { tag: 'map' },
  'אזור': { tag: 'area', void: true },
  'דמות': { tag: 'figure' },
  'כיתוב': { tag: 'figcaption' },

  // טפסים
  'טופס': { tag: 'form' },
  'שדה': { tag: 'input', void: true },
  'אזור-טקסט': { tag: 'textarea' },
  'תווית': { tag: 'label', cls: 'ivrit-label' },
  'בחירה': { tag: 'select' },
  'אפשרות': { tag: 'option' },
  'קבוצת-אפשרויות': { tag: 'optgroup' },
  'כפתור': { tag: 'button', cls: 'ivrit-btn' },
  'כפתור-ראשי': { tag: 'button', cls: 'ivrit-btn ivrit-btn-primary' },
  'כפתור-מתאר': { tag: 'button', cls: 'ivrit-btn ivrit-btn-ghost' },
  'שדה-בדיקה': { tag: 'input', void: true },
  'לחצן-צפי': { tag: 'input', void: true },

  // טבלאות
  'טבלא': { tag: 'table', cls: 'ivrit-table' },
  'שורת-טבלה': { tag: 'tr' },
  'שורה-טבלה': { tag: 'tr' },
  'כותרת-טבלה': { tag: 'th' },
  'תא': { tag: 'td' },
  'כתם': { tag: 'caption' },
  'רגל-טבלה': { tag: 'tfoot' },
  'ראש-טבלה': { tag: 'thead' },
  'גוף-טבלה': { tag: 'tbody' },

  // אינטראקטיביות
  'חלונית-דיאלוג': { tag: 'dialog', cls: 'ivrit-dialog' },
  'פרטים': { tag: 'details', cls: 'ivrit-details' },
  'סיכום': { tag: 'summary', cls: 'ivrit-summary' },
  'התקדמות': { tag: 'progress' },
  'מד': { tag: 'meter' },
  'לוגו': { tag: 'template' },
  'תבנית': { tag: 'template' },
  'חלונית-עליונית': { tag: 'div', role: 'status', cls: 'ivrit-toast' },
  'מקלדת': { tag: 'kbd', cls: 'ivrit-kbd' },
};

/** בעברית "א" ו"ה" סופיות מתחלפות - מקבלים את שתיהן */
function finalFormVariants(key) {
  const out = [];
  const last = key[key.length - 1];
  if (last === '\u05d4') out.push(key.slice(0, -1) + '\u05d0');
  if (last === '\u05d0') out.push(key.slice(0, -1) + '\u05d4');
  // צורת הידיעה: "שורה-טבלה" ~ "שורת-טבלה"
  const dash = key.indexOf('-');
  if (dash > 0) {
    const head = key.slice(0, dash);
    const tail = key.slice(dash);
    const headLast = head[head.length - 1];
    if (headLast === '\u05d4') out.push(head.slice(0, -1) + '\u05ea' + tail);
    if (headLast === '\u05ea') out.push(head.slice(0, -1) + '\u05d4' + tail);
  }
  return out;
}

/** מרחק לוונשטיין - להצעת תיקון לטעות כתיב */
export function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** מחזיר את ההצעה הקרובה ביותר למילה, או null */
export function suggest(word, pool, maxDistance = 2) {
  const target = normalizeKey(word);
  let best = null, bestScore = maxDistance + 1;
  for (const candidate of pool) {
    const d = editDistance(target, normalizeKey(candidate));
    if (d < bestScore) { bestScore = d; best = candidate; }
  }
  return bestScore <= maxDistance ? best : null;
}

const elementIndex = new Map();
for (const [heb, def] of Object.entries(ELEMENTS)) {
  const keys = [heb, ...finalFormVariants(heb), heb.replace(/(\p{L})(\d)/u, '$1-$2')];
  for (const k of keys) {
    const nk = normalizeKey(k);
    if (!elementIndex.has(nk)) elementIndex.set(nk, def);
  }
}

export function lookupElement(name) {
  const key = normalizeKey(name);
  if (elementIndex.has(key)) return elementIndex.get(key);
  // תגי HTML רגילים באנגלית עובדים כמו שהם
  if (/^[a-z][a-z0-9-]*$/.test(key)) return { tag: key };
  return null;
}

// ── מאפיינים: עברית -> HTML ──────────────────────────────────────────────
export const ATTRS = {
  'מזהה': 'id',
  'מחלקה': 'class',
  'סגנון': 'style',
  'שם': 'name',
  'לכתובת': 'href',
  'מקור': 'src',
  'מקור-נוסף': 'srcset',
  'יעד': 'target',
  'ייחוס': 'rel',
  'סוג': 'type',
  'ערך': 'value',
  'מראה': 'value',
  'ממלא': 'placeholder',
  'נגיש': 'aria-label',
  'נגישות-תפקיד': 'role',
  'מספר-שורות': 'rows',
  'מספר-עמודות': 'cols',
  'מקסימום': 'maxlength',
  'מינימום': 'min',
  'מקס': 'max',
  'שלב': 'step',
  'נדרש': 'required',
  'נבדק': 'checked',
  'נבחר': 'selected',
  'מוסתר': 'hidden',
  'רישיון': 'license',
  'מחבר': 'author',
  'תאריך': 'datetime',
  'מספר-עמוד': 'width',
  'מספר-גובה': 'height',
  'גלילה': 'loading',
  'אטור': 'decoding',
  'בקרת-אבטחה': 'referrerpolicy',
  'שליחה-ל': 'action',
  'שיטה': 'method',
  'נמלא-אוטומטית': 'autocomplete',
  'מרובע': 'allowfullscreen',
  'התחלה': 'start',
  'סוף': 'end',
  'חלופי-תצוגה': 'aria-hidden',
  'תווית-אריה': 'for',
  'טאב': 'tabindex',
  'מזהה-נתונים': 'data-id',
  'תוכן': 'content',
  'מקור-תמונה': 'srcset',
  'מילים': 'keywords',
  'תחום': 'charset',
  'סמכות': 'lang',
  'כיוון': 'dir',
  'רוחב-לשוניות': 'tabindex',
  'מסלול': 'action',
};

const attrIndex = new Map();
for (const [heb, en] of Object.entries(ATTRS)) {
  for (const k of [heb, ...finalFormVariants(heb)]) {
    attrIndex.set(normalizeKey(k), en);
    attrIndex.set(normalizeKey(k.replace(/-/g, ' ')), en);
  }
}

export function lookupAttr(name) {
  const key = normalizeKey(name);
  if (attrIndex.has(key)) return attrIndex.get(key);
  if (/^[a-z][a-z0-9-]*$/.test(key)) return key;   // data-*, aria-*, מאפייני HTML רגילים
  if (/^(data|aria)-[a-z0-9-]+$/.test(key)) return key;
  return null;
}

// ── מאפייני CSS: עברית -> CSS ─────────────────────────────────────────────
export const PROPS = {
  'רקע': 'background',
  'רקע-צבע': 'background-color',
  'רקע-תמונה': 'background-image',
  'רקע-מיקום': 'background-position',
  'רקע-חזרה': 'background-repeat',
  'רקע-גודל': 'background-size',
  'צבע': 'color',
  'צבע-טקסט': 'color',
  'גופן': 'font-family',
  'גופן-משקל': 'font-weight',
  'גופן-גודל': 'font-size',
  'גופן-סגנון': 'font-style',
  'גופן-רווח': 'letter-spacing',
  'גופן-גובה-שורה': 'line-height',
  'יישור-טקסט': 'text-align',
  'יישור-אנכי': 'vertical-align',
  'קישוט-טקסט': 'text-decoration',
  'קישוט': 'text-decoration',
  'הצלה-טקסט': 'text-shadow',
  'המרה': 'text-transform',
  'רווח-לבן': 'white-space',
  'רוחב': 'width',
  'גובה': 'height',
  'מראה-מינימלי': 'min-width',
  'גובה-מינימלי': 'min-height',
  'רוחב-מקסימלי': 'max-width',
  'גובה-מקסימלי': 'max-height',
  'מרווח': 'margin',
  'מרווח-עליון': 'margin-top',
  'מרווח-תחתון': 'margin-bottom',
  'מרווח-ימין': 'margin-right',
  'מרווח-שמאל': 'margin-left',
  'מרווח-אוטומטי': 'margin',
  'ריפוד': 'padding',
  'ריפוד-עליון': 'padding-top',
  'ריפוח-תחתון': 'padding-bottom',
  'ריפוד-ימין': 'padding-right',
  'ריפוד-שמאל': 'padding-left',
  'גבול': 'border',
  'גבול-רוחב': 'border-width',
  'גבול-סגנון': 'border-style',
  'גבול-צבע': 'border-color',
  'גבול-עיגול': 'border-radius',
  'בליטה': 'outline',
  'צל': 'box-shadow',
  'שקיפות': 'opacity',
  'נראות': 'visibility',
  'תצוגה': 'display',
  'מיקום': 'position',
  'למעלה': 'top',
  'ימין': 'right',
  'שמאל': 'left',
  'תחתית': 'bottom',
  'מרחק-עליון': 'top',
  'מרחק-תחתון': 'bottom',
  'מרחק-ימין': 'right',
  'מרחק-שמאל': 'left',
  'צפייה': 'z-index',
  'גלילה': 'overflow',
  'גלילה-אופקית': 'overflow-x',
  'גלילה-אנכית': 'overflow-y',
  'גלילה-עומק': 'overflow-clip-margin',
  'יישור-מכלים': 'align-items',
  'יישור-עצמים': 'align-self',
  'יישור-תוכן': 'justify-content',
  'יישור-טקסט-עצמי': 'text-align',
  'פיזור': 'justify-content',
  'כיוון-פיזור': 'flex-direction',
  'כיוון': 'direction',
  'כפיפה': 'flex-wrap',
  'התרחבות': 'flex-grow',
  'כיווץ': 'flex-shrink',
  'בסיס-גודל': 'flex-basis',
  'רשת': 'grid-template-columns',
  'עמודות-רשת': 'grid-template-columns',
  'טורים-רשת': 'grid-template-rows',
  'פער': 'gap',
  'פער-שורות': 'row-gap',
  'פער-עמודות': 'column-gap',
  'מיקום-ברשת': 'grid-area',
  'מעבר': 'transition',
  'הנדשה': 'animation',
  'משך-מעבר': 'transition-duration',
  'קצב-מעבר': 'transition-timing-function',
  'סוג-מעבר': 'transition-property',
  'סינון': 'filter',
  'ערבוב-תצוגה': 'mix-blend-mode',
  'רמת-אלמנטים': 'isolation',
  'סמן': 'cursor',
  'בחירת-משתמש': 'user-select',
  'אייך-גלילה': 'scroll-behavior',
  'עוגן': 'position',
  'ראש-מודבק': 'position',
  'ללא-הדגשה': '-webkit-tap-highlight-color',
  'ללא-עיטול': 'list-style',
  'סגנון-רשימה': 'list-style',
  'תוכן-פסאודו': 'content',
  // מאפיינים לוגיים - עובדים באותו אופן בעברית (RTL) ובאנגלית (LTR)
  'מרווח-שונות': 'margin-inline',
  'מרווח-עמודות': 'margin-inline',
  'מרווח-שורות': 'margin-block',
  'ריפוד-שונות': 'padding-inline',
  'ריפוד-עמודות': 'padding-inline',
  'ריפוד-שורות': 'padding-block',
  'הזחה': 'inset',
  'הזחה-אופקי': 'inset-inline',
  'הזחה-אנכי': 'inset-block',
  'רוחב-תוכן': 'inline-size',
  'גובה-תוכן': 'block-size',
  // עוד שמות נפוצים
  'פינות-עגולות': 'border-radius',
  'פינות-עגולות-ימין-עליון': 'border-top-right-radius',
  'פינות-עגולות-שמאל-עליון': 'border-top-left-radius',
  'דקות-גבול': 'border-width',
  'צל-טקסט': 'text-shadow',
  'ריווח-אותיות': 'letter-spacing',
  'ריווח-מילים': 'word-spacing',
  'רוחב-מינימלי': 'min-width',
  'גובה-מינימלי': 'min-height',
  'גודל-גופן': 'font-size',
  'משפחת-גופן': 'font-family',
  'סגנון-רשימה-סוג': 'list-style-type',
  'מיקום-עצמי': 'place-self',
  'מיקום-פריטים': 'place-items',
  'מיקום-תוכן': 'place-content',
  'סדר-עליון': 'order',
  'מספר-עמודות': 'column-count',
  'שבירת-מילים': 'overflow-wrap',
  'התנהגות-שבירה': 'word-break',
  'אטימות-רקע': 'background-clip',
  'מיקום-רקע': 'object-position',
  'גודל-רקע': 'object-fit',
};

const propIndex = new Map();
for (const [heb, en] of Object.entries(PROPS)) {
  for (const k of [heb, ...finalFormVariants(heb)]) {
    propIndex.set(normalizeKey(k), en);
    propIndex.set(normalizeKey(k.replace(/-/g, ' ')), en);
  }
}

export function lookupProp(name) {
  const key = normalizeKey(name);
  if (propIndex.has(key)) return propIndex.get(key);
  if (/^-?[a-z][a-z0-9-]*$/.test(key)) return key;  // מאפייני CSS רגילים
  return null;
}

// ── ערכי CSS מילוליים ──────────────────────────────────────────────────────
export const VALUES = {
  'אדום': '#ef4444', 'אדום-כהה': '#b91c1c', 'אדום-בהיר': '#fca5a5',
  'כחול': '#3b82f6', 'כחול-כהה': '#1d4ed8', 'כחול-בהיר': '#93c5fd',
  'ירוק': '#22c55e', 'ירוק-כהה': '#15803d', 'ירוק-בהיר': '#86efac',
  'צהוב': '#eab308', 'צהוב-בהיר': '#fde68a',
  'סגול': '#8b5cf6', 'סגול-כהה': '#6d28d9', 'סגול-בהיר': '#c4b5fd',
  'ורוד': '#ec4899', 'ורוד-בהיר': '#f9a8d4',
  'כתום': '#f97316', 'כרום': '#f97316', 'חום': '#14b8a6',
  'תכלת': '#0ea5e9', 'טורקיז': '#14b8a6',
  'לבן': '#ffffff', 'שחור': '#111827', 'שולחן': '#f8fafc',
  'צפוף': '#0b1120', 'אפור': '#6b7280', 'אפור-בהיר': '#e5e7eb',
  'אפור-כהה': '#374151', 'בז': '#f3f4f6', 'זהב': '#fbbf24',
  'מלא': '100%', 'חצי': '50%', 'שליש': '33.333%', 'שני-שלישים': '66.666%',
  'רבע': '25%', 'שלוש-רבעים': '75%',
  'אוטומטי': 'auto', 'אין': 'none', 'עובי': 'bold',
  'דק': '300', 'רגיל': '400', 'בינוני': '600', 'מודגש': '700',
  'יישור-ימין': 'right', 'יישור-שמאל': 'left',
  'יישור-למרכז': 'center', 'יישור-לימין': 'start', 'יישור-לשמאל': 'end',
  'יישור-למעלה': 'flex-start', 'יישור-למטה': 'flex-end', 'יישור-מרוכז': 'center',
  'מרווח-בין': 'space-between', 'מרווח-סביב': 'space-around', 'מרווח-שווה': 'space-evenly',
  'שורה': 'row', 'טור': 'column', 'שורה-הפוכה': 'row-reverse', 'טור-הפוך': 'column-reverse',
  'גלילה-אוטומטית': 'auto', 'גלילה-תמידית': 'scroll', 'גלילה-נסתרת': 'hidden',
  'עוגן-יחסי': 'relative', 'עוגן-מוחלט': 'absolute', 'עוגן-קבוע': 'fixed',
  'עוגן-צף': 'sticky', 'עוגן-סטטי': 'static',
  'ריפוד-אוטומטי': 'auto', 'מעבר-חלק': 'smooth', 'מעבר-מהיר': 'ease',
  'קטן': '0.875rem', 'בינוני': '1rem', 'גדול': '1.5rem', 'עצום': '3rem',
  'אלמגנט': 'antialiased', 'מונו': 'monospace', 'ללא-קישוט': 'none',
  'מודגש-תמיד': '800', 'קל': 'thin', 'כהה': 'dark', 'בהיר': 'light', 'אוטומטי-כהה': 'auto', 'עבה': 'thick', 'גדול-מאוד': 'xx-large',
  'עצום-מאוד': 'xxx-large', 'בינוני-גדול': 'large', 'טבעי': 'natural',
  'נושא': 'inherit', 'הכרחי': 'important', 'שקוף': 'transparent', 'שחור-מלא': 'black',
  'לבן-מלא': 'white', 'שקוף-לחצי': 'rgba(0,0,0,.5)', 'צל-פנימי': 'inset',
  'חיצוני': 'outset', 'שטוח': 'flat', 'מורכב': 'complex', 'אורך-קבוע': 'fixed',
  'עגול-מלא': 'circle', 'ריבוע': 'square', 'שורה-אוטומטית': 'auto',
};

const valueIndex = new Map();
for (const [heb, en] of Object.entries(VALUES)) {
  valueIndex.set(normalizeKey(heb), en);
  valueIndex.set(normalizeKey(heb.replace(/-/g, ' ')), en);
}

export function lookupValue(v) {
  const key = normalizeKey(String(v).trim());
  if (valueIndex.has(key)) return valueIndex.get(key);
  return String(v).trim();
}

export const MEDIA = {
  'מסך-קטן': '(max-width: 480px)',
  'מסך-טלפון': '(max-width: 640px)',
  'מסך-בינוני': '(min-width: 641px)',
  'מסך-טבלט': '(min-width: 768px)',
  'מסך-גדול': '(min-width: 1024px)',
  'מסך-עצום': '(min-width: 1440px)',
  'מסך-הדפסה': 'print',
  'מסך-ממוקד': '(prefers-reduced-motion: reduce)',
  'מסך-ללא-תנועה': '(prefers-reduced-motion: reduce)',
  'מסך-כהה': '(prefers-color-scheme: dark)',
  'מסך-בהיר': '(prefers-color-scheme: light)',
  'מסך-מועדפת-צבע-כהה': '(prefers-color-scheme: dark)',
  'מסך-מועדפת-צבע-בהיר': '(prefers-color-scheme: light)',
  'מסך-ללא-עכבר': '(hover: none)',
  'מסך-מקלדת': '(hover: none) and (pointer: coarse)',
  'מסך-מצביע': '(pointer: coarse)',
  'מסך-ניגודיות-גבוהה': '(prefers-contrast: more)',
};

export function lookupMedia(name) {
  const key = normalizeKey(name);
  if (MEDIA[key]) return MEDIA[key];
  return null;
}

// ── מילות מפתח ────────────────────────────────────────────────────────────
export const KEYWORDS = {
  VAR: ['משתנה', 'קבע', 'הגדר'],
  IF: ['אם', 'אחרת אם', 'אחרת-אם', 'אחרת'],
  FOR: ['לכל', 'לכל-בטווח'],
  WHILE: ['כל-עוד'],
  FN: ['פונקציה', 'פונקציה-בר'],
  COMPONENT: ['רכיב'],
  RETURN: ['החזר', 'מחזיר'],
  PRINT: ['הדפס'],
  STYLE: ['סגנון', 'עיצוב', 'מעצב'],
  MEDIA: ['מסך'],
  IMPORT: ['ייבא', 'טען'],
  BREAK: ['הפסק'],
  CONTINUE: ['המשך'],
  TRUE: ['אמת', 'נכון', 'כן'],
  FALSE: ['שקר', 'לאנכון'],
  NULL: ['ריק', 'אין-ערך', 'null'],
  DEFAULT: ['ברירת-מחדל'],
};

const kwIndex = new Map();
for (const [group, words] of Object.entries(KEYWORDS)) {
  for (const w of words) kwIndex.set(normalizeKey(w), group);
}

export function lookupKeyword(word) {
  return kwIndex.get(normalizeKey(word)) || null;
}

export const STATEMENT_WORDS = new Set(
  [...new Set(Object.values(KEYWORDS).flat())].map(normalizeKey),
);

// ── פונקציות מובנות ──────────────────────────────────────────────────────
export const BUILTINS = {
  'אורך': 'length',
  'מספר': 'number',
  'טקסט': 'text',
  'אמת': 'bool',
  'מילים': 'words',
  'החלף': 'replace',
  'חתוך': 'slice',
  'אותיות-גדולות': 'upper',
  'אותיות-קטנות': 'lower',
  'מיון': 'sort',
  'מיפוי': 'map',
  'סינון': 'filter',
  'מזמן': 'reduce',
  'הצטרף': 'join',
  'הפוך': 'reverse',
  'ממוקם': 'includes',
  'מזמן-עכשיו': 'now',
  'היום': 'today',
  'שנה': 'year',
  'אקראי': 'random',
  'ייצוא': 'json',
  'למספר': 'toNumber',
  'דחיסת-אפשרויות': 'opts',
};

const builtinIndex = new Map();
for (const [heb, en] of Object.entries(BUILTINS)) builtinIndex.set(normalizeKey(heb), en);
export function lookupBuiltin(name) {
  return builtinIndex.get(normalizeKey(name)) || null;
}

// ── תגים ריקים (אין להם תוכן ולא צריך סגירה) ───────────────────────────────
export const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);

// ── אלמנטים בתוך-שורה (שומרים על אותה שורה בפלט) ──────────────────────────
export const INLINE_TAGS = new Set([
  'a', 'span', 'strong', 'b', 'em', 'i', 'small', 'code', 'mark', 's', 'u',
  'sub', 'sup', 'br', 'img', 'kbd', 'abbr', 'time', 'q', 'var', 'small',
  'input', 'button', 'label', 'output', 'meter', 'progress', 'select', 'bdi', 'bdo', 'wbr',
]);

// ── מחלקות עיצוב מוכנות ──────────────────────────────────────────────────
export const DESIGN_CLASSES = {
  'ממרכז': 'text-align:center', 'ימין': 'text-align:right', 'שמאל': 'text-align:left',
  'לבן': 'color:#fff', 'שחור': 'color:#111827', 'אפור': 'color:#6b7280',
  'אדום': 'color:#ef4444', 'ירוק': 'color:#22c55e', 'כחול': 'color:#3b82f6',
  'צהוב': 'color:#eab308', 'סגול': 'color:#8b5cf6',
  'רקע-לבן': 'background:#fff', 'רקע-אפור': 'background:#f3f4f6',
  'רקע-שחור': 'background:#111827', 'רקע-כחלת': 'background:#e0f2fe',
  'עיגול': 'border-radius:999px', 'חלק': 'border-radius:8px',
  'מוצלח': 'box-shadow:0 4px 16px rgba(0,0,0,.08)',
  'מוצלח-חזק': 'box-shadow:0 12px 40px rgba(0,0,0,.18)',
  'שקוף': 'background:rgba(255,255,255,.6);backdrop-filter:blur(12px)',
  'מצביע': 'cursor:pointer', 'סמן-יד': 'cursor:pointer', 'ללא-ריפוד': 'padding:0', 'ריפוד-אפשרי': 'padding:.75rem 1rem',
  'רוחב-מלא': 'width:100%', 'רוחב-חצי': 'width:50%',
  'רווח-קטן': 'gap:.5rem', 'רווח-בינוני': 'gap:1rem', 'רווח-גדול': 'gap:2rem',
  'טקסט-קטן': 'font-size:.875rem', 'טקסט-גדול': 'font-size:2rem', 'טקסט-עצום': 'font-size:3.5rem',
  'מודגש': 'font-weight:700', 'דק': 'font-weight:300', 'בינוני': 'font-weight:600',
  'ללא-גבול': 'border:none', 'גבול': 'border:1px solid #e5e7eb',
  'צל-קטן': 'box-shadow:0 1px 2px rgba(0,0,0,.06)',
  'אנימציה': 'animation:ivrit-rise .5s ease both',
  'מוסתר': 'display:none',
  'רשת-שתיים': 'display:grid;grid-template-columns:repeat(2,1fr);gap:1rem',
  'רשת-שלוש': 'display:grid;grid-template-columns:repeat(3,1fr);gap:1rem',
  'רשת-ארבע': 'display:grid;grid-template-columns:repeat(4,1fr);gap:1rem',
  'גלילה': 'overflow:auto',
};

export function designClass(name) {
  return DESIGN_CLASSES[normalizeKey(name)] || null;
}

export { normalizeKey };

/** רשימות השמות להצעת תיקונים בשגיאות */
export const ELEMENT_NAMES = Object.keys(ELEMENTS);
export const ATTR_NAMES = Object.keys(ATTRS);
export const PROP_NAMES = Object.keys(PROPS);
