// Edit these two lines after the Google Sheet and Apps Script are set up (see README.md).
window.AGENTS_CONFIG = {
  // Master Google Sheet (the "Sheet" button on the home page opens this).
  SHEET_URL: "",
  // Apps Script Web App URL that reads/writes the "Actions" tab (status, notes, stars). Leave blank to save in this browser only.
  SYNC_URL: "https://script.google.com/macros/s/AKfycbwX8hRRsARHsDIe0zpDZCCvCG-G2LHl2GVCwyI9US4Nfpz3TeTDB8IadLyZWCOE6XLWnw/exec",
  // Optional shared secret, must match SECRET in apps_script.gs
  SYNC_KEY: "si4kqc0RwPPYPOclbo98GTEt",
  STATUSES: ["Not contacted", "Contacted", "Replied", "Partner", "Not interested", "Invalid"]
};
