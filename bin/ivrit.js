#!/usr/bin/env node
// bin/ivrit.js - כלי שורת הפקודה של עִבְרִית

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { compileFile, check, finalize } from '../src/compiler.js';
import { serve } from '../src/server.js';
import { createProject } from '../src/newproject.js';
import { addLtrMarks, removeLtrMarks } from '../src/ltr.js';

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  magenta: '\x1b[35m', cyan: '\x1b[36m',
};
const c = (color, text) => (process.stdout.isTTY ? `${C[color]}${text}${C.reset}` : String(text));

const HELP = `
${c('bold', 'עִבְרִית')} ${c('dim', '(ivrit)')} - שפת סימון בעברית שהופכת ל-HTML ול-CSS

${c('bold', 'שימוש:')}
  ivrit build <קובץ.iv> [-o פלט.html] [--no-design] [--minify]
  ivrit serve <קובץ.iv> [-p 3000] [--no-design]
  ivrit check <קובץ.iv> [קובץ2.iv ...]
  ivrit ltr  <קובץ.iv> [--off]     תצוגת קוד שמאל-לימין בעורך (לא משפיע על הפלט)
  ivrit new  <שם-התיקייה>          יוצר פרויקט מוכן
  ivrit help

${c('bold', 'דוגמה:')}
  ivrit build examples/home.iv -o dist/index.html
  ivrit serve examples/home.iv

${c('dim', 'קובץ נקרא עם סיומת .iv או .ivrit')}
`;

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [key, inline] = a.slice(2).split('=');
      if (key.startsWith('no-')) args.flags[key.slice(3)] = false;
      else if (inline !== undefined) args.flags[key] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith('-')) { args.flags[key] = argv[++i]; }
      else args.flags[key] = true;
    } else if (a.startsWith('-') && a.length > 1) {
      const key = { o: 'out', p: 'port', w: 'watch' }[a[1]] || a[1];
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) args.flags[key] = argv[++i];
      else args.flags[key] = true;
    } else args._.push(a);
  }
  return args;
}

function reportProblems(result, { quiet = false } = {}) {
  let bad = false;
  for (const err of result.errors || []) {
    bad = true;
    console.error(`${c('red', '✖ שגיאה')}: ${err.message}`);
  }
  if (!quiet) {
    for (const warn of result.warnings || []) {
      console.warn(`${c('yellow', '⚠ אזהרה')}: ${warn.message}`);
    }
  }
  return bad;
}

function cmdBuild(args) {
  const file = args._[1];
  if (!file) return fail('חסר שם קובץ. לדוגמה: ivrit build index.iv');
  if (!fs.existsSync(file)) return fail(`הקובץ "${file}" לא נמצא`);
  const out = args.flags.out || args.flags.o
    || path.join(path.dirname(file), 'index.html');
  const result = compileFile(file, { design: args.flags.design !== false });
  if (reportProblems(result)) {
    console.error(c('dim', '\n💡 טיפ: הרצתי ivrit check לפרטים מדויקים'));
    process.exitCode = 1;
    return;
  }
  for (const line of result.output) console.log(c('dim', `הדפס › ${line}`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const html = finalize(result, { minify: Boolean(args.flags.minify) });
  fs.writeFileSync(out, html, 'utf8');
  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log(`${c('green', '✔ נבנה')} ${c('bold', out)} ${c('dim', `(${kb}KB)`)}`);
  for (const warn of result.warnings || []) console.warn(`${c('yellow', '⚠')}: ${warn.message}`);
}

function cmdServe(args) {
  const file = args._[1];
  if (!file) return fail('חסר שם קובץ. לדוגמה: ivrit serve index.iv');
  if (!fs.existsSync(file)) return fail(`הקובץ "${file}" לא נמצא`);
  serve({
    file: path.resolve(file),
    port: Number(args.flags.port || args.flags.p || 3000),
    design: args.flags.design !== false,
    minify: Boolean(args.flags.minify),
  });
}

function cmdCheck(args) {
  const files = args._.slice(1);
  if (!files.length) return fail('חסר שם קובץ לבדיקה');
  let result;
  try {
    result = check(files);
  } catch (err) {
    return fail(err.message);
  }
  reportProblems(result);
  if (result.errors.length) {
    console.error(c('red', `\n✖ ${result.errors.length} שגיאות`));
    process.exitCode = 1;
  } else {
    console.log(`${c('green', '✔')} הכל תקין${result.warnings.length ? c('dim', ` (${result.warnings.length} אזהרות)`) : ''}`);
  }
}

function cmdNew(args) {
  const dir = args._[1] || 'האתר-שלי';
  try {
    const created = createProject(dir);
    console.log(`${c('green', '✔ נוצר פרויקט:')} ${c('bold', dir)}`);
    console.log(`\nמתחילים:\n  ${c('cyan', `cd ${dir}`)}\n  ${c('cyan', 'npm install')}\n  ${c('cyan', 'npm run dev')}\n`);
    for (const f of created) console.log(c('dim', `  ${f}`));
  } catch (err) {
    fail(err.message);
  }
}

function cmdLtr(args) {
  const file = args._[1];
  if (!file) return fail('חסר שם קובץ. לדוגמה: ivrit ltr index.iv');
  if (!fs.existsSync(file)) return fail(`הקובץ "${file}" לא נמצא`);
  const source = fs.readFileSync(file, 'utf8');
  const off = Boolean(args.flags.off);
  const updated = off ? removeLtrMarks(source) : addLtrMarks(source);
  fs.writeFileSync(file, updated, 'utf8');
  if (off) {
    console.log(`${c('green', '✔ הוסרו סימני הכיוון מ-')}${c('bold', file)}`);
  } else {
    console.log(`${c('green', '✔ מצב LTR הופעל על ')}${c('bold', file)}`);
    console.log(c('dim', '  העורך יציג את הקוד משמאל-לימין. הפלט לא מושפע. הרץ שוב אחרי שמוסיפים שורות.'));
  }
}

function fail(message) {
  console.error(`${c('red', '✖')}: ${message}`);
  process.exitCode = 1;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0] || 'help';
switch (command) {
  case 'build': case 'b': cmdBuild(args); break;
  case 'serve': case 's': case 'dev': cmdServe(args); break;
  case 'check': case 'c': cmdCheck(args); break;
  case 'ltr': cmdLtr(args); break;
  case 'new': cmdNew(args); break;
  case 'help': case 'h': case '--help': case '-h': console.log(HELP); break;
  default:
    console.log(HELP);
    fail(`פקודה לא ידועה: ${command}`);
}
