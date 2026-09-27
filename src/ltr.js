// ltr.js - עזרי כיוון לעריכה נוחה של קוד עברי.
//
// עורכי קוד (VS Code, Cursor ואחרים) מציגים שורה שמתחילה באות עברית מימין-לשמאל,
// ואז סימני המבנה של הקוד (< > { } = / ") "מתפזרים" לצד הלא נכון. תו LRM (U+200E)
// בלתי-נראה בתחילת שורה מכריח את העורך להציג אותה משמאל-לימין, בעוד שהמילים
// העבריות עדיין נקראות נכון. המהדר מתעלם מכל סימני הכיוון האלה, כך שהפלט לא מושפע.

// טווחי סימני הכיוון הבלתי-נראים של יוניקוד (נבנים מקודים, בלי תווים סמויים במקור):
// 061C ALM, 200E LRM, 200F RLM, 202A-202E (LRE/RLE/PDF/LRO/RLO), 2066-2069 (LRI/RLI/FSI/PDI)
const MARK_RANGES = [[0x061C, 0x061C], [0x200E, 0x200F], [0x202A, 0x202E], [0x2066, 0x2069]];
const MARK_SET = new Set();
for (const [lo, hi] of MARK_RANGES) for (let c = lo; c <= hi; c++) MARK_SET.add(c);

const LRM = String.fromCharCode(0x200E);

/** מסיר את כל סימני הכיוון הבלתי-נראים (המהדר מתעלם מהם) */
export function stripBidiMarks(text) {
  let out = '';
  for (const ch of String(text)) out += MARK_SET.has(ch.codePointAt(0)) ? '' : ch;
  return out;
}

/** האם הטקסט כבר מכיל סימני כיוון (למשל אחרי הפעלת מצב LTR) */
export function hasBidiMarks(text) {
  for (const ch of String(text)) if (MARK_SET.has(ch.codePointAt(0))) return true;
  return false;
}

/**
 * מוסיף LRM בתחילת כל שורה לא-ריקה כדי שהעורך יציג אותה משמאל-לימין.
 * אידמפוטנטי: מנקה קודם סימנים קיימים ואז מוסיף אחד.
 */
export function addLtrMarks(text) {
  return String(text).split('\n').map((line) => {
    const clean = stripBidiMarks(line);
    return clean.trim() === '' ? clean : LRM + clean;
  }).join('\n');
}

/** מסיר את סימני הכיוון מכל השורות (חזרה למצב "נקי") */
export function removeLtrMarks(text) {
  return stripBidiMarks(text);
}
