/** Purchase workflow copy, including the supplier and empty-order controls. */
export const purchaseMessages: Record<string, readonly [string, string]> = {
  "Expected sales in the next 4 weeks": ["未来 4 周的预计销量", "Jangkaan jualan untuk 4 minggu akan datang"],
  "Sales in 4-week periods": ["每 4 周的销量", "Jualan bagi tempoh 4 minggu"],
  "Each bar covers 4 weeks, so you can compare past sales with the forecast.": ["每根柱子代表 4 周，方便比较过去销量和预测销量。", "Setiap bar mewakili 4 minggu supaya anda boleh membandingkan jualan lepas dengan ramalan."],
  "Earlier 4 weeks": ["较早的 4 周", "4 minggu sebelumnya"],
  "Latest 4 weeks": ["最近 4 周", "4 minggu terkini"],
  "Estimated sales": ["预计销量", "Anggaran jualan"],
  "Lower estimate": ["较低估计", "Anggaran bawah"],
  "Up to the upper estimate": ["至较高估计", "Sehingga anggaran atas"],
  "The forecast is an estimate for all 4 weeks together. Actual sales may be lower or higher.": ["预测是整个 4 周的合计估计。实际销量可能更低或更高。", "Ramalan ialah anggaran untuk keseluruhan 4 minggu. Jualan sebenar mungkin lebih rendah atau lebih tinggi."],
  "A past bar is unavailable when any of its weeks are missing. Missing records do not mean zero sales.": ["若有一周缺少记录，则无法显示该时段的柱子。缺少记录不代表销量为零。", "Bar jualan lepas tidak tersedia jika rekod mana-mana minggu tiada. Rekod yang tiada bukan bermakna jualan sifar."],
  "Missing records": ["缺少记录", "Rekod tiada"],
  "{0} of 4 weeks recorded": ["4 周中有 {0} 周有记录", "{0} daripada 4 minggu direkodkan"],
  "See weekly sales records": ["查看每周销量记录", "Lihat rekod jualan mingguan"],
  "Each bar below shows recorded sales for one week.": ["下方每根柱子表示一周的已记录销量。", "Setiap bar di bawah menunjukkan jualan yang direkodkan untuk satu minggu."],
  "Recorded": ["已记录", "Direkodkan"],
  "Both bars use the same scale for the next 4 weeks.": ["两根横条使用相同刻度，比较未来 4 周的数据。", "Kedua-dua bar menggunakan skala yang sama untuk 4 minggu akan datang."],
  "Stock after your order": ["订货后的库存", "Stok selepas pesanan anda"],
  "Expected sales": ["预计销量", "Jangkaan jualan"],
  "Estimated sales range": ["预计销量范围", "Julat anggaran jualan"],
  "Step 4 of 4": [
    "第 4 步 / 共 4 步",
    "Langkah 4 / 4"
  ],
  "Your data stays on your device": [
    "数据只留在您的设备上",
    "Data anda tak keluar dari peranti ini"
  ],
  "Plan your next order": [
    "规划下一次进货",
    "Rancang pesanan seterusnya"
  ],
  "Possible excess stock": [
    "可能多进的货",
    "Stok yang mungkin berlebihan"
  ],
  "units": [
    "件",
    "unit"
  ],
  "See impact →": [
    "看看影响 →",
    "Lihat impak →"
  ],
  "Order needed": [
    "需要多进",
    "Perlu tambah pesanan"
  ],
  "Below expected demand": [
    "低于预计销量",
    "Kurang daripada jangkaan jualan"
  ],
  "Check order": [
    "再看看",
    "Semak semula"
  ],
  "More than the busiest month": [
    "比生意最好的月份还多",
    "Lebih daripada bulan paling laris"
  ],
  "Balanced": [
    "刚刚好",
    "Seimbang"
  ],
  "Within expected demand": [
    "在预计销量范围内",
    "Dalam lingkungan jangkaan jualan"
  ],
  "Need data": [
    "数据不足",
    "Data tak cukup"
  ],
  "Can't be judged yet": [
    "暂时无法判断",
    "Belum boleh dinilai"
  ],
  "Order more": [
    "要多进",
    "Tambah lagi"
  ],
  "Search name or code": [
    "搜索名称或代码",
    "Cari nama atau kod"
  ],
  "Clear": [
    "清除",
    "Kosongkan"
  ],
  "Product": [
    "商品",
    "Produk"
  ],
  "Expected, 4 weeks": [
    "预计 4 周销量",
    "Jangkaan, 4 minggu"
  ],
  "In stock": [
    "现有库存",
    "Dalam stok"
  ],
  "Your order": [
    "您的订单",
    "Pesanan anda"
  ],
  "Check": [
    "状态",
    "Status"
  ],
  "Show fewer": [
    "收起",
    "Tunjuk sikit sahaja"
  ],
  "No products match.": [
    "找不到符合的商品。",
    "Tiada produk yang padan."
  ],
  "Previous product": [
    "上一个",
    "Produk sebelum"
  ],
  "Next product": [
    "下一个",
    "Produk seterusnya"
  ],
  "Incoming": [
    "在途",
    "Dalam perjalanan"
  ],
  "Your planned order": [
    "您的计划订购量",
    "Pesanan dirancang anda"
  ],
  "Looks balanced": [
    "数量刚刚好",
    "Nampak seimbang"
  ],
  "Can't judge this product yet": [
    "这个商品暂时无法判断",
    "Produk ini belum boleh dinilai"
  ],
  "Fix it in Step 3": [
    "到第 3 步修正",
    "Betulkan di Langkah 3"
  ],
  "from your file": [
    "来自您的文件",
    "dari fail anda"
  ],
  "input by you": [
    "您填的",
    "anda isi"
  ],
  "worked out by StockLess": [
    "StockLess 算的",
    "dikira oleh StockLess"
  ],
  "Overstock risk": [
    "可能进太多",
    "Risiko stok berlebihan"
  ],
  "No plan entered": [
    "还没填计划",
    "Belum ada pesanan"
  ],
  "Planned order": [
    "计划进货",
    "Pesanan dirancang"
  ],
  "Incoming stock": [
    "在途库存",
    "Stok dalam perjalanan"
  ],
  "Exact planned order quantity": [
    "计划进货的确切数量",
    "Kuantiti pesanan dirancang yang tepat"
  ],
  "Purchase check": [
    "进货检查",
    "Semakan belian"
  ],
  "Expected demand": [
    "预计销量",
    "Jangkaan jualan"
  ],
  "This plan looks too high.": [
    "这次进得有点多。",
    "Pesanan ini nampak terlalu banyak."
  ],
  "This plan looks too low.": [
    "这次进得有点少。",
    "Pesanan ini nampak terlalu sedikit."
  ],
  "This plan is within range.": [
    "这次的数量刚刚好。",
    "Pesanan ini dalam julat jangkaan."
  ],
  "Why this purchase check?": [
    "为什么是这个检查结果？",
    "Kenapa keputusan semakan ini?"
  ],
  "Expiry information": [
    "有效期",
    "Tarikh luput"
  ],
  "This estimate uses general stock and demand. Expiry is a separate check; affected batch quantities are not included in the adjustment.": [
    "这个建议是按一般库存和销量算的。有效期另外检查，快过期的批次数量没有算进去。",
    "Anggaran ini ikut stok dan jualan umum. Tarikh luput disemak berasingan; kuantiti kelompok yang hampir luput tidak diambil kira."
  ],
  "Recent weekly average": [
    "最近每周平均",
    "Purata mingguan terkini"
  ],
  "Past 8 weeks": [
    "过去八周",
    "8 minggu lalu"
  ],
  "Weeks of cover": [
    "可维持周数",
    "Minggu liputan stok"
  ],
  "Stock counted": [
    "盘点日期",
    "Stok dikira"
  ],
  "Supplier terms": [
    "供应商条件",
    "Syarat pembekal"
  ],
  "Case size": [
    "每箱数量",
    "Saiz karton"
  ],
  "Minimum order": [
    "最低订购量",
    "Pesanan minimum"
  ],
  "← Back to readiness": [
    "← 返回检查数据",
    "← Kembali ke semakan data"
  ],
  "See your impact →": [
    "看看您的影响 →",
    "Lihat impak anda →"
  ],
  "Use suggested {0}": [
    "用建议数量 {0}",
    "Guna cadangan: {0}"
  ],
  "Suggested {0}": [
    "建议 {0}",
    "Cadangan: {0}"
  ],
  "Show all {0} products": [
    "查看全部 {0} 个商品",
    "Lihat semua {0} produk"
  ],
  "Purchase plan · Product {0} of {1}": [
    "进货计划 · 第 {0} / {1} 个商品",
    "Pelan belian · Produk {0} daripada {1}"
  ],
  "in {0} orders": [
    "来自 {0} 张订单",
    "daripada {0} pesanan"
  ],
  "in 1 order": [
    "来自 1 张订单",
    "daripada 1 pesanan"
  ],
  "↓ Download plan": [
    "↓ 下载计划",
    "↓ Muat turun pelan"
  ],
  "For the next 4 weeks from {0}.": [
    "从 {0} 开始的未来四周。",
    "Untuk 4 minggu berikutnya mulai {0}."
  ],
  "Selected product outside current filter": [
    "已选商品不在当前筛选结果中",
    "Produk dipilih di luar penapis semasa"
  ],
  "Counted": [
    "清点于",
    "Dikira"
  ],
  "Demand and stock": [
    "需求与库存",
    "Permintaan dan stok"
  ],
  "Hide evidence": [
    "收起依据",
    "Sembunyikan bukti"
  ],
  "Show evidence": [
    "显示依据",
    "Tunjukkan bukti"
  ],
  "Suggested order": [
    "建议订购量",
    "Pesanan dicadangkan"
  ],
  "Midpoint − stock − incoming; rounded up to whole units.": [
    "中点减去现有库存和在途库存；向上取整。",
    "Titik tengah tolak stok dan stok masuk; dibundarkan ke atas kepada unit penuh."
  ],
  "Decrease planned order": [
    "减少计划订购量",
    "Kurangkan pesanan dirancang"
  ],
  "Increase planned order": [
    "增加计划订购量",
    "Tambah pesanan dirancang"
  ],
  "A blank order is previewed as 0; no order is saved until you enter a quantity.": [
    "空白订购量以 0 预览；输入数量后才会记录订单。",
    "Pesanan kosong dipratonton sebagai 0; pesanan hanya direkodkan selepas kuantiti dimasukkan."
  ],
  "Preview only — no plan entered.": [
    "仅为预览 — 尚未输入计划。",
    "Pratonton sahaja — belum ada pelan dimasukkan."
  ],
  "Stock on hand + incoming stock + your planned order is compared with the expected four-week range. Above the range may leave excess stock; below it may leave a shortfall.": [
    "现有库存加在途库存和计划订购量，再与预计四周需求区间比较。高于区间可能积压，低于区间可能缺货。",
    "Stok semasa + stok masuk + pesanan dirancang dibandingkan dengan julat empat minggu. Melebihi julat mungkin menyebabkan lebihan; di bawahnya mungkin menyebabkan kekurangan."
  ],
  "Optional · case size, minimum order and delivery time": [
    "可选 · 每箱数量、最低订购量和送货时间",
    "Pilihan · saiz karton, pesanan minimum dan masa penghantaran"
  ],
  "Lead time (days)": [
    "交货时间（天）",
    "Tempoh penghantaran (hari)"
  ],
  "Enter whole days from 0 to 3650.": [
    "请输入 0 至 3650 的整天数。",
    "Masukkan hari penuh dari 0 hingga 3650."
  ],
  "Enter a whole case size from 1 to 999999.": [
    "每箱数量须为 1 至 999999 的整数。",
    "Masukkan saiz karton bulat dari 1 hingga 999999."
  ],
  "Enter a whole minimum order from 0 to 999999.": [
    "最低订购量须为 0 至 999999 的整数。",
    "Masukkan pesanan minimum bulat dari 0 hingga 999999."
  ],
  "Correct the supplier terms to update this suggestion.": [
    "更正供应商条件以更新建议。",
    "Betulkan syarat pembekal untuk mengemas kini cadangan ini."
  ],
  "Supplier-adjusted order: {0} units.": [
    "按供应商条件调整：{0} 件。",
    "Pesanan terlaras pembekal: {0} unit."
  ],
  "{0} cases of {1}.": [
    "{0} 箱，每箱 {1} 件。",
    "{0} karton dengan {1} unit setiap karton."
  ],
  "Add a case size or minimum order to adjust the suggested quantity.": [
    "输入每箱数量或最低订购量，以调整建议数量。",
    "Tambah saiz karton atau pesanan minimum untuk melaraskan kuantiti dicadangkan."
  ],
  "Estimated arrival:": [
    "预计到货：",
    "Jangkaan tiba:"
  ],
  "Delivery falls outside this four-week plan. Lead time does not extend the forecast.": [
    "到货时间超出本次四周计划。交货时间不会延长预测范围。",
    "Penghantaran di luar pelan empat minggu ini. Tempoh penghantaran tidak memanjangkan ramalan."
  ],
  "Use supplier quantity {0}": [
    "采用供应商数量 {0}",
    "Gunakan kuantiti pembekal {0}"
  ],
  "Supplier terms stay in this visit. The demand forecast is unchanged; check the adjusted order against the range.": [
    "供应商条件仅保留于本次访问。需求预测不变；请将调整后的订购量与需求区间核对。",
    "Syarat pembekal kekal untuk lawatan ini. Ramalan permintaan kekal; semak pesanan terlaras terhadap julat."
  ],
  "Done, next product →": [
    "完成，下一件商品 →",
    "Selesai, produk seterusnya →"
  ],
  "Quantities are never sent to a supplier.": [
    "数量不会发送给供应商。",
    "Kuantiti tidak dihantar kepada pembekal."
  ],
  "Select a product to enter quantities and review its evidence.": [
    "选择商品，输入数量并查看依据。",
    "Pilih produk untuk memasukkan kuantiti dan menyemak buktinya."
  ],
  "Batch expires": [
    "批次到期",
    "Kelompok luput"
  ],
  "Showing {0} of {1} matching products.": [
    "显示 {1} 件匹配商品中的 {0} 件。",
    "Menunjukkan {0} daripada {1} produk sepadan."
  ],
  "Counts above do not change when filtering.": [
    "上述数量不受筛选影响。",
    "Bilangan di atas tidak berubah semasa menapis."
  ],
  "Evidence mismatch affects {0} products. Return to readiness and refresh the forecast.": [
    "{0} 件商品的依据不匹配。请返回数据检查并刷新预测。",
    "Ketidakpadanan bukti menjejaskan {0} produk. Kembali ke semakan kesediaan dan kemas kini ramalan."
  ],
  "Recorded sales and four-week demand range for {0}": [
    "{0} 的记录销量和四周需求区间",
    "Jualan direkodkan dan julat permintaan empat minggu untuk {0}"
  ],
  "Recorded sales": [
    "记录销量",
    "Jualan direkodkan"
  ],
  "Weekly equivalent of expected demand": [
    "预计需求的每周等值",
    "Setara mingguan permintaan dijangka"
  ],
  "Bars show positive sales. Returns remain in the underlying records.": [
    "柱状图显示正销量。退货仍保留于原始记录中。",
    "Bar menunjukkan jualan positif. Pulangan kekal dalam rekod asas."
  ],
  "Next 4 weeks": [
    "未来四周",
    "4 minggu seterusnya"
  ],
  "Missing week": [
    "缺少的一周",
    "Minggu tiada rekod"
  ],
  "A reliable restock estimate is required first.": [
    "须先具备可靠的补货估算。",
    "Anggaran stok semula yang boleh dipercayai diperlukan dahulu."
  ],
  "Enter valid whole-number supplier terms.": [
    "请输入有效的整数供应商条件。",
    "Masukkan syarat pembekal dalam nombor bulat yang sah."
  ],
  "The supplier-adjusted quantity is above the supported order limit.": [
    "按供应商条件调整的数量超出支持的订购上限。",
    "Kuantiti terlaras pembekal melebihi had pesanan yang disokong."
  ],
  "Demand target": ["需求目标", "Sasaran permintaan"],
  "Target minus stock and incoming, rounded up; no extra order when stock already covers it.": ["目标减去现有和在途库存，向上取整；库存足够时无需额外订购。", "Sasaran ditolak stok dan stok masuk, dibundarkan ke atas; tiada pesanan tambahan apabila stok sudah mencukupi."]
};
