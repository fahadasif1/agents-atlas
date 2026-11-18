"""Geo reference: canonical countries -> ISO2, dial code, world region, plus aliases."""
import re

# name: (iso2, dial, region, subregion)
C = {}
def add(region, sub, items):
    for name, iso, dial in items:
        C[name] = (iso, dial, region, sub)

add("Oceania","Australia & NZ",[("Australia","AU","61"),("New Zealand","NZ","64")])
add("Oceania","Pacific",[("Fiji","FJ","679"),("Papua New Guinea","PG","675"),("Samoa","WS","685"),("Vanuatu","VU","678"),("New Caledonia","NC","687"),("Tonga","TO","676"),("Solomon Islands","SB","677")])
add("Asia","South Asia",[("India","IN","91"),("Pakistan","PK","92"),("Bangladesh","BD","880"),("Nepal","NP","977"),("Sri Lanka","LK","94"),("Bhutan","BT","975"),("Maldives","MV","960"),("Afghanistan","AF","93")])
add("Asia","East Asia",[("China","CN","86"),("Hong Kong","HK","852"),("Macau","MO","853"),("Taiwan","TW","886"),("Japan","JP","81"),("South Korea","KR","82"),("North Korea","KP","850"),("Mongolia","MN","976")])
add("Asia","Southeast Asia",[("Indonesia","ID","62"),("Malaysia","MY","60"),("Singapore","SG","65"),("Thailand","TH","66"),("Vietnam","VN","84"),("Philippines","PH","63"),("Cambodia","KH","855"),("Laos","LA","856"),("Myanmar","MM","95"),("Brunei","BN","673")])
add("Asia","Central Asia & Caucasus",[("Kazakhstan","KZ","7"),("Uzbekistan","UZ","998"),("Kyrgyzstan","KG","996"),("Tajikistan","TJ","992"),("Turkmenistan","TM","993"),("Azerbaijan","AZ","994"),("Armenia","AM","374"),("Georgia","GE","995")])
add("Middle East & North Africa","Middle East",[("United Arab Emirates","AE","971"),("Saudi Arabia","SA","966"),("Qatar","QA","974"),("Kuwait","KW","965"),("Bahrain","BH","973"),("Oman","OM","968"),("Jordan","JO","962"),("Lebanon","LB","961"),("Iraq","IQ","964"),("Iran","IR","98"),("Israel","IL","972"),("Palestine","PS","970"),("Syria","SY","963"),("Yemen","YE","967"),("Turkey","TR","90")])
add("Middle East & North Africa","North Africa",[("Egypt","EG","20"),("Morocco","MA","212"),("Algeria","DZ","213"),("Tunisia","TN","216"),("Libya","LY","218"),("Sudan","SD","249")])
add("Africa","West Africa",[("Nigeria","NG","234"),("Ghana","GH","233"),("Ivory Coast","CI","225"),("Senegal","SN","221"),("Mali","ML","223"),("Gambia","GM","220"),("Sierra Leone","SL","232"),("Togo","TG","228"),("Benin","BJ","229"),("Niger","NE","227"),("Guinea","GN","224"),("Cape Verde","CV","238"),("Liberia","LR","231")])
add("Africa","East Africa",[("Kenya","KE","254"),("Uganda","UG","256"),("Tanzania","TZ","255"),("Rwanda","RW","250"),("Burundi","BI","257"),("Ethiopia","ET","251"),("Somalia","SO","252"),("Mauritius","MU","230"),("Seychelles","SC","248"),("Madagascar","MG","261")])
add("Africa","Southern & Central Africa",[("South Africa","ZA","27"),("Zimbabwe","ZW","263"),("Zambia","ZM","260"),("Botswana","BW","267"),("Namibia","NA","264"),("Malawi","MW","265"),("Mozambique","MZ","258"),("Angola","AO","244"),("Cameroon","CM","237"),("Gabon","GA","241"),("Republic of the Congo","CG","242"),("DR Congo","CD","243"),("Eswatini","SZ","268")])
add("Europe","UK & Ireland",[("United Kingdom","GB","44"),("Ireland","IE","353"),("Jersey","JE","44"),("Guernsey","GG","44"),("Isle of Man","IM","44")])
add("Europe","Western Europe",[("France","FR","33"),("Germany","DE","49"),("Netherlands","NL","31"),("Belgium","BE","32"),("Switzerland","CH","41"),("Austria","AT","43"),("Luxembourg","LU","352")])
add("Europe","Southern Europe",[("Spain","ES","34"),("Italy","IT","39"),("Portugal","PT","351"),("Greece","GR","30"),("Cyprus","CY","357"),("Malta","MT","356")])
add("Europe","Northern Europe",[("Sweden","SE","46"),("Norway","NO","47"),("Denmark","DK","45"),("Finland","FI","358"),("Iceland","IS","354"),("Estonia","EE","372"),("Latvia","LV","371"),("Lithuania","LT","370")])
add("Europe","Central & Eastern Europe",[("Poland","PL","48"),("Czechia","CZ","420"),("Slovakia","SK","421"),("Hungary","HU","36"),("Romania","RO","40"),("Bulgaria","BG","359"),("Russia","RU","7"),("Ukraine","UA","380"),("Belarus","BY","375"),("Moldova","MD","373"),("Serbia","RS","381"),("Croatia","HR","385"),("Slovenia","SI","386"),("Bosnia and Herzegovina","BA","387"),("North Macedonia","MK","389"),("Albania","AL","355"),("Kosovo","XK","383"),("Montenegro","ME","382")])
add("North America","North America",[("United States","US","1"),("Canada","CA","1"),("Mexico","MX","52")])
add("Latin America & Caribbean","Central America & Caribbean",[("Costa Rica","CR","506"),("Panama","PA","507"),("Guatemala","GT","502"),("Honduras","HN","504"),("El Salvador","SV","503"),("Nicaragua","NI","505"),("Belize","BZ","501"),("Cuba","CU","53"),("Dominican Republic","DO","1809"),("Haiti","HT","509"),("Jamaica","JM","1876"),("Puerto Rico","PR","1787"),("Trinidad and Tobago","TT","1868"),("Bahamas","BS","1242"),("Barbados","BB","1246"),("Bermuda","BM","1441"),("Cayman Islands","KY","1345"),("British Virgin Islands","VG","1284"),("US Virgin Islands","VI","1340")])
add("Latin America & Caribbean","South America",[("Brazil","BR","55"),("Argentina","AR","54"),("Chile","CL","56"),("Colombia","CO","57"),("Peru","PE","51"),("Ecuador","EC","593"),("Bolivia","BO","591"),("Venezuela","VE","58"),("Uruguay","UY","598"),("Paraguay","PY","595")])

ISO2NAME = {v[0]: k for k, v in C.items()}
ALIAS = {
 "usa":"United States","us":"United States","u.s.a.":"United States","united states of america":"United States","america":"United States",
 "uk":"United Kingdom","u.k.":"United Kingdom","great britain":"United Kingdom","england":"United Kingdom","scotland":"United Kingdom","wales":"United Kingdom","northern ireland":"United Kingdom","uk international":"United Kingdom",
 "uae":"United Arab Emirates","u.a.e":"United Arab Emirates","türkiye":"Turkey","turkiye":"Turkey","china prc":"China","china (prc)":"China","china (pr)":"China","0-china":"China","prc":"China","people's republic of china":"China","china (excludes sars and taiwan)":"China","mainland china":"China",
 "hong kong sar":"Hong Kong","hong kong (sar)":"Hong Kong","hong kong (sar of china)":"Hong Kong","hong kong (sar) and macao (sar)":"Hong Kong","sar of china":"Hong Kong","macao":"Macau","macau sar":"Macau","macao sar":"Macau",
 "korea":"South Korea","korea (south)":"South Korea","korea, republic of":"South Korea","republic of korea":"South Korea","s. korea":"South Korea",
 "viet nam":"Vietnam","laos pdr":"Laos","lao people’s democratic republic":"Laos","lao pdr":"Laos","myanmar (burma)":"Myanmar","burma":"Myanmar","brunei darussalam":"Brunei","malayasia":"Malaysia","kazahstan":"Kazakhstan",
 "czech republic":"Czechia","macedonia":"North Macedonia","macedonia (north)":"North Macedonia","republic of moldova":"Moldova","russian federation":"Russia","bosnia & herzegovina":"Bosnia and Herzegovina",
 "cote d'ivoire":"Ivory Coast","côte d'ivoire":"Ivory Coast","cote d’ivoire":"Ivory Coast","the gambia":"Gambia","swaziland":"Eswatini","republic of cameroon":"Cameroon","congo":"Republic of the Congo",
 "democratic republic of the congo":"DR Congo","dem rep of the congo":"DR Congo","d.r. congo":"DR Congo","palestinian territories":"Palestine","state of palestine":"Palestine",
 "trinidad":"Trinidad and Tobago","trinidad and tobago":"Trinidad and Tobago","virgin islands (british)":"British Virgin Islands","virgin islands (u.s.)":"US Virgin Islands","channel islands":"Jersey",
 "philipines":"Philippines","srilanka":"Sri Lanka","the netherlands":"Netherlands","holland":"Netherlands","nz":"New Zealand","aus":"Australia",
}
NAMES = {k.lower(): k for k in C}
NAMES.update(ALIAS)

def norm_country(s):
    if not s: return None
    t = re.sub(r"\s+", " ", s.strip()).lower().strip(" .,;")
    return NAMES.get(t)

def split_countries(s):
    """Split multi-country string -> list of canonical countries (unknown tokens dropped)."""
    out = []
    for tok in re.split(r"[;,/]|\band\b(?![ ]herz)", s or ""):
        c = norm_country(tok)
        if c and c not in out: out.append(c)
    # multi-word names containing commas ('Korea, Republic of') / 'Trinidad And Tobago'
    whole = norm_country(s)
    if whole: return [whole]
    return out

# longest-first dial codes (ambiguous: '1' -> US, '7' -> RU, '44' -> GB)
DIAL = {}
for n,(iso,d,_,_) in C.items():
    if n in ("Jersey","Guernsey","Isle of Man","Canada"): continue
    DIAL.setdefault(d, n)
DIAL["1"] = "United States"; DIAL["7"] = "Russia"
DIAL_KEYS = sorted(DIAL, key=len, reverse=True)

def country_from_phone(p):
    if not p: return None
    d = re.sub(r"[^\d+]", "", p)
    if d.startswith("+"): d = d[1:]
    elif d.startswith("00"): d = d[2:]
    else: return None
    for k in DIAL_KEYS:
        if d.startswith(k): return DIAL[k]
    return None

TLD = {v[0].lower(): k for k, v in C.items()}
TLD.update({"uk":"United Kingdom","gb":"United Kingdom","ac":None})
def country_from_domain(s):
    if not s: return None
    m = re.search(r"([a-z0-9-]+)((?:\.[a-z]{2,3}){1,2})\b[/\s]*$", s.lower().split("@")[-1].split("/")[0] if "@" in s else re.sub(r"^https?://", "", s.lower()).split("/")[0])
    if not m: return None
    tld = m.group(2).split(".")[-1]
    return TLD.get(tld)

# word-boundary country scan inside free-text address (longest names first)
_ADDR_NAMES = sorted(set(list(NAMES.keys())), key=len, reverse=True)
_ADDR_NAMES = [n for n in _ADDR_NAMES if len(n) >= 4 and n not in ("georgia","jersey","niger","guinea","congo","america","holland","burma","aus","india ")]
_ADDR_RE = re.compile(r"(?<![a-z])(" + "|".join(re.escape(n) for n in _ADDR_NAMES) + r")(?![a-z])")
def country_from_address(a):
    if not a: return None
    t = a.lower()
    hits = [(m.start(), m.group(1)) for m in _ADDR_RE.finditer(t)]
    if hits:
        return NAMES[hits[-1][1]]  # last mention = country part
    return None

AU_STATE = re.compile(r"\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b\.?,?\s*(\d{4})\b|\b(New South Wales|Victoria|Queensland|Western Australia|South Australia|Tasmania)\b,?\s*(\d{4})\b", re.I)
UK_PC = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b")

# City -> country for records with a city/address but no country text
CITY = {}
for _c, _names in {
 "Australia": "sydney melbourne brisbane perth adelaide canberra hobart darwin gold coast parramatta newcastle wollongong geelong cairns townsville",
 "New Zealand": "auckland wellington christchurch hamilton dunedin tauranga",
 "United Kingdom": "london manchester birmingham leeds liverpool glasgow edinburgh cardiff bristol sheffield nottingham leicester coventry belfast",
 "India": "delhi new delhi mumbai bangalore bengaluru chennai hyderabad kolkata pune ahmedabad jaipur chandigarh ludhiana jalandhar amritsar",
 "Pakistan": "lahore karachi islamabad rawalpindi faisalabad multan peshawar",
 "Nepal": "kathmandu pokhara lalitpur biratnagar butwal chitwan",
 "China": "beijing shanghai guangzhou shenzhen chengdu wuhan hangzhou nanjing xi'an tianjin chongqing",
 "Vietnam": "hanoi ho chi minh saigon da nang",
 "Bangladesh": "dhaka chittagong sylhet", "Sri Lanka": "colombo kandy",
 "Nigeria": "lagos abuja kano ibadan port harcourt", "Ghana": "accra kumasi", "Kenya": "nairobi mombasa",
 "United Arab Emirates": "dubai abu dhabi sharjah", "Saudi Arabia": "riyadh jeddah mecca", "Egypt": "cairo alexandria",
 "Turkey": "istanbul ankara izmir", "Malaysia": "kuala lumpur penang johor", "Indonesia": "jakarta surabaya bandung",
 "Thailand": "bangkok chiang mai", "Philippines": "manila cebu davao", "Singapore": "singapore",
 "Canada": "toronto vancouver montreal calgary ottawa", "United States": "new york los angeles chicago houston san francisco",
 "Brazil": "sao paulo rio de janeiro", "Colombia": "bogota medellin", "Mexico": "mexico city guadalajara",
 "Czechia": "prague", "Hungary": "budapest", "Poland": "warsaw", "Russia": "moscow", "Ukraine": "kyiv kiev",
 "South Korea": "seoul busan", "Japan": "tokyo osaka", "Hong Kong": "hong kong kowloon",
}.items():
    pass
_CITYMAP = {
 "Australia": ["sydney","melbourne","brisbane","perth","adelaide","canberra","hobart","darwin","gold coast","parramatta","newcastle","wollongong","geelong","cairns","townsville"],
 "New Zealand": ["auckland","wellington","christchurch","hamilton","dunedin","tauranga"],
 "United Kingdom": ["london","manchester","birmingham","leeds","liverpool","glasgow","edinburgh","cardiff","bristol","sheffield","nottingham","leicester","coventry","belfast"],
 "India": ["delhi","new delhi","mumbai","bangalore","bengaluru","chennai","hyderabad","kolkata","pune","ahmedabad","jaipur","chandigarh","ludhiana","jalandhar","amritsar"],
 "Pakistan": ["lahore","karachi","islamabad","rawalpindi","faisalabad","multan","peshawar"],
 "Nepal": ["kathmandu","pokhara","lalitpur","biratnagar","butwal","chitwan"],
 "China": ["beijing","shanghai","guangzhou","shenzhen","chengdu","wuhan","hangzhou","nanjing","tianjin","chongqing"],
 "Vietnam": ["hanoi","ho chi minh","saigon","da nang"], "Bangladesh": ["dhaka","chittagong","sylhet"], "Sri Lanka": ["colombo","kandy"],
 "Nigeria": ["lagos","abuja","kano","ibadan","port harcourt"], "Ghana": ["accra","kumasi"], "Kenya": ["nairobi","mombasa"],
 "United Arab Emirates": ["dubai","abu dhabi","sharjah"], "Saudi Arabia": ["riyadh","jeddah","mecca"], "Egypt": ["cairo","alexandria"],
 "Turkey": ["istanbul","ankara","izmir"], "Malaysia": ["kuala lumpur","penang","johor"], "Indonesia": ["jakarta","surabaya","bandung"],
 "Thailand": ["bangkok","chiang mai"], "Philippines": ["manila","cebu","davao"], "Singapore": ["singapore"],
 "Canada": ["toronto","vancouver","montreal","calgary","ottawa"], "United States": ["new york","los angeles","chicago","houston","san francisco"],
 "Brazil": ["sao paulo","rio de janeiro"], "Colombia": ["bogota","medellin"], "Mexico": ["mexico city","guadalajara"],
 "Czechia": ["prague"], "Hungary": ["budapest"], "Poland": ["warsaw"], "Russia": ["moscow"], "Ukraine": ["kyiv","kiev"],
 "South Korea": ["seoul","busan"], "Japan": ["tokyo","osaka"], "Hong Kong": ["hong kong","kowloon"],
}
for _c, _l in _CITYMAP.items():
    for _n in _l: CITY[_n] = _c
_CITY_RE = re.compile(r"(?<![a-z])(" + "|".join(sorted(map(re.escape, CITY), key=len, reverse=True)) + r")(?![a-z])")
def country_from_city(city, addr):
    c = (city or "").strip().lower()
    if c in CITY: return CITY[c]
    hits = _CITY_RE.findall((addr or "").lower())
    return CITY[hits[-1]] if hits else None
