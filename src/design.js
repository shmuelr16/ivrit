// design.js - מערכת העיצוב המוכנה של עִבְרִית.
// כל מסמך מקבל עיצוב יפה, RTL, ורספונסיבי בלי לכתוב שורת CSS אחת.

import { DESIGN_CLASSES, designClass, normalizeKey } from './dict.js';

export const BASE_THEME = `
:root {
  --ivrit-רקע: #f6f7fb;
  --ivrit-נייר: #ffffff;
  --ivrit-טקסט: #101828;
  --ivrit-עמום: #667085;
  --ivrit-גבול: #e4e7ec;
  --ivrit-ראשי: #5b3df5;
  --ivrit-ראשי-בהיר: #efeaff;
  --ivrit-מוצלח: #12b76a;
  --ivrit-אזהרה: #f79009;
  --ivrit-שגיאה: #f04438;
  --ivrit-רדיוס: 14px;
  --ivrit-צל: 0 1px 2px rgba(16,24,40,.06), 0 8px 24px rgba(16,24,40,.06);
  --ivrit-צל-גדול: 0 24px 60px rgba(16,24,40,.16);
  --ivrit-גופן: "Assistant", "Rubik", "Heebo", "Noto Sans Hebrew", "Segoe UI", system-ui, sans-serif;
  --ivrit-מונו: "JetBrains Mono", "SF Mono", Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ivrit-רקע: #0b0d12;
    --ivrit-נייר: #151922;
    --ivrit-טקסט: #e7e9ee;
    --ivrit-עמום: #98a2b3;
    --ivrit-גבול: #262b36;
    --ivrit-ראשי: #8b7bff;
    --ivrit-ראשי-בהיר: #241f4d;
    --ivrit-צל: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
  }
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: var(--ivrit-גופן);
  font-size: 17px;
  line-height: 1.7;
  color: var(--ivrit-טקסט);
  background: var(--ivrit-רקע);
  direction: rtl;
  text-align: right;
  -webkit-font-smoothing: antialiased;
}
img, video, svg { max-width: 100%; height: auto; display: block; }
a { color: var(--ivrit-ראשי); text-decoration-thickness: 1.5px; text-underline-offset: 3px; }
.ivrit-container { width: min(1120px, 100% - 2.5rem); margin-inline: auto; }
.ivrit-p { margin: 0 0 1rem; }
h1, h2, h3, h4, h5, h6 { margin: 0 0 .5em; line-height: 1.25; font-weight: 800; letter-spacing: -.01em; }
h1 { font-size: clamp(2rem, 5vw, 3.25rem); }
h2 { font-size: clamp(1.6rem, 3.4vw, 2.25rem); }
h3 { font-size: 1.35rem; }
h4 { font-size: 1.1rem; }
p  { line-height: 1.75; }
.ivrit-sub { color: var(--ivrit-עמום); font-size: 1.05rem; }
.ivrit-muted { color: var(--ivrit-עמום); }
.ivrit-card {
  background: var(--ivrit-נייר);
  border: 1px solid var(--ivrit-גבול);
  border-radius: var(--ivrit-רדיוס);
  padding: 1.5rem;
  box-shadow: var(--ivrit-צל);
}
.ivrit-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; }
.ivrit-col { min-width: 0; }
.ivrit-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; }
.ivrit-flex { display: flex; gap: 1rem; flex-wrap: wrap; }
.ivrit-center { text-align: center; display: flex; flex-direction: column; align-items: center; }
.ivrit-glass {
  background: color-mix(in srgb, var(--ivrit-נייר) 70%, transparent);
  backdrop-filter: blur(14px);
  border: 1px solid var(--ivrit-גבול);
  border-radius: var(--ivrit-רדיוס);
  box-shadow: var(--ivrit-צל);
}
.ivrit-header { padding: 1rem 0; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.ivrit-nav { display: flex; gap: 1.25rem; align-items: center; flex-wrap: wrap; }
.ivrit-nav a { text-decoration: none; color: var(--ivrit-טקסט); font-weight: 600; }
.ivrit-nav a:hover { color: var(--ivrit-ראשי); }
.ivrit-current { color: var(--ivrit-ראשי); }
.ivrit-footer { padding: 2.5rem 0; color: var(--ivrit-עמום); border-top: 1px solid var(--ivrit-גבול); margin-top: 3rem; }
.ivrit-ul, .ivrit-ol { margin: 0 0 1rem; padding-inline-start: 1.4rem; }
.ivrit-ul { list-style: disc; }
.ivrit-ol { list-style: decimal; }
li { margin-block: .25rem; }
blockquote.ivrit-quote {
  margin: 1.25rem 0; padding: .25rem 1.25rem;
  border-inline-start: 4px solid var(--ivrit-ראשי);
  color: var(--ivrit-עמום); font-size: 1.1rem;
}
code.ivrit-code {
  font-family: var(--ivrit-מונו); font-size: .9em;
  background: var(--ivrit-ראשי-בהיר); color: var(--ivrit-ראשי);
  padding: .12em .4em; border-radius: 6px; direction: ltr; display: inline-block;
}
pre.ivrit-pre {
  font-family: var(--ivrit-מונו); direction: ltr; text-align: left;
  background: #0f1117; color: #e6e6e6; padding: 1.15rem 1.35rem;
  border-radius: var(--ivrit-רדיוס); overflow: auto; line-height: 1.6;
}
table.ivrit-table { width: 100%; border-collapse: collapse; margin: 0 0 1.25rem; font-size: .97em; }
.ivrit-table th, .ivrit-table td { border: 1px solid var(--ivrit-גבול); padding: .6rem .8rem; text-align: right; }
.ivrit-table th { background: var(--ivrit-ראשי-בהיר); font-weight: 700; }
.ivrit-table tr:nth-child(even) td { background: color-mix(in srgb, var(--ivrit-נייר) 60%, var(--ivrit-רקע)); }
.ivrit-btn {
  font: inherit; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: .4rem;
  padding: .6rem 1.1rem; border-radius: 10px;
  border: 1px solid var(--ivrit-גבול); background: var(--ivrit-נייר); color: var(--ivrit-טקסט);
  transition: transform .12s ease, box-shadow .18s ease, background .18s ease;
  text-decoration: none;
}
.ivrit-btn:hover { transform: translateY(-1px); box-shadow: var(--ivrit-צל); }
.ivrit-btn:active { transform: translateY(0); }
.ivrit-btn-primary { background: var(--ivrit-ראשי); border-color: var(--ivrit-ראשי); color: #fff; }
.ivrit-btn-ghost { background: transparent; border-color: transparent; color: var(--ivrit-ראשי); }
.ivrit-label { display: block; font-weight: 700; margin-bottom: .35rem; }
input, select, textarea {
  font: inherit; color: inherit; width: 100%;
  padding: .6rem .8rem; border-radius: 10px;
  border: 1px solid var(--ivrit-גבול); background: var(--ivrit-נייר);
}
input:focus, select:focus, textarea:focus, button:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--ivrit-ראשי) 35%, transparent);
  outline-offset: 1px; border-color: var(--ivrit-ראשי);
}
input[type=checkbox], input[type=radio] { width: auto; accent-color: var(--ivrit-ראשי); }
.ivrit-badge {
  display: inline-flex; align-items: center; gap: .35rem;
  padding: .2rem .6rem; border-radius: 999px;
  background: var(--ivrit-ראשי-בהיר); color: var(--ivrit-ראשי);
  font-size: .82rem; font-weight: 700;
}
.ivrit-hr { border: none; border-top: 1px solid var(--ivrit-גבול); margin: 2rem 0; }
.ivrit-kbd {
  font-family: var(--ivrit-מונו); font-size: .85em; direction: ltr;
  background: var(--ivrit-נייר); border: 1px solid var(--ivrit-גבול);
  border-bottom-width: 2px; border-radius: 6px; padding: .1em .45em;
}
.ivrit-details { border: 1px solid var(--ivrit-גבול); border-radius: var(--ivrit-רדיוס); padding: .75rem 1rem; background: var(--ivrit-נייר); }
.ivrit-summary { font-weight: 700; cursor: pointer; }
.ivrit-dialog { border: 1px solid var(--ivrit-גבול); border-radius: var(--ivrit-רדיוס); padding: 1.5rem; max-width: 560px; box-shadow: var(--ivrit-צל-גדול); background: var(--ivrit-נייר); }
.ivrit-toast { position: fixed; inset-block-end: 1.5rem; inset-inline-start: 1.5rem; background: var(--ivrit-טקסט); color: var(--ivrit-רקע); padding: .8rem 1.1rem; border-radius: 10px; box-shadow: var(--ivrit-צל-גדול); }
.ivrit-shadow { box-shadow: var(--ivrit-צל); }
::selection { background: var(--ivrit-ראשי); color: #fff; }
:focus-visible { outline: 3px solid color-mix(in srgb, var(--ivrit-ראשי) 45%, transparent); outline-offset: 2px; }
@keyframes ivrit-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
@media print { body { background: #fff; } .ivrit-nav, .ivrit-btn { display: none; } }
`;

/** מחזיר את כל מחלקות העיצוב המוכנות כ-CSS */
export function designUtilities() {
  const rules = [];
  for (const name of Object.keys(DESIGN_CLASSES)) {
    const decl = DESIGN_CLASSES[name];
    rules.push(`.${name} { ${decl} }`);
  }
  // וריאציות RTL/LTR של מחלקות כיווניות
  rules.push('[dir="ltr"] .ממרכז, [dir="ltr"] .ivrit-center { text-align: left; }');
  rules.push('[dir="rtl"] .ממרכז { text-align: center; }');
  return rules.join('\n');
}

export function designClassFor(name) {
  return designClass(normalizeKey(name));
}
