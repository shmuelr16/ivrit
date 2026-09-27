// parser.js - מנתח המסמכים של עִבְרִית.
// ממיר טקסט בעברית לעץ תחביר (AST) שהמרנדר יודע להפוך ל-HTML.

import { IvritError, parseExpression, tokenize } from './expr.js';
import {
  ELEMENT_NAMES, VOID_TAGS, lookupElement, lookupKeyword, normalizeKey,
  STATEMENT_WORDS, suggest,
} from './dict.js';
import { stripBidiMarks } from './ltr.js';

/** מסיר הזחה משותפת מבלוק קוד - כמו שעורכים כתבונית */
function dedent(text) {
  const lines = text.split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  if (lines.length <= 1) return lines.join('');
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/u.exec(l)[0].length));
  return lines.map((l) => l.slice(indent)).join('\n');
}

/** בטוח להכנסת מחרוזת לתוך ביטוי רגוללי */
function escapeRegExp(s) {
  return String(s).replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/** מחזיר את האינדקס אחרי מחרוזת, או -1 אם לא נסגרה */
function skipStringIn(text, j) {
  const quote = text[j];
  let k = j + 1;
  while (k < text.length) {
    if (text[k] === '\\') { k += 2; continue; }
    if (text[k] === quote) return k + 1;
    k++;
  }
  return -1;
}

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', lrm: '\u200e', rlm: '\u200f',
};

/** מפענח ישויות HTML כדי שאפשר יהיה לכתוב &lt; ו-&amp; בטקסט */
export function decodeEntities(s) {
  return String(s).replace(/&(#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => {
    const key = name.toLowerCase();
    if (key.startsWith('#')) {
      const code = key[1] === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return key in NAMED_ENTITIES ? NAMED_ENTITIES[key] : m;
  });
}

const WORD_START = /[\p{L}_]/u;
const NAME_CHAR = /[\p{L}\p{N}_-]/u;
const EN_SELECTOR_KEYWORDS = new Set(['and', 'or', 'not', 'only']);
/** תגים שהתוכן שלהם מילולי - מיועדים להצגת קוד */
const VERBATIM_TAGS = new Set(['code', 'pre', 'kbd', 'samp']);

class Parser {
  constructor(src, file = '<זיכרון>') {
    // מתעלמים מסימני כיוון בלתי-נראים (LRM וכו') שמשמשים רק לתצוגה נוחה בעורך
    this.src = stripBidiMarks(src).replace(/\r\n?/g, '\n');
    this.file = file;
    this.i = 0;
    this.bodyMode = false;
    this.imports = [];
  }

  // ── עזרי סריקה ─────────────────────────────────────────────────────────
  line() {
    let n = 1;
    for (let k = 0; k < this.i && k < this.src.length; k++) if (this.src[k] === '\n') n++;
    return n;
  }
  fail(msg, pos = this.i) {
    let line = 1, col = 1;
    for (let k = 0; k < pos && k < this.src.length; k++) {
      if (this.src[k] === '\n') { line++; col = 1; } else col++;
    }
    throw new IvritError(`${this.file}:${line}:${col} — ${msg}`, pos);
  }
  eof() { return this.i >= this.src.length; }
  peek(k = 0) { return this.src[this.i + k]; }
  startsWith(s) { return this.src.startsWith(s, this.i); }
  skipSpaces() { while (!this.eof() && (this.src[this.i] === ' ' || this.src[this.i] === '\t')) this.i++; }
  skipWhitespace() { while (!this.eof() && /\s/.test(this.src[this.i])) this.i++; }
  skipOptional() {
    for (;;) {
      const before = this.i;
      this.skipWhitespace();
      if (this.startsWith('//') || (this.startsWith('--') && this.lineIsBlankBefore())) {
        while (!this.eof() && this.src[this.i] !== '\n') this.i++;
      }
      else if (this.startsWith('/*')) {
        const end = this.src.indexOf('*/', this.i + 2);
        this.i = end === -1 ? this.src.length : end + 2;
      } else if (this.startsWith('<!--')) {
        const end = this.src.indexOf('-->', this.i + 4);
        this.i = end === -1 ? this.src.length : end + 3;
      } else if (this.src[this.i] === ';') { this.i++; }
      if (this.i === before) return;
    }
  }

  /** האם עד לכאן (בשורה הנוכחית) יש רק רווחים - כלומר אנחנו בתחילת שורה */
  lineIsBlankBefore() {
    for (let k = this.i - 1; k >= 0; k--) {
      const ch = this.src[k];
      if (ch === '\n') return true;
      if (ch !== ' ' && ch !== '\t') return false;
    }
    return true;
  }

  readName() {
    const start = this.i;
    if (this.eof() || !WORD_START.test(this.src[this.i])) return null;
    while (!this.eof() && NAME_CHAR.test(this.src[this.i])) this.i++;
    return this.src.slice(start, this.i);
  }
  readRawWord() {
    const start = this.i;
    while (!this.eof() && NAME_CHAR.test(this.src[this.i])) this.i++;
    return this.src.slice(start, this.i);
  }

  /** מחזיר אינדקס לסוף קטע לפי תו עצירה, מכיר מחרוזות וסוגריים */
  findStopChars(stops, { allowNewline = true, skipBraces = false } = {}) {
    let depth = 0;
    let braces = 0;
    let j = this.i;
    while (j < this.src.length) {
      const ch = this.src[j];
      if (ch === '"' || ch === "'") {
        j = this.skipStringFrom(j);
        continue;
      }
      if (ch === '(' || ch === '[') { depth++; j++; continue; }
      if (ch === ')' || ch === ']') {
        if (depth === 0 && stops.includes(ch)) break;
        depth = Math.max(0, depth - 1);
        j++;
        continue;
      }
      if (skipBraces && ch === '{') { braces++; j++; continue; }
      if (skipBraces && ch === '}') {
        if (braces > 0) { braces--; j++; continue; }
        if (stops.includes('}')) return j;
        j++;
        continue;
      }
      if (depth > 0 || braces > 0) { j++; continue; }
      if (ch === '\n' && !allowNewline) break;
      if (stops.includes(ch)) break;
      j++;
    }
    return j;
  }
  skipStringFrom(j) {
    const end = skipStringIn(this.src, j);
    if (end === -1) this.fail('מחרוזת לא נסגרה', j);
    return end;
  }

  readUntilBraceBlock() {
    // קורא אחרי מילת מפתח עד '{' ברמת עומק 0, מחזיר את הטקסט שלפני
    const j = this.findStopChars(['{'], { allowNewline: true });
    const text = this.src.slice(this.i, j).trim();
    this.i = j;
    return text;
  }

  // ── תוכנית ─────────────────────────────────────────────────────────────
  parseProgram() {
    const body = this.parseNodes(null);
    if (!this.eof()) this.fail(`לא צפיתי לזה כאן: "${this.src.slice(this.i, this.i + 12)}"`);
    return { type: 'program', file: this.file, body, imports: this.imports };
  }

  /**
   * קורא צומת של צמצומים. closeTag = שם התג שמסיים (או null לא לסיים).
   */
  /**
   * בתוך גוף של פקודה ({...}), שורה שהיא ביטוי עם הקצאה נחשבת פקודת קוד
   * למשל: {כל-עוד i < 3 {i = i + 1}}
   */
  tryExprStatement() {
    const save = this.i;
    const src = this.src;
    let k = this.i;
    while (k < src.length) {
      const ch = src[k];
      if (ch === '\n' || ch === ';' || ch === '{' || ch === '}') break;
      if (ch === '<' && /[\p{L}\/>]/u.test(src[k + 1] || '')) break;
      k++;
    }
    const raw = src.slice(this.i, k).trim();
    if (raw === '' || raw.startsWith('//')) return null;
    const hasSemi = src[k] === ';';
    if (!hasSemi && !/=/u.test(raw) && !/\bהוא\b/u.test(raw)) return null;
    try {
      const ast = parseExpression(raw);
      ast.pos = save;
      this.i = hasSemi ? k + 1 : k;
      return { type: 'exprStmt', expr: ast, pos: save };
    } catch {
      this.i = save;
      return null;
    }
  }

  parseNodes(closeTag) {
    const nodes = [];
    for (;;) {
      const before = this.i;
      this.skipOptional();
      const preSpace = /[ \t]/.test(this.src.slice(before, this.i));
      if (this.eof()) {
        if (closeTag) this.fail(`הקובץ נגמר לפני שסגרנו את <${closeTag}>`);
        break;
      }
      const node = this.parseOne(closeTag);
      if (!node) break;
      if (preSpace) node.preSpace = true;
      nodes.push(node);
    }
    return nodes;
  }

  /** צומת יחיד; מחזיר null כשהגענו לסוגר של הבלוק */
  parseOne(closeTag) {
    if (this.eof()) {
      if (closeTag) this.fail(`הקובץ נגמר לפני שסגרנו את <${closeTag}>`);
      return null;
    }
    const ch = this.src[this.i];
    if (this.startsWith('</')) {
      if (closeTag) return null;
      this.fail('סגרת תג מופעלת בלי תג פותח', this.i);
    }
    if (ch === '}') {
      if (closeTag) this.fail(`סוגרת '}' לא צפויה - חסר </${closeTag}>`);
      return null;
    }
    if (ch === '<' && /[\p{L}\/>]/u.test(this.src[this.i + 1] || '')) {
      return this.parseElement();
    }
    if (ch === '{') return this.parseInterpolation();

    const stmt = this.tryStatement();
    if (stmt) return stmt;

    if (this.bodyMode && this.atLineStart()) {
      const exprStmt = this.tryExprStatement();
      if (exprStmt) return exprStmt;
    }

    const text = this.parseText();
    if (text === '') return null;
    return { type: 'text', value: decodeEntities(text), pos: this.i };
  }

  parseText() {
    const start = this.i;
    while (!this.eof()) {
      const ch = this.src[this.i];
      if (ch === '<') {
        if (/[\p{L}\/>]/u.test(this.src[this.i + 1] || '')) break;
        this.i++; continue;
      }
      if (ch === '{' || ch === '}') break;
      if (ch === ';' && this.bodyMode) break;
      if (ch === '\n' && (this.statementAhead() || this.statementOnNextLine())) break;
      this.i++;
    }
    return this.src.slice(start, this.i);
  }

  /** האם מילות מפתח של פקודה מתחילות כאן בתחילת שורה */
  /** האם השורה הבאה מתחילה בפקודה (כדי לא לבלוע אותה לתוך טקסט) */
  statementOnNextLine() {
    const nl = this.src.indexOf('\n', this.i);
    if (nl === -1) return false;
    const m = /^[ \t]*(?:\/\/|--)?[ \t]*([\p{L}\p{N}_-]+)/u.exec(this.src.slice(nl + 1));
    return !!m && STATEMENT_WORDS.has(normalizeKey(m[1]));
  }

  /** האם אנחנו בתחילת שורה (רק רווחים לפני) */
  atLineStart() {
    let lineStart = 0;
    for (let k = Math.max(0, this.i - 1); k >= 0; k--) {
      const ch = this.src[k];
      if (ch === '\n' || ch === '{' || ch === '}' || ch === ';') { lineStart = k + 1; break; }
    }
    for (let k = lineStart; k < this.i; k++) {
      if (this.src[k] !== ' ' && this.src[k] !== '\t') return false;
    }
    return true;
  }

  /** האם אנחנו בתחילת שורה עם מילת פקודה (אם, לכל, משתנה...) */
  statementAhead() {
    if (!this.atLineStart()) return false;
    const j = this.skipSpacesFrom(this.i);
    const m = /[\p{L}\p{N}_-]+/u.exec(this.src.slice(j));
    if (!m) return false;
    return STATEMENT_WORDS.has(normalizeKey(m[0]));
  }

  parseInterpolation() {
    const start = this.i;
    this.i++; // {
    const end = this.findStopChars(['}'], { skipBraces: true });
    const inner = this.src.slice(this.i, end);
    this.i = end + 1;
    // מנסה קודם כביטוי, ואם לא - כגוש תוכן (מאפשר {אם ... { <p>..</p> } אחרת {...}})
    try {
      const ast = parseExpression(inner);
      ast.pos = start;
      return { type: 'interp', expr: ast, pos: start };
    } catch {
      try {
        const sub = new Parser(inner, this.file);
        sub.bodyMode = true;
        const body = sub.parseNodes(null);
        sub.skipOptional();
        if (body.length > 0 && sub.eof()) return { type: 'interp', body, pos: start };
      } catch { /* נפול חזרה לשגיאת הביטוי */ }
    }
    this.fail('לא הצלחתי להבין את מה שבתוך {}. כתוב ביטוי, או תוכן כמו: {אם יש <<p>כן</p>> אחרת <<p>לא</p>>}', start);
    return null;
  }

  // ── פקודות ─────────────────────────────────────────────────────────────
  tryStatement() {
    if (!this.statementAhead()) return null;
    const save = this.i;
    const j = this.skipSpacesFrom(this.i);
    const word = /[\p{L}\p{N}_-]+/u.exec(this.src.slice(j));
    if (!word) return null;
    const kw = lookupKeyword(word[0]);
    if (!kw) return null;
    this.i = j + word[0].length;
    try {
      switch (kw) {
        case 'VAR': return this.parseVar();
        case 'IF': return this.parseIf();
        case 'FOR': return this.parseFor();
        case 'WHILE': return this.parseWhile();
        case 'FN': return this.parseFunction('function');
        case 'COMPONENT': return this.parseFunction('component');
        case 'RETURN': return this.parseReturn();
        case 'PRINT': return this.parsePrint();
        case 'IMPORT': return this.parseImport();
        case 'BREAK': this.consumeSemi(); return { type: 'break', pos: save };
        case 'CONTINUE': this.consumeSemi(); return { type: 'continue', pos: save };
        case 'STYLE': return this.parseStyleRule();
        case 'MEDIA': return this.parseStyleRule();
        default: break;
      }
    } catch (err) {
      if (err instanceof IvritError) throw err;
      throw new IvritError(`שגיאה בפקודה "${word[0]}": ${err.message}`, save);
    }
    this.i = save;
    return null;
  }
  skipSpacesFrom(i) {
    let k = i;
    while (k < this.src.length && (this.src[k] === ' ' || this.src[k] === '\t')) k++;
    return k;
  }
  consumeSemi() {
    this.skipWhitespace();
    if (this.src[this.i] === ';') this.i++;
  }
  readStmtExpr(extraStops = []) {
    // קורא ביטוי עד ';' או סוף שורה
    const end = this.findStopChars([';', ...extraStops], { allowNewline: true });
    let exprEnd = end;
    for (let k = end - 1; k > this.i; k--) {
      if (this.src[k] === '\n' || this.src[k] === ' ' || this.src[k] === '\t') { exprEnd = k; continue; }
      break;
    }
    const src = this.src.slice(this.i, exprEnd).trim();
    if (src === '') return { type: 'literal', value: null, pos: this.i };
    let ast;
    try {
      ast = parseExpression(src);
    } catch (err) {
      this.fail(`ביטוי לא תקין: ${err.message}`);
    }
    ast.pos = this.i;
    this.i = exprEnd;
    return ast;
  }

  parseVar() {
    this.skipSpaces();
    const name = this.readName();
    if (!name) this.fail('אחרי "משתנה" צריך שם משתנה');
    this.skipSpaces();
    if (this.src[this.i] === ':') {
      this.i++;
      const start = this.i;
      const end = this.findStopChars([';'], { allowNewline: false });
      const raw = this.src.slice(start, end).trim();
      this.i = end;
      this.consumeSemi();
      return { type: 'var', name, raw, pos: start };
    }
    if (this.src[this.i] === '=') {
      if (this.startsWith('==')) this.fail('כתוב כך: משתנה שם = ערך; (עם = אחד, לא ==)');
      this.i++;
    }
    const expr = this.readStmtExpr();
    this.consumeSemi();
    return { type: 'var', name, expr, pos: this.i };
  }

  parseIf() {
    const pos = this.i;
    const branches = [];
    let condSrc = this.readUntilBraceBlock();
    if (condSrc === '') this.fail('חסר תנאי אחרי "אם"');
    branches.push({ cond: this.parseCond(condSrc, pos), body: this.parseBlock() });
    let elseBody = null;
    this.skipOptional();
    for (;;) {
      const j = this.skipSpacesFrom(this.i);
      const tail = this.src.slice(j);
      const elseIf = /^(אחרת|אחרת[-־])\s+אם\s*/u.exec(tail);
      if (elseIf) {
        this.i = j + elseIf[0].length;
        const c = this.readUntilBraceBlock();
        branches.push({ cond: this.parseCond(c, this.i), body: this.parseBlock() });
        this.skipOptional();
        continue;
      }
      const plainElse = /^אחרת(?![֐-׿\p{L}\p{N}])/u.exec(tail);
      if (!plainElse) break;
      this.i = j + plainElse[0].length;
      this.readUntilBraceBlock();
      elseBody = this.parseBlock();
      break;
    }
    return { type: 'if', branches, else: elseBody, pos };
  }
  parseCond(src, pos) {
    try {
      const ast = parseExpression(src);
      ast.pos = pos;
      return ast;
    } catch (err) {
      this.fail(`תנאי לא תקין ("${src}"): ${err.message}`, pos);
    }
  }

  parseBlock() {
    this.skipWhitespace();
    if (this.src[this.i] !== '{') this.fail('צריך { אחרי תנאי');
    this.i++;
    const prevMode = this.bodyMode;
    this.bodyMode = true;
    const body = this.parseNodes(null);
    this.bodyMode = prevMode;
    this.skipWhitespace();
    if (this.src[this.i] !== '}') this.fail('חסר } שסוגר את הבלוק');
    this.i++;
    return body;
  }

  parseFor() {
    const pos = this.i;
    this.skipSpaces();
    const name = this.readName();
    if (!name) this.fail('אחרי "לכל" צריך שם משתנה');
    this.skipWhitespace();
    // לכל i מ-1 עד-10 {
    const rangeM = /^\s*מ\s*-\s*/u.exec(this.src.slice(this.i));
    if (rangeM) {
      this.i += rangeM[0].length;
      const fromExpr = this.readRangeBound();
      this.skipWhitespace();
      const toM = /^(?:עד\s*-\s*|עד\s+)/u.exec(this.src.slice(this.i));
      if (!toM) this.fail('צריך "עד-" אחרי "מ-"');
      this.i += toM[0].length;
      const toExpr = this.readRangeBound();
      const body = this.parseBlock();
      return { type: 'forRange', name, from: fromExpr, to: toExpr, body, pos };
    }
    // "ב" יכולה להיות מחוברת למילה: "לכל פריט ברשימה" או מופרדת: "לכל פריט ב רשימה"
    const rest = this.src.slice(this.i);
    const spaced = /^\s*ב\s+/u.exec(rest);
    const glued = spaced ? null : /^\s*ב(?=[\p{L}_(\[])/u.exec(rest);
    if (spaced) this.i += spaced[0].length;
    else if (glued) this.i += glued[0].length;
    else this.fail('צריד "ב" או "מ-... עד-..." אחרי שם המשתנה, למשל: לכל פריט ברשימה {');
    const expr = this.readStmtExpr(['{']);
    const body = this.parseBlock();
    return { type: 'forOf', name, expr, body, pos };
  }

  /** קורא גבול מספרי של לולאת טווח: עד "עד", "{" או סוף שורה */
  readRangeBound() {
    this.skipWhitespace();
    const start = this.i;
    const src = this.src;
    let k = this.i;
    while (k < src.length) {
      const ch = src[k];
      if (ch === '\n' || ch === ';' || ch === '{') break;
      if (src.startsWith('עד', k)
        && !/[\p{L}\p{N}]/u.test(src[k - 1] || ' ')
        && !/[\p{L}\p{N}]/u.test(src[k + 2] || ' ')) break;
      k++;
    }
    const raw = src.slice(start, k).trim();
    this.i = k;
    if (raw === '') this.fail('צריך מספר אחרי "מ-" או אחרי "עד-"');
    return this.parseCond(raw, start);
  }

  parseWhile() {
    const pos = this.i;
    const condSrc = this.readUntilBraceBlock();
    if (condSrc === '') this.fail('חסר תנאי אחרי "כל-עוד"');
    return { type: 'while', cond: this.parseCond(condSrc, pos), body: this.parseBlock(), pos };
  }

  parseParams() {
    this.skipWhitespace();
    if (this.src[this.i] !== '(') this.fail('צריך ( אחרי שם הפונקציה');
    this.i++;
    const params = [];
    for (;;) {
      this.skipWhitespace();
      if (this.src[this.i] === ')') { this.i++; break; }
      if (this.src[this.i] === ',') { this.i++; continue; }
      const name = this.readName();
      if (!name) this.fail('שם פרמטר לא תקין');
      let def = null;
      this.skipWhitespace();
      if (this.src[this.i] === '=') {
        this.i++;
        const end = this.findStopChars([',', ')'], { allowNewline: false });
        const s = this.src.slice(this.i, end).trim();
        this.i = end;
        if (s !== '') def = s;
      }
      params.push({ name, default: def });
      this.skipWhitespace();
      if (this.src[this.i] === ')') { this.i++; break; }
      if (this.src[this.i] === ',') { this.i++; continue; }
      this.fail('צריך , או ) אחרי פרמטר');
    }
    return params;
  }

  parseFunction(kind) {
    const pos = this.i;
    this.skipSpaces();
    const name = this.readName();
    if (!name) this.fail(`צריך שם אחרי "${kind === 'component' ? 'רכיב' : 'פונקציה'}"`);
    const params = this.parseParams();
    const body = this.parseBlock();
    return { type: kind, name, params, body, pos };
  }

  parseReturn() {
    const pos = this.i;
    const expr = this.readStmtExpr();
    this.consumeSemi();
    return { type: 'return', expr, pos };
  }

  parsePrint() {
    const pos = this.i;
    this.skipSpaces();
    const start = this.i;
    const end = this.findStopChars([';'], { allowNewline: true });
    let exprEnd = end;
    while (exprEnd > start && /[\s;]/.test(this.src[exprEnd - 1])) exprEnd--;
    const src = this.src.slice(start, exprEnd);
    this.i = end;
    this.consumeSemi();
    let ast;
    try {
      ast = parseExpression(src);
    } catch (err) {
      this.fail(`מה להדפיס? (${err.message})`, pos);
    }
    ast.pos = pos;
    return { type: 'print', expr: ast, pos };
  }

  parseImport() {
    const pos = this.i;
    this.skipSpaces();
    const q = this.src[this.i];
    if (q !== '"' && q !== "'") this.fail('אחרי "ייבא" צריך שם קובץ במרכאות');
    const end = this.skipStringFrom(this.i);
    const path = this.src.slice(this.i + 1, end - 1);
    this.i = end;
    this.consumeSemi();
    this.imports.push(path);
    return { type: 'import', path, pos };
  }

  // ── כללי עיצוב ─────────────────────────────────────────────────────────
  parseStyleRule() {
    const pos = this.i;
    this.skipWhitespace();
    const isMedia = this.src.startsWith('מסך', this.i);
    const head = this.readUntilBraceBlock();
    if (head === '') this.fail('חסר בורר (selector) אחרי סגנון');
    if (this.src[this.i] !== '{') this.fail('צריך { אחרי הבורר');
    this.i++;
    const body = this.parseDeclBody();
    return { type: 'styleRule', selector: head, media: isMedia, body, pos };
  }

  parseDeclBody() {
    const out = [];
    for (;;) {
      this.skipOptional();
      if (this.eof()) this.fail('הקובץ נגמר באמצע בלוק סגנון');
      if (this.src[this.i] === '}') { this.i++; break; }
      if (this.startsWith(';') || this.src[this.i] === ';') { this.i++; continue; }
      const start = this.i;
      // בלוק מקונן: מסך-בינוני { ... }  או  מסך (רוחב: 900px) { ... }
      const bracePos = this.findStopChars(['{', ':', ';', '\n', '}'], { allowNewline: true });
      const head = this.src.slice(start, bracePos).trim();
      this.i = bracePos;
      if (this.src[this.i] === '{') {
        this.i++;
        out.push({ type: 'styleRule', selector: head, media: head.startsWith('מסך'), body: this.parseDeclBody(), pos: start });
        continue;
      }
      if (this.src[this.i] === ':') {
        this.i++;
        const vStart = this.i;
        const vEnd = this.findStopChars([';', '\n', '}'], { allowNewline: true });
        const value = this.src.slice(vStart, vEnd).trim();
        this.i = vEnd;
        if (this.src[this.i] === ';') this.i++;
        if (head !== '' || value !== '') out.push({ type: 'decl', prop: head, value, pos: start });
        continue;
      }
      // משהו ללא ':' - מתעלם או מדווח
      if (this.src[this.i] === ';') { this.i++; continue; }
      if (this.src[this.i] === '}') continue;
      this.fail(`לא הבנתי את השורה "${head}" בתוך סגנון`, start);
    }
    return out;
  }

  // ── אלמנטים ────────────────────────────────────────────────────────────
  parseElement() {
    const pos = this.i;
    const lineStart = this.src.lastIndexOf('\n', Math.max(0, this.i - 1)) + 1;
    let ownLine = true;
    for (let k = lineStart; k < this.i; k++) {
      if (this.src[k] !== ' ' && this.src[k] !== '\t') { ownLine = false; break; }
    }
    this.i++; // <
    const name = this.readName();
    if (!name) this.fail('שם התג חסר');
    const attrs = [];
    let selfClosing = false;
    for (;;) {
      this.skipWhitespace();
      if (this.eof()) this.fail(`הקובץ נגמר לפני שסגרנו את <${name}`);
      if (this.startsWith('/>')) { selfClosing = true; this.i += 2; break; }
      if (this.src[this.i] === '>') { this.i++; break; }
      const attrStart = this.i;
      const attrName = this.readAttrName();
      if (!attrName) {
        this.fail(`לא הבנתי את המאפיין כאן: "${this.src.slice(this.i, this.i + 14)}"`, attrStart);
      }
      this.skipWhitespace();
      let value = null;
      if (this.src[this.i] === '=') {
        this.i++;
        this.skipWhitespace();
        const q = this.src[this.i];
        if (q === '"' || q === "'") {
          const end = this.skipStringFrom(this.i);
          const raw = decodeEntities(this.src.slice(this.i + 1, end - 1));
          this.i = end;
          value = this.makeTemplate(raw, attrStart);
        } else {
          const vStart = this.i;
          const vEnd = this.findStopChars(['>', ' ', '\t', '\n'], { skipBraces: true });
          const raw = this.src.slice(vStart, vEnd);
          this.i = vEnd;
          value = this.makeTemplate(raw, vStart);
        }
      } else {
        value = [{ type: 'lit', value: '' }];
        attrs.push({ name: attrName, value, flag: true, pos: attrStart });
        continue;
      }
      attrs.push({ name: attrName, value, pos: attrStart });
    }
    const def = lookupElement(name);
    const isVoid = Boolean(def && (def.void || VOID_TAGS.has(def.tag)));
    if (selfClosing || isVoid) {
      return { type: 'element', name, attrs, children: [], selfClosing: true, pos, ownLine };
    }

    // <קוד> ו-<קוד-בלוק>: תוכן מילולי, בלי ביטויים ובלי פקודות
    if (def && VERBATIM_TAGS.has(def.tag)) {
      const closeRe = new RegExp(`</\\s*${escapeRegExp(name)}\\s*>`, 'iu');
      const rest = this.src.slice(this.i);
      const m = closeRe.exec(rest);
      const raw = dedent(m ? rest.slice(0, m.index) : rest);
      this.i += m ? m.index + m[0].length : raw.length;
      return { type: 'element', name, attrs, children: [{ type: 'text', value: raw, verbatim: true, pos }], selfClosing: false, pos, ownLine };
    }

    const children = this.parseNodes(name);
    // parseNodes נעצר ב-</
    if (this.src.startsWith('</', this.i)) {
      this.i += 2;
      const closeName = this.readName();
      this.skipWhitespace();
      if (this.src[this.i] !== '>') this.fail(`סוגר לא תקין </${closeName}`, this.i);
      this.i++;
      if (normalizeKey(closeName) !== normalizeKey(name)) {
        const hint = suggest(closeName, ELEMENT_NAMES);
        this.fail(
          `סגרת </${closeName}> לא מתאימה ל-<${name}>`
          + (hint ? `. אולי התכוונת ל-</${hint}>?` : ''),
          pos,
        );
      }
    }
    return { type: 'element', name, attrs, children, selfClosing: false, pos, ownLine };
  }

  readAttrName() {
    const start = this.i;
    while (!this.eof() && /[^\s=>/]/.test(this.src[this.i])) this.i++;
    return this.src.slice(start, this.i);
  }

  /** הופך מחרוזת עם {ביטויים} למערך של חלקים */
  makeTemplate(raw, pos) {
    const parts = [];
    let i = 0;
    while (i < raw.length) {
      const open = raw.indexOf('{', i);
      if (open === -1) {
        parts.push({ type: 'lit', value: raw.slice(i) });
        break;
      }
      if (open > i) parts.push({ type: 'lit', value: raw.slice(i, open) });
      let depth = 1;
      let j = open + 1;
      while (j < raw.length && depth > 0) {
        const ch = raw[j];
        if (ch === '"' || ch === "'") {
          const next = skipStringIn(raw, j);
          if (next === -1) this.fail('מחרוזת לא נסגרה', pos + open);
          j = next;
          continue;
        }
        if (ch === '{') depth++;
        if (ch === '}') depth--;
        j++;
      }
      if (depth !== 0) this.fail('סוגריים {} לא מאוזנים', pos + open);
      const inner = raw.slice(open + 1, j - 1).trim();
      if (inner === '') this.fail('התא {} ריק', pos + open);
      let ast = null;
      try {
        ast = parseExpression(inner);
      } catch { /* יכול להיות תוכן ולא ביטוי - ננסה אחר כך */ }
      if (ast) {
        ast.pos = pos + open;
        parts.push({ type: 'expr', expr: ast });
      } else {
        const sub = new Parser(inner, this.file);
        sub.bodyMode = true;
        const body = sub.parseNodes(null);
        sub.skipOptional();
        if (!body.length || !sub.eof()) {
          this.fail(`לא הצלחתי להבין את מה שבתוך {} במאפיין: ${inner}`, pos + open);
        }
        parts.push({ type: 'body', body });
      }
      i = j;
    }
    if (parts.length === 0) parts.push({ type: 'lit', value: '' });
    return parts;
  }
}

export function parse(src, file) {
  return new Parser(src, file).parseProgram();
}

export { Parser };
