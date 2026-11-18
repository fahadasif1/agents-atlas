# Agents Atlas (atlas.convosoft.uk)

Static site: `index.html`, `app.js`, `style.css`, `config.js`, `vendor/`, `data/` (per-country JSON shards + `manifest.json`).

## Rebuild the data
`python3 -I build/classify.py` reads `../global_student_recruitment_agents.csv` and writes
- `../global_student_recruitment_agents_classified.csv` (sorted by Region > Country > City; adds Region, Subregion, Country, Office Country, All Markets, Country Basis, Has Email/Phone/Website, Display Name, Quality Score)
- `../agents_working.sqlite` (working copy, table `agents`)
- `data/*.json` (site shards)

## Run locally
`python3 -m http.server 8765` in this folder, open http://127.0.0.1:8765

## Google Sheet backend
1. Import `global_student_recruitment_agents_classified.csv` into a new Google Sheet (File > Import). Put the URL in `config.js` as `SHEET_URL`.
2. Extensions > Apps Script: paste `apps_script.gs`, set `SECRET`, deploy as Web app, put the URL in `SYNC_URL` and the secret in `SYNC_KEY`.
3. Status/notes/stars/tags/owner then sync to an `Actions` tab keyed by Record ID.

## Access
The data contains 36k+ public contact emails. Do not host it on an open URL without an access gate (e.g. Cloudflare Access).
