"""Download and tidy the public data behind StockLess's draft money and food-waste epic (E9).

Run:   python public-data/fetch_public_data.py
Needs: Python 3.10+ with pandas, pyarrow and requests.

Raw downloads go to public-data/raw/. Existing files are kept, so delete a file to refresh it.
Tidy tables go to public-data/processed/ and are rebuilt on every run.
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

import pandas as pd
import requests

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
OUT = HERE / "processed"

PRICECATCHER = "https://storage.data.gov.my/pricecatcher/"
OWID = "https://ourworldindata.org/grapher/{}.csv?v=1&csvType=full&useColumnShortNames=true"
FOODKEEPER = "https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json"

# Premise types closest to a small shop like Aina's.
SMALL_SHOPS = {"Kedai Runcit", "Pasar Mini"}

NON_FOOD_GROUPS = {"PRODUK KEBERSIHAN"}
NON_FOOD_CATEGORIES = {
    "LAMPIN PAKAI BUANG", "ALAT TULIS DAN BAHAN BACAAN", "BERUS GIGI", "MAJALAH", "MOUTH WASH",
    "PENGHALAU NYAMUK", "PEWANGI RUMAH", "SABUN BADAN", "SYAMPU", "TISU", "TUALA WANITA",
    "UBAT GIGI", "UBAT-UBATAN",
}
DAYS_GROUPS = {"BARANGAN SEGAR", "MAKANAN SIAP MASAK"}
DAYS_WORDS = ("SUSU SEGAR", "FRESH MILK", "YOGURT", "ROTI", "YAKULT", "TAUHU", "TEMPE")
WEEKS_CATEGORIES = {"TELUR", "UBI KENTANG", "BAWANG"}

# Draft mapping from a PriceCatcher item to a Poore & Nemecek (2018) product.
# First match wins: (item_category, words in the item name or None, product or None, note).
FOOTPRINT_RULES: list[tuple[str, tuple[str, ...] | None, str | None, str]] = [
    ("DAGING", ("KAMBING", "BEBIRI"), "Lamb & Mutton", ""),
    ("DAGING", ("BABI",), "Pig Meat", ""),
    ("DAGING", None, "Beef (beef herd)", "beef or buffalo"),
    ("AYAM", None, "Poultry Meat", ""),
    ("TELUR", None, "Eggs", ""),
    ("BAHAN LAUT", ("UDANG",), "Prawns (farmed)", ""),
    ("BAHAN LAUT", None, "Fish (farmed)", "approximate: the source has no wild-caught seafood"),
    ("IKAN DARAT", None, "Fish (farmed)", ""),
    ("IKAN DALAM TIN", None, "Fish (farmed)", "approximate: canned fish"),
    ("BERAS", None, "Rice", ""),
    ("BIHUN", None, "Rice", "rice vermicelli"),
    ("MEE/KUETIAU", ("KUETIAU",), "Rice", "rice noodles"),
    ("MEE/KUETIAU", None, "Wheat & Rye", "wheat noodles"),
    ("MI SEGERA", None, "Wheat & Rye", "approximate: instant noodles"),
    ("TEPUNG", ("JAGUNG",), "Maize", ""),
    ("TEPUNG", ("BERAS", "PULUT"), "Rice", ""),
    ("TEPUNG", None, "Wheat & Rye", ""),
    ("GULA", None, "Cane Sugar", ""),
    ("MINYAK DAN LEMAK", ("MINYAK MASAK",), "Palm Oil", "Malaysian cooking oil is palm olein"),
    ("SAYUR-SAYURAN", ("TOMATO",), "Tomatoes", ""),
    ("SAYUR-SAYURAN", ("KUBIS", "BROKOLI", "SAWI", "KAILAN"), "Brassicas", ""),
    ("SAYUR-SAYURAN", ("LOBAK",), "Root Vegetables", ""),
    ("SAYUR-SAYURAN", ("BAWANG",), "Onions & Leeks", ""),
    ("SAYUR-SAYURAN", None, "Other Vegetables", ""),
    ("BAWANG", None, "Onions & Leeks", ""),
    ("UBI KENTANG", None, "Potatoes", ""),
    ("BUAH-BUAHAN", ("PISANG",), "Bananas", ""),
    ("BUAH-BUAHAN", ("OREN", "LIMAU"), "Citrus Fruit", ""),
    ("BUAH-BUAHAN", ("EPAL",), "Apples", ""),
    ("BUAH-BUAHAN", ("ANGGUR",), "Berries & Grapes", ""),
    ("BUAH-BUAHAN", None, "Other Fruit", ""),
    ("KACANG", ("TANAH",), "Groundnuts", ""),
    ("KACANG", None, "Other Pulses", "soybeans counted as pulses"),
    ("TAUHU DAN TEMPE", None, "Tofu", ""),
    ("SAPUAN (SPREADS)", ("CHEESE", "CHEDDAR"), "Cheese", ""),
    ("SAPUAN (SPREADS)", ("MENTEGA KACANG",), "Groundnuts", "peanut butter"),
    ("TERSEDIA MINUM", ("SOYA",), "Soy milk", ""),
    ("TERSEDIA MINUM", ("SUSU", "MILK", "UHT", "YOGURT"), "Milk", "liquid milk drinks"),
    ("BAHAN-BAHAN MINUMAN", ("3 IN 1", "COFFEE-MATE"), None, "drink mix or creamer"),
    ("BAHAN-BAHAN MINUMAN", ("KOPI", "COFFEE", "NESCAFE CLASSIC"), "Coffee", "per kg of coffee powder"),
    ("BAHAN-BAHAN MINUMAN", ("OATS",), "Oatmeal", ""),
]

MASS_KG = {"kg": 1.0, "g": 0.001, "gm": 0.001, "l": 1.0, "liter": 1.0, "litre": 1.0, "ml": 0.001}
VOLUME = {"l", "liter", "litre", "ml"}
UNIT = r"(kg|gm|g|ml|liter|litre|l)\b"
MULTIPACK = re.compile(r"(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*" + UNIT, re.I)
SINGLE = re.compile(r"(\d+(?:\.\d+)?)\s*" + UNIT, re.I)
EGG_COUNT = re.compile(r"(\d+)\s*biji", re.I)
EGG_GRADE = re.compile(r"BERAT\s*(\d+(?:\.\d+)?)\s*GM\s*HINGGA\s*(\d+(?:\.\d+)?)\s*GM", re.I)
EGG_GRADE_LETTER = re.compile(r"GRED\s+([A-F]{1,2})\b", re.I)

DAY_FACTORS = {"hours": 1 / 24, "days": 1, "weeks": 7, "months": 30, "year": 365, "years": 365}


def last_full_months(count: int = 3, today: date | None = None) -> list[str]:
    today = today or date.today()
    year, month, months = today.year, today.month, []
    for _ in range(count):
        month -= 1
        if month == 0:
            year, month = year - 1, 12
        months.append(f"{year}-{month:02d}")
    return sorted(months)


def download(url: str, dest: Path) -> bool:
    """Saves url to dest unless dest already exists. Returns False when the server refuses."""
    if dest.exists():
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    response = requests.get(url, timeout=180, headers={"User-Agent": "Mozilla/5.0 (StockLess data fetch)"})
    if response.status_code != 200:
        print(f"  ! HTTP {response.status_code} for {url}")
        return False
    dest.write_bytes(response.content)
    print(f"  saved {dest.relative_to(HERE)} ({len(response.content):,} bytes)")
    return True


def egg_grade_grams(names: pd.Series) -> dict[str, float]:
    """Middle weight in grams of each egg grade, read from the items whose names state it."""
    grams = {}
    for name in names:
        if (letter := EGG_GRADE_LETTER.search(name)) and (grade := EGG_GRADE.search(name)):
            grams[letter[1].upper()] = (float(grade[1]) + float(grade[2])) / 2
    return grams


def unit_kg(item: str, unit: str, egg_grams: dict[str, float]) -> tuple[float | None, str]:
    """Reads the pack weight in kg from a PriceCatcher unit such as '1kg', '5 X 79g' or '1 liter'."""
    text = str(unit).strip()
    if match := MULTIPACK.search(text):
        kind = match[3].lower()
        note = "multipack" + (", volume read as 1 kg per litre" if kind in VOLUME else "")
        return int(match[1]) * float(match[2]) * MASS_KG[kind], note
    if match := SINGLE.search(text):
        kind = match[2].lower()
        notes = ["approximate pack weight" if text.startswith("+") else "",
                 "volume read as 1 kg per litre" if kind in VOLUME else ""]
        return float(match[1]) * MASS_KG[kind], ", ".join(note for note in notes if note)
    if count := EGG_COUNT.search(text):
        if grade := EGG_GRADE.search(item):
            return int(count[1]) * (float(grade[1]) + float(grade[2])) / 2000, "eggs: count x middle of the grade weight"
        if (letter := EGG_GRADE_LETTER.search(item)) and letter[1].upper() in egg_grams:
            return int(count[1]) * egg_grams[letter[1].upper()] / 1000, "eggs: count x grade weight named by other items"
    return None, "unit is not a weight or volume"


def shelf_life_class(item: str, group: str, category: str) -> tuple[str, str]:
    """Sorts an item into days / weeks / months / non-food by its PriceCatcher group and name."""
    if group in NON_FOOD_GROUPS or category in NON_FOOD_CATEGORIES:
        return "non-food", f"{group} / {category}"
    if category in WEEKS_CATEGORIES:
        return "weeks", f"category {category}"
    if group in DAYS_GROUPS:
        return "days", f"group {group}"
    if any(word in item.upper() for word in DAYS_WORDS):
        return "days", "chilled or fresh product in its name"
    return "months", "packaged, dry or long-life food"


def footprint_product(item: str, category: str, is_food: bool) -> tuple[str | None, str]:
    if not is_food:
        return None, "not food"
    name = item.upper()
    for rule_category, words, product, note in FOOTPRINT_RULES:
        if rule_category == category and (words is None or any(word in name for word in words)):
            return product, note or f"category {category}"
    return None, "no per-kg factor in the source (processed, dried or concentrated)"


def build_footprint() -> pd.DataFrame:
    """One row per Poore & Nemecek product: kg CO2e, land and water per kg of food."""
    stages = pd.read_csv(RAW / "owid" / "food-emissions-supply-chain.csv")
    stages["entity"] = stages["entity"].replace({"Shrimps (farmed)": "Prawns (farmed)"})
    stages["kg_co2e_per_kg"] = stages.drop(columns=["entity", "year"]).sum(axis=1)
    ghg = pd.read_csv(RAW / "owid" / "ghg-per-kg-poore.csv").set_axis(["entity", "year", "ghg"], axis=1)
    land = pd.read_csv(RAW / "owid" / "land-use-per-kg-poore.csv").set_axis(["entity", "year", "land_m2_per_kg"], axis=1)
    water = pd.read_csv(RAW / "owid" / "water-withdrawals-per-kg-poore.csv").set_axis(["entity", "year", "water_l_per_kg"], axis=1)
    table = (ghg[["entity", "ghg"]]
             .merge(stages[["entity", "kg_co2e_per_kg"]], on="entity", how="outer")
             .merge(land[["entity", "land_m2_per_kg"]], on="entity", how="left")
             .merge(water[["entity", "water_l_per_kg"]], on="entity", how="left"))
    # The published per-kg chart is the headline figure; the supply-chain total fills in the oils.
    table["kg_co2e_per_kg"] = table["ghg"].fillna(table["kg_co2e_per_kg"]).round(2)
    table["source"] = "Poore & Nemecek (2018), processed by Our World in Data"
    return (table.drop(columns=["ghg"]).rename(columns={"entity": "product"})
            .sort_values("product").reset_index(drop=True))


def two_stage_prices(prices: pd.DataFrame, keys: list[str], prefix: str = "") -> pd.DataFrame:
    """Median price per premise first, then across premises, so busy premises do not dominate."""
    per_premise = prices.groupby([*keys, "premise_code"])["price"].median().rename("premise_price").reset_index()
    grouped = per_premise.groupby(keys)["premise_price"]
    summary = pd.DataFrame({
        f"{prefix}median_rm": grouped.median(),
        f"{prefix}p25_rm": grouped.quantile(0.25),
        f"{prefix}p75_rm": grouped.quantile(0.75),
        f"{prefix}n_premises": grouped.size(),
    })
    summary[f"{prefix}n_prices"] = prices.groupby(keys)["price"].size()
    return summary.round(2).reset_index()


def build_prices(months: list[str], footprint: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    items = pd.read_csv(RAW / "pricecatcher" / "lookup_item.csv")
    items = items[items["item_code"] > 0].copy()
    premises = pd.read_csv(RAW / "pricecatcher" / "lookup_premise.csv")
    premises["premise_type"] = premises["premise_type"].str.strip()
    prices = pd.concat(
        [pd.read_parquet(RAW / "pricecatcher" / f"pricecatcher_{month}.parquet") for month in months],
        ignore_index=True,
    ).merge(premises[["premise_code", "premise_type", "state"]], on="premise_code", how="left")
    prices["date"] = pd.to_datetime(prices["date"])

    egg_grams = egg_grade_grams(items["item"])
    items[["unit_kg", "unit_kg_note"]] = [unit_kg(i, u, egg_grams) for i, u in zip(items["item"], items["unit"])]
    items["unit_kg"] = pd.to_numeric(items["unit_kg"])
    items[["shelf_life", "shelf_life_rule"]] = [
        shelf_life_class(i, g, c) for i, g, c in zip(items["item"], items["item_group"], items["item_category"])
    ]
    items["is_food"] = items["shelf_life"] != "non-food"
    items[["footprint_product", "footprint_rule"]] = [
        footprint_product(i, c, f) for i, c, f in zip(items["item"], items["item_category"], items["is_food"])
    ]

    table = (items
             .merge(two_stage_prices(prices, ["item_code"], "price_"), on="item_code", how="left")
             .merge(two_stage_prices(prices[prices["premise_type"].isin(SMALL_SHOPS)], ["item_code"], "small_shop_")
                    [["item_code", "small_shop_median_rm", "small_shop_n_premises"]], on="item_code", how="left")
             .merge(two_stage_prices(prices[prices["date"] >= pd.Timestamp(f"{months[-1]}-01")], ["item_code"], "latest_month_")
                    [["item_code", "latest_month_median_rm"]], on="item_code", how="left")
             .merge(footprint[["product", "kg_co2e_per_kg", "land_m2_per_kg", "water_l_per_kg"]]
                    .rename(columns={"product": "footprint_product"}), on="footprint_product", how="left"))
    table["price_per_kg_rm"] = (table["price_median_rm"] / table["unit_kg"]).round(2)
    table["kg_co2e_per_unit"] = (table["unit_kg"] * table["kg_co2e_per_kg"]).round(3)
    table["unit_kg"] = table["unit_kg"].round(4)
    table["price_months"] = f"{months[0]} to {months[-1]}"

    by_state = (two_stage_prices(prices.dropna(subset=["state"]), ["item_code", "state"], "price_")
                .merge(items[["item_code", "item", "unit"]], on="item_code"))
    by_state = by_state[["item_code", "item", "unit", "state", "price_median_rm", "price_p25_rm",
                         "price_p75_rm", "price_n_premises", "price_n_prices"]]
    return table, by_state.sort_values(["item_code", "state"])


def build_shelf_life() -> pd.DataFrame | None:
    """Flattens USDA FoodKeeper: typical storage time per product, unopened, in days."""
    path = RAW / "foodkeeper" / "foodkeeper.json"
    if not path.exists():
        return None
    sheets = {sheet["name"]: pd.DataFrame([{k: v for cell in row for k, v in cell.items()} for row in sheet["data"]])
              for sheet in json.loads(path.read_text(encoding="utf-8"))["sheets"]}
    products = sheets["Product"].merge(
        sheets["Category"].rename(columns={"ID": "Category_ID"}), on="Category_ID", how="left")

    def storage(row: pd.Series, *prefixes: str) -> tuple[str | None, float | None]:
        for prefix in prefixes:
            low, high, metric = row.get(f"{prefix}_Min"), row.get(f"{prefix}_Max"), row.get(f"{prefix}_Metric")
            if isinstance(metric, str) and metric.strip():
                if pd.notna(low) and pd.notna(high):
                    text = f"{high:g} {metric}" if low == high else f"{low:g}-{high:g} {metric}"
                else:
                    text = metric
                factor = DAY_FACTORS.get(metric.strip().lower())
                return text, (round(high * factor, 1) if factor and pd.notna(high) else None)
        return None, None

    rows = []
    for _, row in products.iterrows():
        pantry, pantry_days = storage(row, "Pantry", "DOP_Pantry")
        fridge, fridge_days = storage(row, "Refrigerate", "DOP_Refrigerate")
        freezer, freezer_days = storage(row, "Freeze", "DOP_Freeze")
        rows.append({
            "id": int(row["ID"]), "category": row.get("Category_Name"), "subcategory": row.get("Subcategory_Name"),
            "name": row.get("Name"), "name_subtitle": row.get("Name_subtitle"), "keywords": row.get("Keywords"),
            "pantry": pantry, "pantry_max_days": pantry_days,
            "fridge": fridge, "fridge_max_days": fridge_days,
            "freezer": freezer, "freezer_max_days": freezer_days,
        })
    return pd.DataFrame(rows)


def main() -> None:
    months = last_full_months()
    print(f"PriceCatcher months: {', '.join(months)}")
    for name in ["lookup_item.csv", "lookup_premise.csv", *[f"pricecatcher_{month}.parquet" for month in months]]:
        download(PRICECATCHER + name, RAW / "pricecatcher" / name)
    for chart in ["ghg-per-kg-poore", "food-emissions-supply-chain", "land-use-per-kg-poore",
                  "water-withdrawals-per-kg-poore"]:
        download(OWID.format(chart), RAW / "owid" / f"{chart}.csv")
    if not download(FOODKEEPER, RAW / "foodkeeper" / "foodkeeper.json"):
        print("  FSIS refuses scripted downloads. Open the link in a browser and save it as raw/foodkeeper/foodkeeper.json.")

    OUT.mkdir(exist_ok=True)
    footprint = build_footprint()
    footprint.to_csv(OUT / "food_footprint_per_kg.csv", index=False, encoding="utf-8-sig")
    prices, by_state = build_prices(months, footprint)
    prices.to_csv(OUT / "reference_prices.csv", index=False, encoding="utf-8-sig")
    by_state.to_csv(OUT / "reference_prices_by_state.csv", index=False, encoding="utf-8-sig")
    shelf = build_shelf_life()
    if shelf is not None:
        shelf.to_csv(OUT / "shelf_life_foodkeeper.csv", index=False, encoding="utf-8-sig")

    priced = prices["price_median_rm"].notna()
    print(f"reference_prices.csv: {len(prices)} items, {priced.sum()} with a price, "
          f"{(priced & prices['is_food']).sum()} of them food, "
          f"{(priced & prices['kg_co2e_per_kg'].notna()).sum()} with a CO2e factor")
    print(f"reference_prices_by_state.csv: {len(by_state)} rows")
    print(f"food_footprint_per_kg.csv: {len(footprint)} products")
    print(f"shelf_life_foodkeeper.csv: {0 if shelf is None else len(shelf)} products")


if __name__ == "__main__":
    main()
