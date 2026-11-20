"""Write _plain_data/uk.json: UK agents with coordinates (postcode-precise where possible, else city centre)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import geocode_uk as g
rows = g.run(); cache = g.cache
COLS = ["Record ID", "Display Name", "Record Type", "Office Address", "City", "Phone", "Public Email", "Website", "Contact Person", "Affiliated Agency", "Recruitment Destination"]
ok = lambda la, ln: la is not None and ln is not None and 49.8 <= la <= 60.95 and -8.7 <= ln <= 1.9
out = []; prec = {"postcode": 0, "city": 0, "none": 0}
for r in rows:
    m = g.FULL.search(r["Office Address"]); pc = g.norm(m) if m else ""
    hit = cache["pc"].get(pc) if pc else None
    if hit and ok(hit[0], hit[1]): la, ln, p, area = hit[0], hit[1], "postcode", hit[2]
    else:
        pl = cache["place"].get(r["City"].strip()); pc = pc if hit else ""
        if pl and ok(*pl): la, ln, p, area = pl[0], pl[1], "city", ""
        else: prec["none"] += 1; continue
    prec[p] += 1
    out.append([r[c] for c in COLS] + [pc, round(la, 5), round(ln, 5), p, area])
json.dump({"cols": COLS + ["Postcode", "lat", "lng", "prec", "area"], "rows": out}, open(os.path.join(g.ROOT, "_plain_data", "uk.json"), "w"), separators=(",", ":"), ensure_ascii=False)
print("uk.json", len(out), prec)
