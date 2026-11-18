/**
 * Agents Atlas sync backend. Paste into Extensions > Apps Script of the master Google Sheet.
 * Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone (or your org).
 * Put the /exec URL in config.js as SYNC_URL. Set SECRET below and the same value as SYNC_KEY.
 * Workflow state lives in a tab called "Actions": Record ID | Status | Starred | Tags | Note | Owner | Updated.
 */
const SECRET = "change-me";
const TAB = "Actions";
const HEAD = ["Record ID", "Status", "Starred", "Tags", "Note", "Owner", "Updated"];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TAB);
  if (!sh) { sh = ss.insertSheet(TAB); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  return sh;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  if (e.parameter.key !== SECRET) return json_({ ok: false, error: "bad key" });
  const v = sheet_().getDataRange().getValues().slice(1);
  return json_({ ok: true, actions: v.filter(r => r[0]).map(r => ({
    id: r[0], s: r[1] || undefined, f: r[2] === true || r[2] === "TRUE" || undefined,
    t: r[3] ? String(r[3]).split(";").map(x => x.trim()).filter(Boolean) : undefined, n: r[4] || undefined, o: r[5] || undefined, u: r[6] ? String(r[6]) : undefined })) });
}

function doPost(e) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.key !== SECRET) return json_({ ok: false, error: "bad key" });
    const sh = sheet_(); const data = sh.getDataRange().getValues();
    const rowOf = {}; data.forEach((r, i) => { if (i) rowOf[r[0]] = i + 1; });
    const append = [];
    (body.upsert || []).forEach(a => {
      const row = [a.id, a.s || "", !!a.f, (a.t || []).join("; "), a.n || "", a.o || "", a.u || new Date().toISOString()];
      if (a.deleted) { if (rowOf[a.id]) sh.getRange(rowOf[a.id], 2, 1, 6).clearContent(); return; }
      if (rowOf[a.id]) sh.getRange(rowOf[a.id], 1, 1, 7).setValues([row]); else append.push(row);
    });
    if (append.length) sh.getRange(sh.getLastRow() + 1, 1, append.length, 7).setValues(append);
    return json_({ ok: true, n: (body.upsert || []).length });
  } catch (err) { return json_({ ok: false, error: String(err) }); }
  finally { lock.releaseLock(); }
}
