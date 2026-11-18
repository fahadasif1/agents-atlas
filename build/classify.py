"""Classify the master CSV by country/region and emit: working SQLite, sorted classified CSV, web JSON shards."""
import csv, json, os, re, sqlite3, sys, collections
sys.path.insert(0, os.path.dirname(__file__))
from geo import *

csv.field_size_limit(10**9)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "global_student_recruitment_agents.csv")
OUT_CSV = os.path.join(ROOT, "global_student_recruitment_agents_classified.csv")
OUT_DB = os.path.join(ROOT, "agents_working.sqlite")
DATA = os.path.join(ROOT, "_plain_data")  # plaintext stays OUTSIDE the repo; build/encrypt.py writes agents_site/data
os.makedirs(DATA, exist_ok=True)

rows = list(csv.DictReader(open(SRC, encoding="utf-8-sig")))
orig_cols = list(rows[0].keys())

def office(r):
    a = r["Office Address"]
    c = country_from_address(a)
    if c: return c, "address"
    if a and AU_STATE.search(a): return "Australia", "address"
    c = country_from_phone(r["Phone"])
    if c: return c, "phone"
    for f in ("Website", "Public Email"):
        c = country_from_domain(r[f])
        if c: return c, "domain"
    c = country_from_city(r["City"], a)
    if c: return c, "city"
    return None, None

NEW = ["Country", "Region", "Subregion", "Country Basis", "Office Country", "All Markets",
       "Has Email", "Has Phone", "Has Website", "Display Name", "Quality Score"]
for r in rows:
    mk = split_countries(r["Listed Market"])
    ms = split_countries(r["Markets Served"])
    oc, ob = office(r)
    if mk:   country, basis = mk[0], "Listed market"
    elif ms: country, basis = ms[0], "Markets served"
    elif oc: country, basis = oc, "Office " + ob
    else:    country, basis = "", "Unclassified"
    r["Country"] = country
    g = C.get(country)
    r["Region"] = g[2] if g else "Unclassified"
    r["Subregion"] = g[3] if g else "Unclassified"
    r["Country Basis"] = basis
    r["Office Country"] = oc or ""
    r["All Markets"] = "; ".join(dict.fromkeys(mk + ms))
    r["Has Email"] = "Yes" if r["Public Email"].strip() else ""
    r["Has Phone"] = "Yes" if r["Phone"].strip() else ""
    r["Has Website"] = "Yes" if r["Website"].strip() else ""
    r["Display Name"] = (r["Agency Name"] or r["Affiliated Agency"] or r["Contact Person"]).strip()
    r["Quality Score"] = str(sum(bool(r[k].strip()) for k in
        ("Agency Name", "Public Email", "Phone", "Website", "Office Address", "City", "Contact Person")))

rows.sort(key=lambda r: (r["Region"] == "Unclassified", r["Region"], r["Country"], r["City"], r["Display Name"].lower()))
cols = orig_cols[:1] + ["Region", "Subregion", "Country", "Office Country", "City", "Display Name"] + \
       [c for c in orig_cols[1:] if c != "City"] + ["All Markets", "Country Basis", "Has Email", "Has Phone", "Has Website", "Quality Score"]
cols = list(dict.fromkeys(cols))

with open(OUT_CSV, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore"); w.writeheader(); w.writerows(rows)

# --- SQLite working copy
if os.path.exists(OUT_DB): os.remove(OUT_DB)
db = sqlite3.connect(OUT_DB)
db.execute("CREATE TABLE agents (" + ", ".join(f'"{c}" TEXT' for c in cols) + ")")
db.executemany("INSERT INTO agents VALUES (" + ",".join("?" * len(cols)) + ")", [[r[c] for c in cols] for r in rows])
for c in ("Record ID", "Region", "Country", "Record Type", "Duplicate Check ID"):
    db.execute(f'CREATE INDEX "ix_{c.replace(" ","_")}" ON agents("{c}")')
db.commit(); db.close()

# --- Web shards: compact column-array JSON per country
WEB_COLS = ["Record ID", "Display Name", "Record Type", "City", "Listed Region", "Office Address", "Website", "Public Email",
            "Phone", "Contact Person", "Affiliated Agency", "Recruitment Destination", "Source Type", "Source URL",
            "Source Checked Date", "Office Country", "All Markets", "Other Public Emails", "Quality Score",
            "Contact Status", "Data Completeness", "Individual Role Evidence", "Group/Legal Name", "Trading Name",
            "Additional Source URLs"]
by = collections.defaultdict(list)
for r in rows: by[r["Country"] or "Unclassified"].append(r)
manifest = []
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
for country, rs in by.items():
    fn = f"c-{slug(country)}.json"
    json.dump({"cols": WEB_COLS, "rows": [[r[c] for c in WEB_COLS] for r in rs]},
              open(os.path.join(DATA, fn), "w"), separators=(",", ":"), ensure_ascii=False)
    g = C.get(country)
    typ = collections.Counter(r["Record Type"] for r in rs)
    manifest.append({"country": country, "iso": g[0] if g else "", "region": rs[0]["Region"], "subregion": rs[0]["Subregion"],
        "file": fn, "n": len(rs), "email": sum(1 for r in rs if r["Has Email"]), "phone": sum(1 for r in rs if r["Has Phone"]),
        "web": sum(1 for r in rs if r["Has Website"]), "agencies": typ["Agency"] + typ["Agency/office"], "individuals": typ["Individual"]})
manifest.sort(key=lambda m: -m["n"])
json.dump({"generated": "2026-11-14", "total": len(rows), "countries": manifest}, open(os.path.join(DATA, "manifest.json"), "w"), separators=(",", ":"))

reg = collections.Counter(r["Region"] for r in rows)
print("total", len(rows)); print(reg.most_common())
print("unclassified", reg["Unclassified"], "| basis", collections.Counter(r["Country Basis"] for r in rows).most_common())
print("shards", len(manifest), "bytes", sum(os.path.getsize(os.path.join(DATA, m["file"])) for m in manifest))

# --- progress.json: aggregate cube for the Progress view
import datetime
cube = collections.defaultdict(lambda: [0,0,0,0,0,0])
for r in rows:
    k = (r["Region"], r["Record Type"], r["Source Type"][:90], r["Country Basis"])
    a = cube[k]; a[0] += 1; a[1] += r["Region"] != "Unclassified"; a[2] += bool(r["Has Email"]); a[3] += bool(r["Has Phone"]); a[4] += bool(r["Has Website"]); a[5] += bool(r["Contact Person"].strip())
src_mtime = datetime.datetime.fromtimestamp(os.path.getmtime(SRC)).strftime("%Y-%m-%d %H:%M")
json.dump({"built": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), "source_modified": src_mtime, "total": len(rows),
           "cols": ["region","type","source","basis","n","classified","email","phone","web","contact"],
           "cube": [list(k)+v for k,v in cube.items()]}, open(os.path.join(DATA, "progress.json"), "w"), separators=(",", ":"))
