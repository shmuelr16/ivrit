// בדיקות להרשתת העורך - תצוגה מקדימה
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildPreviewHtml, cleanMessage } = require('../src/preview.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const { compile } = await import(new URL('../../../src/compiler.js', import.meta.url).href);

test('תצוגה מקדימה מציגה את הדף שנבנה', () => {
  const r = compile('<מסמך שם="בדיקה"><פסקה>שלום</פסקה></מסמך>', { file: 'בדיקה.iv' });
  const html = buildPreviewHtml({ html: r.html, errors: r.errors }, 'בדיקה.iv');
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /שלום/);
  assert.doesNotMatch(html, /<script/i);
});

test('תצוגה מקדימה מציגה שגיאות במקום הדף', () => {
  const r = compile('<פסקה>שלום</כותרת1>', { file: 'בדיקה.iv' });
  const html = buildPreviewHtml({ html: r.html, errors: r.errors }, 'בדיקה.iv');
  assert.match(html, /שגיאות בקובץ בדיקה\.iv/);
  assert.match(html, /<li>סגרת/);
});

test('הודעת שגיאה מנוקה מקידומת מיקום', () => {
  assert.equal(cleanMessage('דף.iv:3:7 — משתנה לא מוגדר'), 'משתנה לא מוגדר');
  assert.equal(cleanMessage('שגיאה פשוטה'), 'שגיאה פשוטה');
});

test('בלי קובץ פתוח מוצגת הנחיה', () => {
  assert.match(buildPreviewHtml(null), /פותח קובץ/);
});

test('המקמפל המשוכפל בהרשתה תקין', async () => {
  const vendored = path.join(root, 'editors', 'vscode', 'vendor', 'compiler.js');
  const { compile: vendoredCompile } = await import(`file://${vendored}`);
  const r = vendoredCompile('<פסקה>מה הולך כאן</פסקה>', { file: 'בדיקה.iv' });
  assert.deepEqual(r.errors, []);
  assert.match(r.bodyHtml, /מה הולך כאן/);
});
