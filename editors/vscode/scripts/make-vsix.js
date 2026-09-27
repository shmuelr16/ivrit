// make-vsix.js - אורז את ההרשתה לקובץ .vsix (ארכיון zip עם מבנה מיוחד).
// מיועד להתקנה ידנית: cursor --install-extension ivrit-1.0.0.vsix
// או בתוך VS Code: "Extensions: Install from VSIX..."
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { fileURLToPath } = require('node:url');

const here = path.dirname(__filename);
const extDir = path.resolve(here, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(extDir, 'package.json'), 'utf8'));
const out = path.join(extDir, `${pkg.name}-${pkg.version}.vsix`);
const stage = path.join(extDir, '.stage');
const bundle = path.join(stage, 'extension');

const KEEP = ['package.json', 'language-configuration.json', 'README.md', 'CHANGELOG.md',
  'syntaxes', 'snippets', 'src', 'vendor', 'media'];

fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(out, { force: true });
fs.mkdirSync(bundle, { recursive: true });

const missing = [];
for (const item of KEEP) {
  const from = path.join(extDir, item);
  if (!fs.existsSync(from)) { missing.push(item); continue; }
  fs.cpSync(from, path.join(bundle, item), { recursive: true });
}
if (missing.includes('vendor')) {
  console.error('✖ חסרת תיקיית vendor - הרץ קודם: node scripts/vendor.js');
  process.exit(1);
}

execFileSync('zip', ['-r', '-q', '-X', out, 'extension'], { cwd: stage, stdio: 'inherit' });
fs.rmSync(stage, { recursive: true, force: true });

const size = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`✔ נוצר ${path.relative(process.cwd(), out)} (${size}KB)`);
console.log(`  התקנה: cursor --install-extension ${path.relative(process.cwd(), out)}`);
