"""Simple CO2e estimate for StockLess I3 (US9.5): kg CO2e = quantity x kg per unit x kg CO2e per kg.

Reference for the app; the rules are explained in README.md. Run it to see the examples.
"""

import csv
import re
import unicodedata
from pathlib import Path

PROCESSED = Path(__file__).resolve().parent / "processed"

# US EPA Greenhouse Gas Equivalencies: 8.887 x 10^-3 t CO2 per gallon of petrol = 2.35 kg per litre.
PETROL_KG_CO2_PER_LITRE = 2.35

UNIT_KG = {"kg": 1.0, "g": 0.001, "gm": 0.001, "l": 1.0, "liter": 1.0, "litre": 1.0, "ml": 0.001}  # 1 L read as 1 kg
UNIT = r"(kg|gm|g|ml|liter|litre|l)\b"
MULTIPACK = re.compile(r"(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*" + UNIT, re.I)
SINGLE = re.compile(r"(\d+(?:\.\d+)?)\s*" + UNIT, re.I)


def read_csv(name: str) -> list[dict[str, str]]:
    with open(PROCESSED / name, encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


FACTORS = {row["product"]: float(row["kg_co2e_per_kg"]) for row in read_csv("food_footprint_per_kg.csv")}
# First match wins, in the file's `order`. A blank category means "no factor" (mixed or concentrated food).
RULES = [
    (re.compile(r"(?<![a-z])(" + "|".join(map(re.escape, row["keywords"].split("|"))) + r")(?![a-z])"),
     row["category"] or None)
    for row in sorted(read_csv("co2e_name_keywords.csv"), key=lambda row: int(row["order"]))
]


def food_category(product_name: str, category: str | None = None) -> str | None:
    """A category column in the file wins; otherwise the first keyword found in the product name."""
    if category:
        return category
    name = unicodedata.normalize("NFKD", product_name).encode("ascii", "ignore").decode().lower()
    return next((rule_category for pattern, rule_category in RULES if pattern.search(name)), None)


def kg_per_unit(pack_size: str, net_weight_kg: float | None = None) -> float | None:
    """A net-weight column wins; otherwise read '200 g jar', '1 L bottle' or '6 x 250 ml' from the pack size."""
    if net_weight_kg:
        return net_weight_kg
    if match := MULTIPACK.search(pack_size):
        return int(match[1]) * float(match[2]) * UNIT_KG[match[3].lower()]
    if match := SINGLE.search(pack_size):
        return float(match[1]) * UNIT_KG[match[2].lower()]
    return None


def estimate(quantity: float, product_name: str, pack_size: str,
             category: str | None = None, net_weight_kg: float | None = None) -> dict:
    """kg of food and kg CO2e for `quantity` units, or the reason there is no estimate (never 0)."""
    chosen = food_category(product_name, category)
    weight = kg_per_unit(pack_size, net_weight_kg)
    if chosen not in FACTORS:
        return {"reason": "no emission factor for this product"}
    if weight is None:
        return {"reason": "pack size has no weight or volume"}
    food_kg = quantity * weight
    kg_co2e = food_kg * FACTORS[chosen]
    return {"category": chosen, "food_kg": round(food_kg, 3), "kg_co2e": round(kg_co2e, 2),
            "petrol_litres": round(kg_co2e / PETROL_KG_CO2_PER_LITRE, 1)}


if __name__ == "__main__":
    print("One unit of each product in frontend/public/samples:")
    for name, pack in [("Sambal Ikan Bilis", "200 g jar"), ("Kopi O", "10 sachets"),
                       ("Nasi Goréng Spesial", "250 g pack"), ("Gula Pasir", "1 kg bag"),
                       ("Minyak Goreng", "1 L bottle"), ("Beras Wangi", "5 kg bag"),
                       ("Kerupuk Udang", "250 g pack")]:
        print(f"  {name} ({pack}): {estimate(1, name, pack)}")

    print("\nWorked example: Ayam Segar, 1 kg pack")
    print("  recorded discard of 3 packs:", estimate(3, "Ayam Segar", "1 kg pack"))
    for label, low, high in [("planned order leaves", 4, 6), ("StockLess option leaves", 0, 2)]:
        print(f"  {label} {low}-{high} packs past expiry:",
              estimate(low, "Ayam Segar", "1 kg pack")["kg_co2e"], "-",
              estimate(high, "Ayam Segar", "1 kg pack")["kg_co2e"], "kg CO2e")
    print("  potential avoided (4 packs at both ends):", estimate(4, "Ayam Segar", "1 kg pack"))
