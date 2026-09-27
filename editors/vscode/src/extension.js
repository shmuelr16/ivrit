// extension.js - הרשתה לעורך קוד (VS Code ו-Cursor) עבור עִבְרִית.
// מספקת תחביר, השלמות, בנייה ל-HTML, תצוגה מקדימה ואזהרות בלוח הבעיות.

// CommonJS - VS Code טוען הרשתות עם require() ולא עם import.
const vscode = require('vscode');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { buildPreviewHtml, cleanMessage } = require('./preview.js');

let compilerModule = null;
let diagnostics = null;
let previewPanel = null;
let lastResult = null;
let building = false;
let statusItem = null;
let extContext = null;

/** מעדכן פס למטה שמראה את מצב הבנייה האחרונה */
function setStatus(result) {
  if (!statusItem) return;
  if (!result) {
    statusItem.text = '$(code) עִבְרִית';
    statusItem.tooltip = 'עִבְרִית: לחץ לבנייה';
    statusItem.backgroundColor = undefined;
    return;
  }
  if (result.errors.length) {
    statusItem.text = `$(error) עִבְרִית: ${result.errors.length} שגיאות`;
    statusItem.tooltip = result.errors.map((e) => e.message).join('\n');
    statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    return;
  }
  const time = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  statusItem.text = `$(check) עִבְרִית ${time}`;
  statusItem.tooltip = result.warnings.length
    ? `נבנה בהצלחה (${result.warnings.length} אזהרות)`
    : 'נבנה בהצלחה';
  statusItem.backgroundColor = result.warnings.length
    ? new vscode.ThemeColor('statusBarItem.warningBackground')
    : undefined;
}

/** טוען את המקמפל מתיקיית הספקייה (vendor) של ההרשתה */
async function getCompiler(extensionPath) {
  if (compilerModule) return compilerModule;
  const entry = path.join(extensionPath, 'vendor', 'compiler.js');
  if (!fs.existsSync(entry)) {
    throw new Error('לא נמצא המקמפל של עִבְרִית. הרץ: npm run vendor בתיקיית editors/vscode');
  }
  compilerModule = await import(pathToFileURL(entry).href);
  return compilerModule;
}

let ltrModule = null;
/** טוען את עזרי הכיוון (LTR) מתיקיית הספקייה */
async function getLtr(extensionPath) {
  if (ltrModule) return ltrModule;
  const entry = path.join(extensionPath, 'vendor', 'ltr.js');
  if (!fs.existsSync(entry)) {
    throw new Error('לא נמצא מודול הכיוון של עִבְרִית. הרץ: npm run vendor בתיקיית editors/vscode');
  }
  ltrModule = await import(pathToFileURL(entry).href);
  return ltrModule;
}

/** ממיר היסט בקובץ לשורה ועמודה של תווית */
function positionAt(text, offset) {
  const safe = Math.max(0, Math.min(offset ?? 0, text.length));
  const before = text.slice(0, safe);
  const line = before.split('\n').length - 1;
  const column = safe - (before.lastIndexOf('\n') + 1);
  return { line, column };
}

/** מקמפל את תוכן הקובץ ומעדכן את הפלט והאזהרות */
async function compileDocument(document, extensionPath) {
  const { compile } = await getCompiler(extensionPath);
  const result = compile(document.getText(), { file: document.fileName });
  const problems = [...result.errors.map((e) => ({ item: e, severity: vscode.DiagnosticSeverity.Error }))];
  if (vscode.workspace.getConfiguration('ivrit').get('check.showWarnings', true)) {
    problems.push(...result.warnings.map((w) => ({ item: w, severity: vscode.DiagnosticSeverity.Warning })));
  }
  if (vscode.window.activeTextEditor?.document === document) setStatus(result);
  diagnostics.set(document.uri, problems.map(({ item, severity }) => {
    const { line, column } = positionAt(document.getText(), item.pos);
    const range = new vscode.Range(line, column, line, column + 1);
    const message = cleanMessage(item.message || '');
    const diagnostic = new vscode.Diagnostic(range, message, severity);
    diagnostic.source = 'עִבְרִית';
    return diagnostic;
  }));
  lastResult = { document, result };
  return result;
}

/** כותב את תוצאת הקומפילציה לקובץ HTML */
async function writeOutput(document, result, extensionPath) {
  const outDir = vscode.workspace.getConfiguration('ivrit').get('build.outputDir', 'dist');
  const target = path.join(path.dirname(document.fileName), outDir, `${path.basename(document.fileName).replace(/\.iv(rit)?$/u, '')}.html`);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, result.html, 'utf8');
  return target;
}

/** יוצר או מרענן את התצוגה המקדימה */
function renderPreview(extensionPath) {
  if (!previewPanel) {
    previewPanel = vscode.window.createWebviewPanel(
      'ivrit.preview',
      'תצוגה מקדימה - עִבְרִית',
      vscode.ViewColumn.Beside,
      { enableScripts: false, retainContextWhenHidden: true },
    );
    previewPanel.onDidDispose(() => { previewPanel = null; }, null, extContext?.subscriptions);
  }
  previewPanel.webview.html = buildPreviewHtml(lastResult, lastResult?.document.fileName || '');
  previewPanel.reveal(vscode.ViewColumn.Beside, true);
  return previewPanel;
}

/** מציע כפתור תצוגה מקדימה בראש הקובץ */
class PreviewCodeLensProvider {
  provideCodeLenses(document) {
    if (document.languageId !== 'ivrit') return [];
    return [{
      range: new vscode.Range(0, 0, 0, 0),
      command: { title: '$(play) פתח בדפדפן', command: 'ivrit.open' },
    }, {
      range: new vscode.Range(0, 0, 0, 0),
      command: { title: '$(preview) תצוגה מקדימה', command: 'ivrit.preview' },
    }, {
      range: new vscode.Range(0, 0, 0, 0),
      command: { title: '$(check) בנייה', command: 'ivrit.build' },
    }];
  }
}

function activate(context) {
  extContext = context;
  diagnostics = vscode.languages.createDiagnosticCollection('ivrit');
  context.subscriptions.push(diagnostics);

  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusItem.command = 'ivrit.open';
  statusItem.text = '$(code) עִבְרִית';
  statusItem.tooltip = 'עִבְרִית: לחץ כדי לבנות ולפתוח בדפדפן';
  statusItem.show();
  context.subscriptions.push(statusItem, { dispose: () => { statusItem = null; } });

  context.subscriptions.push(vscode.languages.registerCodeLensProvider(
    { language: 'ivrit' },
    new PreviewCodeLensProvider(),
  ));

  const run = async (fn) => {
    try {
      await fn();
    } catch (err) {
      vscode.window.showErrorMessage(`עִבְרִית: ${err.message}`);
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('ivrit.build', () => run(async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'ivrit') {
        vscode.window.showInformationMessage('עִבְרִית: פתח קובץ .iv כדי לבנות אותו');
        return;
      }
      if (building) return;
      building = true;
      try {
        const result = await compileDocument(editor.document, context.extensionPath);
        if (result.errors.length) {
          vscode.window.showErrorMessage(`עִבְרִית: ${result.errors.length} שגיאות - ראה את הבעיות בקובץ`);
          return;
        }
        const target = await writeOutput(editor.document, result, context.extensionPath);
        if (previewPanel) renderPreview(context.extensionPath);
        vscode.window.setStatusBarMessage(`✔ בנוי: ${path.basename(target)}`, 4000);
      } finally {
        building = false;
      }
    })),

    vscode.commands.registerCommand('ivrit.preview', () => run(async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const result = await compileDocument(editor.document, context.extensionPath);
      if (result.errors.length) {
        diagnostics.set(editor.document.uri, diagnostics.get(editor.document.uri) || []);
      }
      renderPreview(context.extensionPath);
    })),

    vscode.commands.registerCommand('ivrit.open', () => run(async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const result = await compileDocument(editor.document, context.extensionPath);
      if (result.errors.length) {
        vscode.window.showErrorMessage(`עִבְרִית: ${result.errors.length} שגיאות - תקן אותן לפני פתיחה`);
        return;
      }
      const target = await writeOutput(editor.document, result, context.extensionPath);
      await vscode.env.openExternal(vscode.Uri.file(target));
    })),

    vscode.commands.registerCommand('ivrit.ltr', () => run(async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'ivrit') {
        vscode.window.showInformationMessage('עִבְרִית: פתח קובץ .iv כדי להחליף את כיוון התצוגה');
        return;
      }
      const { addLtrMarks, removeLtrMarks, hasBidiMarks } = await getLtr(context.extensionPath);
      const doc = editor.document;
      const text = doc.getText();
      const on = hasBidiMarks(text);
      const updated = on ? removeLtrMarks(text) : addLtrMarks(text);
      const full = new vscode.Range(doc.positionAt(0), doc.positionAt(text.length));
      await editor.edit((b) => b.replace(full, updated));
      vscode.window.setStatusBarMessage(
        on ? '↔ עִבְרִית: תצוגת RTL רגילה' : '↔ עִבְרִית: תצוגת קוד שמאל-לימין',
        4000,
      );
    })),

    vscode.commands.registerCommand('ivrit.check', () => run(async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const result = await compileDocument(editor.document, context.extensionPath);
      const lines = [
        `שגיאות: ${result.errors.length}`,
        `אזהרות: ${result.warnings.length}`,
        ...result.errors.map((e) => `✖ ${e.message}`),
        ...result.warnings.map((w) => `⚠ ${w.message}`),
      ];
      vscode.window.showInformationMessage(`עִבְרִית: ${lines[0]}, ${lines[1]}`);
    })),
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (document.languageId !== 'ivrit') return;
      if (!vscode.workspace.getConfiguration('ivrit').get('build.autoSave', true)) return;
      const result = await compileDocument(document, context.extensionPath);
      if (result.errors.length) return;
      await writeOutput(document, result, context.extensionPath);
      if (previewPanel && lastResult?.document === document) renderPreview(context.extensionPath);
    }),
  );

  // בנייה ראשונית של הקבצים הפתוחים
  for (const document of vscode.workspace.textDocuments) {
    if (document.languageId === 'ivrit' && document.isDirty === false) {
      compileDocument(document, context.extensionPath).catch(() => {});
    }
  }
}

function deactivate() {
  diagnostics?.clear();
  diagnostics?.dispose();
}

module.exports = { activate, deactivate };
