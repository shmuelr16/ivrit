// expr.js - מנוע הביטויים של עִבְרִית: אופרטורים, משתנים, קריאות, רשימות.

import { lookupBuiltin, normalizeKey } from './dict.js';

export class IvritError extends Error {
  constructor(message, pos) {
    super(message);
    this.name = 'IvritError';
    this.pos = pos;
  }
}

export class Scope {
  constructor(parent = null, kind = 'block') {
    this.vars = new Map();
    this.parent = parent;
    this.kind = kind;
  }
  define(name, value) {
    this.vars.set(name, value);
    return value;
  }
  has(name) {
    let s = this;
    while (s) {
      if (s.vars.has(name)) return true;
      s = s.parent;
    }
    return false;
  }
  get(name) {
    let s = this;
    while (s) {
      if (s.vars.has(name)) return s.vars.get(name);
      s = s.parent;
    }
    return undefined;
  }
  set(name, value) {
    let s = this;
    while (s) {
      if (s.vars.has(name)) {
        s.vars.set(name, value);
        return value;
      }
      s = s.parent;
    }
    this.vars.set(name, value);
    return value;
  }
  child(kind) {
    return new Scope(this, kind);
  }
}

// ── טוקנים ────────────────────────────────────────────────────────────────
const WORD_RE = /[\p{L}_][\p{L}\p{N}_]*(?:-[\p{L}\p{N}_]+)*/uy;
const NUM_RE = /\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|fr|ch|pt|ex)?/y;

const HEBREW_OPS = [
  ['או', '||'],
  ['וגם', '&&'],
  ['מכיל', 'in'],
  ['לא', '!'],
  ['חיבור', '+'],
  ['חיסור', '-'],
  ['כפל', '*'],
  ['חלוקה', '/'],
  ['שארית', '%'],
  ['מינוס', 'neg'],
  ['חזקה', '**'],
  ['הוא', '='],
  ['שווה', '=='],
  ['לא-שווה', '!='],
  ['גדול-מ', '>'],
  ['קטן-מ', '<'],
  ['גדול-או-שווה', '>='],
  ['קטן-או-שווה', '<='],
];

const SPACED_OPS = HEBREW_OPS
  .filter(([heb]) => heb.includes(' '))
  .map(([heb, op]) => [op, new RegExp(`^${heb.split(' ').join('\\s+')}(?![\\p{L}\\p{N}_])`, 'u')]);

export function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1, value = '';
      while (j < src.length && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < src.length) {
          const next = src[j + 1];
          value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          j += 2;
        } else {
          value += src[j];
          j++;
        }
      }
      if (j >= src.length) throw new IvritError('מחרוזת לא נסגרה', i);
      tokens.push({ type: 'string', value, start: i, end: j + 1 });
      i = j + 1;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      NUM_RE.lastIndex = i;
      const m = NUM_RE.exec(src);
      if (m) {
        tokens.push({ type: 'number', value: parseFloat(m[0]), raw: m[0], start: i, end: NUM_RE.lastIndex });
        i = NUM_RE.lastIndex;
        continue;
      }
    }

    // מילה בעברית או באנגלית
    if (/[\p{L}_]/u.test(ch)) {
      WORD_RE.lastIndex = i;
      const m = WORD_RE.exec(src);
      const word = m ? m[0] : ch;
      const end = m ? WORD_RE.lastIndex : i + 1;
      const norm = normalizeKey(word);
      let matched = null;
      for (const [heb, op] of HEBREW_OPS) {
        if (norm === normalizeKey(heb)) { matched = op; break; }
      }
      if (!matched) {
        for (const [op, re] of SPACED_OPS) {
          re.lastIndex = i;
          const mm = re.exec(src);
          if (mm) { matched = op; break; }
        }
      }
      if (matched) {
        tokens.push({ type: 'op', value: matched, start: i, end });
        i = end;
        continue;
      }
      tokens.push({ type: 'name', value: word, start: i, end });
      i = end;
      continue;
    }

    if (src.startsWith('**', i)) {
      tokens.push({ type: 'op', value: '**', start: i, end: i + 2 });
      i += 2;
      continue;
    }

    const three = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '=>'].includes(three)) {
      tokens.push({ type: 'op', value: three, start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if ('+-*/%<>=!.,()[]{}?:'.includes(ch)) {
      tokens.push({ type: 'op', value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }
    throw new IvritError(`תו לא מוכר: "${ch}"`, i);
  }
  tokens.push({ type: 'eof', value: null, start: src.length, end: src.length });
  return tokens;
}

// ── ניתוח ביטוי ───────────────────────────────────────────────────────────
class ExprParser {
  constructor(tokens) { this.t = tokens; this.i = 0; }
  peek() { return this.t[this.i]; }
  next() { return this.t[this.i++]; }
  isOp(value) { const tk = this.peek(); return tk.type === 'op' && tk.value === value; }
  eat(value) { if (this.isOp(value)) { this.i++; return true; } return false; }
  expect(value) {
    if (!this.eat(value)) {
      const tk = this.peek();
      throw new IvritError(`צפיתי ל"${value}" אבל מצאתי "${describe(tk)}"`, tk.start);
    }
  }

  parse() {
    const node = this.parseAssign();
    if (this.peek().type !== 'eof') {
      const tk = this.peek();
      throw new IvritError(`משהו מיותר בסוף הביטוי: "${describe(tk)}"`, tk.start);
    }
    return node;
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.isOp('||')) { this.next(); left = { type: 'logical', op: '||', left, right: this.parseAnd() }; }
    return left;
  }
  parseAnd() {
    let left = this.parseNot();
    while (this.isOp('&&')) { this.next(); left = { type: 'logical', op: '&&', left, right: this.parseNot() }; }
    return left;
  }
  parseAssign() {
    const left = this.parseOr();
    if (this.isOp('=')) {
      this.next();
      return { type: 'assign', target: left, value: this.parseAssign() };
    }
    return left;
  }
  parseNot() {
    if (this.isOp('!')) { this.next(); return { type: 'not', value: this.parseNot() }; }
    return this.parseComparison();
  }
  parseComparison() {
    let left = this.parseAdditive();
    for (;;) {
      const tk = this.peek();
      if (tk.type !== 'op') break;
      if (['==', '!=', '<', '>', '<=', '>=', 'in'].includes(tk.value)) {
        this.next();
        left = { type: 'binary', op: tk.value, left, right: this.parseAdditive() };
      } else break;
    }
    return left;
  }
  parseAdditive() {
    let left = this.parseMultiplicative();
    for (;;) {
      const tk = this.peek();
      if (tk.type === 'op' && (tk.value === '+' || tk.value === '-')) {
        this.next();
        left = { type: 'binary', op: tk.value, left, right: this.parseMultiplicative() };
      } else break;
    }
    return left;
  }
  parseMultiplicative() {
    let left = this.parseUnary();
    for (;;) {
      const tk = this.peek();
      if (tk.type === 'op' && ['*', '/', '%', '**'].includes(tk.value)) {
        this.next();
        left = { type: 'binary', op: tk.value, left, right: this.parseUnary() };
      } else break;
    }
    return left;
  }
  parseUnary() {
    if (this.isOp('-')) { this.next(); return { type: 'neg', value: this.parseUnary() }; }
    if (this.isOp('neg')) { this.next(); return { type: 'neg', value: this.parseUnary() }; }
    return this.parsePower();
  }
  parsePower() {
    const base = this.parsePostfix();
    if (this.isOp('**')) { this.next(); return { type: 'binary', op: '**', left: base, right: this.parseUnary() }; }
    return base;
  }
  parsePostfix() {
    let node = this.parsePrimary();
    for (;;) {
      if (this.isOp('.')) {
        this.next();
        const key = this.next();
        if (key.type !== 'name' && key.type !== 'number') {
          throw new IvritError('צפיתי לשם מאחרי נקודה', key.start);
        }
        node = { type: 'member', object: node, property: { type: 'literal', value: String(key.value) } };
      } else if (this.isOp('[')) {
        this.next();
        const prop = this.parseOr();
        this.expect(']');
        node = { type: 'member', object: node, property: prop };
      } else if (this.isOp('(')) {
        this.next();
        const args = [];
        while (!this.isOp(')')) {
          args.push(this.parseOr());
          if (!this.eat(',')) break;
        }
        this.expect(')');
        node = { type: 'call', callee: node, args };
      } else break;
    }
    return node;
  }
  parsePrimary() {
    const tk = this.next();
    if (tk.type === 'number') return { type: 'literal', value: tk.value };
    if (tk.type === 'string') return { type: 'string', raw: tk.value };
    if (tk.type === 'name') {
      if (tk.value === 'אמת' || tk.value === 'נכון') return { type: 'literal', value: true };
      if (tk.value === 'שקר' || tk.value === 'לאנכון') return { type: 'literal', value: false };
      if (tk.value === 'ריק' || tk.value === 'null') return { type: 'literal', value: null };
      return { type: 'name', value: tk.value };
    }
    if (tk.type === 'op') {
      if (tk.value === '(') {
        // (א, ב) => ... - פונקציית חץ
        const save = this.i;
        const params = [];
        let arrow = true;
        for (;;) {
          const t = this.peek();
          if (t.type === 'name') { params.push(t.value); this.next(); continue; }
          if (t.type === 'op' && t.value === ',') { this.next(); continue; }
          if (t.type === 'op' && t.value === ')') { this.next(); break; }
          arrow = false;
          break;
        }
        if (arrow && this.isOp('=>')) {
          this.next();
          return { type: 'lambda', params, body: this.parseAssign(), pos: tk.start };
        }
        this.i = save;
        const node = this.parseOr();
        this.expect(')');
        if (this.isOp('=>')) {
          this.next();
          return { type: 'lambda', params: [node], body: this.parseAssign(), pos: tk.start };
        }
        return node;
      }
      if (tk.value === '[') {
        const items = [];
        while (!this.isOp(']')) {
          items.push(this.parseOr());
          if (!this.eat(',')) break;
        }
        this.expect(']');
        return { type: 'array', items };
      }
    }
    throw new IvritError(`לא הצלחתי להבין את הביטוי כאן ("${describe(tk)}")`, tk.start);
  }
}

function describe(tk) {
  if (tk.type === 'eof') return 'סוף';
  if (tk.type === 'string') return JSON.stringify(tk.value);
  return String(tk.value);
}

export function parseExpression(src) {
  const p = new ExprParser(tokenize(src));
  return p.parse();
}

// ── הערכה ─────────────────────────────────────────────────────────────────
export function truthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === 'object') {
    if (v.__ivritRaw) return true;
    if (v.__ivritNodes) return v.__ivritNodes.length > 0;
    return true;
  }
  return Boolean(v);
}

export function toText(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(toText).join('');
  if (typeof v === 'object') {
    if (v.__ivritRaw !== undefined) return String(v.__ivritRaw);
    if (typeof v.__ivritText === 'string') return v.__ivritText;
    if (Array.isArray(v.__ivritNodes)) return v.__ivritText ?? '';
    return JSON.stringify(v);
  }
  if (typeof v === 'boolean') return v ? 'אמת' : 'שקר';
  return String(v);
}

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const m = v.trim().match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : 0;
  }
  return 0;
}

function looseEqual(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined || b === false || b === '';
  if (b === null || b === undefined) return a === false || a === '';
  if (typeof a === 'object' || typeof b === 'object') return a === b;
  if (typeof a === 'boolean' || typeof b === 'boolean') return truthy(a) === truthy(b);
  if (typeof a === 'number' && typeof b === 'string') return a === toNumber(b);
  if (typeof a === 'string' && typeof b === 'number') return toNumber(a) === b;
  return a === b;
}

export function deepEqual(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }
  return looseEqual(a, b);
}

function callFunction(fn, args, pos) {
  if (typeof fn !== 'function') {
    throw new IvritError(`מנסה לקרוא למשהו שאינו פונקציה (קיבלתי ${typeof fn === 'object' ? 'אובייקט' : typeof fn})`, pos);
  }
  return fn(...args);
}

const MEMBER_FUNCS = {
  'אורך': (self) => (typeof self === 'string' ? self.length : self?.length ?? 0),
  'הצטרף': (self, sep = ', ') => (Array.isArray(self) ? self : [self]).map(toText).join(sep),
  'הפוך': (self) => (Array.isArray(self) ? [...self].reverse() : [...String(self)].reverse().join('')),
  'מיון': (self, fn) => sortList(self, fn),
  'מיפוי': (self, fn) => (Array.isArray(self) ? self : [self]).map((x, i) => callFunction(fn, [x, i])),
  'סינון': (self, fn) => (Array.isArray(self) ? self : [self]).filter((x, i) => truthy(callFunction(fn, [x, i]))),
  'הוסף': (self, item) => [...(Array.isArray(self) ? self : []), item],
  'הסר': (self, item) => (Array.isArray(self) ? self : []).filter((x) => !deepEqual(x, item)),
  'מכיל': (self, item) => (Array.isArray(self)
    ? self.some((x) => deepEqual(x, item))
    : String(self).includes(toText(item))),
  'אורך-טקסט': (self) => toText(self).length,
  'חתוך': (self, a, b) => String(self).slice(a, b),
  'החלף': (self, a, b) => String(self).split(toText(a)).join(toText(b)),
  'אותיות-גדולות': (self) => toText(self).toUpperCase(),
  'אותיות-קטנות': (self) => toText(self).toLowerCase(),
  'מספר': (self) => toNumber(self),
  'טקסט': (self) => toText(self),
};

export function getMember(object, key, pos) {
  if (object === null || object === undefined) {
    throw new IvritError(`אין אפשר לקחת "${key}" ממשהו שאינו קיים`, pos);
  }
  if (typeof object === 'object' && !Array.isArray(object) && !object.__ivritNodes) {
    return object[key];
  }
  if (Array.isArray(object) && key === 'אורך') return object.length;
  if (typeof object === 'string' && key === 'אורך') return object.length;
  return undefined;
}

function sortList(list, fn) {
  const arr = [...(Array.isArray(list) ? list : [list])];
  if (typeof fn === 'function') {
    return arr.sort((a, b) => toNumber(callFunction(fn, [a, b])) || 0);
  }
  return arr.sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return toText(a).localeCompare(toText(b), 'he');
  });
}

function builtinFn(name) {
  switch (name) {
    case 'length': return (x) => (typeof x === 'string' ? x.length : x?.length ?? 0);
    case 'number': return (x) => toNumber(x);
    case 'text': return (x) => toText(x);
    case 'bool': return (x) => truthy(x);
    case 'words': return (x) => toText(x).split(/\s+/).filter(Boolean);
    case 'replace': return (s, a, b) => toText(s).split(toText(a)).join(toText(b));
    case 'slice': return (s, a, b) => toText(s).slice(a, b);
    case 'upper': return (s) => toText(s).toUpperCase();
    case 'lower': return (s) => toText(s).toLowerCase();
    case 'sort': return (list, fn) => sortList(list, fn);
    case 'map': return (list, fn) => (Array.isArray(list) ? list : [list]).map((x, i) => callFunction(fn, [x, i]));
    case 'filter': return (list, fn) => (Array.isArray(list) ? list : [list]).filter((x, i) => truthy(callFunction(fn, [x, i])));
    case 'reduce': return (list, fn, init) => (Array.isArray(list) ? list : [list])
      .reduce((acc, x, i) => {
        const r = callFunction(fn, [acc, x, i]);
        return typeof r === 'object' && r !== null ? r : acc;
      }, init === undefined ? 0 : init);
    case 'join': return (list, sep = ', ') => (Array.isArray(list) ? list : [list]).map(toText).join(sep);
    case 'reverse': return (list) => (Array.isArray(list) ? [...list].reverse() : [...toText(list)].reverse().join(''));
    case 'includes': return (list, item) => (Array.isArray(list)
      ? list.some((x) => deepEqual(x, item))
      : toText(list).includes(toText(item)));
    case 'now': return () => Date.now();
    case 'today': return () => new Date().toISOString().slice(0, 10);
    case 'year': return () => new Date().getFullYear();
    case 'random': return (min = 0, max = 100) => {
      const a = toNumber(min), b = toNumber(max);
      return Math.floor(Math.random() * (b - a + 1)) + a;
    };
    case 'json': return (x) => JSON.stringify(x, null, 2);
    case 'toNumber': return (x) => toNumber(x);
    case 'opts': return (obj, key, fallback) => (obj && obj[key] !== undefined ? obj[key] : fallback);
    default: return null;
  }
}

export function evaluate(node, scope) {
  switch (node.type) {
    case 'literal': return node.value;
    case 'string': return node.raw;
    case 'array': return node.items.map((it) => evaluate(it, scope));
    case 'name': {
      const value = scope.get(node.value);
      if (value === undefined && !scope.has(node.value)) {
        const fn = builtinFn(lookupBuiltin(node.value) || '');
        if (fn) return (...args) => fn(...args);
        throw new IvritError(`משתנה בשם "${node.value}" לא מוגדר`, node.pos);
      }
      return value;
    }
    case 'not': return !truthy(evaluate(node.value, scope));
    case 'neg': return -toNumber(evaluate(node.value, scope));
    case 'logical': {
      const left = evaluate(node.left, scope);
      if (node.op === '&&') return truthy(left) ? evaluate(node.right, scope) : left;
      return truthy(left) ? left : evaluate(node.right, scope);
    }
    case 'lambda': {
      const closure = scope;
      return (...args) => {
        const inner = new Scope(closure, 'fn');
        node.params.forEach((p, i) => inner.define(p, args[i]));
        return evaluate(node.body, inner);
      };
    }
    case 'assign': {
      const value = evaluate(node.value, scope);
      const target = node.target;
      if (target.type === 'name') return scope.set(target.value, value);
      if (target.type === 'member') {
        const object = evaluate(target.object, scope);
        if (object && typeof object === 'object') {
          object[toText(evaluate(target.property, scope))] = value;
        }
        return value;
      }
      throw new IvritError('אפשר להקצות רק למשתנה או למאפיין', target.pos ?? 0);
    }
    case 'binary': {
      const a = evaluate(node.left, scope);
      const b = evaluate(node.right, scope);
      switch (node.op) {
        case '+':
          if (typeof a === 'string' || typeof b === 'string') {
            if (typeof a === 'string' && typeof b === 'string') return a + b;
            return toText(a) + toText(b);
          }
          if (Array.isArray(a) || Array.isArray(b)) {
            return [...(Array.isArray(a) ? a : [a]), ...(Array.isArray(b) ? b : [b])];
          }
          return toNumber(a) + toNumber(b);
        case '-': return toNumber(a) - toNumber(b);
        case '*': return toNumber(a) * toNumber(b);
        case '/': return toNumber(b) === 0 ? 0 : toNumber(a) / toNumber(b);
        case '%': return toNumber(b) === 0 ? 0 : toNumber(a) % toNumber(b);
        case '**': return toNumber(a) ** toNumber(b);
        case '==': return looseEqual(a, b);
        case '!=': return !looseEqual(a, b);
        case '<': return compare(a, b) < 0;
        case '>': return compare(a, b) > 0;
        case '<=': return compare(a, b) <= 0;
        case '>=': return compare(a, b) >= 0;
        case 'in': {
          if (Array.isArray(b)) return b.some((x) => deepEqual(x, a));
          if (b && typeof b === 'object') return Object.prototype.hasOwnProperty.call(b, toText(a));
          return toText(b).includes(toText(a));
        }
        default: throw new IvritError(`אופרטור לא נתמך: ${node.op}`, node.pos);
      }
    }
    case 'member': {
      const object = evaluate(node.object, scope);
      const key = toText(evaluate(node.property, scope));
      if (object && typeof object === 'object' && !Array.isArray(object) && !object.__ivritNodes) {
        return object[key];
      }
      if (key === 'אורך') return MEMBER_FUNCS['אורך'](object);
      return undefined;
    }
    case 'call': {
      // קריאה למתודה: עצמ.מתודה(...)
      if (node.callee.type === 'member') {
        const object = evaluate(node.callee.object, scope);
        const key = toText(evaluate(node.callee.property, scope));
        const fn = MEMBER_FUNCS[key] || MEMBER_FUNCS[normalizeKey(key)];
        if (fn) return fn(object, ...node.args.map((a) => evaluate(a, scope)));
        if (object && typeof object === 'object' && typeof object[key] === 'function') {
          return object[key](...node.args.map((a) => evaluate(a, scope)));
        }
        throw new IvritError(`אין כזאת שיטה: "${key}"`, node.pos);
      }
      if (node.callee.type === 'name') {
        const fn = scope.get(node.callee.value);
        if (typeof fn === 'function') {
          return callFunction(fn, node.args.map((a) => evaluate(a, scope)), node.pos);
        }
        const builtin = builtinFn(lookupBuiltin(node.callee.value) || '');
        if (builtin) return builtin(...node.args.map((a) => evaluate(a, scope)));
        throw new IvritError(`פונקציה בשם "${node.callee.value}" לא נמצאה`, node.pos);
      }
      const value = evaluate(node.callee, scope);
      return callFunction(value, node.args.map((a) => evaluate(a, scope)), node.pos);
    }
    default:
      throw new IvritError(`סוג ביטוי לא ידוע: ${node.type}`, node.pos);
  }
}

function compare(a, b) {
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  const x = toNumber(a), y = toNumber(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export { toNumber, builtinFn, MEMBER_FUNCS, sortList };
