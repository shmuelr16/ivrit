// render.js - המרנדר של עִבְרִית: עץ תחביר -> HTML + CSS
// המסמך עצמו (<html>, <head>, <body>) נבנה כאן, כך שהמשתמש יכול פשוט לכתוב.

import fs from 'node:fs';
import path from 'node:path';
import {
  ATTR_NAMES, ELEMENT_NAMES, INLINE_TAGS, VOID_TAGS, designClass, lookupAttr,
  lookupElement, lookupMedia, lookupProp, lookupValue, normalizeKey, suggest,
} from './dict.js';
import { BASE_THEME, designUtilities } from './design.js';
import {
  IvritError, Scope, evaluate, parseExpression, toNumber, toText, truthy,
} from './expr.js';

const SHELL_TAGS = new Set(['html', 'head', 'body']);
// תגים שתמיד עוברים ל-<head>
const HEAD_ONLY_TAGS = new Set(['meta', 'link', 'base', 'style']);
// תגים חסרי תוכן - אין טעם להוסיף להם מחלקה
const NO_CLASS_TAGS = new Set(['meta', 'link', 'base', 'br', 'col', 'param', 'source', 'track', 'area', 'wbr', 'embed', 'html', 'head', 'body', 'title']);

/** תגים שבהם "מקור" מציין כתובת יעד ולא קובץ משאב */
const HREF_TAGS = new Set(['a', 'link', 'area', 'base', 'form']);

class ReturnSignal { constructor(value) { this.value = value; } }
class BreakSignal {}
class ContinueSignal {}

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// \u05E2\u05D5\u05D8\u05E3 \u05DB\u05DC \u05E8\u05E6\u05E3 \u05E9\u05DC \u05D0\u05D5\u05EA\u05D9\u05D5\u05EA \u05E2\u05D1\u05E8\u05D9\u05D5\u05EA \u05D1-<bdi>. \u05D1\u05D1\u05DC\u05D5\u05E7 \u05E7\u05D5\u05D3 (direction: ltr) \u05D6\u05D4 \u05DE\u05E9\u05D0\u05D9\u05E8
// \u05D0\u05EA \u05E1\u05D9\u05DE\u05E0\u05D9 \u05D4\u05E4\u05D9\u05E1\u05D5\u05E7 - { } < > ( ) , . ; - \u05D1\u05DE\u05E7\u05D5\u05DD \u05E9\u05D1\u05D5 \u05E0\u05DB\u05EA\u05D1\u05D5, \u05D5\u05D1\u05D5-\u05D6\u05DE\u05E0\u05D9\u05EA \u05DB\u05DC \u05DE\u05D9\u05DC\u05D4
// \u05E2\u05D1\u05E8\u05D9\u05EA \u05E2\u05D3\u05D9\u05D9\u05DF \u05E0\u05E7\u05E8\u05D0\u05EA \u05E0\u05DB\u05D5\u05DF \u05DE\u05D9\u05DE\u05D9\u05DF \u05DC\u05E9\u05DE\u05D0\u05DC. \u05D1\u05DC\u05D9 \u05D6\u05D4, \u05E7\u05D5\u05D3 \u05DE\u05E2\u05D5\u05E8\u05D1 "\u05DE\u05EA\u05D4\u05E4\u05DA": \u05DC\u05DE\u05E9\u05DC
// "\u05E4\u05D5\u05E0\u05E7\u05E6\u05D9\u05D4 \u05D1\u05E8\u05D5\u05DB\u05D9\u05DD(\u05E9\u05DD) { ... }" \u05DE\u05D5\u05E6\u05D2 \u05DB-"{ ... } \u05E4\u05D5\u05E0\u05E7\u05E6\u05D9\u05D4 \u05D1\u05E8\u05D5\u05DB\u05D9\u05DD(\u05E9\u05DD)".
const HEBREW_RUN = /[\u0590-\u05FF]+/gu;
export function isolateBidi(text) {
  return String(text).replace(HEBREW_RUN, (run) => `<bdi>${run}</bdi>`);
}

const isHebrew = (s) => /[\u0590-\u05FF]/.test(s);
const EN_SELECTOR_KEYWORDS = new Set(['and', 'or', 'not', 'only', 'root', 'has', 'is', 'where', 'first-child', 'last-child', 'hover', 'focus', 'active', 'before', 'after', 'placeholder', 'checked', 'disabled']);

/** מסיר מרכאות מסביב לערך טקסטואלי שהגיע מתוך תוכן בסוגריים */
function unquote(text) {
  const t = text.trim();
  if (t.length > 1) {
    if ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'")) {
      return t.slice(1, -1);
    }
  }
  return text;
}
const pad = (n) => '  '.repeat(Math.max(0, n));

// ── הקשר ───────────────────────────────────────────────────────────────────
export class RenderContext {
  constructor(options = {}) {
    this.options = options;
    this.cssRules = [];
    this.rawTokens = new Map();
    this.variables = new Map();
    this.components = new Map();
    this.functions = new Map();
    this.usedDesignClasses = new Set();
    this.output = [];
    this.errors = [];
    this.warnings = [];
    this.headChunks = [];
    this.hasTitle = false;
    this.bodyAttrs = [];
    this.depth = 0;
    this.tolerant = Boolean(options.collectErrors);
    this.lang = options.lang || 'he';
    this.dir = options.dir || 'rtl';
    this.title = '';
  }
  err(node, message) {
    const err = new IvritError(message, node?.pos);
    if (this.tolerant) { this.errors.push(err); return true; }
    throw err;
  }
  warn(message, pos) {
    this.warnings.push(new IvritError(message, pos));
  }
}

// ── תרגום CSS ─────────────────────────────────────────────────────────────
export function translateSelector(selector, parentSelectors, ampParent) {
  let sel = String(selector).trim();
  if (!sel) return '';
  // "&" מתייחס לבוחר שמכיל את הכלל
  const hasAmp = sel.includes('&');
  if (hasAmp) {
    const target = ampParent || (parentSelectors && parentSelectors.length ? parentSelectors.join(', ') : '');
    sel = sel.replace(/&/g, target);
  }
  // בעברית = מחלקה (כל תג עברי מקבל מחלקה בשמו), באנגלית = תג
  const translated = sel.replace(/[\p{L}][\p{L}\p{N}_-]*/gu, (word, offset, full) => {
    const prev = full[offset - 1];
    if (prev === '.' || prev === '#') return word;
    if (EN_SELECTOR_KEYWORDS.has(word)) return word;
    if (isHebrew(word)) return `.${word}`;
    const el = lookupElement(word);
    return el && el.tag ? el.tag : word;
  });
  if (hasAmp) return translated;
  if (!parentSelectors || !parentSelectors.length) return translated;
  return parentSelectors.map((p) => `${p} ${translated}`).join(', ');
}

export function translateValue(value, ctx) {
  const raw = String(value).trim();
  if (raw === '') return '';
  if (ctx.variables.has(raw) || ctx.rawTokens.has(raw)) return `var(--${raw})`;
  const parts = raw.split(/(\s+)/);
  return parts.map((tok) => {
    if (tok === '' || /^\s+$/.test(tok)) return tok;
    if (/^["'"].*["']$/.test(tok)) return tok;
    if (tok.startsWith('#') || tok.startsWith('--') || tok.startsWith('$')) return tok;
    if (/^[\d.]/.test(tok)) return tok;
    if (/[\w-]\(/.test(tok) || /^[,()]+$/.test(tok)) return tok;
    if (/^[a-z-]+$/i.test(tok)) return tok;
    if (isHebrew(tok)) {
      if (ctx.variables.has(tok) || ctx.rawTokens.has(tok)) return `var(--${tok})`;
      return lookupValue(tok);
    }
    return tok;
  }).join('').replace(/,\s+/g, ', ');
}

function splitDecls(text) {
  const out = [];
  let depth = 0, current = '', quote = null;
  for (const ch of String(text)) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if ((ch === ';' || ch === '\n') && depth === 0) {
      if (current.trim()) out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function translateDecl(prop, value, ctx) {
  let name = lookupProp(prop);
  if (!name) {
    ctx.warn(`לא מכיר את מאפיין ה-CSS "${prop}" - מעביר אותו כמו שהוא`);
    name = prop;
  }
  return { name, value: translateValue(value, ctx) };
}

function translateDeclText(text, ctx) {
  const lines = [];
  for (const d of splitDecls(text)) {
    const idx = d.indexOf(':');
    if (idx === -1) continue;
    const { name, value } = translateDecl(d.slice(0, idx).trim(), d.slice(idx + 1), ctx);
    if (name && value) lines.push(`${name}: ${value}`);
  }
  return lines;
}

// ── רינדור ────────────────────────────────────────────────────────────────
class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  render(program) {
    const root = new Scope(null, 'root');
    const chunks = this.renderNodes(program.body, root, {
      depth: 1, inHead: false, inShell: true, wrapText: true,
    });
    return { chunks, css: this.collectCss() };
  }

  collectCss() {
    const { ctx } = this;
    const parts = [];
    if (ctx.rawTokens.size) {
      const vars = [...ctx.rawTokens.entries()].map(([k, v]) => `  --${k}: ${v};`);
      parts.push(`:root {\n${vars.join('\n')}\n}`);
    }
    if (ctx.options.design !== false) {
      parts.push(BASE_THEME.trim());
      parts.push(designUtilities());
    }
    if (ctx.cssRules.length) parts.push(ctx.cssRules.join('\n'));
    return parts.join('\n\n');
  }

  renderNodes(nodes, scope, opts) {
    const chunks = [];
    for (const node of nodes) {
      const produced = this.renderNode(node, scope, opts);
      if (!produced) continue;
      const list = Array.isArray(produced) ? produced : [produced];
      if (node.preSpace) {
        const first = list.find((c) => c.text);
        if (first && !first.block && !/^\s/.test(first.text)) first.text = ` ${first.text}`;
      }
      chunks.push(...list);
    }
    return chunks;
  }

  renderNode(node, scope, opts) {
    const { ctx } = this;
    try {
      switch (node.type) {
        case 'text': return this.renderText(node, opts);
        case 'interp': return this.renderInterp(node, scope, opts);
        case 'element': return this.renderElement(node, scope, opts);
        case 'styleRule': this.renderStyleRule(node, null); return [];
        case 'var': return this.runVar(node, scope);
        case 'function': this.declareFunction(node, scope); return [];
        case 'component': this.declareComponent(node, scope); return [];
        case 'if': return this.runIf(node, scope, opts);
        case 'forOf':
        case 'forRange': return this.runFor(node, scope, opts);
        case 'while': return this.runWhile(node, scope, opts);
        case 'return': throw new ReturnSignal(node.expr ? evaluate(node.expr, scope) : null);
        case 'exprStmt': {
          // ביטוי "בגוף" מציג את ערכו (כמו התא {}), הקצאה לא מציגה כלום
          if (node.expr.type === 'assign') { evaluate(node.expr, scope); return []; }
          const value = evaluate(node.expr, scope);
          if (value === null || value === undefined || value === '') return [];
          return [{ text: escapeHtml(toText(value)), block: false }];
        }
        case 'print':
          ctx.output.push(toText(evaluate(node.expr, scope)));
          return [];
        case 'import': return [];
        case 'break': throw new BreakSignal();
        case 'continue': throw new ContinueSignal();
        default:
          ctx.err(node, `סוג צומת לא ידוע: ${node.type}`);
          return [];
      }
    } catch (err) {
      if (err instanceof ReturnSignal || err instanceof BreakSignal || err instanceof ContinueSignal) throw err;
      if (err instanceof IvritError && ctx.tolerant) {
        ctx.errors.push(err);
        return [];
      }
      if (err instanceof IvritError) {
        ctx.errors.push(err);
        return [];
      }
      throw err;
    }
  }

  renderText(node, opts) {
    // תוכן מילולי (בלוק קוד) נשמר כמות שהוא, כולל ישויות HTML. עוטפים רצפי
    // עברית ב-<bdi> כדי שהפיסוק לא "יתהפך" ב-RTL (ראה isolateBidi).
    if (node.verbatim) return [{ text: isolateBidi(node.value), block: node.value.includes('\n') }];
    const text = node.value.replace(/\s+/g, ' ');
    if (text.trim() === '') {
      return (text.includes(' ') && !opts.inShell) ? [{ text: ' ', block: false }] : [];
    }
    const escaped = escapeHtml(text);
    if (opts.wrapText) return [{ text: `<p class="טקסט פסקה ivrit-p">${escaped}</p>`, block: true }];
    return [{ text: escaped, block: false }];
  }

  renderInterp(node, scope, opts) {
    if (node.body) {
      const chunks = this.renderNodes(node.body, scope, { ...opts, wrapText: false });
      return [{ text: unquote(chunks.map((c) => c.text).join('')), block: false }];
    }
    const value = evaluate(node.expr, scope);
    if (value && typeof value === 'object' && Array.isArray(value.__ivritNodes)) {
      return this.renderNodes(value.__ivritNodes, scope, { ...opts, wrapText: false });
    }
    return [{ text: escapeHtml(toText(value)), block: false }];
  }

  runVar(node, scope) {
    if (node.raw !== undefined) {
      const value = String(node.raw).trim();
      this.ctx.rawTokens.set(node.name, value);
      this.ctx.variables.set(node.name, value);
      // משתנה גלם זמין גם כערך רגיל: {צבע-ראשי} -> "#5b3df5"
      scope.set(node.name, value);
      return [];
    }
    scope.set(node.name, evaluate(node.expr, scope));
    return [];
  }

  declareFunction(node, scope) {
    const fn = (...args) => {
      const inner = scope.child('function');
      node.params.forEach((p, i) => {
        if (args[i] !== undefined) inner.define(p.name, args[i]);
        else inner.define(p.name, p.default ? this.evalSource(p.default, inner) : null);
      });
      inner.define('ילדים', { __ivritNodes: [], __ivritText: '' });
      try {
        this.renderNodes(node.body, inner, { depth: 0, inHead: false, inShell: false, wrapText: true });
        return null;
      } catch (err) {
        if (err instanceof ReturnSignal) return err.value;
        throw err;
      }
    };
    fn.__ivritParams = node.params.map((p) => p.name);
    this.ctx.functions.set(node.name, fn);
    scope.define(node.name, fn);
    return fn;
  }

  declareComponent(node, scope) {
    if (lookupElement(node.name)) {
      this.ctx.warn(
        `הרכיב "${node.name}" מסתיר תג מוכנה של עִבְרִית - בתוך הרכיב עצמו השם יפנה לרכיב, לא לתג. תמחיק לשנות שם (למשל "${node.name}-שלי")`,
        node.pos,
      );
    }
    const comp = { name: node.name, params: node.params, body: node.body, scope };
    comp.render = (attrs, children, depth) => {
      const inner = scope.child('component');
      const map = new Map();
      for (const [k, v] of attrs) map.set(normalizeKey(k), v);
      for (const p of node.params) {
        const key = normalizeKey(p.name);
        if (map.has(key)) inner.define(p.name, map.get(key));
        else inner.define(p.name, p.default ? this.evalSource(p.default, inner) : null);
      }
      const props = {};
      for (const [k, v] of map) props[k] = v;
      inner.define('מאפיינים', props);
      inner.define('ילדים', { __ivritNodes: children || [], __ivritText: '' });
      return this.renderNodes(node.body, inner, { depth, inHead: false, inShell: false, wrapText: false });
    };
    this.ctx.components.set(normalizeKey(node.name), comp);
    return comp;
  }

  evalSource(src, scope) {
    try {
      return evaluate(parseExpression(src), scope);
    } catch {
      return src;
    }
  }

  runIf(node, scope, opts) {
    for (const branch of node.branches) {
      if (truthy(evaluate(branch.cond, scope))) {
        return this.renderNodes(branch.body, scope.child('if'), opts);
      }
    }
    if (node.else) return this.renderNodes(node.else, scope.child('if'), opts);
    return [];
  }

  runFor(node, scope, opts) {
    const items = [];
    if (node.type === 'forOf') {
      const list = evaluate(node.expr, scope);
      if (Array.isArray(list)) items.push(...list);
      else if (list && typeof list === 'object') {
        items.push(...Object.entries(list).map(([k, v]) => ({ מפתח: k, ערך: v })));
      } else if (list !== null && list !== undefined && list !== '') items.push(list);
      else this.ctx.err(node, 'מה שאחרי "ב" אינו רשימה - איך אפשר לעבור עליו?');
    } else {
      const from = Math.trunc(toNumber(evaluate(node.from, scope)));
      const to = Math.trunc(toNumber(evaluate(node.to, scope)));
      const step = from <= to ? 1 : -1;
      for (let i = from; step > 0 ? i <= to : i >= to; i += step) items.push(i);
    }
    const chunks = [];
    items.forEach((item, index) => {
      const inner = scope.child('loop');
      inner.define(node.name, item);
      inner.define('אינדקס', index);
      try {
        chunks.push(...this.renderNodes(node.body, inner, opts));
      } catch (err) {
        if (err instanceof BreakSignal) return;
        if (err instanceof ContinueSignal) return;
        throw err;
      }
    });
    return chunks;
  }

  runWhile(node, scope, opts) {
    const chunks = [];
    let guard = 0;
    for (;;) {
      if (++guard > 100000) {
        this.ctx.err(node, 'הלולאה "כל-עוד" לא נעצרה');
        break;
      }
      if (!truthy(evaluate(node.cond, scope))) break;
      try {
        chunks.push(...this.renderNodes(node.body, scope.child('loop'), opts));
      } catch (err) {
        if (err instanceof BreakSignal) break;
        if (err instanceof ContinueSignal) continue;
        throw err;
      }
    }
    return chunks;
  }

  // ── אלמנטים ────────────────────────────────────────────────────────────
  /**
   * מקבל מאפייני <link> ומחזיר בלוק <style> אם זה קובץ CSS מקומי שנמצא בדיסק.
   * כך אפשר לשמור על קובץ style.css נפרד לצד קובץ ה-.iv ועדיין לקבל דף עמוד אחד.
   */
  localStylesheetTag(rawAttrs) {
    const map = new Map(rawAttrs.map(([k, v]) => [lookupAttr(k) || k, v]));
    const rel = toText(map.get('rel') || '');
    // "מקור" מתורגם ל-src, אבל בתג link הוא בעצם href
    const href = toText(map.get('href') || map.get('src') || '');
    if (!/stylesheet/u.test(rel)) return null;
    if (!href || href.startsWith('data:') || /^(?:https?:)?\/\//u.test(href)) return null;
    const dir = path.dirname(path.resolve(this.ctx.options.file || '.'));
    // נתיב שמתחיל ב-/ נחשב יחסי לתיקיית הפרויקט
    const cssFile = path.resolve(dir, href.replace(/^\/+/, ''));
    if (!fs.existsSync(cssFile)) return null;
    const content = fs.readFileSync(cssFile, 'utf8').trim();
    if (!content) return null;
    const body = content.split('\n').map((l) => (l.trim() ? `${pad(1)}  ${l}` : '')).join('\n');
    return `<style>\n${body}\n${pad(1)}</style>`;
  }

  renderElement(node, scope, opts) {
    const { ctx } = this;
    const name = node.name;
    const normName = normalizeKey(name);
    const isComponent = ctx.components.has(normName);
    const el = isComponent ? null : lookupElement(name);

    if (!isComponent && !el) {
      const hint = suggest(name, ELEMENT_NAMES);
      ctx.err(node, `לא מכיר את התג <${name}>`
        + (hint ? `. אולי התכוונת ל-<${hint}>?` : '')
        + '. אפשר גם להשתמש בכל תג HTML רגיל.');
      return [];
    }

    const rawAttrs = [];
    for (const attr of node.attrs) {
      rawAttrs.push([attr.name, this.evalAttrValue(attr, scope)]);
    }
    const attrs = new Map(rawAttrs.map(([k, v]) => [normalizeKey(k), v]));

    // ── רכיב שהוגדר בשפה ──
    if (isComponent) {
      if (ctx.depth > 64) {
        ctx.err(node, `הרכיב "${name}" קורא לעצמו יותר מ-64 פעמים - probably infinite loop`);
        return [];
      }
      ctx.depth++;
      try {
        return ctx.components.get(normName).render(rawAttrs, node.children, opts.depth);
      } finally {
        ctx.depth--;
      }
    }

    // ── תוכן גולמי ──
    if (el.raw) {
      const html = node.children.map((c) => (c.type === 'text' ? c.value : '')).join('');
      return [{ text: html, block: !INLINE_TAGS.has('div') }];
    }

    // ── מעטפת המסמך: <מסמך> <ראש> <גוף> ──
    if (el.tag === 'html') {
      if (attrs.has('שם')) ctx.title = toText(attrs.get('שם'));
      if (attrs.has('כותרת') && !ctx.title) ctx.title = toText(attrs.get('כותרת'));
      if (attrs.has('שפה') || attrs.has('סמכות')) ctx.lang = toText(attrs.get('שפה') || attrs.get('סמכות'));
      if (attrs.has('כיוון')) ctx.dir = toText(attrs.get('כיוון'));
      return this.renderNodes(node.children, scope, { ...opts, inShell: true, wrapText: true });
    }
    if (el.tag === 'head') {
      ctx.headChunks.push(...this.renderNodes(node.children, scope, {
        depth: 1, inHead: true, inShell: false, wrapText: false,
      }));
      return [];
    }
    if (el.tag === 'body') {
      ctx.bodyAttrs.push(this.buildAttributes(node, el, rawAttrs));
      return this.renderNodes(node.children, scope, { ...opts, inShell: true, wrapText: true });
    }

    // ── אלמנט רגיל ──
    const tag = el.tag;
    const inHead = opts.inHead;

    // <נתיב ייחוג="stylesheet" מקור="style.css"> - CSS מקומי נטמע בתוך הדף
    if (tag === 'link') {
      const localStyle = this.localStylesheetTag(rawAttrs);
      if (localStyle) {
        ctx.headChunks.push({ text: localStyle, block: true });
        return [];
      }
    }

    if (HEAD_ONLY_TAGS.has(tag) && !inHead) {
      this.renderNodes(node.children, scope, { ...opts, inHead: true, wrapText: false });
      const parts = this.buildAttributes(node, el, rawAttrs);
      const html = tag === 'style'
        ? `<style>${this.renderNodes(node.children, scope, { ...opts, inHead: true, wrapText: false }).map((c) => c.text).join('')}</style>`
        : `<${tag}${parts}>`;
      ctx.headChunks.push({ text: html, block: true });
      return [];
    }

    const isTitle = inHead && tag === 'h1';
    const realTag = isTitle ? 'title' : tag;
    if (isTitle) {
      const inner = this.renderNodes(node.children, scope, { ...opts, wrapText: false });
      const text = this.join(inner, opts.depth + 1).trim();
      ctx.title = ctx.title || text;
      ctx.hasTitle = true;
      return [{ text: `<title>${escapeHtml(text)}</title>`, block: true }];
    }

    const attrParts = this.buildAttributes(node, el, rawAttrs);
    const block = !this.isInline(tag) || node.ownLine === true;
    if (VOID_TAGS.has(tag) || el.void) {
      return [{ text: `<${tag}${attrParts}>`, block }];
    }

    const childOpts = { depth: opts.depth + 1, inHead, inShell: false, wrapText: false };
    const childChunks = this.renderNodes(node.children, scope, childOpts);
    const inner = this.join(childChunks, opts.depth + 1);
    if (inner.trim() === '') {
      return [{ text: `<${tag}${attrParts}></${tag}>`, block }];
    }
    const allInline = childChunks.every((c) => !c.block);
    if (allInline) return [{ text: `<${tag}${attrParts}>${inner.trim()}</${tag}>`, block }];
    return [{ text: `<${tag}${attrParts}>\n${inner}${pad(opts.depth)}</${tag}>`, block }];
  }

  isInline(tag) {
    return INLINE_TAGS.has(tag);
  }

  evalAttrValue(attr, scope) {
    if (attr.flag) return true;
    const parts = attr.value;
    const valueOf = (p) => {
      if (p.type === 'lit') return p.value;
      if (p.type === 'body') {
        const chunks = this.renderNodes(p.body, scope, { depth: 0, inHead: false, inShell: false, wrapText: false });
        return unquote(chunks.map((c) => c.text).join('')).replace(/<[^>]*>/g, '').trim();
      }
      return evaluate(p.expr, scope);
    };
    if (parts.length === 1) return valueOf(parts[0]);
    return parts.map(valueOf).map((v) => toText(v)).join('');
  }

  buildAttributes(node, el, rawAttrs) {
    const { ctx } = this;
    const out = [];
    const classes = [];

    for (const [rawName, value] of rawAttrs) {
      const norm = normalizeKey(rawName);
      if (['סגנון', 'סגנונות', 'עיצוב', 'סגנונות-פנימיים', 'סגנון-פנימי'].includes(norm)) {
        const css = translateDeclText(toText(value), ctx);
        if (css.length) out.push(` style="${escapeAttr(css.join('; '))}"`);
        continue;
      }
      if (norm === 'מחלקה') {
        for (const token of toText(value).split(/\s+/).filter(Boolean)) {
          classes.push(token);
          if (designClass(token)) ctx.usedDesignClasses.add(token);
        }
        continue;
      }
      let attrName = lookupAttr(rawName);
      if (attrName === 'action' && el.tag === 'button' && normalizeKey(rawName) === 'שליחה-ל') {
        attrName = 'formaction';
      }
      // בתגים שמפנים לכתובת, "מקור" מתורגם ל-href ולא ל-src
      if (attrName === 'src' && HREF_TAGS.has(el.tag)) attrName = 'href';
      if (!attrName) {
        const hint = suggest(rawName, ATTR_NAMES);
        ctx.warn(`לא מכיר את המאפיין "${rawName}"`
          + (hint ? `. אולי התכוונת ל-"${hint}"?` : '') + ' - מעביר אותו כמו שהוא', node.pos);
        attrName = rawName;
      }
      if (attrName === 'class') {
        for (const token of toText(value).split(/\s+/).filter(Boolean)) classes.push(token);
        continue;
      }
      if (value === false || value === null || value === undefined || value === '') continue;
      if (value === true) { out.push(` ${attrName}`); continue; }
      out.push(` ${attrName}="${escapeAttr(toText(value))}"`);
    }
    const own = isHebrew(node.name) && !NO_CLASS_TAGS.has(el.tag) ? node.name : null;
    if (classes.length || el.cls || own) {
      const all = [...new Set([own, ...(el.cls ? el.cls.split(' ') : []), ...classes].filter(Boolean))];
      out.push(` class="${escapeAttr(all.join(' '))}"`);
    }
    if (el.role && !rawAttrs.some(([n]) => lookupAttr(n) === 'role')) {
      out.push(` role="${el.role}"`);
    }
    return out.join('');
  }

  // ── סגנון ───────────────────────────────────────────────────────────────
  renderStyleRule(node, parentSelectors) {
    const { ctx } = this;
    if (node.media) {
      const rules = [];
      for (const child of node.body) {
        if (child.type === 'styleRule') {
          const css = this.renderRuleBody(child, null);
          if (css.trim()) rules.push(css);
        }
      }
      if (rules.length) ctx.cssRules.push(`@media ${this.buildMediaQuery(node.selector)} {\n${rules.join('\n')}\n}`);
      return;
    }
    const css = this.renderRuleBody(node, parentSelectors);
    if (css.trim()) ctx.cssRules.push(css);
  }

  renderRuleBody(node, parentSelectors, ampParent) {
    const { ctx } = this;
    const selector = translateSelector(node.selector, parentSelectors, ampParent);
    const declLines = [];
    const nested = [];
    for (const child of node.body) {
      if (child.type === 'decl') {
        const { name, value } = translateDecl(child.prop, child.value, ctx);
        if (name && value) declLines.push(`  ${name}: ${value};`);
      } else if (child.type === 'styleRule') {
        // כלל עם "&" מצביע על ההורה בעצמו
        const amp = child.selector.includes('&') ? selector : null;
        const parent = amp ? null : (selector ? [selector] : parentSelectors);
        const sub = this.renderRuleBody(child, parent, amp);
        if (sub.trim()) nested.push(sub);
      }
    }
    const parts = [];
    if (selector && declLines.length) parts.push(`${selector} {\n${declLines.join('\n')}\n}`);
    parts.push(...nested);
    return parts.join('\n');
  }

  /** מתרגם תנאי מסך בעברית לתכונת מדיה ב-CSS */
  mediaFeature(text) {
    const { ctx } = this;
    const t = text.trim();
    const idx = t.indexOf(':');
    if (idx < 0) return null;
    const rawName = t.slice(0, idx).trim();
    const val = t.slice(idx + 1).trim();
    const DIRECT = {
      'העדפת-צבע': 'prefers-color-scheme',
      'העדפת-תנועה': 'prefers-reduced-motion',
      'העדפת-ניגודיות': 'prefers-contrast',
      'ריחוף': 'hover',
      'מצביע': 'pointer',
      'דפוס': 'print',
      'סוג-תצוגה': 'display-mode',
      'טווח-צבע': 'color-gamut',
    };
    const direct = DIRECT[normalizeKey(rawName)];
    if (direct) return `(${direct}: ${translateValue(val, ctx)})`;

    const prop = lookupProp(rawName) || rawName;
    const upTo = /^עד[-\s]*/u.exec(val);
    const from = /^(?:מ[-־]?\s*|מעלה\s+)/u.exec(val);
    const upTo2 = /\s+עד\s+/u.exec(val);
    if (upTo2) {
      const a = translateValue(val.slice(0, upTo2.index).trim(), ctx);
      const b = translateValue(val.slice(upTo2.index + upTo2[0].length).trim(), ctx);
      return `(${`min-${prop}`}: ${a}) and (${`max-${prop}`}: ${b})`;
    }
    if (upTo) return `(max-${prop}: ${translateValue(val.slice(upTo[0].length).trim(), ctx)})`;
    return `(min-${prop}: ${translateValue((from ? val.slice(from[0].length) : val).trim(), ctx)})`;
  }

  buildMediaQuery(head) {
    const raw = String(head).trim();
    const known = lookupMedia(raw) || lookupMedia(raw.replace(/^מסך[-\s]*/u, '').trim());
    if (known) return known;
    const groups = [...raw.matchAll(/\(([^)]*)\)/gu)].map((m) => m[1]);
    if (groups.length) {
      const parts = groups
        .flatMap((g) => g.split(/,|\s+ו(?![֐-׿\p{L}\p{N}])/u))
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => this.mediaFeature(p));
      if (parts.length && parts.every(Boolean)) return parts.join(' and ');
    }
    const inner = raw
      .replace(/^מסך[-\s]*/u, '')
      .replace(/^\(\s*/, '')
      .replace(/\s*\)$/, '')
      .trim();
    const knownInner = lookupMedia(inner);
    if (knownInner) return knownInner;
    const single = this.mediaFeature(inner);
    if (single) return single;
    return raw;
  }

  join(chunks, depth) {
    const ind = pad(depth);
    let out = '';
    for (const c of chunks) {
      if (!c.text) continue;
      if (c.block) {
        if (out !== '' && !out.endsWith('\n')) out += '\n';
        out += ind + c.text + '\n';
      } else {
        out += c.text;
      }
    }
    return out;
  }
}

// ── נקודת הכניסה ──────────────────────────────────────────────────────────
export function render(program, options = {}) {
  const ctx = new RenderContext(options);
  const renderer = new Renderer(ctx);
  const { chunks, css } = renderer.render(program);

  const headChunks = [
    { text: '<meta charset="utf-8">', block: true },
    { text: '<meta name="viewport" content="width=device-width, initial-scale=1">', block: true },
    ...ctx.headChunks,
    ...(!ctx.hasTitle ? [{ text: `<title>${escapeHtml(ctx.title || 'מסמך')}</title>`, block: true }] : []),
    { text: `<style>\n${css.split('\n').map((l) => (l ? `${pad(2)}${l}` : '')).join('\n')}\n${pad(1)}</style>`, block: true },
  ];

  const head = renderer.join(headChunks, 1);
  const body = renderer.join(chunks, 1);
  const html = `<!DOCTYPE html>\n<html lang="${escapeAttr(ctx.lang)}" dir="${escapeAttr(ctx.dir)}">\n`
    + `<head>\n${head}</head>\n`
    + `<body${ctx.bodyAttrs.join('')}>\n${body}</body>\n</html>\n`;

  return {
    html,
    bodyHtml: body,
    headHtml: head,
    css,
    output: ctx.output,
    errors: ctx.errors,
    warnings: ctx.warnings,
    title: ctx.title,
    lang: ctx.lang,
    dir: ctx.dir,
  };
}
