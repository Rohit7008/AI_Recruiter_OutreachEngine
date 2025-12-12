
// -----------------------------
// CONFIG (update before deploy)
// -----------------------------
const GEMINI_API_KEY = "REPLACE_WITH_YOUR_GEMINI_KEY";
const RESUME_DOC_ID = "REPLACE_WITH_RESUME_DOC_ID";
const SPREADSHEET_ID = "REPLACE_WITH_SPREADSHEET_ID";
const MAX_EMAILS_PER_DAY = 24;

// -----------------------------
// UTIL
// -----------------------------
function clean(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (["NA", "N/A", "-", "NULL", ""].includes(s.toUpperCase())) return "";
  return s;
}
function extractValidEmails(raw) {
  if (!raw) return [];
  const parts = raw.split(/[,\/;|\s]+/);
  const ok = [];
  const re = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/i;
  for (let p of parts) {
    p = String(p).trim();
    if (re.test(p)) ok.push(p.toLowerCase());
  }
  return [...new Set(ok)];
}
function dateDiffDays(a, b) {
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

// -----------------------------
// TRIGGER
// -----------------------------
function createDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "sendJobApplicationEmails") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("sendJobApplicationEmails").timeBased().atHour(9).everyDays(1).create();
}

// -----------------------------
// RESUME EXPORT (PDF blob)
// -----------------------------
function getResumePDF() {
  const url = `https://docs.google.com/document/d/${RESUME_DOC_ID}/export?format=pdf`;
  const token = ScriptApp.getOAuthToken();
  const res = UrlFetchApp.fetch(url, { headers: { Authorization: `Bearer ${token}` }, muteHttpExceptions: true });
  const blob = res.getBlob();
  blob.setName("Rohit-Pottavathini-Resume.pdf");
  return blob;
}
function getResumeText() {
  try { return DocumentApp.openById(RESUME_DOC_ID).getBody().getText(); }
  catch (e) { return ""; }
}

// -----------------------------
// GEMINI CALL (throws GEMINI_ errors)
// -----------------------------
function callGemini(promptText) {
  const url = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(GEMINI_API_KEY);
  const payload = { contents: [{ parts: [{ text: promptText }] }] };
  try {
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    const body = res.getContentText();
    if (code === 429) throw new Error("GEMINI_QUOTA_EXCEEDED: " + body);
    if (code >= 400) throw new Error("GEMINI_ERROR: " + body);
    const text = JSON.parse(body)?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return String(text).replace(/```html|```|```json/g, "").trim();
  } catch (e) {
    if (!String(e.message).startsWith("GEMINI_")) throw new Error("GEMINI_ERROR: " + e.message);
    throw e;
  }
}

// -----------------------------
// EMAIL CONTENT GENERATORS
// (use resumeText for richer context)
// -----------------------------
function generateCEOEmail(company, category, ceoName, resume) {
  const prompt = `
Write a confident, value-driven CEO outreach email.
Start with: <p>Hi ${ceoName},</p>
Tone: concise professional-casual; show product/automation impact, ownership, execution speed.
Avoid the word "final".
Length: ~150 words. HTML only.
Context: ${company} — ${category}
Resume: ${resume}
Signature: <p>Kind regards,<br><b>Rohit Pottavathini</b></p>`;
  return callGemini(prompt);
}
function generateHREmail(company, category, hrName, resume) {
  const prompt = `
Write a warm, concise HR outreach email.
Start with: <p>Hi ${hrName},</p>
Tone: friendly, recruiter-friendly; highlight full-stack, automation, integrations, quick onboarding.
Avoid "final".
Length: ~140 words. HTML only.
Context: ${company} — ${category}
Resume: ${resume}
Signature: <p>Kind regards,<br><b>Rohit Pottavathini</b></p>`;
  return callGemini(prompt);
}
function generateCEOFollowUpDay3(company, ceoName, resume) {
  const prompt = `
Write a short Day-3 follow-up to a CEO.
Start with: <p>Hi ${ceoName},</p>
Re-emphasize value; zero pressure. HTML only. Resume: ${resume}
Signature: <p>Kind regards,<br><b>Rohit</b></p>`;
  return callGemini(prompt);
}
function generateHRFollowUpDay3(company, hrName, resume) {
  const prompt = `
Write a short Day-3 follow-up to HR.
Start with: <p>Hi ${hrName},</p>
Gentle reminder; easy CTA. HTML only. Resume: ${resume}
Signature: <p>Kind regards,<br><b>Rohit</b></p>`;
  return callGemini(prompt);
}
function generateCEOFollowUpDay7(company, ceoName, resume) {
  const prompt = `
Write a concise Day-7 follow-up to a CEO.
Start with: <p>Hi ${ceoName},</p>
Offer value; no pressure. HTML only. Resume: ${resume}
Signature: <p>Kind regards,<br><b>Rohit</b></p>`;
  return callGemini(prompt);
}
function generateHRFollowUpDay7(company, hrName, resume) {
  const prompt = `
Write a concise Day-7 follow-up to HR.
Start with: <p>Hi ${hrName},</p>
Polite check-in. HTML only. Resume: ${resume}
Signature: <p>Kind regards,<br><b>Rohit</b></p>`;
  return callGemini(prompt);
}

// -----------------------------
// REPLY & BOUNCE DETECTION (multi-recipient helpers)
// -----------------------------
function checkRepliedByRecipients(list) {
  if (!list || list.length === 0) return false;
  try {
    for (const e of list) { if (GmailApp.search(`from:${e} newer_than:10d`).length > 0) return true; }
  } catch (ignore) {}
  return false;
}
function checkBounceByRecipients(list) {
  if (!list || list.length === 0) return false;
  try {
    for (const e of list) {
      if (GmailApp.search(`subject:"Delivery Status Notification" to:${e} newer_than:10d`).length > 0) return true;
    }
  } catch (ignore) {}
  return false;
}

// -----------------------------
// SUBJECT A/B
// -----------------------------
function chooseSubjectCEO(company) {
  const opts = [`Exploring ways I can contribute to ${company}`, `${company} — Interested in supporting product & engineering`];
  return opts[Math.floor(Math.random() * opts.length)];
}
function chooseSubjectHR(company) {
  const opts = [`Application to contribute to ${company}`, `Exploring opportunities at ${company}`];
  return opts[Math.floor(Math.random() * opts.length)];
}

// -----------------------------
// SEND helper: send to multiple recipients, returns count
// -----------------------------
function sendToMultipleRecipients(list, subject, body, pdfBlob) {
  if (!list || list.length === 0) return 0;
  let sent = 0;
  for (const to of list) {
    try {
      const payload = { to, subject, htmlBody: body };
      if (pdfBlob) payload.attachments = [pdfBlob];
      MailApp.sendEmail(payload);
      sent++;
      Utilities.sleep(2000 + Math.floor(Math.random() * 4000));
      // update counter stored in properties
      const props = PropertiesService.getScriptProperties();
      let c = parseInt(props.getProperty("email_count") || "0", 10);
      c++; props.setProperty("email_count", String(c));
      if (c >= MAX_EMAILS_PER_DAY) break;
    } catch (e) {
      // ignore and continue
    }
  }
  return sent;
}

// -----------------------------
// MAIN: sends Day1 / Day3 / Day7 emails, respects caps & weekends
// -----------------------------
function sendJobApplicationEmails() {
  const today = new Date();
  const wd = today.getDay();
  if (wd === 0 || wd === 6) return;

  const props = PropertiesService.getScriptProperties();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
  let emailCount = parseInt(props.getProperty("email_count") || "0", 10);
  if (props.getProperty("email_count_date") !== todayStr) { emailCount = 0; props.setProperty("email_count_date", todayStr); props.setProperty("email_count", "0"); }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Sheet1");
  const lastRow = sheet.getLastRow();
  const resumeText = getResumeText();
  let resumePDF = null;
  try { resumePDF = getResumePDF(); } catch (e) {}

  try {
    for (let r = 2; r <= lastRow; r++) {
      if (emailCount >= MAX_EMAILS_PER_DAY) { props.setProperty("email_count", String(emailCount)); return; }

      const company = clean(sheet.getRange(r, 1).getValue());
      const category = clean(sheet.getRange(r, 2).getValue());
      const ceoNameRaw = clean(sheet.getRange(r, 3).getValue());
      const ceoEmailRaw = clean(sheet.getRange(r, 4).getValue());
      const hrNameRaw = clean(sheet.getRange(r, 6).getValue());
      const hrEmailRaw = clean(sheet.getRange(r, 7).getValue());
      const ceoName = ceoNameRaw || "Ceo", hrName = hrNameRaw || "HR Team";

      const ceoDay1Cell = sheet.getRange(r, 9), hrDay1Cell = sheet.getRange(r, 10),
            ceoDay3Cell = sheet.getRange(r, 11), hrDay3Cell = sheet.getRange(r, 12),
            ceoDay7Cell = sheet.getRange(r, 13), hrDay7Cell = sheet.getRange(r, 14);

      const day1CeoStatus = sheet.getRange(r, 15), day1HrStatus = sheet.getRange(r, 16), day1DateCell = sheet.getRange(r, 17),
            day3HrStatus = sheet.getRange(r, 18), day3CeoStatus = sheet.getRange(r, 19), day3DateCell = sheet.getRange(r, 20),
            day7HrStatus = sheet.getRange(r, 21), day7CeoStatus = sheet.getRange(r, 22), day7DateCell = sheet.getRange(r, 23),
            hrReplyCell = sheet.getRange(r, 24), ceoReplyCell = sheet.getRange(r, 25);

      const ceoEmails = extractValidEmails(ceoEmailRaw);
      const hrEmails = extractValidEmails(hrEmailRaw);

      if (ceoEmails.length === 0 && hrEmails.length === 0) {
        day1CeoStatus.setValue("SKIPPED"); day1HrStatus.setValue("SKIPPED");
        day3CeoStatus.setValue("SKIPPED"); day3HrStatus.setValue("SKIPPED");
        day7CeoStatus.setValue("SKIPPED"); day7HrStatus.setValue("SKIPPED");
        continue;
      }

      if (checkRepliedByRecipients(ceoEmails)) ceoReplyCell.setValue("YES");
      if (checkRepliedByRecipients(hrEmails)) hrReplyCell.setValue("YES");
      if (hrReplyCell.getValue() === "YES" || ceoReplyCell.getValue() === "YES") continue;
      if (checkBounceByRecipients(ceoEmails) || checkBounceByRecipients(hrEmails)) continue;

      // generate Day1 bodies (just-in-time)
      if (!ceoDay1Cell.getValue() && ceoEmails.length > 0) {
        try { ceoDay1Cell.setValue(generateCEOEmail(company, category, ceoName, resumeText)); }
        catch (e) { if (String(e.message).indexOf("GEMINI_") === 0) throw e; ceoDay1Cell.setValue(`<p>Hi ${ceoName},</p><p>Following up about ways I can help ${company}.</p>`); }
      }
      if (!hrDay1Cell.getValue() && hrEmails.length > 0) {
        try { hrDay1Cell.setValue(generateHREmail(company, category, hrName, resumeText)); }
        catch (e) { if (String(e.message).indexOf("GEMINI_") === 0) throw e; hrDay1Cell.setValue(`<p>Hi ${hrName},</p><p>Following up about open roles.</p>`); }
      }

      // DAY1 send: CEO
      if (day1CeoStatus.getValue() !== "SENT") {
        if (ceoEmails.length > 0) {
          const s = sendToMultipleRecipients(ceoEmails, chooseSubjectCEO(company), ceoDay1Cell.getValue() || "", resumePDF);
          if (s) { day1CeoStatus.setValue("SENT"); day1DateCell.setValue(today); emailCount += s; props.setProperty("email_count", String(emailCount)); if (emailCount >= MAX_EMAILS_PER_DAY) return; }
          else day1CeoStatus.setValue("SKIPPED");
        } else day1CeoStatus.setValue("SKIPPED");
      }

      // DAY1 send: HR
      if (day1HrStatus.getValue() !== "SENT") {
        if (hrEmails.length > 0) {
          const s = sendToMultipleRecipients(hrEmails, chooseSubjectHR(company), hrDay1Cell.getValue() || "", resumePDF);
          if (s) { day1HrStatus.setValue("SENT"); day1DateCell.setValue(today); emailCount += s; props.setProperty("email_count", String(emailCount)); if (emailCount >= MAX_EMAILS_PER_DAY) return; }
          else day1HrStatus.setValue("SKIPPED");
        } else day1HrStatus.setValue("SKIPPED");
      }

      // DAY3 logic
      const d1 = day1DateCell.getValue();
      if (d1 && dateDiffDays(today, new Date(d1)) >= 3) {
        if (!hrDay3Cell.getValue() && hrEmails.length > 0) { try { hrDay3Cell.setValue(generateHRFollowUpDay3(company, hrName, resumeText)); } catch (e) { if (String(e.message).indexOf("GEMINI_") === 0) throw e; hrDay3Cell.setValue(`<p>Hi ${hrName},</p><p>Following up on my application.</p>`); } }
        if (day3HrStatus.getValue() !== "SENT" && hrEmails.length > 0) { const s = sendToMultipleRecipients(hrEmails, "Quick follow-up on my application", hrDay3Cell.getValue() || "", resumePDF); if (s) { day3HrStatus.setValue("SENT"); day3DateCell.setValue(today); emailCount += s; props.setProperty("email_count", String(emailCount)); } else day3HrStatus.setValue("SKIPPED"); }

        if (!ceoDay3Cell.getValue() && ceoEmails.length > 0) { try { ceoDay3Cell.setValue(generateCEOFollowUpDay3(company, ceoName, resumeText)); } catch (e) { if (String(e.message).indexOf("GEMINI_") === 0) throw e; ceoDay3Cell.setValue(`<p>Hi ${ceoName},</p><p>Following up briefly.</p>`); } }
        if (day3CeoStatus.getValue() !== "SENT" && ceoEmails.length > 0) { const s2 = sendToMultipleRecipients(ceoEmails, `Following up on contributing to ${company}`, ceoDay3Cell.getValue() || "", resumePDF); if (s2) { day3CeoStatus.setValue("SENT"); day3DateCell.setValue(today); emailCount += s2; props.setProperty("email_count", String(emailCount)); } else day3CeoStatus.setValue("SKIPPED"); }
      }

      // DAY7 logic
      const d3 = day3DateCell.getValue();
      if (d3 && dateDiffDays(today, new Date(d3)) >= 4) {
        if (!hrDay7Cell.getValue() && hrEmails.length > 0) { try { hrDay7Cell.setValue(generateHRFollowUpDay7(company, hrName, resumeText)); } catch (e) { if (String(e.message).indexOf("GEMINI_") === 0) throw e; hrDay7Cell.setValue(`<p>Hi ${hrName},</p><p>Just checking in once more.</p>`); } }
        if (day7HrStatus.getValue() !== "SENT" && hrEmails.length > 0) { const s3 = sendToMultipleRecipients(hrEmails, "Checking in once more on my application", hrDay7Cell.getValue() || "", resumePDF); if (s3) { day7HrStatus.setValue("SENT"); day7DateCell.setValue(today); emailCount += s3; props.setProperty("email_count", String(emailCount)); } else day7HrStatus.setValue("SKIPPED"); }

        if (!ceoDay7Cell.getValue() && ceoEmails.length > 0) { try { ceoDay7Cell.setValue(generateCEOFollowUpDay7(company, ceoName, resumeText)); } catch (e) { if (String(e.message).indexOf("GEMINI_") === 0) throw e; ceoDay7Cell.setValue(`<p>Hi ${ceoName},</p><p>Checking in — no pressure.</p>`); } }
        if (day7CeoStatus.getValue() !== "SENT" && ceoEmails.length > 0) { const s4 = sendToMultipleRecipients(ceoEmails, `Checking in regarding contributing to ${company}`, ceoDay7Cell.getValue() || "", resumePDF); if (s4) { day7CeoStatus.setValue("SENT"); day7DateCell.setValue(today); emailCount += s4; props.setProperty("email_count", String(emailCount)); } else day7CeoStatus.setValue("SKIPPED"); }
      }
    }
  } catch (e) {
    // Stop on Gemini quota errors to avoid sending partial/invalid content
    if (String(e.message).indexOf("GEMINI_") === 0) { props.setProperty("email_count", String(parseInt(props.getProperty("email_count") || "0", 10))); return; }
    throw e;
  }
  props.setProperty("email_count", String(parseInt(props.getProperty("email_count") || "0", 10)));
}
