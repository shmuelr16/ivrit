// test/ivrit.test.js - בדיקות לשפת עִבְרִית
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compile, compileFile } from '../src/compiler.js';
import { parseExpression, Scope, evaluate } from '../src/expr.js';
import { lookupElement, lookupProp, lookupAttr, suggest } from '../src/dict.js';

const build = (src, options = {}) => compile(src, { file: 'בדיקה.iv', ...options });
const body = (src, options) => build(src, options).bodyHtml;
const clean = (html) => html.replace(/\s+/g, ' ').trim();
const ok = (src) => {
  const r = build(src);
  assert.deepEqual(r.errors.map((e) => e.message), [], 'אמור להתקמפל בלי שגיאות');
  return r;
};

// ── מילונים ────────────────────────────────────────────────────────────────
test('מילון: תגים עבריים -> HTML', () => {
  assert.equal(lookupElement('כותרת1').tag, 'h1');
  assert.equal(lookupElement('פסקה').tag, 'p');
  assert.equal(lookupElement('עמוד').tag, 'div');
  assert.equal(lookupElement('div').tag, 'div', 'תגים באנגלית עובדים כמו שהם');
  assert.equal(lookupElement('שורת-טבלה').tag, 'tr', 'צורת ידיעה');
  assert.equal(lookupElement('טבלה').tag, 'table', 'צורה סופית');
  assert.equal(lookupElement('שורה-טבלה').tag, 'tr', 'שתי צורות מתקבלות');
});

test('מילון: מאפיינים ו-CSS', () => {
  assert.equal(lookupAttr('מזהה'), 'id');
  assert.equal(lookupAttr('לכתובת'), 'href');
  assert.equal(lookupProp('גופן-גודל'), 'font-size');
  assert.equal(lookupProp('רוחב'), 'width');
});

test('מילון: הצעת תיקון לטעות', () => {
  assert.equal(suggest('כרטס', ['כרטיס', 'כותרת']), 'כרטיס');
  assert.equal(suggest('לאשהו', ['כרטיס', 'כותרת']), null);
});

// ── ביטויים ───────────────────────────────────────────────────────────────
const expr = (src, scope = new Scope()) => evaluate(parseExpression(src), scope);
const sc = (obj) => {
  const s = new Scope();
  for (const [k, v] of Object.entries(obj)) s.define(k, v);
  return s;
};

test('ביטויים: חשבון והשוואות', () => {
  assert.equal(expr('1 + 2 * 3'), 7);
  assert.equal(expr('(1 + 2) * 3'), 9);
  assert.equal(expr('10 / 4'), 2.5);
  assert.equal(expr('2 ** 8'), 256);
  assert.equal(expr('7 % 3'), 1);
  assert.equal(expr('1 + 1 == 2'), true);
  assert.equal(expr('2 != 3'), true);
  assert.equal(expr('"א" + "ב"'), 'אב');
  assert.equal(expr('"מספר: " + 5'), 'מספר: 5');
});

test('ביטויים: אופרטורים בעברית', () => {
  assert.equal(expr('3 חיבור 4'), 7);
  assert.equal(expr('3 חיסור 4'), -1);
  assert.equal(expr('3 כפל 4'), 12);
  assert.equal(expr('8 חלוקה 2'), 4);
  assert.equal(expr('9 שארית 4'), 1);
  assert.equal(expr('אמת וגם שקר'), false);
  assert.equal(expr('אמת או שקר'), true);
  assert.equal(expr('לא שקר'), true);
  assert.equal(expr('מינוס 5'), -5);
  assert.equal(expr('3 < 4'), true);
  assert.equal(expr('3 >= 3'), true);
});

test('ביטויים: משתנים, רשימות ומאפיינים', () => {
  assert.equal(expr('שם', sc({ שם: 'דוד' })), 'דוד');
  assert.deepEqual(expr('[1, 2, 3]'), [1, 2, 3]);
  assert.equal(expr('רשימה.אורך', sc({ רשימה: [1, 2] })), 2);
  assert.equal(expr('משתנה.ערך', sc({ משתנה: { ערך: 7 } })), 7);
  assert.equal(expr('"abc".אורך'), 3);
});

test('ביטויים: פונקציות מובנות', () => {
  assert.equal(expr('אורך("שלום")'), 4);
  assert.equal(expr('מספר("42")'), 42);
  assert.equal(expr('טקסט(42)'), '42');
  assert.equal(expr('מילים("שלום עולם יפה").אורך'), 3);
  assert.equal(expr('החלף("א-ב", "-", "+")'), 'א+ב');
  assert.equal(expr('הצטרף(["a", "b"], "-")'), 'a-b');
  assert.equal(expr('סינון([1,2,3,4], (x) => x > 2).אורך'), 2);
  assert.deepEqual(expr('מיפוי([1,2], (x) => x כפל 2)'), [2, 4]);
});

test('ביטויים: שיטות על רשימות', () => {
  assert.equal(expr('["a","b"].הצטרף("-")'), 'a-b');
  assert.equal(expr('[1,2,3].סינון((x) => x != 2).הצטרף("-")'), '1-3');
  assert.equal(expr('["b","a"].מיון().הצטרף("-")'), 'a-b');
  assert.equal(expr('[1,2].הוסף(3).הצטרף("-")'), '1-2-3');
  assert.equal(expr('"שלום".אותיות-גדולות()'), 'שלום');
});

// ── תגיות וטקסט ───────────────────────────────────────────────────────────
test('טקסט פשוט הופך לפסקה', () => {
  assert.match(body('שלום עולם'), /<p class="טקסט פסקה ivrit-p">שלום עולם<\/p>/);
});

test('תגיות נכנסות כמות שכתוב', () => {
  const html = body('<כותרת1>כותרת</כותרת1>\n<פסקה>טקסט</פסקה>');
  assert.match(html, /<h1 class="כותרת1">כותרת<\/h1>/);
  assert.match(html, /<p class="פסקה ivrit-p">טקסט<\/p>/);
});

test('תיוג בתוך שורה נשמר', () => {
  assert.equal(clean(body('<פסקה>זה <מודגש>מודגש</מודגש> וזה</פסקה>')),
    '<p class="פסקה ivrit-p">זה <strong class="מודגש">מודגש</strong> וזה</p>');
});

test('מרווחים בין תגיות נשמרים כמרווח אחד', () => {
  const html = clean(body('<פסקה>א <קישור>קישור</קישור> עוד</פסקה>'));
  assert.match(html, /א <a class="קישור">קישור<\/a> עוד/);
});

test('התא {} מחליף ערך', () => {
  const r = ok('משתנה שם = "עולם";\n<כותרת1>שלום {שם}!</כותרת1>');
  assert.match(r.bodyHtml, /<h1 class="כותרת1">שלום עולם!<\/h1>/);
});

test('התא {} מחפש ביטוי', () => {
  const r = ok('משתנה רשימה = [1,2,3];\n<פסקה>יש {אורך(רשימה)} פריטים</פסקה>');
  assert.match(r.bodyHtml, /יש 3 פריטים/);
});

test('תוכן מותנה בתוך {}', () => {
  const r = ok('<פסקה>{אם אמת {<b>כן</b>} אחרת {<b>לא</b>}}</פסקה>');
  assert.match(clean(r.bodyHtml), /<p class="פסקה ivrit-p"><b>כן<\/b><\/p>/);
});

test('תג ריק לא מציץ סגירה', () => {
  const r = ok('<מטא שם="description" תוכן="טקסט">\n<מסף>\n<הפסקה>');
  assert.match(r.headHtml, /<meta name="description" content="טקסט">/);
  assert.match(r.bodyHtml, /<hr class="מסף ivrit-hr">/);
  assert.match(r.bodyHtml, /<br>/);
});

test('מסמך מלא מקבל תגיות מסמך תקינות', () => {
  const r = ok('<מסמך שם="כותרת הדפדפן">\n<פסקה>גוף</פסקה>\n</מסמך>');
  assert.match(r.html, /^<!DOCTYPE html>/);
  assert.match(r.html, /<html lang="he" dir="rtl">/);
  assert.match(r.html, /<title>כותרת הדפדפן<\/title>/);
  assert.match(r.html, /<meta charset="utf-8">/);
  assert.match(r.html, /viewport/);
  assert.match(r.html, /<body>\n {2}<p class="פסקה ivrit-p">גוף<\/p>\n<\/body>/);
});

test('ראש נכתב ידנית ונשמר', () => {
  const r = ok('<מסמך>\n<ראש>\n<כותרת>שם העמוד</כותרת>\n</ראש>\n<פסקה>גוף</פסקה>\n</מסמך>');
  assert.match(r.headHtml, /<title>שם העמוד<\/title>/);
  assert.match(r.html, /<meta charset="utf-8">/);
  assert.doesNotMatch(r.headHtml, /<title>מסמך/);
});

test('גוף עם מחלקות', () => {
  const r = ok('<מסמך>\n<גוף מחלקה="עמוד-מלא">\n<פסקה>גוף</פסקה>\n</גוף>\n</מסמך>');
  assert.match(r.html, /<body class="עמוד-מלא">/);
});

test('כיוון ושפה מותאמים', () => {
  const r = ok('<מסמך שפה="en" כיוון="ltr">\n<פסקה>hello</פסקה>\n</מסמך>');
  assert.match(r.html, /<html lang="en" dir="ltr">/);
});

// ── מאפיינים ───────────────────────────────────────────────────────────────
test('מאפיינים מתורגמים', () => {
  const r = ok('<קישור לכתובת="https://x.co" יעד="_blank" מזהה="ראשי">קליק</קישור>');
  assert.match(clean(r.bodyHtml), /<a href="https:\/\/x.co" target="_blank" id="ראשי" class="קישור">קליק<\/a>/);
});

test('סגנון פנימי מתורגם ל-CSS', () => {
  const r = ok('<פסקה סגנון="צבע: אדום; גופן-גודל: 20px">טקסט</פסקה>');
  assert.match(clean(r.bodyHtml), /style="color: #ef4444; font-size: 20px"/);
});

test('מחלקות מתורגמות', () => {
  const r = ok('<עמוד מחלקה="ממרכז צל">מה</עמוד>');
  assert.match(clean(r.bodyHtml), /class="עמוד ממרכז צל"/);
});

// ── סגנון ─────────────────────────────────────────────────────────────────
test('בלוק סגנון מתורגם', () => {
  const r = ok('<פסקה>טקסט</פסקה>\nסגנון פסקה {\n  צבע: סגול;\n  גופן-גודל: 1.2rem;\n}');
  assert.match(r.css, /\.פסקה \{[^}]*color: #8b5cf6;[^}]*font-size: 1\.2rem;/s);
});

test('בחירת מחלקה ומזהה בעברית', () => {
  const r = ok('סגנון .מיוחד { צבע: ירוק; }\nסגנון #ראשי { צבע: כחול; }');
  assert.match(r.css, /\.מיוחד \{/);
  assert.match(r.css, /#ראשי \{/);
});

test('משתני עיצוב הופכים ל-CSS variables', () => {
  const r = ok('משתנה צבע-ראשי: #7c3aed;\n<כותרת1>כותרת</כותרת1>\nסגנון כותרת1 { צבע: צבע-ראשי; }');
  assert.match(r.css, /:root \{\n {2}--צבע-ראשי: #7c3aed;/);
  assert.match(r.css, /\.כותרת1 \{/);
  assert.match(r.css, /color: var\(--צבע-ראשי\)/);
});

test('שאילתות מסך', () => {
  const r = ok('סגנון מסך-טלפון {\n  כותרת1 { גופן-גודל: 1rem; }\n}');
  assert.match(r.css, /@media \(max-width: 640px\) \{\s*\.כותרת1 \{/);
});

test('מסך עם תנאים מפורשים', () => {
  const a = ok('סגנון מסך (רוחב: 900px) {\n  פסקה { צבע: שחור; }\n}');
  assert.match(a.css, /@media \(min-width: 900px\)/);
  const b = ok('סגנון מסך (רוחב: עד 640px) {\n  כותרת1 { צבע: שחור; }\n}');
  assert.match(b.css, /@media \(max-width: 640px\)/);
  const c = ok('סגנון מסך (העדפת-צבע: כהה) ו (רוחב: מ-800px) {\n  גוף { צבע: לבן; }\n}');
  assert.match(c.css, /@media \(prefers-color-scheme: dark\) and \(min-width: 800px\)/);
});

test('תחילת CSS מוכנה תמיד מגיעה', () => {
  assert.match(build('שלום').css, /:root \{/);
  assert.doesNotMatch(build('שלום', { design: false }).css, /:root \{/, 'אפשר לכבות את העיצוב');
});

test('כלל מקונן עם &', () => {
  const r = ok('סגנון מאגר {\n  כרטיס { ריפוד: 1rem; }\n  & > כותרת1 { צבע: אדום; }\n}');
  assert.match(r.css, /\.מאגר \.כרטיס \{/);
  assert.match(r.css, /\.מאגר > \.כותרת1 \{/);
});

// ── זרימת שליטה ───────────────────────────────────────────────────────────
test('משתנים', () => {
  const r = ok('משתנה א = 2;\nמשתנה ב = א כפל 3;\n<פסקה>{ב}</פסקה>');
  assert.match(clean(r.bodyHtml), />6</);
});

test('אם / אחרת', () => {
  const r = ok('משתנה גיל = 20;\n<פסקה>{אם גיל < 18 {קטין} אחרת {בוגר}}</פסקה>');
  assert.match(clean(r.bodyHtml), />בוגר</);
});

test('אחרת-אם', () => {
  const r = ok('משתנה נ = 5;\n<פסקה>{אם נ < 3 {קטן} אחרת אם נ < 10 {בינוני} אחרת {גדול}}</פסקה>');
  assert.match(clean(r.bodyHtml), />בינוני</);
});

test('לכל על רשימה', () => {
  const r = ok('משתנה פריטים = ["א", "ב", "ג"];\n<רשימה>\nלכל פריט בפריטים {\n<פריט>{פריט}</פריט>\n}\n</רשימה>');
  assert.equal((r.bodyHtml.match(/<li class="פריט">/g) || []).length, 3);
  assert.match(r.bodyHtml, /<li class="פריט">א<\/li>/);
});

test('לכל בטווח', () => {
  const r = ok('<רשימה>\nלכל i מ-1 עד-3 {\n<פריט>{i}</פריט>\n}\n</רשימה>');
  assert.match(r.bodyHtml, /<li class="פריט">1<\/li>/);
  assert.match(r.bodyHtml, /<li class="פריט">3<\/li>/);
  assert.doesNotMatch(r.bodyHtml, /<li class="פריט">4<\/li>/);
});

test('לכל עם אינדקס', () => {
  const r = ok('משתנה רשימה = ["א", "ב"];\n<פסקה>\nלכל x ברשימה {\n{אינדקס}:{x} \n}\n</פסקה>');
  assert.match(clean(r.bodyHtml), />0:א1:ב/);
});

test('הפסק והמשך', () => {
  const r = ok('<פסקה>{לכל i מ-1 עד-9 {אם i > 2 {הפסק} אם i == 1 {המשך} {i} }}</פסקה>');
  assert.match(clean(r.bodyHtml), />2/);
  assert.doesNotMatch(clean(r.bodyHtml), /3/);
});

test('פונקציה והחזר', () => {
  const r = ok('פונקציה סכום(א, ב) {\n  החזר א + ב;\n}\n<פסקה>{סכום(2, 3)}</פסקה>');
  assert.match(clean(r.bodyHtml), />5</);
});

test('פונקציה עם ערך ברירת מחדל', () => {
  const r = ok('פונקציה ברוך(שם = "עולם") {\n  החזר "שלום " + שם;\n}\n<פסקה>{ברוך()}</פסקה>');
  assert.match(clean(r.bodyHtml), /שלום עולם/);
});

test('הדפס מדפיס בזמן הבנייה', () => {
  const r = ok('הדפס "שלום";\nהדפס 1 + 1;');
  assert.deepEqual(r.output, ['שלום', '2']);
});

test('כל-עוד עם תנאי', () => {
  const r = ok('משתנה i = 0;\n<פסקה>{כל-עוד i < 3 {i; i = i + 1}}</פסקה>');
  assert.match(clean(r.bodyHtml), /012/);
});

// ── רכיבים ────────────────────────────────────────────────────────────────
test('רכיב עם פרמטרים', () => {
  const r = ok('רכיב ברוך(שם) {\n<פסקה>שלום {שם}</פסקה>\n}\n<ברוך שם="דוד" />');
  assert.match(clean(r.bodyHtml), /<p class="פסקה ivrit-p">שלום דוד<\/p>/);
});

test('רכיב מקבל ילדים', () => {
  const r = ok('רכיב עטרה(כותרת) {\n<עמוד>\n<כותרת2>{כותרת}</כותרת2>\n{ילדים}\n</עמוד>\n}\n<עטרה כותרת="מלך">\n<p>תוכן</p>\n</עטרה>');
  assert.match(r.bodyHtml, /<h2 class="כותרת2">מלך<\/h2>/);
  assert.match(r.bodyHtml, /<p>תוכן<\/p>/);
});

test('רכיב משתמש במאפיינים', () => {
  const r = ok('רכיב תו(מזהה) {\n<עמוד מזהה={מזהה}></עמוד>\n}\n<תו מזהה="א" />\n<תו מזהה="ב" />');
  assert.match(r.bodyHtml, /id="א"/);
  assert.match(r.bodyHtml, /id="ב"/);
});

test('רכיב בתוך לולאה', () => {
  const r = ok('רכיב שורה(טקסט) {\n<פריט>{טקסט}</פריט>\n}\n<רשימה>\nלכל x ב["א","ב"] {\n<שורה טקסט={x} />\n}\n</רשימה>');
  assert.equal((r.bodyHtml.match(/<li class="פריט">/g) || []).length, 2);
});

test('רכיב מקבן את עצמו ללא סוף', () => {
  const r = build('רכיב רשת(עומק) {\n<עמוד>{אם עומק > 0 {<רשת עומק={עומק חיסור 1} />}}</עמוד>\n}\n<רשת עומק={200} />');
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].message, /64/);
});

// ── שגיאות ────────────────────────────────────────────────────────────────
test('שגיאה: תג לא ידוע עם הצעה', () => {
  const r = build('<כרטס>משהו</כרטס>');
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].message, /כרטיס/);
});

test('שגיאה: סגירה של תג אחר', () => {
  const r = build('<פסקה>טקסט</כותרת1>');
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].message, /לא מתאימה/);
});

test('שגיאה: משתנה לא מוגדר', () => {
  const r = build('<פסקה>{לא_קיים}</פסקה>');
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].message, /לא_קיים/);
});

test('שגיאה: תיוג לא סגור', () => {
  const r = build('<עמוד>\n<פסקה>טקסט</פסקה>');
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].message, /נגמר/);
});

test('שגיאה: לולאה אינסופית נעצרת', () => {
  const r = build('משתנה i = 0;\n<פסקה>{כל-עוד אמת {i = i + 1}}</פסקה>');
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].message, /לא נעצרה/);
});

test('לכל על ערך יחיד מציג אותו', () => {
  const r = ok('משתנה x = 5;\n<פסקה>\nלכל y בx {\n  {y}\n}\n</פסקה>');
  assert.match(clean(r.bodyHtml), />5</);
});

// ── אימון HTML ────────────────────────────────────────────────────────────
test('תווים מיוחדים מסומנים', () => {
  assert.match(body('<פסקה>5 < 6 & 7 > 2</פסקה>'), /5 &lt; 6 &amp; 7 &gt; 2/);
});

test('מאפיין עם גרשיים מסומן', () => {
  assert.match(body('<עמוד מזהה=\'a"b\'></עמוד>'), /id="a&quot;b"/);
});

// ── הערות ─────────────────────────────────────────────────────────────────
test('הערת שורה בעברית (--) מתעלמת מהקוד', () => {
  const r = ok('-- כותרת הדף\nמשתנה שם = "עולם";\n<פסקה>{שם}</פסקה>');
  assert.match(clean(r.bodyHtml), />עולם</);
});

test('הערה באמצע טקסט לא מבלעת', () => {
  assert.match(body('<פסקה>טקסט עם -- מקף כפול</פסקה>'), /מקף כפול/);
});

test('טקסט רגיל לא בולע את הפקודה שאחריו', () => {
  const r = ok('טקסת ארוכה\nמשתנה x = 1;\n<פסקה>{x}</פסקה>');
  assert.match(clean(r.bodyHtml), /טקסת ארוכה/);
  assert.match(clean(r.bodyHtml), />1</);
});

// ── ישויות HTML ───────────────────────────────────────────────────────────
test('ישות &lt; מתפענחת לתוית', () => {
  assert.match(body('<פסקה>5 &lt; 6</פסקה>'), /5 &lt; 6/);
});

test('ישות במאפיין נשמרת', () => {
  assert.match(body('<עמוד מזהה="a&amp;b"></עמוד>'), /id="a&amp;b"/);
});

test('סימן & גולמי נשמר כתו', () => {
  assert.match(body('<פסקה>a &amp;amp; b</פסקה>'), /a &amp;amp; b/);
});

// ── בלוקי קוד ─────────────────────────────────────────────────────────────
test('בלוק קוד מציג טקסט מילולי', () => {
  const html = body('<קוד-בלוק>\nמשתנה x = 5;\nלכל y {\n  {y}\n}\n</קוד-בלוק>');
  // רצפי עברית עטופים ב-<bdi> כדי לשמור על סדר הסימנים ב-RTL; הטקסט עצמו נשמר
  const text = html.replace(/<\/?bdi>/g, '');
  assert.match(text, /משתנה x = 5;/);
  assert.match(html, /\{y\}/, 'סוגריים משתארים כמות שהם');
});

test('בלוק קוד עוטף רצפי עברית ב-bdi כדי שהפיסוק לא יתהפך ב-RTL', () => {
  const html = body('<קוד-בלוק>פונקציה ברוכים(שם) { ... }</קוד-בלוק>');
  assert.match(html, /<bdi>פונקציה<\/bdi> <bdi>ברוכים<\/bdi>\(<bdi>שם<\/bdi>\) \{ \.\.\. \}/);
});

test('קוד שורתי נשאר בשורה אחת', () => {
  assert.match(body('<פסקה>כתוב <קוד>&lt;div&gt;</קוד></פסקה>'), /<code[^>]*>&lt;div&gt;<\/code>/);
});

test('בלוק קוד לא מריץ פקודות', () => {
  const r = build('<קוד-בלוק>משתנה x = 1;</קוד-בלוק>\n<פסקה>{x}</פסקה>');
  assert.match(clean(r.bodyHtml), /<p[^>]*>\s*<\/p>/, 'המשתנה לא נוצר');
});

// ── משתני גלם ─────────────────────────────────────────────────────────────
test('משתנה גלם נטען כמשתנה רגיל בהפרשה', () => {
  const html = body('משתנה צבע-ראשי: #5b3df5;\n<פסקה>{צבע-ראשי}</פסקה>');
  assert.match(html, /#5b3df5/);
});

// ── מקור ככתובת יעד ───────────────────────────────────────────────────────
test('מקור בקישור הופך ל-href', () => {
  assert.match(body('<קישור מקור="https://x.dev">לינק</קישור>'), /href="https:\/\/x\.dev"/);
});

test('מקור בתמונה נשאר src', () => {
  assert.match(body('<תמונה מקור="a.png">'), /src="a\.png"/);
});

// ── מילות מפתח נוספות ──────────────────────────────────────────────────────
test('מילית מפתח מחזיר בעברית', () => {
  const r = ok('פונקציה חישוב() { מחזיר 6 כפל 7; }\n<פסקה>{חישוב()}</פסקה>');
  assert.match(clean(r.bodyHtml), />42</);
});

test('הגדר הוא מילית מפתח למשתנה', () => {
  assert.match(body('הגדר x = 3;\n<פסקה>{x}</פסקה>'), />3</);
});

// ── טמעת CSS מקומי ───────────────────────────────────────────────────────
test('קובץ CSS מקומי נטמע בדף', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ivrit-'));
  const cssFile = path.join(dir, 'style.css');
  fs.writeFileSync(cssFile, '.מותג { color: red; }\n');
  const ivFile = path.join(dir, 'עמוד.iv');
  fs.writeFileSync(ivFile, '<מסמך>\n<ראש>\n<נתיב ייחוס="stylesheet" מקור="style.css">\n</ראש>\n<פסקה>שלום</פסקה>\n</מסמך>\n');
  const r = compileFile(ivFile);
  assert.deepEqual(r.errors, []);
  assert.doesNotMatch(r.html, /<link/, 'הקישור ל-CSS הוסר');
  assert.match(r.html, /\.מותג \{ color: red; \}/, 'תוכן הקובץ נטמע');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('קישור ל-CSS חיצוני נשאר כמו שהוא', () => {
  const r = build('<מסמך>\n<ראש>\n<נתיב ייחוס="stylesheet" מקור="https://cdn.dev/a.css">\n</ראש>\n</מסמך>');
  assert.match(r.html, /<link[^>]+href="https:\/\/cdn\.dev\/a\.css"/);
});

// ── סימני כיוון (מצב LTR לעורך) ───────────────────────────────────────────────
import { addLtrMarks, removeLtrMarks, stripBidiMarks, hasBidiMarks } from '../src/ltr.js';

const LRM = String.fromCharCode(0x200E);

test('המהדר מתעלם מסימני כיוון (LRM) בתחילת שורות', () => {
  const src = 'משתנה שם = "עולם";\n<פסקה>שלום {שם}</פסקה>\n';
  const marked = addLtrMarks(src);
  assert.equal(build(marked).bodyHtml, build(src).bodyHtml, 'הפלט זהה עם וללא הסימנים');
});

test('addLtrMarks מוסיף LRM לכל שורה לא-ריקה, ו-strip מחזיר למקור', () => {
  const src = 'שורה אחת\n\nשורה שתיים\n';
  const marked = addLtrMarks(src);
  const nonEmpty = src.split('\n').filter((l) => l.trim());
  assert.ok(marked.split('\n').filter((l) => l.trim()).every((l) => l[0] === LRM));
  assert.equal(marked.split('\n').filter((l) => l[0] === LRM).length, nonEmpty.length);
  assert.equal(stripBidiMarks(marked), src, 'הסרה מחזירה למקור');
  assert.equal(removeLtrMarks(marked), src);
});

test('hasBidiMarks מזהה מצב LTR', () => {
  assert.equal(hasBidiMarks('טקסט רגיל'), false);
  assert.equal(hasBidiMarks(addLtrMarks('טקסט')), true);
});

test('addLtrMarks אידמפוטנטי', () => {
  const once = addLtrMarks('משתנה x = 1;\n<פסקה>א</פסקה>\n');
  assert.equal(addLtrMarks(once), once);
});
