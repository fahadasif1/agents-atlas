"""Geocode UK records via postcodes.io (postcodes/places only are sent; cache in ../geocache_uk.json, outside the repo)."""
import csv, json, os, re, sys, urllib.request, urllib.parse, collections
csv.field_size_limit(10**9)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(ROOT, "geocache_uk.json")
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {"pc": {}, "place": {}}
FULL = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b", re.I)
def norm(m): return f"{m.group(1).upper()} {m.group(2).upper()}"
def post(url, body):
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=30))
def get(url):
    try: return json.load(urllib.request.urlopen(url, timeout=20))
    except Exception: return {}
def uk_rows():
    rows = csv.DictReader(open(os.path.join(ROOT, "global_student_recruitment_agents_classified.csv"), encoding="utf-8-sig"))
    return [r for r in rows if r["Country"] == "United Kingdom"]
def run():
    rows = uk_rows()
    need = sorted({norm(m) for r in rows if (m := FULL.search(r["Office Address"])) and norm(m) not in cache["pc"]})
    for i in range(0, len(need), 100):
        res = post("https://api.postcodes.io/postcodes", {"postcodes": need[i:i+100]})["result"]
        for q in res:
            r = q["result"]; cache["pc"][q["query"]] = [r["latitude"], r["longitude"], r.get("admin_district") or ""] if r else None
        print("postcodes", min(i+100, len(need)), "/", len(need), flush=True)
    # city fallback for rows without a usable postcode
    cities = sorted({r["City"].strip() for r in rows if r["City"].strip() and not ((m := FULL.search(r["Office Address"])) and cache["pc"].get(norm(m)))} - set(cache["place"]))
    for c in cities:
        j = get("https://api.postcodes.io/places?limit=1&q=" + urllib.parse.quote(c))
        p = (j.get("result") or [None])[0]
        cache["place"][c] = [p["latitude"], p["longitude"]] if p and p.get("latitude") else None
    json.dump(cache, open(CACHE, "w"))
    return rows
if __name__ == "__main__":
    run(); print("cached postcodes", len(cache["pc"]), "ok", sum(1 for v in cache["pc"].values() if v), "| places", len(cache["place"]), "ok", sum(1 for v in cache["place"].values() if v))
