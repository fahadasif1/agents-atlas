"""Write _plain_data/pk.json: Pakistan agents placed by neighbourhood (where the address names one) or city. No external lookups."""
import csv, json, os, re, zlib
csv.field_size_limit(10**9)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CITIES = {  # name: (lat, lng)
"Lahore":(31.5204,74.3587),"Karachi":(24.8607,67.0011),"Islamabad":(33.6844,73.0479),"Rawalpindi":(33.5651,73.0169),"Faisalabad":(31.4504,73.1350),
"Multan":(30.1575,71.5249),"Gujranwala":(32.1877,74.1945),"Sialkot":(32.4945,74.5229),"Peshawar":(34.0151,71.5249),"Quetta":(30.1798,66.9750),
"Hyderabad":(25.3960,68.3578),"Sargodha":(32.0836,72.6711),"Bahawalpur":(29.3956,71.6836),"Sukkur":(27.7052,68.8574),"Gujrat":(32.5731,74.0750),
"Abbottabad":(34.1688,73.2215),"Sahiwal":(30.6682,73.1114),"Jhelum":(32.9425,73.7257),"Mirpur":(33.1478,73.7518),"Burewala":(30.1667,72.6500),
"Hafizabad":(32.0709,73.6880),"Mandi Bahauddin":(32.5861,73.4917),"Chakwal":(32.9328,72.8630),"Mardan":(34.1989,72.0231),"Sheikhupura":(31.7167,73.9850),
"Kasur":(31.1156,74.4467),"Okara":(30.8081,73.4458),"Rahim Yar Khan":(28.4202,70.2952),"Dera Ghazi Khan":(30.0561,70.6403),"Larkana":(27.5600,68.2264),
"Mingora":(34.7717,72.3600),"Swat":(34.7717,72.3600),"Muzaffarabad":(34.3700,73.4711),"Gilgit":(35.9208,74.3080),"Wah Cantt":(33.7715,72.7511),"Taxila":(33.7463,72.8397),
"Attock":(33.7660,72.3609),"Kamoke":(31.9758,74.2236),"Nowshera":(34.0153,71.9747),"Bannu":(32.9889,70.6056),"Kohat":(33.5869,71.4414),"Jhang":(31.2681,72.3181),
"Sadiqabad":(28.3062,70.1306),"Khanewal":(30.3017,71.9321),"Vehari":(30.0453,72.3489),"Dera Ismail Khan":(31.8626,70.9019),"Mianwali":(32.5839,71.5370),
"Narowal":(32.1019,74.8731),"Lodhran":(29.5339,71.6324),"Gojra":(31.1500,72.6833),"Toba Tek Singh":(30.9709,72.4826),"Chiniot":(31.7292,72.9822),
"Khushab":(32.2954,72.3489),"Bhakkar":(31.6258,71.0654),"Layyah":(30.9693,70.9428),"Mansehra":(34.3333,73.2000),"Haripur":(33.9946,72.9337),"Murree":(33.9070,73.3943),
"Nawabshah":(26.2442,68.4100),"Mirpurkhas":(25.5269,69.0159),"Gwadar":(25.1216,62.3254),"Turbat":(26.0012,63.0544),"Khuzdar":(27.8000,66.6167),
"Kotli":(33.5184,73.9022),"Bhimber":(32.9746,74.0780),"Rawalakot":(33.8578,73.7604),"Daska":(32.3242,74.3503),"Wazirabad":(32.4432,74.1200),"Jauharabad":(32.2900,72.2800),
"Pakpattan":(30.3436,73.3894),"Muridke":(31.8026,74.2576),"Kharian":(32.8161,73.8647),"Swabi":(34.1200,72.4700),"Charsadda":(34.1453,71.7308),"Chitral":(35.8518,71.7864),
}
CITIES["Rawalpindi Cantt"]=CITIES["Rawalpindi"]; CITIES["Lahore Cantt"]=CITIES["Lahore"]
AREAS = {
"Lahore":{"Gulberg":(31.5120,74.3470),"DHA":(31.4800,74.4000),"Johar Town":(31.4697,74.2728),"Model Town":(31.4833,74.3167),"Bahria Town":(31.3680,74.1850),
 "Garden Town":(31.4960,74.3190),"Wapda Town":(31.4380,74.2650),"Iqbal Town":(31.5100,74.2900),"Faisal Town":(31.4870,74.3040),"Mall Road":(31.5600,74.3300),
 "Anarkali":(31.5680,74.3100),"Cantt":(31.5300,74.3800),"Township":(31.4500,74.3000),"Shadman":(31.5330,74.3300),"Samanabad":(31.5300,74.2900),"Valencia":(31.4000,74.2300),
 "Ferozepur Road":(31.4900,74.3300),"Kalma Chowk":(31.5000,74.3330),"Liberty":(31.5100,74.3430),"Raiwind Road":(31.4000,74.2400),"Allama Iqbal Town":(31.5100,74.2900),"Cavalry Ground":(31.5080,74.3700),"Barkat Market":(31.4980,74.3200)},
"Karachi":{"Clifton":(24.8138,67.0300),"DHA":(24.8200,67.0600),"Gulshan-e-Iqbal":(24.9200,67.0900),"Gulshan":(24.9200,67.0900),"Saddar":(24.8570,67.0100),"PECHS":(24.8700,67.0600),
 "Bahadurabad":(24.8800,67.0700),"North Nazimabad":(24.9400,67.0400),"Gulistan-e-Jauhar":(24.9100,67.1300),"Jauhar":(24.9100,67.1300),"Tariq Road":(24.8750,67.0600),
 "Shahrah-e-Faisal":(24.8700,67.0800),"Nazimabad":(24.9100,67.0300),"Malir":(24.8900,67.2000),"Bahria Town":(25.0100,67.3100),"Korangi":(24.8300,67.1300),"Defence":(24.8200,67.0600),"Shahra-e-Faisal":(24.8700,67.0800)},
"Islamabad":{"Blue Area":(33.7100,73.0600),"F-6":(33.7290,73.0780),"F-7":(33.7200,73.0560),"F-8":(33.7100,73.0370),"F-10":(33.6960,73.0130),"F-11":(33.6840,72.9890),
 "G-6":(33.7120,73.0900),"G-8":(33.6980,73.0510),"G-9":(33.6940,73.0360),"G-10":(33.6800,73.0120),"G-11":(33.6700,72.9900),"G-13":(33.6500,72.9650),"I-8":(33.6650,73.0750),"I-9":(33.6570,73.0450),
 "I-10":(33.6480,73.0300),"E-11":(33.7100,72.9760),"DHA":(33.5400,73.1200),"Bahria Town":(33.5200,73.1300),"Gulberg":(33.6500,73.1600),"PWD":(33.5700,73.1400),"H-13":(33.6400,72.9900)},
"Rawalpindi":{"Satellite Town":(33.6300,73.0700),"Saddar":(33.5950,73.0480),"Chaklala":(33.6000,73.0900),"Bahria Town":(33.5300,73.1100),"DHA":(33.5100,73.1300),"Commercial Market":(33.6100,73.0600),"Murree Road":(33.6100,73.0600)},
}
def spread(key, km):  # deterministic offset so pins at one place don't stack
    h = zlib.crc32(key.encode()); import math
    a = (h & 0xffff) / 0xffff * 2 * math.pi; d = ((h >> 16) & 0xffff) / 0xffff
    d = math.sqrt(d) * km
    return d * math.sin(a) / 110.57, d * math.cos(a) / 111.32
def word(t, name): return re.search(r"(?<![A-Za-z])" + re.escape(name) + r"(?![A-Za-z])", t, re.I)
CK = sorted(CITIES, key=len, reverse=True)
rows = [r for r in csv.DictReader(open(os.path.join(ROOT, "global_student_recruitment_agents_classified.csv"), encoding="utf-8-sig")) if r["Country"] == "Pakistan"]
COLS = ["Record ID", "Display Name", "Record Type", "Office Address", "City", "Phone", "Public Email", "Website", "Contact Person", "Affiliated Agency", "Recruitment Destination"]
out = []; cnt = {"area": 0, "city": 0, "none": 0}
for r in rows:
    t = r["City"] + " | " + r["Office Address"]
    hits = [(m.start(), -len(c), c) for c in CK if (m := word(t, c))]
    city = min(hits)[2] if hits else None
    if not city: cnt["none"] += 1; continue
    base = CITIES[city]; area = ""; prec = "city"; km = 4.0
    ak = AREAS.get("Lahore" if city == "Lahore Cantt" else city, {})
    for a in sorted(ak, key=len, reverse=True):
        if word(t, a): base, area, prec, km = ak[a], a, "area", 0.7; break
    dla, dln = spread(r["Record ID"], km)
    m = re.search(r"(?<!\d)(\d{5})(?!\d)", r["Office Address"])
    out.append([r[c] for c in COLS] + [m.group(1) if m else "", round(base[0] + dla, 5), round(base[1] + dln, 5), prec, (area + ", " if area else "") + city])
    cnt[prec] += 1
places = [[n, v[0], v[1], 11] for n, v in CITIES.items()] + [[a + ", " + c, v[0], v[1], 14] for c, d in AREAS.items() for a, v in d.items()]
os.makedirs(os.path.join(ROOT, "_plain_data"), exist_ok=True)
json.dump({"cols": COLS + ["Postcode", "lat", "lng", "prec", "area"], "rows": out, "places": places}, open(os.path.join(ROOT, "_plain_data", "pk.json"), "w"), separators=(",", ":"), ensure_ascii=False)
print("pk.json", len(out), "of", len(rows), cnt)
