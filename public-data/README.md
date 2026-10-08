# 公开数据：钱和食物浪费（I3 草案 E9）

为 I3 "钱和食物浪费" 这个 epic 准备的公开数据，下载于 2026-09-21。

## 目录

```
public-data/
  fetch_public_data.py    下载 + 整理，可重复运行
  co2e_estimate.py        碳排放估算的参考算法（US9.5），直接运行可以看例子
  raw/                    原始下载（约 8 MB，可用脚本重新生成）
    pricecatcher/         商品表、店铺表、2026-06 到 2026-08 的每日价格（parquet）
    owid/                 每 kg 食物的碳排放、用地、用水
    foodkeeper/           USDA 保质期数据（json + 原版 xls）
  processed/              整理好的表，app 以后直接用这些
```

## 整理好的表

| 文件 | 行数 | 用来做什么 |
|---|---|---|
| `reference_prices.csv` | 796 个商品，其中 339 个有价格 | 参考单价、每件重量、保质期类别、每件碳排放 |
| `reference_prices_by_state.csv` | 4,614 | 同上的价格，按州分 |
| `food_footprint_per_kg.csv` | 43 种食物 | 每 kg 的 kg CO₂e、用地 m²、用水 L |
| `shelf_life_foodkeeper.csv` | 661 种食物 | 常温、冷藏、冷冻的典型保质期（天） |
| `co2e_name_keywords.csv` | 45 条规则 | 用商品名（英文或马来文）找到上表的食物类别。手写的，不由脚本生成 |

## 碳排放怎么算（US9.5）

**kg CO₂e = 数量 × 每件 kg × 每 kg 食物的 kg CO₂e**，参考实现是 `co2e_estimate.py`。

1. 系数：文件里有食物类别列（写 `food_footprint_per_kg.csv` 里的名字）就直接用；没有的话，按 `co2e_name_keywords.csv` 的顺序在商品名里找关键词，第一条命中的算数。命中空类别的是混合或浓缩食品（sambal、酱料、3 in 1、炼奶、nasi 等），不估。
2. 每件 kg：有净重列就用；没有就从 pack size 读，例如 `200 g jar`、`1 L bottle`（按 1 kg/L）、`6 x 250 ml`。读不出来的（如 `10 sachets`）不估。
3. 数量从哪来：
   - 实际记录（US9.3）：丢弃、过期的数量，算"已浪费"；捐出、救回的数量，算"没进垃圾桶"。
   - 方案对比：计划订单和 StockLess 方案各自会有多少件放到过期还卖不掉（低需求、高需求两头各算一次）。两者之差就是"可能避免"，要标成估算。
4. 中间结果"kg 食物"本身就是 SDG 12.3 用的单位，可以一起显示。
5. 对比：kg CO₂e ÷ 2.35 = 约等于烧掉多少升汽油（US EPA：每加仑汽油 8.887 kg CO₂）。
6. 算不出来的商品不算成 0，要单独列出来，并写明原因。

限制：系数是全球平均，基准年 2010 左右；不含丢进垃圾场以后产生的排放；混合食品没有系数。显示时写"约"，并署名 Poore & Nemecek (2018) / Our World in Data。

`reference_prices.csv` 的主要字段：
- `price_median_rm`：2026-06 到 2026-08 的参考价。先取每家店自己的中位数，再取所有店的中位数，这样一天记很多次的店不会占太大比重。另有 `price_p25_rm` / `price_p75_rm`、`price_n_premises`（店数）。
- `small_shop_median_rm`：只看 Kedai Runcit 和 Pasar Mini，最接近 Aina 这类小店。
- `latest_month_median_rm`：只看 2026-08。
- `unit_kg`：每件重量。由单位解析而来，例如 `1kg`、`5 X 79g`、`1 liter`（液体按 1 kg/L 估算）。鸡蛋按等级重量计算。读不出重量时留空，原因写在 `unit_kg_note`。
- `shelf_life`：`days`（生鲜、熟食、鲜奶、面包）、`weeks`（鸡蛋、土豆、洋葱）、`months`（其他食品）或 `non-food`。依据写在 `shelf_life_rule`。
- `footprint_product` 和 `kg_co2e_per_kg`：对应到 Poore & Nemecek 里的某种食物。`kg_co2e_per_unit` = 每件重量 × 系数。

## 草稿规则，需要组里看一下

- **保质期分类**和**碳排放对照**都是我按 PriceCatcher 的分组、品类和商品名关键词写的，规则集中在 `fetch_public_data.py` 顶部的 `DAYS_*`、`WEEKS_CATEGORIES` 和 `FOOTPRINT_RULES`。
- 以下商品没有对应系数，碳排放留空：加工品、干货、浓缩品（奶粉、酱料、调料、干江鱼仔、椰子等），以及数据源里没有的食物（例如玉米油）。有价格的食品里，208 个有系数。
- 海鱼、罐头鱼借用 "Fish (farmed)"，只是近似值。马来西亚的食用油按 Palm Oil 计。

## 来源和许可（app 里显示时要署名）

- **PriceCatcher**，KPDN，经 data.gov.my 发布，CC BY 4.0。署名：`Contains data from PriceCatcher (KPDN), data.gov.my, licensed under CC BY 4.0.`
  <https://data.gov.my/data-catalogue/pricecatcher>
- **Poore & Nemecek (2018), Science 360(6392)**，由 Our World in Data 整理，CC BY 4.0。<https://ourworldindata.org/grapher/ghg-per-kg-poore>
- **USDA FSIS FoodKeeper**，美国政府公开数据。<https://catalog.data.gov/dataset/fsis-foodkeeper-data>

## 更新

```sh
pip install pandas pyarrow requests
python public-data/fetch_public_data.py
```

脚本默认取运行当天之前的三个完整月份。已经下载的文件不会重复下载，想刷新就删掉对应文件再运行。FSIS 会拒绝脚本请求，所以 FoodKeeper 要用浏览器打开 <https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json>，另存为 `raw/foodkeeper/foodkeeper.json`。

## 注意

- PriceCatcher 是**零售价**，不是进货价。显示时要写成 "typical shop price"，用户自己填的进货价优先。
- 碳排放系数是全球平均值，基准年 2010 左右，只能写"约"。
- FoodKeeper 是美国数据。它只能在没有 expiry 时作参考，不能代替用户文件里的日期。
- `raw/` 可以随时重新生成。要不要提交到 git 由组里决定；app 真正要用的是 `processed/`。
