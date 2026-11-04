"""Download real independent businesses in a few Newcastle and Gateshead areas and save them with made-up names.

Run once with:  uv run scripts/fetch_real_data.py
It writes data/real_businesses.json, which the app loads on start.

Sources:
  - OpenStreetMap (Overpass API): business type, location, whether a website is listed.
    © OpenStreetMap contributors, licensed under the ODbL.
  - Food Standards Agency ratings API: food hygiene rating for food businesses.
    Contains public sector information licensed under the Open Government Licence v3.0.

Real names are only used in memory to match the two sources, and are never saved.
"""

import difflib
import json
import math
import random
import time
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).parent.parent / "data" / "real_businesses.json"

AREAS = {
    "Heaton": (54.9800, -1.5830),
    "Jesmond": (54.9845, -1.6050),
    "Ouseburn": (54.9735, -1.5960),
    "Gateshead": (54.9620, -1.6010),
}
OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
RADIUS_M = 600
PER_AREA = 25

FOOD = {"cafe", "restaurant", "fast_food", "pub", "bar", "bakery", "butcher", "deli",
        "greengrocer", "convenience", "confectionery", "ice_cream", "pastry", "seafood"}

TYPE_LABELS = {
    "cafe": "Café", "restaurant": "Restaurant", "fast_food": "Takeaway", "pub": "Pub", "bar": "Bar",
    "bakery": "Bakery", "butcher": "Butcher", "deli": "Deli", "greengrocer": "Greengrocer",
    "convenience": "Corner shop", "hairdresser": "Hairdresser", "beauty": "Beauty salon",
    "florist": "Florist", "clothes": "Clothes shop", "charity": "Charity shop", "books": "Bookshop",
    "hardware": "Hardware shop", "jewelry": "Jeweller", "optician": "Optician", "bicycle": "Bike shop",
    "tattoo": "Tattoo studio", "pet": "Pet shop", "gift": "Gift shop", "laundry": "Laundrette",
    "dry_cleaning": "Dry cleaner", "mobile_phone": "Phone shop", "tailor": "Tailor",
    "shoes": "Shoe shop", "e-cigarette": "Vape shop", "seafood": "Fishmonger", "furniture": "Furniture shop", "estate_agent": "Estate agent",
}

NAME_FIRST = ["Willow", "Maple", "Oak", "Birch", "Rowan", "Hazel", "Juniper", "Elm", "Ivy", "Linden",
              "Aspen", "Holly", "Cedar", "Alder", "Fern", "Heather", "Bramble", "Poppy", "Clover",
              "Sorrel", "Thistle", "Larch", "Primrose", "Moss", "Wren", "Robin", "Finch", "Lark"]
NAME_SECOND = ["Lane", "Corner", "Yard", "Row", "House", "Street", "Works", "Place", "Court",
               "Gate", "Hill", "Square", "Mill", "Bridge", "Green"]


def get_json(url, data=None, headers=None):
    request = urllib.request.Request(url, data=data, headers={"User-Agent": "nehelp-hackathon-demo", **(headers or {})})
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)


def distance_m(lat1, lng1, lat2, lng2):
    """Straight-line distance in metres (fine for short distances)."""
    x = math.radians(lng2 - lng1) * math.cos(math.radians((lat1 + lat2) / 2))
    y = math.radians(lat2 - lat1)
    return math.hypot(x, y) * 6_371_000


def osm_businesses(lat, lng):
    query = f"""
    [out:json][timeout:90];
    (
      nwr(around:{RADIUS_M},{lat},{lng})["name"]["shop"];
      nwr(around:{RADIUS_M},{lat},{lng})["name"]["amenity"~"^(cafe|restaurant|fast_food|pub|bar)$"];
      nwr(around:{RADIUS_M},{lat},{lng})["name"]["craft"];
    );
    out center tags;
    """
    data = urllib.parse.urlencode({"data": query}).encode()
    elements = None
    for attempt in range(4):
        for server in OVERPASS_SERVERS:
            try:
                elements = get_json(server, data=data)["elements"]
                break
            except OSError as e:  # busy server: try the next mirror
                print(f"  {server} failed ({e}), trying another…")
        if elements is not None:
            break
        print("  All servers busy, waiting 30 seconds…")
        time.sleep(30)
    else:
        raise SystemExit("All OpenStreetMap servers are busy. Try again in a few minutes.")
    results = []
    for e in elements:
        tags = e["tags"]
        if "brand" in tags or "brand:wikidata" in tags:
            continue  # chains aren't who this is for
        point = e.get("center", e)
        if "lat" not in point:
            continue
        kind = tags.get("shop") or tags.get("amenity") or tags.get("craft")
        if kind in ("vacant", "yes"):
            continue
        results.append({
            "real_name": tags["name"],
            "kind": kind,
            "lat": point["lat"],
            "lng": point["lon"],
            "has_website": any(k in tags for k in ("website", "contact:website", "url")),
            "has_social": any(k in tags for k in ("contact:facebook", "contact:instagram", "facebook", "instagram")),
        })
    return results


def fsa_nearby(lat, lng):
    params = urllib.parse.urlencode({
        "latitude": lat, "longitude": lng,
        "maxDistanceLimit": RADIUS_M / 1609 + 0.1,  # miles
        "pageSize": 5000,
    })
    data = get_json(f"https://api.ratings.food.gov.uk/Establishments?{params}", headers={"x-api-version": "2"})
    return [e for e in data["establishments"] if e["geocode"]["latitude"]]


def normalise(name):
    return "".join(c for c in name.lower() if c.isalnum() or c == " ").replace("the ", "").strip()


def hygiene_for(business, establishments):
    """Find the FSA record for this business: close by and with a similar name."""
    best, best_score = None, 0.0
    for e in establishments:
        d = distance_m(business["lat"], business["lng"], float(e["geocode"]["latitude"]), float(e["geocode"]["longitude"]))
        if d > 80:
            continue
        score = difflib.SequenceMatcher(None, normalise(business["real_name"]), normalise(e["BusinessName"])).ratio()
        if score > best_score:
            best, best_score = e, score
    if best is None or best_score < 0.6:
        return None
    return {"rating": int(best["RatingValue"]) if best["RatingValue"].isdigit() else None,
            "status": best["RatingValue"], "date": best["RatingDate"][:10]}


def fake_name(kind, used, rng):
    label = TYPE_LABELS.get(kind, kind.replace("_", " ").title())
    while True:
        name = f"{rng.choice(NAME_FIRST)} {rng.choice(NAME_SECOND)} {label}"
        if name not in used:
            used.add(name)
            return name, label


def main():
    rng = random.Random(42)  # same fake names every run
    used, output = set(), []
    for area, (lat, lng) in AREAS.items():
        print(f"{area}: asking OpenStreetMap…")
        found = osm_businesses(lat, lng)
        rng.shuffle(found)
        found = found[:PER_AREA]
        establishments = fsa_nearby(lat, lng) if any(b["kind"] in FOOD for b in found) else []
        print(f"  {len(found)} independent businesses, {len(establishments)} FSA records nearby")
        for i, b in enumerate(found):
            name, label = fake_name(b["kind"], used, rng)
            hygiene = hygiene_for(b, establishments) if b["kind"] in FOOD else None
            output.append({
                "id": f"r_{area.split()[0].lower()}_{i}",
                "name": name,
                "type": label,
                "area": area,
                "lat": round(b["lat"], 5),
                "lng": round(b["lng"], 5),
                "claimed": False,
                "real": True,
                "public": {
                    "has_website": b["has_website"],
                    # OpenStreetMap rarely lists social media, so "not listed" means "don't know".
                    "has_social": True if b["has_social"] else None,
                    "hygiene_rating": hygiene["rating"] if hygiene else None,
                    "hygiene_date": hygiene["date"] if hygiene else None,
                },
            })
    OUT.write_text(json.dumps(output, indent=1, ensure_ascii=False))
    matched = sum(1 for b in output if b["public"]["hygiene_rating"] is not None)
    print(f"Saved {len(output)} businesses ({matched} with a hygiene rating) to {OUT}")


if __name__ == "__main__":
    main()
