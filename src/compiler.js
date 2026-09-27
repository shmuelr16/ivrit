// compiler.js - הנקודה המרכזית: קובץ עִבְרִית -> HTML מוכן

import fs from 'node:fs';
import path from 'node:path';
import { parse } from './parser.js';
import { IvritError } from './expr.js';
import { render } from './render.js';

const IVRIT_EXT = /\.(iv|ivrit)$/i;

function isIvritFile(file) {
  return IVRIT_EXT.test(file);
}

function resolveImport(fromFile, spec) {
  const dir = path.dirname(path.resolve(fromFile));
  const base = path.resolve(dir, spec);
  const candidates = isIvritFile(base) ? [base] : [
    base, `${base}.iv`, `${base}.ivrit`, path.join(base, 'index.iv'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

/** טוען קובץ, מפתר ייבואים (גם מקוננים), ומחזיר תוכנית אחת */
export function loadProgram(source, file, stack = []) {
  const program = parse(source, file);
  const seen = new Set();
  const bodies = [];
  for (const spec of program.imports) {
    const resolved = resolveImport(file, spec);
    if (!resolved) {
      throw new IvritError(`לא מצאתי את הקובץ המיובא "${spec}"`, null);
    }
    if (stack.includes(resolved) || seen.has(resolved)) continue;
    seen.add(resolved);
    const childSource = fs.readFileSync(resolved, 'utf8');
    const child = loadProgram(childSource, resolved, [...stack, resolved]);
    bodies.push(...child.body);
  }
  return {
    body: [...bodies, ...program.body.filter((n) => n.type !== 'import')],
    imports: program.imports,
  };
}

/**
 * מקמפל קוד עִבְרִית ל-HTML.
 * @param {string} source קוד מקור
 * @param {object} options אפשרויות (file, design, collectErrors, lang, dir)
 */
export function compile(source, options = {}) {
  const file = options.file || 'קובץ.iv';
  const result = { file, html: '', css: '', output: [], errors: [], warnings: [], title: '' };
  let program;
  try {
    program = loadProgram(source, file);
  } catch (err) {
    result.errors.push(err);
    return result;
  }
  const rendered = render(program, options);
  result.html = rendered.html;
  result.bodyHtml = rendered.bodyHtml;
  result.headHtml = rendered.headHtml;
  result.css = rendered.css;
  result.output = rendered.output;
  result.errors = rendered.errors;
  result.warnings = rendered.warnings;
  result.title = rendered.title;
  return result;
}

/** מקמפל קובץ מהדיסק */
export function compileFile(file, options = {}) {
  const source = fs.readFileSync(file, 'utf8');
  return compile(source, { ...options, file });
}

/** בודק קבצים ומדווח על שגיאות בלי לייצר קובץ */
export function check(files, options = {}) {
  const list = Array.isArray(files) ? files : [files];
  const allErrors = [];
  const allWarnings = [];
  for (const file of list) {
    let res;
    try {
      res = compileFile(file, { ...options, collectErrors: true });
    } catch (err) {
      res = { errors: [err], warnings: [] };
    }
    allErrors.push(...res.errors);
    allWarnings.push(...res.warnings);
  }
  return { errors: allErrors, warnings: allWarnings };
}

/** מייצר HTML סופי (אם מבוקש minify) */
export function finalize(result, { minify = false } = {}) {
  let html = result.html;
  if (minify) html = minifyHtml(html);
  return html;
}

export function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,:>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

export function minifyHtml(html) {
  const withMinifiedCss = html.replace(
    /<style>([\s\S]*?)<\/style>/g,
    (_, css) => `<style>${minifyCss(css)}</style>`,
  );
  return `${withMinifiedCss
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/>\n+</g, '><')
    .trim()}\n`;
}

export { parse, render, IvritError };
