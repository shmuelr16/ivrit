// newproject.js - יוצר סביבת פרויקט מוכנה לעִבְרִית

import fs from 'node:fs';
import path from 'node:path';

const INDEX_IV = `-- עִבְרִית - כתוב כאן מה שבא לך לך, וזה יהפוך ל-HTML
משתנה שם-האתר = "האתר שלי";
משתנה צבע-ראשי: #5b3df5;

// רכיב = חתיכת HTML עם פרמטרים. שם הרכיב לא יכול להתנגש עם שם תג מובנה
רכיב כרטיס-תכנים(כותרת, טקסט) {
  <כרטיס>
    <כותרת3>{כותרת}</כותרת3>
    <פסקה סגנון="צבע: אפור">{טקסט}</פסקה>
  </כרטיס>
}

<מסמך שם="{שם-האתר}">
  <ראש>
    <!-- קובץ CSS מקומי נטמע אוטומטית בתוך הדף -->
    <נתיב ייחוס="stylesheet" מקור="style.css">
  </ראש>

  <מאגר>
    <כותרת1>ברוך הבא 👋</כותרת1>
    <פסקה>זהו קובץ <קוד>.iv</קוד> פשוט. כתוב כאן <מודגש>כל מה שבא לך</מודגש> וזה הופך ל-HTML נקי.</פסקה>
    <כפתור-ראשי>בוא נתחיל</כפתור-ראשי>

    <עמודות>
      <כרטיס-תכנים כותרת="מהיר" טקסט="קומפיילר קטן שקורא את הקובץ ומפיק HTML." />
      <כרטיס-תכנים כותרת="יפה" טקסט="כל מסמך מקבל עיצוב מוכן, RTL ורספונסיבי." />
      <כרטיס-תכנים כותרת="עברי" טקסט="תגים, מאפיינים ו-CSS - הכל בעברית." />
    </עמודות>
  </מאגר>
</מסמך>

סגנון כותרת1 {
  גופן-גודל: 3rem;
  צבע: צבע-ראשי;
}

סגנון מסך-טלפון {
  כותרת1 { גופן-גודל: 2rem; }
}
`;

const STYLE_CSS = `/* כאן אפשר להוסיף CSS נוסף - או להשתמש בבלוק סגנון בתוך קובץ ה-.iv */
body { background: #f6f7fb; }
`;

const PACKAGE_JSON = (name) => JSON.stringify({
  name: name.replace(/[^a-z0-9-]/gi, '-').toLowerCase() || 'ivrit-app',
  version: '1.0.0',
  private: true,
  type: 'module',
  scripts: {
    dev: 'ivrit serve index.iv',
    build: 'ivrit build index.iv -o dist/index.html --minify',
    check: 'ivrit check index.iv',
  },
  devDependencies: { ivrit: '^1.0.0' },
}, null, 2) + '\n';

const README = `# פרויקט עִבְרִית

התקנה והרצה:

    npm install
    npm run dev      # פותח http://localhost:3000 עם טעינה-חוצה חיה
    npm run build    # מייצר dist/index.html

הקובץ הראשי הוא \`index.iv\`.
`;

export function createProject(dir) {
  const root = path.resolve(dir);
  if (fs.existsSync(root) && fs.readdirSync(root).length > 0) {
    throw new Error(`התיקייה "${dir}" כבר קיימת ולא ריקה`);
  }
  fs.mkdirSync(root, { recursive: true });
  const files = {
    'index.iv': INDEX_IV,
    'style.css': STYLE_CSS,
    'package.json': PACKAGE_JSON(dir),
    'README.md': README,
    '.gitignore': 'node_modules\ndist\n',
  };
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, name), content, 'utf8');
  }
  return Object.keys(files);
}
