// ===== VDR 國家資料庫 - Google Apps Script =====
// 部署方式：工具 -> 指令碼編輯器 -> 貼上此程式碼 -> 部署 -> 新增部署 -> 網頁應用程式

const API_TOKEN = PropertiesService.getScriptProperties().getProperty('API_TOKEN');

function handleRequest(e) {
  const token = e?.parameter?.token || (typeof e?.postData?.contents === 'string' ? JSON.parse(e.postData.contents)?.token : null);
  if (API_TOKEN && token !== API_TOKEN) return json({ error: 'unauthorized' });
  return null;
}

function doGet(e) {
  const authErr = handleRequest(e);
  if (authErr) return authErr;

  const action = e?.parameter?.action;
  try {
    if (action === 'ping') return json({ status: 'ok' });
    if (action === 'getCitizens') return json({ citizens: getAllRows('公民') });
    if (action === 'getDecrees') return json({ decrees: getAllRows('總統令') });
    if (action === 'getTransactions') return json({ transactions: getAllRows('交易紀錄') });
    if (action === 'getAll') {
      return json({
        citizens: getAllRows('公民'),
        decrees: getAllRows('總統令'),
        transactions: getAllRows('交易紀錄'),
        nation: getAllRows('國家概覽')[0] || {},
      });
    }
    return json({ error: 'unknown action' });
  } catch (err) {
    return json({ error: err.message });
  }
}

function doPost(e) {
  const body = typeof e?.postData?.contents === 'string'
    ? JSON.parse(e.postData.contents) : e?.parameter || {};

  const token = e?.parameter?.token || body?.token;
  if (API_TOKEN && token !== API_TOKEN) return json({ error: 'unauthorized' });

  const { action } = body;
  try {
    if (action === 'registerCitizen') {
      appendRow('公民', [body.userId, body.name, body.region, body.wallet || 100, new Date().toISOString()]);
      return json({ success: true });
    }
    if (action === 'addDecree') {
      appendRow('總統令', [body.id, body.title, body.content, body.authorName, new Date().toISOString()]);
      return json({ success: true });
    }
    if (action === 'addTransaction') {
      appendRow('交易紀錄', [body.from, body.to, body.amount, body.note || '', new Date().toISOString()]);
      return json({ success: true });
    }
    if (action === 'updateWallet') {
      updateWallet(body.userId, body.amount);
      return json({ success: true });
    }
    if (action === 'syncAll') {
      syncFromJson(body.data);
      return json({ success: true });
    }
    return json({ error: 'unknown action' });
  } catch (err) {
    return json({ error: err.message });
  }
}

function getAllRows(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = data[i][j];
    rows.push(row);
  }
  return rows;
}

function appendRow(sheetName, rowData) {
  const sheet = getSheet(sheetName);
  sheet.appendRow(rowData);
}

function updateWallet(userId, amount) {
  const sheet = getSheet('公民');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      const current = parseInt(data[i][3]) || 0;
      sheet.getRange(i + 1, 4).setValue(current + amount);
      return;
    }
  }
}

function syncFromJson(data) {
  if (data.citizens) {
    const sheet = getSheet('公民');
    clearSheet(sheet);
    sheet.appendRow(['userId', 'name', 'region', 'wallet', 'registeredAt']);
    for (const c of data.citizens) sheet.appendRow([c.userId, c.name, c.region, c.wallet, c.registeredAt]);
  }
  if (data.decrees) {
    const sheet = getSheet('總統令');
    clearSheet(sheet);
    sheet.appendRow(['id', 'title', 'content', 'authorName', 'issuedAt']);
    for (const d of data.decrees) sheet.appendRow([d.id, d.title, d.content, d.authorName, d.issuedAt]);
  }
  if (data.transactions) {
    const sheet = getSheet('交易紀錄');
    clearSheet(sheet);
    sheet.appendRow(['from', 'to', 'amount', 'note', 'at']);
    for (const t of data.transactions) sheet.appendRow([t.from, t.to, t.amount, t.note, t.at]);
  }
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function clearSheet(sheet) {
  sheet.clearContents();
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
