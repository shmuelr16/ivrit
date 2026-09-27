// vendor.js - מעתיק את המקמפל של עִבְרִית לתוך תיקיית ההרשתה,
// כדי שההרשתה תהיה עצמאית (כמו כל הרשתה שמפורסמת בחנות).
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

const here = path.dirname(__filename);
const extDir = path.resolve(here, '..');
const root = path.resolve(extDir, '..', '..');
const vendor = path.join(extDir, 'vendor');

fs.rmSync(vendor, { recursive: true, force: true });
fs.mkdirSync(vendor, { recursive: true });
fs.cpSync(path.join(root, 'src'), vendor, { recursive: true });
fs.cpSync(path.join(root, 'bin'), vendor, { recursive: true });
fs.cpSync(path.join(root, 'package.json'), path.join(vendor, 'package.json'));

console.log(`✔ המקמפל הועתק ל-${path.relative(process.cwd(), vendor)}`);
