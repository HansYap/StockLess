import { epic123Messages } from "./epic123.ts";
import { purchaseMessages } from "./purchase-refresh.ts";
import { savedWorkspaceMessages } from "./saved-workspace.ts";
import { onboardingMessages } from "./onboarding.ts";
import { i3CompletionMessages } from "./i3-completion.ts";
/** English interface copy → Simplified Chinese, Bahasa Melayu. */
export const messages: Record<string, readonly [string, string]> = {
  "Suggested drafts are calculated automatically. Adjust the quantity if needed; zero is a valid order.": ["建议草稿会自动计算。需要时可调整数量；零也是有效订单。", "Draf cadangan dikira secara automatik. Laraskan kuantiti jika perlu; sifar ialah pesanan sah."],
  "Saved buying restrictions are included automatically in suggestions. Check an adjusted order against the demand range.": ["保存的采购限制会自动计入建议。请按需求区间核对调整后的订单。", "Sekatan belian disimpan dikira secara automatik dalam cadangan. Semak pesanan dilaraskan berbanding julat permintaan."],

  "Language": [
    "语言",
    "Bahasa"
  ],
  "StockLess | Your restocking workspace": [
    "StockLess | 补货工作区",
    "StockLess | Ruang kerja penambahan stok"
  ],
  "StockLess | Less food waste. Smarter restocking.": [
    "StockLess | 减少食物浪费，明智补货。",
    "StockLess | Kurangkan pembaziran makanan. Tambah stok dengan bijak."
  ],
  "Opening your workspace…": [
    "正在打开工作区…",
    "Membuka ruang kerja anda…"
  ],
  "Opening your saved dataset…": [
    "正在打开已保存的数据集…",
    "Membuka set data anda yang disimpan…"
  ],
  "Benefits": [
    "优势",
    "Manfaat"
  ],
  "Why StockLess": [
    "为何选择 StockLess",
    "Mengapa StockLess"
  ],
  "How it works": [
    "使用流程",
    "Cara penggunaan"
  ],
  "HOW IT WORKS": [
    "使用流程",
    "CARA PENGGUNAAN"
  ],
  "Get started": [
    "开始使用",
    "Mula sekarang"
  ],
  "Skip to content": [
    "跳至内容",
    "Langkau ke kandungan"
  ],
  "StockLess home": [
    "StockLess 首页",
    "Laman utama StockLess"
  ],
  "Homepage": [
    "首页",
    "Laman utama"
  ],
  "SMALLER RESTOCKS. BIGGER POSSIBILITIES.": [
    "更少积压，更多可能。",
    "STOK LEBIH TERKAWAL. LEBIH BANYAK PELUANG."
  ],
  "Less": [
    "减少",
    "Kurangkan"
  ],
  "food waste.": [
    "食物浪费。",
    "pembaziran makanan."
  ],
  "Lower costs. Higher profits.": [
    "降低成本，提高利润。",
    "Kos lebih rendah. Untung lebih tinggi."
  ],
  "Smarter restocking for small retailers.": [
    "为小型零售商提供明智的补货方案。",
    "Penambahan stok bijak untuk peruncit kecil."
  ],
  "Make the most of what you stock.": [
    "让每一份库存发挥价值。",
    "Manfaatkan stok anda sepenuhnya."
  ],
  "Start with your sales data": [
    "从销售数据开始",
    "Mulakan dengan data jualan"
  ],
  "See how it works": [
    "了解使用流程",
    "Lihat cara penggunaan"
  ],
  "YOUR PURCHASE PLAN, WITH DEMAND EVIDENCE": [
    "以需求数据为依据的采购计划",
    "PELAN PEMBELIAN BERDASARKAN DATA PERMINTAAN"
  ],
  "Interactive example": [
    "交互示例",
    "Contoh interaktif"
  ],
  "SELECTED PRODUCT · SKU 000101": [
    "所选商品 · SKU 000101",
    "PRODUK DIPILIH · SKU 000101"
  ],
  "Ready": [
    "可用",
    "Sedia"
  ],
  "Steady seller": [
    "销售稳定",
    "Jualan stabil"
  ],
  "ESTIMATED RESTOCK": [
    "预计补货量",
    "ANGGARAN TAMBAHAN STOK"
  ],
  "Estimated restock": [
    "预计补货量",
    "Anggaran tambahan stok"
  ],
  "A practical starting quantity for the next four weeks.": [
    "未来四周的参考补货数量。",
    "Kuantiti permulaan praktikal untuk empat minggu akan datang."
  ],
  "Midpoint of range − stock on hand − incoming stock": [
    "需求区间中点 − 现有库存 − 在途库存",
    "Titik tengah julat − stok semasa − stok akan tiba"
  ],
  "DEMAND EVIDENCE": [
    "需求依据",
    "DATA PERMINTAAN"
  ],
  "Demand evidence": [
    "需求依据",
    "Data permintaan"
  ],
  "Past sales and expected demand": [
    "历史销量与预计需求",
    "Jualan lalu dan jangkaan permintaan"
  ],
  "History": [
    "历史销量",
    "Sejarah"
  ],
  "Expected range": [
    "预计区间",
    "Julat jangkaan"
  ],
  "Illustrative weekly sales history followed by a shaded four-week demand range.": [
    "示意图：每周历史销量及阴影显示的未来四周需求区间。",
    "Contoh sejarah jualan mingguan diikuti julat permintaan empat minggu yang berlorek."
  ],
  "Past 8 weeks": [
    "过去 8 周",
    "8 minggu lalu"
  ],
  "Next 4 weeks": [
    "未来 4 周",
    "4 minggu akan datang"
  ],
  "Expected 4-week demand": [
    "预计四周需求",
    "Jangkaan permintaan 4 minggu"
  ],
  "Current stock": [
    "当前库存",
    "Stok semasa"
  ],
  "Recent weekly average": [
    "近期周均销量",
    "Purata mingguan terkini"
  ],
  "Current weeks of cover": [
    "当前库存可售周数",
    "Tempoh bekalan stok semasa (minggu)"
  ],
  "YOUR PURCHASE": [
    "您的采购",
    "PEMBELIAN ANDA"
  ],
  "Your purchase": [
    "您的采购",
    "Pembelian anda"
  ],
  "What are you planning to order?": [
    "您计划订购多少？",
    "Berapakah kuantiti yang ingin dipesan?"
  ],
  "Move either slider. The estimate and purchase check update immediately.": [
    "移动任一滑块，补货估算和采购检查会即时更新。",
    "Gerakkan mana-mana peluncur. Anggaran dan semakan pembelian dikemas kini serta-merta."
  ],
  "Planned order": [
    "计划订购量",
    "Kuantiti pesanan dirancang"
  ],
  "Incoming stock": [
    "在途库存",
    "Stok akan tiba"
  ],
  "Purchase check": [
    "采购检查",
    "Semakan pembelian"
  ],
  "StockLess works this out from stock, incoming stock, planned order and the demand range.": [
    "StockLess 根据现有库存、在途库存、计划订购量及需求区间进行计算。",
    "StockLess mengira berdasarkan stok semasa, stok akan tiba, pesanan dirancang dan julat permintaan."
  ],
  "Illustrative product and figures · Your results depend on your own sales and stock data.": [
    "商品及数字仅作示例 · 实际结果取决于您的销售和库存数据。",
    "Produk dan angka contoh · Keputusan anda bergantung pada data jualan dan stok sendiri."
  ],
  "units": [
    "件",
    "unit"
  ],
  "input by you": [
    "由您输入",
    "dimasukkan oleh anda"
  ],
  "from your file": [
    "来自您的文件",
    "daripada fail anda"
  ],
  "worked out by StockLess": [
    "由 StockLess 计算",
    "dikira oleh StockLess"
  ],
  "Overstock risk": [
    "库存过量风险",
    "Risiko lebihan stok"
  ],
  "Needs review": [
    "需要复核",
    "Perlu disemak"
  ],
  "Looks balanced": [
    "数量适中",
    "Nampak seimbang"
  ],
  "This plan looks too high.": [
    "此计划的订购量偏高。",
    "Kuantiti dalam pelan ini terlalu tinggi."
  ],
  "This plan looks too low.": [
    "此计划的订购量偏低。",
    "Kuantiti dalam pelan ini terlalu rendah."
  ],
  "This plan is within range.": [
    "此计划处于需求区间内。",
    "Pelan ini dalam julat permintaan."
  ],
  "{0} units after this order is above the 36-unit demand range high.": [
    "订购后的 {0} 件库存超过需求上限 36 件。",
    "Stok {0} unit selepas pesanan melebihi had atas permintaan 36 unit."
  ],
  "{0} units after this order is below the 28-unit demand range low.": [
    "订购后的 {0} 件库存低于需求下限 28 件。",
    "Stok {0} unit selepas pesanan kurang daripada had bawah permintaan 28 unit."
  ],
  "{0} units after this order is within the 28–36 unit demand range.": [
    "订购后的 {0} 件库存处于 28–36 件的需求区间内。",
    "Stok {0} unit selepas pesanan dalam julat permintaan 28–36 unit."
  ],
  "{0} units": [
    "{0} 件",
    "{0} unit"
  ],
  "{0} weeks": [
    "{0} 周",
    "{0} minggu"
  ],
  "{0} days": [
    "{0} 天",
    "{0} hari"
  ],
  "THE BIGGER PICTURE": [
    "放眼全局",
    "GAMBARAN KESELURUHAN"
  ],
  "Food waste starts": [
    "食物浪费，始于",
    "Pembaziran makanan bermula"
  ],
  "with what we stock.": [
    "我们的库存决策。",
    "dengan stok yang disimpan."
  ],
  "For small retailers, every restocking decision can mean the difference between selling stock and wasting it.": [
    "对小型零售商而言，每次补货决策都可能决定商品是售出还是浪费。",
    "Bagi peruncit kecil, setiap keputusan menambah stok boleh menentukan sama ada barangan terjual atau terbuang."
  ],
  "1.05B": [
    "10.5 亿",
    "1.05 bilion"
  ],
  "tonnes": [
    "吨",
    "tan"
  ],
  "of food waste generated globally in 2022, including inedible parts.": [
    "2022 年全球产生的食物垃圾总量，包含不可食用部分。",
    "jumlah sisa makanan global pada 2022, termasuk bahagian yang tidak boleh dimakan."
  ],
  "of that food waste came from the retail sector.": [
    "的食物垃圾来自零售行业。",
    "daripada sisa makanan itu datang daripada sektor runcit."
  ],
  "The SDG 12.3 target year for halving per-capita global food waste at retail and consumer levels.": [
    "可持续发展目标 12.3 的目标年份：将零售和消费环节的人均食物浪费减半。",
    "Tahun sasaran SDG 12.3 untuk mengurangkan separuh sisa makanan global per kapita di peringkat runcit dan pengguna."
  ],
  "saved per semester after predictive resource management reduced food spoilage from 20% to 8% in a Malaysian food-service implementation.": [
    "马来西亚一项餐饮实践通过预测式资源管理，将食物变质率从 20% 降至 8%，每学期节省的金额。",
    "penjimatan setiap semester dalam pelaksanaan perkhidmatan makanan di Malaysia selepas pengurusan sumber ramalan mengurangkan kerosakan makanan daripada 20% kepada 8%."
  ],
  "Sources:": [
    "来源：",
    "Sumber:"
  ],
  "UNEP Food Waste Index 2024 ↗": [
    "联合国环境署《2024 年食物浪费指数》↗",
    "Indeks Sisa Makanan UNEP 2024 ↗"
  ],
  "MSU Greenally research ↗": [
    "MSU Greenally 研究 ↗",
    "Kajian MSU Greenally ↗"
  ],
  "Smarter restocking can help prevent waste before it happens.": [
    "明智补货，有助于在浪费发生之前预防它。",
    "Penambahan stok bijak membantu mencegah pembaziran sebelum berlaku."
  ],
  "Fruit and vegetables displayed on shelves in a small retail shop": [
    "小型零售店货架上的水果和蔬菜",
    "Buah-buahan dan sayur-sayuran di rak kedai runcit kecil"
  ],
  "THE BENEFITS": [
    "产品优势",
    "MANFAAT"
  ],
  "Less food waste. Smarter restocking.": [
    "减少食物浪费，明智补货。",
    "Kurangkan pembaziran makanan. Tambah stok dengan bijak."
  ],
  "More sustainable business.": [
    "让生意更可持续。",
    "Perniagaan lebih mampan."
  ],
  "StockLess helps you reduce excess stock and food waste by making smarter restocking decisions.": [
    "StockLess 帮助您作出更明智的补货决策，减少过量库存与食物浪费。",
    "StockLess membantu mengurangkan lebihan stok dan pembaziran makanan melalui keputusan penambahan stok yang lebih bijak."
  ],
  "Spend less on excess stock": [
    "减少过量库存支出",
    "Kurangkan belanja untuk stok berlebihan"
  ],
  "Avoid over-ordering by identifying when planned restocks exceed expected demand.": [
    "识别超过预计需求的补货计划，避免过量订购。",
    "Elakkan pesanan berlebihan dengan mengenal pasti apabila tambahan stok melebihi jangkaan permintaan."
  ],
  "Help prevent food waste": [
    "帮助预防食物浪费",
    "Bantu mencegah pembaziran makanan"
  ],
  "Spot potential overstock early and act before products become stale or expire.": [
    "及早识别潜在积压，在商品变质或过期前采取行动。",
    "Kesan lebihan stok lebih awal dan bertindak sebelum produk rosak atau luput."
  ],
  "Start without new tools": [
    "无需添置新工具",
    "Mula tanpa alat baharu"
  ],
  "Use the sales file you already have. No installation, new hardware, or complex setup.": [
    "使用已有销售文件，无需安装软件、添置硬件或复杂设置。",
    "Gunakan fail jualan sedia ada. Tiada pemasangan, perkakasan baharu atau persediaan rumit."
  ],
  "Keep your data private": [
    "保护数据隐私",
    "Lindungi privasi data"
  ],
  "Your sales records are processed on your device, without sending them to an external server.": [
    "销售记录在您的设备上处理，不会发送至外部服务器。",
    "Rekod jualan diproses pada peranti anda tanpa dihantar ke pelayan luar."
  ],
  "A large pile of discarded vegetables, showing the scale of avoidable food waste": [
    "大量被丢弃的蔬菜，展示可避免的食物浪费规模",
    "Longgokan sayur dibuang yang menunjukkan skala pembaziran makanan yang boleh dielakkan"
  ],
  "Better decisions start before food becomes waste.": [
    "在食物变成垃圾之前，作出更好的决策。",
    "Keputusan lebih baik bermula sebelum makanan menjadi sisa."
  ],
  "MADE FOR YOUR EVERYDAY": [
    "为日常经营而设计",
    "DIREKA UNTUK KEGUNAAN HARIAN"
  ],
  "Why StockLess?": [
    "为何选择 StockLess？",
    "Mengapa StockLess?"
  ],
  "Designed for small retailers who need smarter inventory decisions": [
    "专为需要更明智库存决策的小型零售商设计",
    "Direka untuk peruncit kecil yang memerlukan keputusan stok lebih bijak"
  ],
  "without the cost and complexity of enterprise systems.": [
    "无需承担企业系统的成本与复杂性。",
    "tanpa kos dan kerumitan sistem perusahaan."
  ],
  "Compare features": [
    "功能对比",
    "Bandingkan ciri"
  ],
  "Swipe to explore →": [
    "左右滑动查看 →",
    "Leret untuk melihat →"
  ],
  "Comparison of StockLess, ERP software and Excel": [
    "StockLess、ERP 软件与 Excel 的比较",
    "Perbandingan StockLess, perisian ERP dan Excel"
  ],
  "How StockLess compares with typical ERP and spreadsheet workflows. Capabilities vary by product and setup.": [
    "StockLess 与典型 ERP 和电子表格工作流程的比较。具体功能取决于产品及设置。",
    "Perbandingan StockLess dengan aliran kerja ERP dan hamparan biasa. Keupayaan bergantung pada produk dan persediaan."
  ],
  "What matters to your shop": [
    "您店铺关心的事项",
    "Keperluan kedai anda"
  ],
  "PURPOSE-BUILT": [
    "专为零售打造",
    "DIREKA KHUSUS"
  ],
  "ERP software": [
    "ERP 软件",
    "Perisian ERP"
  ],
  "Built for small retailers": [
    "面向小型零售商",
    "Untuk peruncit kecil"
  ],
  "Simple & focused": [
    "简洁且专注",
    "Ringkas dan fokus"
  ],
  "Scope varies by system": [
    "范围因系统而异",
    "Skop berbeza mengikut sistem"
  ],
  "Flexible spreadsheets": [
    "灵活的电子表格",
    "Hamparan fleksibel"
  ],
  "Restocking recommendations": [
    "补货建议",
    "Cadangan tambahan stok"
  ],
  "Demand-based guidance": [
    "基于需求的指导",
    "Panduan berasaskan permintaan"
  ],
  "Depends on modules": [
    "取决于模块",
    "Bergantung pada modul"
  ],
  "Build your own formulas": [
    "自行编写公式",
    "Bina formula sendiri"
  ],
  "Demand insights": [
    "需求洞察",
    "Pemahaman permintaan"
  ],
  "Based on sales patterns": [
    "基于销售模式",
    "Berdasarkan corak jualan"
  ],
  "Available with setup": [
    "配置后可用",
    "Tersedia selepas persediaan"
  ],
  "Manual analysis or formulas": [
    "手动分析或公式",
    "Analisis manual atau formula"
  ],
  "Food-waste prevention": [
    "预防食物浪费",
    "Pencegahan pembaziran makanan"
  ],
  "Flags potential overstock": [
    "标记潜在库存过量",
    "Menandakan potensi lebihan stok"
  ],
  "Depends on configuration": [
    "取决于配置",
    "Bergantung pada konfigurasi"
  ],
  "Requires a custom workflow": [
    "需要自定义工作流程",
    "Memerlukan aliran kerja tersuai"
  ],
  "Getting started": [
    "开始使用",
    "Mula menggunakan"
  ],
  "Import your sales CSV": [
    "导入销售 CSV",
    "Import CSV jualan anda"
  ],
  "Implementation varies": [
    "实施方式各异",
    "Pelaksanaan berbeza-beza"
  ],
  "Create your workbook": [
    "创建工作簿",
    "Cipta buku kerja anda"
  ],
  "Technical expertise": [
    "技术要求",
    "Kepakaran teknikal"
  ],
  "Guided, step by step": [
    "分步引导",
    "Panduan langkah demi langkah"
  ],
  "Training may be needed": [
    "可能需要培训",
    "Latihan mungkin diperlukan"
  ],
  "Depends on workbook complexity": [
    "取决于工作簿复杂程度",
    "Bergantung pada kerumitan buku kerja"
  ],
  "Sales data privacy": [
    "销售数据隐私",
    "Privasi data jualan"
  ],
  "Processed on your device": [
    "在您的设备上处理",
    "Diproses pada peranti anda"
  ],
  "Depends on provider": [
    "取决于服务商",
    "Bergantung pada penyedia"
  ],
  "Depends on storage settings": [
    "取决于存储设置",
    "Bergantung pada tetapan storan"
  ],
  "A guide to typical workflows. ERP and spreadsheet capabilities vary with product, configuration, and storage.": [
    "典型工作流程参考。ERP 和电子表格功能因产品、配置与存储方式而异。",
    "Panduan aliran kerja biasa. Keupayaan ERP dan hamparan berbeza mengikut produk, konfigurasi dan storan."
  ],
  "Smarter than spreadsheets. Simpler than enterprise systems.": [
    "比电子表格更智能，比企业系统更简单。",
    "Lebih pintar daripada hamparan. Lebih mudah daripada sistem perusahaan."
  ],
  "Supporting Sustainable Development Goal 12: Responsible consumption and production": [
    "支持可持续发展目标 12：负责任消费和生产",
    "Menyokong Matlamat Pembangunan Mampan 12: Penggunaan dan pengeluaran bertanggungjawab"
  ],
  "RESPONSIBLE": [
    "负责任的",
    "BERTANGGUNGJAWAB"
  ],
  "CONSUMPTION": [
    "消费",
    "PENGGUNAAN"
  ],
  "AND PRODUCTION": [
    "与生产",
    "DAN PENGELUARAN"
  ],
  "A shared goal. An everyday action.": [
    "共同的目标，每天的行动。",
    "Matlamat bersama. Tindakan setiap hari."
  ],
  "GOOD FOR YOUR SHOP. BETTER FOR THE PLANET.": [
    "有益店铺，也有益地球。",
    "BAIK UNTUK KEDAI ANDA. LEBIH BAIK UNTUK BUMI."
  ],
  "Small decisions.": [
    "小小决策。",
    "Keputusan kecil."
  ],
  "Less waste.": [
    "更少浪费。",
    "Kurang pembaziran."
  ],
  "Smarter restocking decisions can help small retailers save money while preventing food from becoming waste.": [
    "更明智的补货决策，有助于小型零售商节省成本并减少食物浪费。",
    "Keputusan penambahan stok bijak membantu peruncit kecil menjimatkan wang sambil mencegah pembaziran makanan."
  ],
  "Every restocking decision matters. StockLess uses your existing sales data to help you identify unnecessary orders and potential excess stock. Less stock sitting on shelves can mean less food going to waste.": [
    "每次补货决策都很重要。StockLess 利用现有销售数据识别不必要的订单及潜在库存积压。减少货架上的滞留库存，也有助于减少食物浪费。",
    "Setiap keputusan menambah stok penting. StockLess menggunakan data jualan sedia ada untuk mengenal pasti pesanan tidak perlu dan potensi lebihan stok. Kurang stok terbiar di rak boleh mengurangkan makanan yang terbuang."
  ],
  "Supporting responsible consumption": [
    "支持负责任消费",
    "Menyokong penggunaan bertanggungjawab"
  ],
  "From data to less waste.": [
    "用数据，减少浪费。",
    "Daripada data kepada kurang pembaziran."
  ],
  "Turn everyday sales data into smarter restocking decisions.": [
    "将日常销售数据转化为更明智的补货决策。",
    "Tukarkan data jualan harian kepada keputusan penambahan stok yang lebih bijak."
  ],
  "Let’s get started": [
    "开始使用",
    "Mari mulakan"
  ],
  "Upload your sales data": [
    "上传销售数据",
    "Muat naik data jualan"
  ],
  "Import your existing sales CSV, or explore the sample data to see how StockLess works.": [
    "导入现有销售 CSV，或使用示例数据了解 StockLess。",
    "Import CSV jualan sedia ada atau cuba data contoh untuk memahami StockLess."
  ],
  "Prepare it with StockLess": [
    "使用 StockLess 整理数据",
    "Sediakan data dengan StockLess"
  ],
  "Confirm your columns and review missing values or date formats with guided checks.": [
    "通过引导式检查确认字段，并复核缺失值或日期格式。",
    "Sahkan lajur dan semak nilai hilang atau format tarikh melalui semakan berpandu."
  ],
  "Understand your demand": [
    "了解商品需求",
    "Fahami permintaan anda"
  ],
  "See sales patterns, expected demand, and where your data needs more confidence.": [
    "查看销售模式、预计需求，以及数据仍需补充的部分。",
    "Lihat corak jualan, jangkaan permintaan dan bahagian data yang perlu diperkukuh."
  ],
  "Review your restocking plan": [
    "复核补货计划",
    "Semak pelan tambahan stok"
  ],
  "Compare purchase scenarios to spot potential excess stock and control costs.": [
    "比较不同采购方案，识别潜在过量库存并控制成本。",
    "Bandingkan senario pembelian untuk mengenal pasti lebihan stok dan mengawal kos."
  ],
  "MAKE YOUR NEXT ORDER A SMARTER ONE": [
    "让下一次订购更明智",
    "JADIKAN PESANAN SETERUSNYA LEBIH BIJAK"
  ],
  "A little less stock.": [
    "少一点库存。",
    "Sedikit kurang stok."
  ],
  "A lot more possibility.": [
    "多很多可能。",
    "Lebih banyak peluang."
  ],
  "Open StockLess": [
    "打开 StockLess",
    "Buka StockLess"
  ],
  "Use your own CSV or start with a sample.": [
    "使用自己的 CSV，或从示例开始。",
    "Gunakan CSV sendiri atau mulakan dengan contoh."
  ],
  "Fresh produce ready for customers in a small shop": [
    "小店中等待顾客选购的新鲜农产品",
    "Hasil segar untuk pelanggan di kedai kecil"
  ],
  "Back to StockLess home": [
    "返回 StockLess 首页",
    "Kembali ke laman utama StockLess"
  ],
  "Smarter restocking. Less food waste.": [
    "明智补货，减少食物浪费。",
    "Tambah stok dengan bijak. Kurangkan pembaziran makanan."
  ],
  "Back to top ↑": [
    "返回顶部 ↑",
    "Kembali ke atas ↑"
  ],
  "Upload": [
    "上传",
    "Muat naik"
  ],
  "Map columns": [
    "匹配字段",
    "Padankan lajur"
  ],
  "Check readiness": [
    "检查数据",
    "Semak kesediaan"
  ],
  "Plan purchases": [
    "采购计划",
    "Rancang pembelian"
  ],
  "StockLess — upload": [
    "StockLess — 上传",
    "StockLess — muat naik"
  ],
  "← Homepage": [
    "← 首页",
    "← Laman utama"
  ],
  "Active session": [
    "当前会话",
    "Sesi aktif"
  ],
  "Sample data": [
    "示例数据",
    "Data contoh"
  ],
  "Retailer file": [
    "商家文件",
    "Fail peruncit"
  ],
  "Clear session": [
    "清除本次数据",
    "Kosongkan sesi"
  ],
  "Progress": [
    "进度",
    "Kemajuan"
  ],
  "Start with what you already have": [
    "从已有数据开始",
    "MULAKAN DENGAN DATA SEDIA ADA"
  ],
  "Upload your existing sales file.": [
    "上传您已有的销售文件。",
    "Muat naik fail jualan sedia ada."
  ],
  "What data can StockLess use?": [
    "StockLess 可以使用哪些数据？",
    "Apakah data yang boleh digunakan oleh StockLess?"
  ],
  "Start with the three required attributes. The six optional attributes are not needed to continue.": [
    "先准备三个必填属性。其余六个可选属性不影响继续操作。",
    "Mulakan dengan tiga atribut wajib. Enam atribut pilihan tidak diperlukan untuk meneruskan."
  ],
  "Required data": [
    "必填数据",
    "Data wajib"
  ],
  "Optional data": [
    "可选数据",
    "Data pilihan"
  ],
  "Required": [
    "必填",
    "Wajib"
  ],
  "Optional": [
    "可选",
    "Pilihan"
  ],
  "attributes": [
    "个属性",
    "atribut"
  ],
  "Unlocks": [
    "支持功能",
    "Membolehkan"
  ],
  "Two accepted ways to name a product": [
    "两种可接受的商品标识方式",
    "Dua cara yang diterima untuk mengenal pasti produk"
  ],
  "Reading the file": [
    "正在读取文件",
    "Membaca fail"
  ],
  "Detecting the delimiter": [
    "正在识别分隔符",
    "Mengesan pemisah"
  ],
  "Parsing rows": [
    "正在解析数据行",
    "Menghurai baris"
  ],
  "Finishing up": [
    "正在完成处理",
    "Menyelesaikan proses"
  ],
  "Working in this browser…": [
    "正在浏览器中处理…",
    "Sedang diproses dalam pelayar ini…"
  ],
  "Import progress": [
    "导入进度",
    "Kemajuan import"
  ],
  "Cancel": [
    "取消",
    "Batal"
  ],
  "Drop your CSV file here": [
    "将 CSV 文件拖放到这里",
    "Letakkan fail CSV anda di sini"
  ],
  "Use the export from your POS, marketplace or spreadsheet.": [
    "使用从收银系统、电商平台或电子表格导出的文件。",
    "Gunakan fail eksport daripada POS, platform jualan atau hamparan anda."
  ],
  "Choose CSV file": [
    "选择 CSV 文件",
    "Pilih fail CSV"
  ],
  "Use sample file": [
    "使用示例文件",
    "Gunakan fail contoh"
  ],
  "up to": [
    "最大",
    "sehingga"
  ],
  "rows ·": [
    "行 ·",
    "baris ·"
  ],
  "comma, semicolon or tab": [
    "逗号、分号或制表符分隔",
    "koma, koma bertitik atau tab"
  ],
  "Your sales figures stay in this browser.": [
    "销售数据仅保留在本浏览器中。",
    "Angka jualan anda kekal dalam pelayar ini."
  ],
  "Import cancelled.": [
    "已取消导入。",
    "Import dibatalkan."
  ],
  "Sample unavailable": [
    "示例暂不可用",
    "Contoh tidak tersedia"
  ],
  "Confirm what your columns mean": [
    "确认每一列的含义",
    "SAHKAN MAKSUD LAJUR ANDA"
  ],
  "We found likely matches.": [
    "已找到可能的匹配。",
    "Kami menemui padanan yang mungkin."
  ],
  "Check them before continuing.": [
    "请检查后继续。",
    "Semak sebelum meneruskan."
  ],
  "Your original file is not changed. Mapping only tells StockLess how to interpret it during this session.": [
    "原始文件不会改变。字段匹配仅用于告诉 StockLess 如何解读本次数据。",
    "Fail asal tidak diubah. Padanan hanya memberitahu StockLess cara mentafsir data untuk sesi ini."
  ],
  "columns ·": [
    "列 ·",
    "lajur ·"
  ],
  "KB · delimiter": [
    "KB · 分隔符",
    "KB · pemisah"
  ],
  "✓ Read successfully": [
    "✓ 读取成功",
    "✓ Berjaya dibaca"
  ],
  "Column mapping": [
    "字段匹配",
    "Padanan lajur"
  ],
  "Nothing is applied until you confirm it. Sale date, quantity sold and how your products are named or coded are required.": [
    "确认后才会应用匹配。销售日期、销售数量和商品标识是必填项。",
    "Padanan hanya digunakan selepas disahkan. Tarikh jualan, kuantiti dijual dan pengenalan produk diperlukan."
  ],
  "confirmed": [
    "已确认",
    "disahkan"
  ],
  "All matches look right?": [
    "所有匹配都正确？",
    "Semua padanan betul?"
  ],
  "Confirm all selected columns and continue in one step.": [
    "一键确认所有已选字段并进入下一步。",
    "Sahkan semua lajur dipilih dan teruskan dalam satu langkah."
  ],
  "Products will be kept separate using:": [
    "将使用以下方式区分商品：",
    "Produk akan dibezakan menggunakan:"
  ],
  "Still needed:": [
    "仍需补充：",
    "Masih diperlukan:"
  ],
  "Looks well, next step": [
    "确认无误，下一步",
    "Semuanya betul, langkah seterusnya"
  ],
  "Resolve columns used more than once": [
    "请先修正重复使用的列",
    "Selesaikan lajur yang digunakan lebih daripada sekali"
  ],
  "StockLess field": [
    "StockLess 字段",
    "Medan StockLess"
  ],
  "Your column": [
    "您的数据列",
    "Lajur anda"
  ],
  "Preview": [
    "预览",
    "Pratonton"
  ],
  "Status": [
    "状态",
    "Status"
  ],
  "Not in this file": [
    "文件中没有此项",
    "Tiada dalam fail ini"
  ],
  "Confirmed": [
    "已确认",
    "Disahkan"
  ],
  "Suggested — please check": [
    "建议匹配，请检查",
    "Cadangan — sila semak"
  ],
  "Confirm": [
    "确认",
    "Sahkan"
  ],
  "Not matched yet": [
    "尚未匹配",
    "Belum dipadankan"
  ],
  "How should products be kept separate?": [
    "如何区分不同商品？",
    "Bagaimanakah produk perlu dibezakan?"
  ],
  "Pick one path and confirm it. This choice is recorded as evidence for the rest of the session.": [
    "选择一种方式并确认。本次会话的后续处理将使用此选择。",
    "Pilih satu cara dan sahkannya. Pilihan ini direkodkan untuk pemprosesan seterusnya dalam sesi ini."
  ],
  "Use this path": [
    "使用此方式",
    "Gunakan cara ini"
  ],
  "Confirm its columns first": [
    "请先确认所需字段",
    "Sahkan lajurnya dahulu"
  ],
  "One identity conflict": [
    "一处商品标识冲突",
    "Satu konflik pengenalan"
  ],
  "{0} identity conflicts": [
    "{0} 处商品标识冲突",
    "{0} konflik pengenalan"
  ],
  "covers more than one pack size": [
    "对应多个包装规格",
    "merangkumi lebih daripada satu saiz pek"
  ],
  "maps to more than one product code": [
    "对应多个商品编码",
    "dipadankan dengan lebih daripada satu kod produk"
  ],
  "(rows": [
    "（行",
    "(baris"
  ],
  "This file unlocks": [
    "此文件支持的功能",
    "Fungsi yang tersedia dengan fail ini"
  ],
  "Capabilities follow the columns you confirmed, not the column names themselves.": [
    "功能取决于已确认的字段，而非原始列名。",
    "Fungsi bergantung pada lajur yang disahkan, bukan nama lajur semata-mata."
  ],
  "You can do this now": [
    "现在可用",
    "Boleh digunakan sekarang"
  ],
  "Needs more information": [
    "需要更多信息",
    "Perlu maklumat tambahan"
  ],
  "Locked until iteration 3": [
    "第三次迭代后开放",
    "Tersedia mulai iterasi 3"
  ],
  "← Choose another file": [
    "← 选择其他文件",
    "← Pilih fail lain"
  ],
  "Run readiness check →": [
    "检查数据 →",
    "Jalankan semakan kesediaan →"
  ],
  "Run readiness check": [
    "检查数据",
    "Jalankan semakan kesediaan"
  ],
  "Checking locally…": [
    "正在本地检查…",
    "Menyemak secara setempat…"
  ],
  "· Limited data": [
    "· 数据有限",
    "· Data terhad"
  ],
  "Limited data": [
    "数据有限",
    "Data terhad"
  ],
  "Data readiness · snapshot": [
    "数据检查 · 快照",
    "Kesediaan data · snapshot"
  ],
  "Your file is ready to review.": [
    "文件已准备好，可进行复核。",
    "Fail anda sedia untuk disemak."
  ],
  "Your file is usable, with evidence to review.": [
    "文件可用，部分数据需要复核。",
    "Fail anda boleh digunakan, dengan data yang perlu disemak."
  ],
  "Every result below comes from one local readiness snapshot. Original cells remain unchanged, missing weeks stay distinct from zero sales, and rows left out remain traceable.": [
    "以下结果均来自同一次本地数据检查。原始单元格保持不变，缺失周与零销量会分别处理，被排除的行仍可追溯。",
    "Semua keputusan di bawah datang daripada satu snapshot semakan setempat. Sel asal tidak berubah, minggu hilang dibezakan daripada jualan sifar, dan baris dikecualikan boleh dijejaki."
  ],
  "Refreshing the readiness evidence locally…": [
    "正在本地更新检查结果…",
    "Mengemas kini hasil semakan secara setempat…"
  ],
  "Exact row reconciliation": [
    "数据行核对",
    "Penyelarasan baris tepat"
  ],
  "rows in =": [
    "行输入 =",
    "baris input ="
  ],
  "used +": [
    "行使用 +",
    "digunakan +"
  ],
  "left out.": [
    "行排除。",
    "dikecualikan."
  ],
  "used rows had safe representation-only normalization.": [
    "行已安全规范化，仅调整表示形式。",
    "baris digunakan telah dinormalkan dengan selamat pada format paparan sahaja."
  ],
  "usable rows of": [
    "行可用，总行数",
    "baris boleh digunakan daripada"
  ],
  "Date issues": [
    "日期问题",
    "Isu tarikh"
  ],
  "Invalid or unconfirmed date values": [
    "无效或尚未确认的日期",
    "Nilai tarikh tidak sah atau belum disahkan"
  ],
  "Quantity issues": [
    "数量问题",
    "Isu kuantiti"
  ],
  "Invalid or conflicting quantity values": [
    "无效或互相冲突的数量",
    "Nilai kuantiti tidak sah atau bercanggah"
  ],
  "Missing identity": [
    "缺少商品标识",
    "Pengenalan hilang"
  ],
  "Rows without the chosen product identity": [
    "缺少所选商品标识的数据行",
    "Baris tanpa pengenalan produk yang dipilih"
  ],
  "Exact duplicates": [
    "完全重复的行",
    "Pendua tepat"
  ],
  "Matching source rows needing a decision": [
    "需要您决定如何处理的重复行",
    "Baris sumber sepadan yang memerlukan keputusan"
  ],
  "Stock evidence": [
    "库存数据",
    "Data stok"
  ],
  "Optional stock values that limit cover": [
    "影响库存可售周数的可选库存数据",
    "Nilai stok pilihan yang mengehadkan tempoh bekalan"
  ],
  "Fix": [
    "修正",
    "Betulkan"
  ],
  "Review": [
    "复核",
    "Semak"
  ],
  "Readiness decisions": [
    "数据处理决定",
    "Keputusan semakan data"
  ],
  "Date format": [
    "日期格式",
    "Format tarikh"
  ],
  "These values match more than one format. Choose the format used by the whole column.": [
    "这些值符合多种日期格式，请选择整列使用的格式。",
    "Nilai ini sepadan dengan beberapa format. Pilih format yang digunakan oleh seluruh lajur."
  ],
  "Confirm the one detected non-ISO format before these dates are used.": [
    "使用这些日期前，请确认检测到的非 ISO 格式。",
    "Sahkan format bukan ISO yang dikesan sebelum tarikh ini digunakan."
  ],
  "{0} is explicitly confirmed for this column.": [
    "此列已明确确认为 {0} 格式。",
    "Format {0} telah disahkan untuk lajur ini."
  ],
  "{0} confirmed": [
    "已确认 {0}",
    "{0} disahkan"
  ],
  "Confirm {0}": [
    "确认 {0}",
    "Sahkan {0}"
  ],
  "Exact duplicate": [
    "完全重复项",
    "Pendua tepat"
  ],
  "Rows": [
    "行",
    "Baris"
  ],
  "These rows are identical. Your row count is unchanged and every row remains in use until you decide.": [
    "这些行完全相同。在您作出决定前，行数保持不变，每一行都会被使用。",
    "Baris ini sama sepenuhnya. Bilangan baris tidak berubah dan semua baris digunakan sehingga anda membuat keputusan."
  ],
  "You chose “keep both”. Every row remains in use and your row count is unchanged.": [
    "您选择了“全部保留”。每一行继续使用，行数保持不变。",
    "Anda memilih “kekalkan kedua-duanya”. Semua baris terus digunakan dan bilangan baris tidak berubah."
  ],
  "You chose “these are duplicates”. Row {0} remains in use; rows {1} are left out and marked as duplicates you confirmed.": [
    "您选择了“确认为重复行”。保留第 {0} 行，第 {1} 行被排除并标记为已确认的重复行。",
    "Anda memilih “ini pendua”. Baris {0} dikekalkan; baris {1} dikecualikan dan ditandakan sebagai pendua yang disahkan."
  ],
  "Warning for": [
    "请注意",
    "Amaran untuk"
  ],
  ": these products cannot pass the order check until you decide.": [
    "：作出决定前，这些商品无法通过采购检查。",
    ": produk ini tidak boleh lulus semakan pesanan sehingga anda membuat keputusan."
  ],
  "keep both": [
    "全部保留",
    "kekalkan kedua-duanya"
  ],
  "these are duplicates": [
    "确认为重复行",
    "ini pendua"
  ],
  "Problems and tidy-ups": [
    "问题与整理记录",
    "Masalah dan rekod pembetulan format"
  ],
  "Problems are filtered by the selected card.": [
    "已按所选卡片筛选问题。",
    "Masalah ditapis mengikut kad dipilih."
  ],
  "Problems and permitted tidy-ups from this same local snapshot.": [
    "来自同一次本地检查的问题与允许的整理操作。",
    "Masalah dan pembetulan format yang dibenarkan daripada snapshot setempat yang sama."
  ],
  "0 problems": [
    "0 个问题",
    "0 masalah"
  ],
  "Nothing to correct in this selection.": [
    "当前选择中没有需要修正的内容。",
    "Tiada pembetulan diperlukan dalam pilihan ini."
  ],
  "Row": [
    "行",
    "Baris"
  ],
  "Product": [
    "商品",
    "Produk"
  ],
  "Issue": [
    "问题",
    "Isu"
  ],
  "Observed value": [
    "原始值",
    "Nilai diperhatikan"
  ],
  "Reason and action": [
    "原因及处理方式",
    "Sebab dan tindakan"
  ],
  "Use": [
    "处理结果",
    "Penggunaan"
  ],
  "Unknown": [
    "未知",
    "Tidak diketahui"
  ],
  "blank": [
    "空白",
    "kosong"
  ],
  "Left out": [
    "已排除",
    "Dikecualikan"
  ],
  "Used": [
    "已使用",
    "Digunakan"
  ],
  "Problem pages": [
    "问题分页",
    "Halaman masalah"
  ],
  "Every problem is included in the download.": [
    "下载文件包含全部问题。",
    "Semua masalah disertakan dalam muat turun."
  ],
  "← Previous": [
    "← 上一页",
    "← Sebelumnya"
  ],
  "Page": [
    "页",
    "Halaman"
  ],
  "of": [
    "/",
    "daripada"
  ],
  "Next →": [
    "下一页 →",
    "Seterusnya →"
  ],
  "Every tidy-up": [
    "全部整理记录",
    "Semua pembetulan format"
  ],
  "Each event shows its source row, exact before-and-after value, and the tidy-up.": [
    "每条记录展示来源行、修改前后的精确值及整理方式。",
    "Setiap rekod menunjukkan baris sumber, nilai tepat sebelum dan selepas, serta pembetulan format."
  ],
  "events": [
    "条记录",
    "rekod"
  ],
  "Row number": [
    "行号",
    "Nombor baris"
  ],
  "Column": [
    "列",
    "Lajur"
  ],
  "What was there before": [
    "原始内容",
    "Nilai sebelum"
  ],
  "What it is now": [
    "整理后内容",
    "Nilai selepas"
  ],
  "Tidy-up applied": [
    "执行的整理",
    "Pembetulan format dibuat"
  ],
  "Tidy-up pages": [
    "整理记录分页",
    "Halaman pembetulan format"
  ],
  "Showing": [
    "显示",
    "Memaparkan"
  ],
  "Trim leading and trailing whitespace": [
    "去除首尾空白",
    "Buang ruang kosong di awal dan akhir"
  ],
  "Normalise line endings": [
    "统一换行符",
    "Seragamkan pemisah baris"
  ],
  "Use the retailer-confirmed date format": [
    "使用商家确认的日期格式",
    "Gunakan format tarikh yang disahkan peruncit"
  ],
  "· Each product starts at its own first observed week and ends at its own last observed week.": [
    "· 每件商品的时间范围从首个有记录的周开始，到最后一个有记录的周结束。",
    "· Setiap produk bermula pada minggu pertama direkodkan dan berakhir pada minggu terakhir direkodkan."
  ],
  "No valid demand rows are available.": [
    "没有可用的有效需求数据行。",
    "Tiada baris permintaan sah tersedia."
  ],
  "products": [
    "件商品",
    "produk"
  ],
  "product": [
    "件商品",
    "produk"
  ],
  "observed ·": [
    "周有记录 ·",
    "direkodkan ·"
  ],
  "in span ·": [
    "周跨度 ·",
    "dalam tempoh ·"
  ],
  "missing": [
    "缺失",
    "hilang"
  ],
  "to": [
    "至",
    "hingga"
  ],
  "Missing": [
    "缺失",
    "Hilang"
  ],
  "Confirmed zero": [
    "已确认零销量",
    "Sifar disahkan"
  ],
  "Net zero + activity": [
    "有交易但净销量为零",
    "Bersih sifar dengan aktiviti"
  ],
  "Observed demand": [
    "已记录需求",
    "Permintaan direkodkan"
  ],
  "Standard": [
    "标准",
    "Standard"
  ],
  "Age is measured in calendar days at Asia/Kuala_Lumpur midnight.": [
    "库龄按吉隆坡时区午夜计算自然日数。",
    "Usia stok dikira dalam hari kalendar pada tengah malam waktu Asia/Kuala_Lumpur."
  ],
  "As at": [
    "截至",
    "Setakat"
  ],
  "Snapshot:": [
    "快照日期：",
    "Tarikh snapshot:"
  ],
  "Age:": [
    "库龄：",
    "Usia:"
  ],
  "Cover unavailable:": [
    "无法计算可售周数：",
    "Tempoh bekalan tidak tersedia:"
  ],
  "stock evidence incomplete": [
    "库存数据不完整",
    "data stok tidak lengkap"
  ],
  "Current · 0–7 days old": [
    "较新 · 0–7 天",
    "Terkini · berusia 0–7 hari"
  ],
  "Getting old · 8–14 days old": [
    "逐渐过时 · 8–14 天",
    "Semakin lama · berusia 8–14 hari"
  ],
  "Too old to rely on · more than 14 days old": [
    "过旧，不宜依赖 · 超过 14 天",
    "Terlalu lama untuk dipercayai · melebihi 14 hari"
  ],
  "Stock count date missing": [
    "缺少盘点日期",
    "Tarikh kiraan stok tiada"
  ],
  "Stock count date invalid": [
    "盘点日期无效",
    "Tarikh kiraan stok tidak sah"
  ],
  "Stock count date is in the future": [
    "盘点日期在未来",
    "Tarikh kiraan stok pada masa hadapan"
  ],
  "Stock count cannot be relied on": [
    "库存盘点数据不可依赖",
    "Kiraan stok tidak boleh dipercayai"
  ],
  "↓ Download problems": [
    "↓ 下载问题报告",
    "↓ Muat turun masalah"
  ],
  "Estimating demand locally…": [
    "正在本地估算需求…",
    "Menganggar permintaan secara setempat…"
  ],
  "Review demand →": [
    "查看需求 →",
    "Semak permintaan →"
  ],
  "← Back to mapping": [
    "← 返回字段匹配",
    "← Kembali ke padanan"
  ],
  "{0} duplicate decision{1} remain; affected products have Limited data.": [
    "仍有 {0} 个重复项待处理；受影响商品的数据有限。",
    "Masih ada {0} keputusan pendua; data produk terjejas adalah terhad."
  ],
  "Calculations use {0} valid rows only.": [
    "计算仅使用 {0} 行有效数据。",
    "Pengiraan hanya menggunakan {0} baris sah."
  ],
  "Showing {0}–{1} of {2}": [
    "显示 {0}–{1}，共 {2} 项",
    "Memaparkan {0}–{1} daripada {2}"
  ],
  "The readiness check could not be completed.": [
    "无法完成数据检查。",
    "Semakan kesediaan tidak dapat diselesaikan."
  ],
  "Demand estimation could not be completed.": [
    "无法完成需求估算。",
    "Anggaran permintaan tidak dapat diselesaikan."
  ],
  "Sample data loaded.": [
    "已加载示例数据。",
    "Data contoh dimuatkan."
  ],
  "Retailer file loaded locally.": [
    "已在本地加载商家文件。",
    "Fail peruncit dimuatkan secara setempat."
  ],
  "The mapping could not be updated.": [
    "无法更新字段匹配。",
    "Padanan tidak dapat dikemas kini."
  ],
  "The field could not be confirmed.": [
    "无法确认此字段。",
    "Medan ini tidak dapat disahkan."
  ],
  "The identity could not be confirmed.": [
    "无法确认商品标识方式。",
    "Cara pengenalan produk tidak dapat disahkan."
  ],
  "Readiness evidence needs to be refreshed": [
    "需要更新数据检查结果",
    "Hasil semakan perlu dikemas kini"
  ],
  "Run the check again after confirming the current mappings.": [
    "确认当前匹配后，请重新运行检查。",
    "Jalankan semakan semula selepas mengesahkan padanan semasa."
  ],
  "Purchase plan ·": [
    "采购计划 ·",
    "Pelan pembelian ·"
  ],
  "Plan what to restock, then check it before you order.": [
    "规划补货，并在下单前检查。",
    "Rancang stok tambahan dan semak sebelum memesan."
  ],
  "Start with StockLess's estimated quantity, enter what you intend to buy, and see whether the plan fits expected demand.": [
    "参考 StockLess 的预计数量，输入计划购买量，检查是否符合预计需求。",
    "Mulakan dengan anggaran StockLess, masukkan kuantiti pembelian anda dan semak sama ada pelan sesuai dengan jangkaan permintaan."
  ],
  "↓ Download purchase summary": [
    "↓ 下载采购摘要",
    "↓ Muat turun ringkasan pembelian"
  ],
  "Your figures stay local.": [
    "您的数据仅保留在本地。",
    "Angka anda kekal setempat."
  ],
  "Typed order quantities last for this visit only and are not sent to a supplier.": [
    "输入的订购量仅保留在本次访问中，不会发送给供应商。",
    "Kuantiti pesanan yang dimasukkan hanya disimpan untuk lawatan ini dan tidak dihantar kepada pembekal."
  ],
  "Purchase planning instructions": [
    "采购计划说明",
    "Arahan perancangan pembelian"
  ],
  "Instructions": [
    "使用说明",
    "Arahan"
  ],
  "Select a product to plan its next order.": [
    "选择商品，规划下一次订购。",
    "Pilih produk untuk merancang pesanan seterusnya."
  ],
  "Click any row below to review its forecast, enter incoming stock and planned order, and receive a purchase check.": [
    "点击下方任意商品，查看预测，输入在途库存和计划订购量，获取采购检查结果。",
    "Klik mana-mana baris untuk menyemak ramalan, memasukkan stok akan tiba serta pesanan dirancang, dan mendapatkan semakan pembelian."
  ],
  "Product data labels": [
    "商品数据状态",
    "Label data produk"
  ],
  "All": [
    "全部",
    "Semua"
  ],
  "Limited": [
    "有限",
    "Terhad"
  ],
  "Cannot assess": [
    "无法评估",
    "Tidak dapat dinilai"
  ],
  "Evidence mismatch affects": [
    "数据不一致影响了",
    "Ketidakpadanan data menjejaskan"
  ],
  ". These products remain listed but cannot be evaluated. Return to readiness and refresh the forecast.": [
    "。这些商品仍会显示，但无法评估。请返回数据检查并更新预测。",
    ". Produk ini kekal dalam senarai tetapi tidak dapat dinilai. Kembali ke semakan kesediaan dan kemas kini ramalan."
  ],
  "All products": [
    "全部商品",
    "Semua produk"
  ],
  "Your purchase plan": [
    "您的采购计划",
    "Pelan pembelian anda"
  ],
  "Select a product to enter quantities and see its evidence and full calculation.": [
    "选择商品，输入数量并查看依据及完整计算过程。",
    "Pilih produk untuk memasukkan kuantiti dan melihat data serta pengiraan penuh."
  ],
  "shown": [
    "已显示",
    "dipaparkan"
  ],
  "Search products": [
    "搜索商品",
    "Cari produk"
  ],
  "Search by product name or SKU": [
    "按商品名称或 SKU 搜索",
    "Cari mengikut nama produk atau SKU"
  ],
  "Only products I am ordering": [
    "只显示我计划订购的商品",
    "Hanya produk yang saya pesan"
  ],
  "Expiry not checked — your file has no expiry dates": [
    "未检查保质期 — 文件中没有到期日期",
    "Tarikh luput tidak disemak — fail anda tiada tarikh luput"
  ],
  "4-week demand": [
    "四周需求",
    "Permintaan 4 minggu"
  ],
  "Data label": [
    "数据状态",
    "Label data"
  ],
  "Open action": [
    "打开操作",
    "Tindakan buka"
  ],
  "No range": [
    "暂无区间",
    "Tiada julat"
  ],
  "for the next 4 weeks": [
    "未来四周",
    "untuk 4 minggu akan datang"
  ],
  "No estimate": [
    "暂无估算",
    "Tiada anggaran"
  ],
  "Evidence not usable": [
    "依据不可用",
    "Data tidak boleh digunakan"
  ],
  "No products match": [
    "没有匹配的商品",
    "Tiada produk sepadan"
  ],
  "No products are available. Return to readiness to review your data.": [
    "没有可用商品，请返回数据检查页面复核数据。",
    "Tiada produk tersedia. Kembali ke semakan kesediaan untuk menyemak data."
  ],
  "products. Counts above do not change when filtering.": [
    "件商品。上方总数不会随筛选改变。",
    "produk. Jumlah di atas tidak berubah apabila ditapis."
  ],
  "← Back to readiness": [
    "← 返回数据检查",
    "← Kembali ke semakan kesediaan"
  ],
  "Evidence mismatch": [
    "数据不一致",
    "Data tidak sepadan"
  ],
  "Refresh the evidence before checking a purchase.": [
    "请更新数据后再检查采购计划。",
    "Kemas kini data sebelum menyemak pembelian."
  ],
  "No plan entered": [
    "尚未输入计划",
    "Pelan belum dimasukkan"
  ],
  "Enter a planned order when you are ready.": [
    "准备好后，请输入计划订购量。",
    "Masukkan pesanan dirancang apabila anda bersedia."
  ],
  "StockLess will check it immediately. You can leave this product alone without answering anything.": [
    "StockLess 会即时检查。您也可以暂不填写此商品。",
    "StockLess akan menyemaknya serta-merta. Anda boleh membiarkan produk ini tanpa mengisi apa-apa."
  ],
  "StockLess cannot judge this purchase.": [
    "StockLess 无法判断此次采购。",
    "StockLess tidak dapat menilai pembelian ini."
  ],
  "What you can do:": [
    "建议操作：",
    "Tindakan yang boleh diambil:"
  ],
  "Getting old": [
    "逐渐过时",
    "Semakin lama"
  ],
  "Stock on hand": [
    "现有库存",
    "Stok semasa"
  ],
  "Demand range low": [
    "需求下限",
    "Had bawah permintaan"
  ],
  "Demand range high": [
    "需求上限",
    "Had atas permintaan"
  ],
  "Stock after order": [
    "订购后库存",
    "Stok selepas pesanan"
  ],
  "Purchase plan · SKU": [
    "采购计划 · SKU",
    "Pelan pembelian · SKU"
  ],
  "Stock counted": [
    "盘点日期",
    "Stok dikira pada"
  ],
  "date unavailable": [
    "日期不可用",
    "tarikh tidak tersedia"
  ],
  "days old": [
    "天前",
    "hari lalu"
  ],
  "Close purchase plan": [
    "关闭采购计划",
    "Tutup pelan pembelian"
  ],
  "A practical starting quantity for this product's next four weeks.": [
    "此商品未来四周的参考补货数量。",
    "Kuantiti permulaan praktikal untuk produk ini bagi empat minggu akan datang."
  ],
  "Midpoint of demand range − stock on hand − incoming stock": [
    "需求区间中点 − 现有库存 − 在途库存",
    "Titik tengah julat permintaan − stok semasa − stok akan tiba"
  ],
  "No reliable estimate": [
    "暂无可靠估算",
    "Tiada anggaran yang boleh dipercayai"
  ],
  "Missing weeks remain separate from recorded zero sales.": [
    "缺失周与已记录的零销量会分别处理。",
    "Minggu hilang dibezakan daripada jualan sifar yang direkodkan."
  ],
  "Expected demand": [
    "预计需求",
    "Jangkaan permintaan"
  ],
  "Demand range": [
    "需求区间",
    "Julat permintaan"
  ],
  "total for the next 4 weeks": [
    "未来四周合计",
    "jumlah untuk 4 minggu akan datang"
  ],
  "Range based on": [
    "区间依据",
    "Julat berdasarkan"
  ],
  "weeks, from": [
    "周数据，起自",
    "minggu, dari"
  ],
  "Stock-count date": [
    "库存盘点日期",
    "Tarikh kiraan stok"
  ],
  "Not available": [
    "不可用",
    "Tidak tersedia"
  ],
  "not available": [
    "不可用",
    "tidak tersedia"
  ],
  "Cannot calculate": [
    "无法计算",
    "Tidak dapat dikira"
  ],
  "Both fields are optional. The purchase check updates as soon as a valid figure changes.": [
    "两项均为可选。有效数值改变后，采购检查会即时更新。",
    "Kedua-dua medan adalah pilihan. Semakan pembelian dikemas kini sebaik sahaja angka sah berubah."
  ],
  "Not entered": [
    "未输入",
    "Belum dimasukkan"
  ],
  "Not entered is treated as 0.": [
    "未输入时按 0 处理。",
    "Jika tidak dimasukkan, dianggap sebagai 0."
  ],
  "Move the slider to check the plan instantly.": [
    "移动滑块，即时检查计划。",
    "Gerakkan peluncur untuk menyemak pelan serta-merta."
  ],
  "Clear": [
    "清除",
    "Kosongkan"
  ],
  "Clear planned order": [
    "清除计划订购量",
    "Kosongkan pesanan dirancang"
  ],
  "Clear incoming stock": [
    "清除在途库存",
    "Kosongkan stok akan tiba"
  ],
  "Figures you enter are marked “input by you” and last for this visit only.": [
    "您输入的数字会标记为“由您输入”，仅保留在本次访问中。",
    "Angka yang anda masukkan ditandakan “dimasukkan oleh anda” dan hanya kekal untuk lawatan ini."
  ],
  "Expiry information": [
    "保质期信息",
    "Maklumat tarikh luput"
  ],
  "Expiry not checked — evidence mismatch for this product": [
    "未检查保质期 — 此商品数据不一致",
    "Tarikh luput tidak disemak — data produk ini tidak sepadan"
  ],
  "Earliest expiry:": [
    "最早到期日期：",
    "Tarikh luput terawal:"
  ],
  "Done": [
    "完成",
    "Selesai"
  ],
  "Units per week": [
    "每周件数",
    "Unit seminggu"
  ],
  "Today": [
    "今天",
    "Hari ini"
  ],
  ": missing week": [
    "：缺失周",
    ": minggu hilang"
  ],
  ": 0 sales recorded": [
    "：已记录零销量",
    ": jualan sifar direkodkan"
  ],
  "Observed weekly demand": [
    "已记录的每周需求",
    "Permintaan mingguan direkodkan"
  ],
  "Expected weekly equivalent": [
    "预计每周需求",
    "Anggaran setara mingguan"
  ],
  "0 sales recorded": [
    "已记录零销量",
    "Jualan sifar direkodkan"
  ],
  "Dashed column = missing week": [
    "虚线列 = 缺失周",
    "Lajur putus-putus = minggu hilang"
  ],
  "Data note:": [
    "数据说明：",
    "Nota data:"
  ],
  "Source column for {0}": [
    "{0} 的来源列",
    "Lajur sumber untuk {0}"
  ],
  "Observed sales and four-week expected demand range for {0}": [
    "{0} 的历史销量及未来四周预计需求区间",
    "Jualan direkodkan dan julat jangkaan permintaan empat minggu untuk {0}"
  ],
  "Open purchase plan for {0}, SKU {1}": [
    "打开 {0}（SKU {1}）的采购计划",
    "Buka pelan pembelian untuk {0}, SKU {1}"
  ],
  "Weekly product history": [
    "商品每周销售历史",
    "Sejarah mingguan produk"
  ],
  "Timeline gap evidence": [
    "时间线缺失检查",
    "Data jurang garis masa"
  ],
  "Stock freshness": [
    "库存数据时效",
    "Kemutakhiran data stok"
  ],
  "Descriptive weeks of cover": [
    "库存可售周数",
    "Tempoh bekalan stok deskriptif"
  ],
  "Purchase audit": [
    "采购审核",
    "Audit pembelian"
  ],
  "Expiry-aware note": [
    "保质期提示",
    "Nota tarikh luput"
  ],
  "Supplier scenario": [
    "供应商方案",
    "Senario pembekal"
  ],
  "Sale date": [
    "销售日期",
    "Tarikh jualan"
  ],
  "The date each sale or return was recorded.": [
    "每笔销售或退货的记录日期。",
    "Tarikh setiap jualan atau pulangan direkodkan."
  ],
  "How your products are named or coded": [
    "商品名称或编码",
    "Nama atau kod produk anda"
  ],
  "Choose either accepted form. Both keep products and pack sizes separate.": [
    "选择任一方式，均可区分商品及包装规格。",
    "Pilih salah satu cara. Kedua-duanya membezakan produk dan saiz pek."
  ],
  "One code column: SKU, barcode or product code": [
    "一个编码列：SKU、条形码或商品编码",
    "Satu lajur kod: SKU, kod bar atau kod produk"
  ],
  "Product name together with pack size": [
    "商品名称与包装规格组合",
    "Nama produk bersama saiz pek"
  ],
  "Quantity sold": [
    "销售数量",
    "Kuantiti dijual"
  ],
  "The quantity sold or returned in each record.": [
    "每条记录中的销售或退货数量。",
    "Kuantiti dijual atau dipulangkan dalam setiap rekod."
  ],
  "Your latest counted quantity for each product.": [
    "每件商品最近一次盘点的数量。",
    "Kiraan kuantiti terkini bagi setiap produk."
  ],
  "Stock count date": [
    "库存盘点日期",
    "Tarikh kiraan stok"
  ],
  "The date that stock count was taken.": [
    "进行库存盘点的日期。",
    "Tarikh kiraan stok dibuat."
  ],
  "Planned orders": [
    "计划订购量",
    "Pesanan dirancang"
  ],
  "Quantities you are considering ordering.": [
    "您正在考虑订购的数量。",
    "Kuantiti yang anda bercadang untuk pesan."
  ],
  "Quantities already ordered and expected to arrive.": [
    "已订购并预计到货的数量。",
    "Kuantiti telah dipesan dan dijangka tiba."
  ],
  "Expiry dates": [
    "到期日期",
    "Tarikh luput"
  ],
  "Expiry dates and affected quantities for product batches.": [
    "商品批次的到期日期及涉及数量。",
    "Tarikh luput dan kuantiti terlibat bagi kelompok produk."
  ],
  "Supplier details": [
    "供应商信息",
    "Maklumat pembekal"
  ],
  "Supplier identity, delivery time and ordering pack information.": [
    "供应商标识、交货时间及订购包装信息。",
    "Pengenalan pembekal, masa penghantaran dan maklumat pek pesanan."
  ],
  "{0} must be mapped and confirmed. It can come from {1}.": [
    "需要匹配并确认{0}，可来自{1}。",
    "{0} perlu dipadankan dan disahkan. Ia boleh datang daripada {1}."
  ],
  "a file column": [
    "文件中的列",
    "lajur fail"
  ],
  "manual entry": [
    "手动输入",
    "input manual"
  ],
  "a file column or manual entry": [
    "文件中的列或手动输入",
    "lajur fail atau input manual"
  ],
  "{0} is mapped but is not valid enough for this capability.": [
    "{0} 已匹配，但数据不足以支持此功能。",
    "{0} telah dipadankan tetapi belum cukup sah untuk fungsi ini."
  ],
  "{0} is visible but locked until Iteration 3.": [
    "{0} 已展示，将在第三次迭代开放。",
    "{0} dipaparkan tetapi hanya tersedia mulai iterasi 3."
  ],
  "At least one valid mapped transaction row is required.": [
    "至少需要一行已匹配的有效交易数据。",
    "Sekurang-kurangnya satu baris transaksi sah yang dipadankan diperlukan."
  ],
  "At least two observed week keys are required.": [
    "至少需要两个有记录的周。",
    "Sekurang-kurangnya dua minggu direkodkan diperlukan."
  ],
  "At least one completed observed week is required.": [
    "至少需要一个已结束且有记录的周。",
    "Sekurang-kurangnya satu minggu lengkap yang direkodkan diperlukan."
  ],
  "{0} is available with Limited data.": [
    "{0} 可用，但数据有限。",
    "{0} tersedia dengan data terhad."
  ],
  "The stock count is getting old because it is 8–14 days old.": [
    "盘点已过去 8–14 天，库存数据逐渐过时。",
    "Kiraan stok semakin lama kerana telah berusia 8–14 hari."
  ],
  "The stock count date is missing, invalid, in the future, or too old to rely on.": [
    "盘点日期缺失、无效、位于未来或过旧，无法依赖。",
    "Tarikh kiraan stok tiada, tidak sah, pada masa hadapan atau terlalu lama untuk dipercayai."
  ],
  "Valid stock on hand and a positive value for {0} are required.": [
    "需要有效的现有库存，以及大于零的{0}。",
    "Stok semasa yang sah dan nilai positif untuk {0} diperlukan."
  ],
  "{0} is available but one or more inputs provide Limited data.": [
    "{0} 可用，但一个或多个输入的数据有限。",
    "{0} tersedia tetapi satu atau lebih input mempunyai data terhad."
  ],
  "Occasional seller": [
    "偶尔售出",
    "Jualan sekali-sekala"
  ],
  "the product is Cannot assess": [
    "此商品无法评估",
    "produk tidak dapat dinilai"
  ],
  "no stock on hand figure": [
    "缺少现有库存数量",
    "tiada angka stok semasa"
  ],
  "no stock count date": [
    "缺少盘点日期",
    "tiada tarikh kiraan stok"
  ],
  "the stock count date is more than 14 days old": [
    "盘点日期距今超过 14 天",
    "tarikh kiraan stok melebihi 14 hari"
  ],
  "the stock count date is in the future": [
    "盘点日期在未来",
    "tarikh kiraan stok pada masa hadapan"
  ],
  "Whole numbers only": [
    "仅限整数",
    "Nombor bulat sahaja"
  ],
  "Cannot judge": [
    "无法判断",
    "Tidak dapat dinilai"
  ],
  "Expiry not checked — no usable expiry date for this product": [
    "未检查保质期 — 此商品没有可用的到期日期",
    "Tarikh luput tidak disemak — tiada tarikh luput sah untuk produk ini"
  ],
  "No expiry inside the next 4 weeks": [
    "未来四周内不会到期",
    "Tiada tarikh luput dalam 4 minggu akan datang"
  ],
  "Not a CSV file": [
    "不是 CSV 文件",
    "Bukan fail CSV"
  ],
  "Choose a file whose name ends in .csv.": [
    "请选择扩展名为 .csv 的文件。",
    "Pilih fail dengan nama berakhir .csv."
  ],
  "The text cannot be read": [
    "无法读取文本",
    "Teks tidak dapat dibaca"
  ],
  "Export the file again as a standard UTF-8 CSV.": [
    "请重新导出为标准 UTF-8 CSV 文件。",
    "Eksport semula fail sebagai CSV UTF-8 standard."
  ],
  "No consistent separator found": [
    "未找到统一的分隔符",
    "Tiada pemisah seragam ditemui"
  ],
  "Export the file with one consistent comma, semicolon or tab separator.": [
    "请使用统一的逗号、分号或制表符重新导出文件。",
    "Eksport fail dengan satu pemisah seragam: koma, koma bertitik atau tab."
  ],
  "Larger than 10 MiB": [
    "文件超过 10 MiB",
    "Melebihi 10 MiB"
  ],
  "Reduce the file to 10 MiB or less.": [
    "请将文件缩小至 10 MiB 或以下。",
    "Kecilkan fail kepada 10 MiB atau kurang."
  ],
  "More than 100,000 rows": [
    "超过 100,000 行",
    "Melebihi 100,000 baris"
  ],
  "Reduce the file to 100,000 data rows or fewer.": [
    "请将数据减少至 100,000 行或以下。",
    "Kurangkan fail kepada 100,000 baris data atau kurang."
  ],
  "The calendar date on which the sale or return was recorded.": [
    "记录销售或退货的日期。",
    "Tarikh kalendar jualan atau pulangan direkodkan."
  ],
  "Product code, SKU or barcode": [
    "商品编码、SKU 或条形码",
    "Kod produk, SKU atau kod bar"
  ],
  "A stable identifier that keeps each product separate.": [
    "用于区分不同商品的固定标识。",
    "Pengenal tetap yang membezakan setiap produk."
  ],
  "Product name": [
    "商品名称",
    "Nama produk"
  ],
  "A readable product label and one part of composite identity.": [
    "易读的商品名称，也是组合标识的一部分。",
    "Nama produk yang mudah dibaca dan sebahagian daripada pengenalan gabungan."
  ],
  "Pack size": [
    "包装规格",
    "Saiz pek"
  ],
  "The pack size or unit needed to prevent unlike products being merged.": [
    "用于避免不同商品被合并的包装规格或单位。",
    "Saiz pek atau unit untuk mengelakkan produk berbeza digabungkan."
  ],
  "The sale or return quantity recorded for the transaction.": [
    "交易中记录的销售或退货数量。",
    "Kuantiti jualan atau pulangan yang direkodkan untuk transaksi."
  ],
  "The current product-level stock snapshot; repeated values are not summed.": [
    "当前商品的库存快照；重复出现的库存数值不会累加。",
    "Snapshot stok semasa bagi produk; nilai berulang tidak dijumlahkan."
  ],
  "The date on which the current-stock snapshot was measured.": [
    "当前库存快照的盘点日期。",
    "Tarikh snapshot stok semasa diukur."
  ],
  "A planned purchase quantity for Purchase audit.": [
    "用于采购审核的计划购买数量。",
    "Kuantiti pembelian dirancang untuk audit pembelian."
  ],
  "Stock already expected to arrive.": [
    "已订购且预计到货的库存。",
    "Stok yang sudah dijangka tiba."
  ],
  "Expiry date": [
    "到期日期",
    "Tarikh luput"
  ],
  "The expiry date of a product lot.": [
    "商品批次的到期日期。",
    "Tarikh luput bagi kelompok produk."
  ],
  "One code column": [
    "一个编码列",
    "Satu lajur kod"
  ],
  "Required data is enough to continue. Optional data unlocks more features when you have it.": [
    "提供必填数据即可继续。补充可选数据后，可以使用更多功能。",
    "Data wajib mencukupi untuk meneruskan. Data pilihan membolehkan lebih banyak fungsi apabila tersedia."
  ],
  "Duplicate rows not yet decided": [
    "重复行尚未处理",
    "Keputusan baris pendua belum dibuat"
  ],
  "Only {0} of the last 8 weeks have records": [
    "最近 8 周中仅有 {0} 周有记录",
    "Hanya {0} daripada 8 minggu lalu mempunyai rekod"
  ],
  "The local AI model could not load. Suggestions may be less complete, but your file is still loaded and every attribute can be matched by hand.": [
    "本地 AI 模型无法加载，匹配建议可能不完整。文件已加载，您仍可手动匹配所有字段。",
    "Model AI setempat tidak dapat dimuatkan. Cadangan mungkin kurang lengkap, tetapi fail telah dimuatkan dan setiap atribut boleh dipadankan secara manual."
  ],
  "Review the product's data issues in the readiness check.": [
    "请在数据检查页面复核此商品的问题。",
    "Semak isu data produk dalam semakan kesediaan."
  ],
  "Add a current stock figure and run the readiness check again.": [
    "补充当前库存数量后，重新运行数据检查。",
    "Tambah angka stok semasa dan jalankan semakan kesediaan semula."
  ],
  "Add the date when this stock was counted.": [
    "请补充此次库存盘点的日期。",
    "Tambah tarikh stok ini dikira."
  ],
  "Provide a stock count dated within the last 14 days.": [
    "请提供最近 14 天内的库存盘点数据。",
    "Sediakan kiraan stok dalam tempoh 14 hari terakhir."
  ],
  "Correct the stock count date.": [
    "请修正库存盘点日期。",
    "Betulkan tarikh kiraan stok."
  ],
  "You would have {0} units, above the {1}-unit four-week range, so the planned order looks too much.": [
    "订购后将有 {0} 件，超过四周需求上限 {1} 件，因此计划订购量偏多。",
    "Anda akan mempunyai {0} unit, melebihi had empat minggu {1} unit, jadi pesanan dirancang terlalu banyak."
  ],
  "You would have {0} units, below the {1}-unit four-week range, so the planned order looks too little.": [
    "订购后将有 {0} 件，低于四周需求下限 {1} 件，因此计划订购量偏少。",
    "Anda akan mempunyai {0} unit, kurang daripada had empat minggu {1} unit, jadi pesanan dirancang terlalu sedikit."
  ],
  "You would have {0} units, within the {1}-{2} four-week range, so the planned order looks about right.": [
    "订购后将有 {0} 件，处于四周需求区间 {1}–{2} 内，因此计划订购量适中。",
    "Anda akan mempunyai {0} unit, dalam julat empat minggu {1}–{2}, jadi pesanan dirancang sesuai."
  ],
  "Expires in {0} days ({1})": [
    "将在 {0} 天后到期（{1}）",
    "Luput dalam {0} hari ({1})"
  ],
  "The active in-memory dataset, mappings, derived references, and identity evidence were cleared.": [
    "已清除当前内存中的数据、匹配、派生引用及商品标识依据。",
    "Data aktif dalam memori, padanan, rujukan terbitan dan data pengenalan telah dikosongkan."
  ],
  "This product has more than one different nonblank current-stock value.": [
    "此商品有多个不一致的非空库存数值。",
    "Produk ini mempunyai beberapa nilai stok semasa bukan kosong yang berbeza."
  ],
  "Confirm one product-level current-stock snapshot in the source file.": [
    "请在源文件中为此商品保留一个明确的当前库存快照。",
    "Sahkan satu snapshot stok semasa bagi produk ini dalam fail sumber."
  ],
  "This product has more than one different nonblank stock snapshot date.": [
    "此商品有多个不一致的非空库存盘点日期。",
    "Produk ini mempunyai beberapa tarikh snapshot stok bukan kosong yang berbeza."
  ],
  "Confirm one product-level stock snapshot date in the source file.": [
    "请在源文件中为此商品确认一个库存盘点日期。",
    "Sahkan satu tarikh snapshot stok bagi produk ini dalam fail sumber."
  ],
  "This product has more than one different nonblank planned-order value.": [
    "此商品有多个不一致的非空计划订购量。",
    "Produk ini mempunyai beberapa nilai pesanan dirancang bukan kosong yang berbeza."
  ],
  "Keep one product-level planned-order figure, or leave the file values blank and enter it in StockLess.": [
    "每件商品保留一个计划订购量，或将文件中的值留空并在 StockLess 中输入。",
    "Kekalkan satu angka pesanan dirancang bagi setiap produk, atau kosongkan nilai fail dan masukkannya dalam StockLess."
  ],
  "This product has more than one different nonblank incoming-stock value.": [
    "此商品有多个不一致的非空在途库存数值。",
    "Produk ini mempunyai beberapa nilai stok akan tiba bukan kosong yang berbeza."
  ],
  "Keep one product-level incoming-stock figure, or leave the file values blank and enter it in StockLess.": [
    "每件商品保留一个在途库存数值，或将文件中的值留空并在 StockLess 中输入。",
    "Kekalkan satu angka stok akan tiba bagi setiap produk, atau kosongkan nilai fail dan masukkannya dalam StockLess."
  ],
  "The date uses a non-ISO format that has not been confirmed for this column.": [
    "日期使用了此列尚未确认的非 ISO 格式。",
    "Tarikh menggunakan format bukan ISO yang belum disahkan untuk lajur ini."
  ],
  "The sale date is blank or is not a valid date under the confirmed column format.": [
    "销售日期为空，或不符合此列已确认的日期格式。",
    "Tarikh jualan kosong atau tidak sah mengikut format lajur disahkan."
  ],
  "Confirm the column-level date format, or export dates as YYYY-MM-DD.": [
    "确认整列日期格式，或将日期导出为 YYYY-MM-DD。",
    "Sahkan format tarikh lajur atau eksport tarikh sebagai YYYY-MM-DD."
  ],
  "Enter a real date using YYYY-MM-DD or the one confirmed column format.": [
    "使用 YYYY-MM-DD 或已确认的列格式输入有效日期。",
    "Masukkan tarikh sah menggunakan YYYY-MM-DD atau format lajur disahkan."
  ],
  "The sale date is later than the analysis date.": [
    "销售日期晚于分析日期。",
    "Tarikh jualan selepas tarikh analisis."
  ],
  "Correct the sale date so it is not in the future.": [
    "修正销售日期，使其不晚于分析日期。",
    "Betulkan tarikh jualan supaya tidak pada masa hadapan."
  ],
  "Quantity sold is blank or is not a finite decimal number.": [
    "销售数量为空或不是有效有限小数。",
    "Kuantiti dijual kosong atau bukan nombor perpuluhan terhingga."
  ],
  "Enter a decimal number using a dot as the decimal separator.": [
    "请输入以点号作为小数分隔符的数值。",
    "Masukkan nombor perpuluhan menggunakan titik sebagai pemisah perpuluhan."
  ],
  "The confirmed product-code identity is blank on this row.": [
    "此行缺少已确认的商品编码。",
    "Kod produk disahkan kosong pada baris ini."
  ],
  "The confirmed product name and pack size identity is incomplete on this row.": [
    "此行的商品名称与包装规格组合标识不完整。",
    "Gabungan nama produk dan saiz pek disahkan tidak lengkap pada baris ini."
  ],
  "Complete the confirmed product identity fields in the source file.": [
    "请在源文件中补全已确认的商品标识字段。",
    "Lengkapkan medan pengenalan produk disahkan dalam fail sumber."
  ],
  "Stock on hand must be a finite non-negative decimal.": [
    "现有库存必须是有效的非负数。",
    "Stok semasa mestilah nombor perpuluhan terhingga bukan negatif."
  ],
  "Enter a non-negative stock quantity or leave the optional value blank.": [
    "输入非负库存数量，或将此可选值留空。",
    "Masukkan kuantiti stok bukan negatif atau kosongkan nilai pilihan ini."
  ],
  "The stock date uses a non-ISO format that has not been confirmed for this column.": [
    "盘点日期使用了此列尚未确认的非 ISO 格式。",
    "Tarikh stok menggunakan format bukan ISO yang belum disahkan untuk lajur ini."
  ],
  "The stock snapshot date is not valid under the confirmed column format.": [
    "库存盘点日期不符合此列已确认的格式。",
    "Tarikh snapshot stok tidak sah mengikut format lajur disahkan."
  ],
  "Enter a real stock snapshot date using YYYY-MM-DD or the confirmed format.": [
    "使用 YYYY-MM-DD 或已确认格式输入有效的盘点日期。",
    "Masukkan tarikh snapshot stok sah menggunakan YYYY-MM-DD atau format disahkan."
  ],
  "The stock snapshot date is later than the analysis date.": [
    "库存盘点日期晚于分析日期。",
    "Tarikh snapshot stok selepas tarikh analisis."
  ],
  "Correct the snapshot date so it is not in the future.": [
    "修正盘点日期，使其不晚于分析日期。",
    "Betulkan tarikh snapshot supaya tidak pada masa hadapan."
  ],
  "Stock on hand is present without its stock count date.": [
    "已有库存数量，但缺少盘点日期。",
    "Stok semasa tersedia tanpa tarikh kiraan stok."
  ],
  "Enter the date when the current-stock count was measured.": [
    "请输入当前库存的盘点日期。",
    "Masukkan tarikh kiraan stok semasa dibuat."
  ],
  "A stock snapshot date is present without a current-stock value.": [
    "已有盘点日期，但缺少库存数量。",
    "Tarikh snapshot stok tersedia tanpa nilai stok semasa."
  ],
  "Enter the non-negative current-stock count measured on that date.": [
    "请输入该日期盘点的非负库存数量。",
    "Masukkan kiraan stok semasa bukan negatif pada tarikh tersebut."
  ],
  "Planned order must be a whole number from 0 to 999,999.": [
    "计划订购量必须是 0 至 999,999 的整数。",
    "Pesanan dirancang mestilah nombor bulat dari 0 hingga 999,999."
  ],
  "Enter a whole planned-order quantity from 0 to 999,999, or leave it blank.": [
    "输入 0 至 999,999 的整数订购量，或留空。",
    "Masukkan kuantiti pesanan bulat dari 0 hingga 999,999, atau biarkan kosong."
  ],
  "Incoming stock must be a whole number from 0 to 999,999.": [
    "在途库存必须是 0 至 999,999 的整数。",
    "Stok akan tiba mestilah nombor bulat dari 0 hingga 999,999."
  ],
  "Enter a whole incoming-stock quantity from 0 to 999,999, or leave it blank.": [
    "输入 0 至 999,999 的整数在途库存，或留空。",
    "Masukkan kuantiti stok akan tiba bulat dari 0 hingga 999,999, atau biarkan kosong."
  ],
  "The expiry date uses a non-ISO format that has not been confirmed for this column.": [
    "到期日期使用了此列尚未确认的非 ISO 格式。",
    "Tarikh luput menggunakan format bukan ISO yang belum disahkan untuk lajur ini."
  ],
  "The expiry date is not valid under the confirmed column format.": [
    "到期日期不符合此列已确认的格式。",
    "Tarikh luput tidak sah mengikut format lajur disahkan."
  ],
  "Enter a real expiry date using YYYY-MM-DD or the confirmed format.": [
    "使用 YYYY-MM-DD 或已确认格式输入有效的到期日期。",
    "Masukkan tarikh luput sah menggunakan YYYY-MM-DD atau format disahkan."
  ],
  "Every source cell matches another record after permitted representation normalization.": [
    "经过允许的格式整理后，此行各单元格与另一条记录完全一致。",
    "Setiap sel sumber sepadan dengan rekod lain selepas penyeragaman format yang dibenarkan."
  ],
  "Choose “keep both” or “these are duplicates” for this exact-match group.": [
    "请为此重复组选择“全部保留”或“确认为重复行”。",
    "Pilih “kekalkan kedua-duanya” atau “ini pendua” untuk kumpulan sepadan ini."
  ],
  "The retailer has reviewed this exact-match group.": [
    "商家已复核此重复组。",
    "Peruncit telah menyemak kumpulan sepadan ini."
  ],
  "The retailer confirmed this row duplicates source row {0}.": [
    "商家已确认此行与源文件第 {0} 行重复。",
    "Peruncit mengesahkan baris ini menduplikasi baris sumber {0}."
  ],
  "Remove the repeated source record if the source spreadsheet should be corrected.": [
    "如需修正源表格，请删除其中重复的记录。",
    "Buang rekod sumber berulang jika hamparan sumber perlu dibetulkan."
  ],
  "An exact duplicate group is awaiting a retailer decision, so this product has Limited data.": [
    "此商品有一组完全重复的行等待处理，因此数据有限。",
    "Satu kumpulan pendua tepat menunggu keputusan peruncit, jadi data produk ini terhad."
  ],
  "Invalid date": [
    "无效日期",
    "Tarikh tidak sah"
  ],
  "Future transaction date": [
    "未来交易日期",
    "Tarikh transaksi masa hadapan"
  ],
  "Date format confirmation required": [
    "需要确认日期格式",
    "Pengesahan format tarikh diperlukan"
  ],
  "Invalid expiry date": [
    "无效到期日期",
    "Tarikh luput tidak sah"
  ],
  "Invalid quantity": [
    "无效数量",
    "Kuantiti tidak sah"
  ],
  "Invalid planned order": [
    "无效计划订购量",
    "Pesanan dirancang tidak sah"
  ],
  "Invalid incoming stock": [
    "无效在途库存",
    "Stok akan tiba tidak sah"
  ],
  "Conflicting planned order": [
    "计划订购量冲突",
    "Pesanan dirancang bercanggah"
  ],
  "Conflicting incoming stock": [
    "在途库存冲突",
    "Stok akan tiba bercanggah"
  ],
  "Duplicate candidate": [
    "疑似重复",
    "Kemungkinan pendua"
  ],
  "Duplicate confirmed": [
    "已确认重复",
    "Pendua disahkan"
  ],
  "Invalid current stock": [
    "当前库存无效",
    "Stok semasa tidak sah"
  ],
  "Missing current stock": [
    "缺少当前库存",
    "Stok semasa tiada"
  ],
  "Invalid stock date": [
    "库存日期无效",
    "Tarikh stok tidak sah"
  ],
  "Missing stock date": [
    "缺少库存日期",
    "Tarikh stok tiada"
  ],
  "Future stock date": [
    "未来库存日期",
    "Tarikh stok masa hadapan"
  ],
  "Conflicting current stock": [
    "当前库存冲突",
    "Stok semasa bercanggah"
  ],
  "Conflicting stock date": [
    "库存日期冲突",
    "Tarikh stok bercanggah"
  ],
  "Stale stock": [
    "库存数据过旧",
    "Data stok terlalu lama"
  ],
  "Data readiness": ["数据检查", "Kesediaan data"],
  "StockLess checked your sales and stock data. Review any issues before planning your purchases.": ["StockLess 已检查您的销售与库存数据。在规划采购前，请先查看需要处理的项目。", "StockLess telah menyemak data jualan dan stok anda. Semak sebarang isu sebelum merancang belian anda."],
  "How readiness is checked: StockLess evaluates the uploaded file using a local readiness snapshot. It checks required fields, valid dates and quantities, product identity, duplicate rows, and available stock evidence. Original cells are not modified.": ["就绪检查如何进行：StockLess 在本地生成就绪快照来评估上传的文件，检查必填字段、有效的日期与数量、产品识别、重复行，以及可用的库存证据。原始单元格不会被修改。", "Bagaimana kesediaan disemak: StockLess menilai fail yang dimuat naik menggunakan petikan kesediaan setempat. Ia menyemak medan wajib, tarikh dan kuantiti yang sah, identiti produk, baris pendua, dan bukti stok yang ada. Sel asal tidak diubah."],
  "Exact row reconciliation: StockLess tracks every source row through the readiness process, so you can see how many are usable and how many are excluded. No source rows are silently discarded.": ["逐行核对：StockLess 会追踪每一行原始数据在就绪检查中的去向，让您看到多少行可用、多少行被排除。不会有任何原始行被悄悄丢弃。", "Penyesuaian baris tepat: StockLess menjejaki setiap baris sumber melalui proses kesediaan, supaya anda nampak berapa yang boleh digunakan dan berapa yang dikecualikan. Tiada baris sumber dibuang secara senyap."],
  "Can continue": ["可以继续", "Boleh teruskan"],
  "Must fix": ["需要修正", "Perlu dibetulkan"],
  "Next step:": ["下一步：", "Langkah seterusnya:"],
  "rows passed every check and will be used.": ["行通过了所有检查，将会被使用。", "baris lulus setiap semakan dan akan digunakan."],
  "rows are left out until corrected in your file.": ["行被排除，直到您在文件中修正为止。", "baris ditinggalkan sehingga dibetulkan dalam fail anda."],
  "Continue with the usable rows, or download the problem list and correct your file first.": ["可以用可用的行继续，或先下载问题清单并修正文件。", "Teruskan dengan baris yang boleh digunakan, atau muat turun senarai masalah dan betulkan fail anda dahulu."],
  "Date validation: StockLess checks whether each sale date can be interpreted reliably. Invalid or ambiguous dates are flagged rather than silently converted.": ["日期验证：StockLess 会检查每个销售日期是否能被可靠解读。无效或含糊的日期会被标记，而不是被悄悄转换。", "Pengesahan tarikh: StockLess menyemak sama ada setiap tarikh jualan boleh ditafsirkan dengan yakin. Tarikh tidak sah atau kabur ditandakan, bukan ditukar secara senyap."],
  "Values that are not finite numbers": ["非有效数值", "Nilai yang bukan nombor sah"],
  "Quantity validation: quantities must resolve to valid numeric values. Missing, non-numeric or invalid values are flagged.": ["数量验证：数量必须是有效的数值。缺失、非数字或无效的值都会被标记。", "Pengesahan kuantiti: kuantiti mesti menghasilkan nilai berangka yang sah. Nilai yang hilang, bukan nombor atau tidak sah akan ditandakan."],
  "Missing product ID": ["缺少产品编号", "ID produk tiada"],
  "Product identity: each sales row needs a reliable product identifier so sales can be grouped correctly for demand analysis.": ["产品识别：每一行销售记录都需要可靠的产品标识，销售数据才能正确归组以供需求分析。", "Identiti produk: setiap baris jualan memerlukan pengecam produk yang boleh dipercayai supaya jualan dikumpulkan dengan betul untuk analisis permintaan."],
  "Duplicate rows": ["重复行", "Baris pendua"],
  "Repeats left out of the totals for you": ["重复项已自动不计入总数", "Pendua ditinggalkan daripada jumlah untuk anda"],
  "Duplicate detection: StockLess finds rows whose source values all match. One copy is counted and the repeats are left out automatically — nothing is deleted, and every row stays traceable.": ["重复检测：StockLess 会找出所有来源值完全相同的行。其中一份计入总数，其余重复项会自动排除——不会删除任何数据，每一行都可追溯。", "Pengesanan pendua: StockLess mencari baris yang semua nilai sumbernya sepadan. Satu salinan dikira dan pendua lain ditinggalkan secara automatik — tiada apa dipadam, dan setiap baris kekal boleh dijejaki."],
  "Stock data": ["库存数据", "Data stok"],
  "Stock evidence: current stock and stock-count dates are optional. When available they provide additional evidence for evaluating inventory coverage and restocking decisions.": ["库存证据：现有库存和盘点日期是选填的。若有提供，可为评估库存覆盖与补货决策提供额外依据。", "Bukti stok: stok semasa dan tarikh kiraan stok adalah pilihan. Apabila ada, ia memberi bukti tambahan untuk menilai liputan inventori dan keputusan menstok semula."],
  "Handled for you": ["已为您处理", "Diuruskan untuk anda"],
  "These rows are identical. Row {0} is counted once, and {1} more left out of the totals.": ["这些行完全相同。第 {0} 行计入一次，另外 {1} 行不计入总数。", "Baris ini serupa. Baris {0} dikira sekali, dan {1} lagi ditinggalkan daripada jumlah."],
  "Affected:": ["涉及：", "Terlibat:"],
  "Count them all instead": ["改为全部计入", "Kira semuanya sebaliknya"],
  "What to correct in your file, and what StockLess tidied up for you.": ["文件中需要您修正的内容，以及 StockLess 已为您整理的部分。", "Apa yang perlu anda betulkan dalam fail, dan apa yang StockLess kemaskan untuk anda."],
  "Search by product name or code": ["按产品名称或编号搜索", "Cari mengikut nama atau kod produk"],
  "Show the complete list": ["显示完整清单", "Tunjukkan senarai penuh"],
  "Weekly sales": ["每周销量", "Jualan mingguan"],
  "Timeline gap evidence: StockLess groups sales into weekly periods and tells apart weeks with positive sales, negative sales, no recorded sales, cancelled transactions and missing data. A missing week is never treated as a week of zero sales.": ["时间线缺口证据：StockLess 会把销售按周分组，并区分有正销量、负销量、无销售记录、已取消交易和数据缺失的周。缺失的周绝不会当作零销量。", "Bukti jurang garis masa: StockLess mengumpulkan jualan mengikut minggu dan membezakan minggu dengan jualan positif, jualan negatif, tiada rekod jualan, transaksi dibatalkan dan data hilang. Minggu yang hilang tidak sekali-kali dianggap sifar jualan."],
  "Continue to purchase planning →": ["继续制定采购计划 →", "Teruskan ke perancangan belian →"],
  "Sales data overview": ["销售数据概览", "Gambaran keseluruhan data jualan"],
  "Units sold per week, from the rows that passed every check.": ["每周售出单位数，取自通过所有检查的行。", "Unit terjual setiap minggu, daripada baris yang lulus setiap semakan."],
  "Data quality by row": ["按行的数据质量", "Kualiti data mengikut baris"],
  "How many rows are usable, and why the rest are set aside.": ["有多少行可用，以及其余为何被搁置。", "Berapa baris boleh digunakan, dan mengapa yang lain diketepikan."],
  "Valid sales rows": ["有效销售行", "Baris jualan sah"],
  "Unique products": ["产品数", "Produk unik"],
  "Weeks of history": ["历史周数", "Minggu sejarah"],
  "Rows left out": ["被排除的行", "Baris ditinggalkan"],
  "Total rows": ["总行数", "Jumlah baris"],
  "Usable rows": ["可用行", "Baris boleh guna"],
  "Missing — not zero sales": ["数据缺失 — 并非零销量", "Hilang — bukan sifar jualan"],
  "Invalid format": ["格式无效", "Format tidak sah"],
  "Future date": ["日期在未来", "Tarikh akan datang"],
  "Unconfirmed": ["未确认", "Belum disahkan"],
  "Not a number": ["非数字", "Bukan nombor"],
  "Conflicting": ["互相冲突", "Bercanggah"],
  "No product ID": ["无产品编号", "Tiada ID produk"],
  "Matching rows": ["内容相同的行", "Baris sepadan"],
  "Stock missing": ["库存缺失", "Stok tiada"],
  "Stock invalid": ["库存无效", "Stok tidak sah"],
  "Date missing": ["日期缺失", "Tarikh tiada"],
  "What is wrong": ["问题是什么", "Apa yang tidak kena"],
  "How to fix it": ["如何修正", "Cara membetulkannya"],
  "Safe tidy-ups StockLess applied": ["StockLess 已套用的安全整理", "Kemasan selamat yang StockLess gunakan"],
  "Used means the row passed every check and counts towards your demand figures. Left out means StockLess could not read it safely, so it is excluded from the totals — your file is not changed, and the row stays listed here until you correct it.": ["「已使用」表示该行通过了所有检查，会计入您的需求数据。「被排除」表示 StockLess 无法安全读取该行，因此不计入总数——您的文件不会被更改，该行会一直列在这里，直到您修正为止。", "\"Digunakan\" bermaksud baris itu lulus setiap semakan dan dikira dalam angka permintaan anda. \"Ditinggalkan\" bermaksud StockLess tidak dapat membacanya dengan selamat, jadi ia dikecualikan daripada jumlah — fail anda tidak diubah, dan baris itu kekal tersenarai di sini sehingga anda membetulkannya."],
  "Current": ["仍然新鲜", "Semasa"],
  "Too old to rely on": ["太旧，不可依赖", "Terlalu lama untuk dipercayai"],
  "0–7 days old": ["0–7 天前", "0–7 hari lalu"],
  "8–14 days old": ["8–14 天前", "8–14 hari lalu"],
  "more than 14 days old": ["超过 14 天", "lebih 14 hari lalu"],
  "no usable count date": ["没有可用的盘点日期", "tiada tarikh kiraan yang boleh digunakan"],
  "Calculations use 24 valid rows; 3 are left out.": ["计算只使用 24 行有效数据；3 行被排除。", "Pengiraan menggunakan 24 baris sah; 3 ditinggalkan."],
  "counts towards your demand figures.": ["会计入您的需求数据。", "dikira dalam angka permintaan anda."],
  "is excluded from the totals until you correct it.": ["在您修正之前不计入总数。", "dikecualikan daripada jumlah sehingga anda membetulkannya."],
  "Your file is never changed either way. A row that is left out stays listed here, with the reason, so you can fix it in your own spreadsheet and upload again.": ["无论哪种情况，您的文件都不会被更改。被排除的行会连同原因一直列在这里，方便您在自己的表格中修正后重新上传。", "Fail anda tidak pernah diubah dalam kedua-dua keadaan. Baris yang ditinggalkan kekal tersenarai di sini dengan sebabnya, supaya anda boleh membetulkannya dalam hamparan sendiri dan muat naik semula."],
  "Your data is mostly ready": ["您的数据大致就绪", "Data anda hampir sedia"],
  "products checked": ["项产品已检查", "produk disemak"],
  "Need review": ["需查看", "Perlu semakan"],
  "Missing data": ["数据缺失", "Data tiada"],
  "Complete data, no major issues": ["数据完整，无重大问题", "Data lengkap, tiada isu besar"],
  "Usable, but the stock count is ageing": ["可用，但盘点已有些日子", "Boleh guna, tetapi kiraan stok semakin lama"],
  "Something StockLess could not read": ["有 StockLess 无法读取的内容", "Ada yang StockLess tidak dapat baca"],
  "products need your attention": ["项产品需要您处理", "produk perlukan perhatian anda"],
  "These products may have data issues or old stock. Review them before continuing.": ["这些产品可能有数据问题或库存过旧。请先查看再继续。", "Produk ini mungkin ada isu data atau stok lama. Semak sebelum meneruskan."],
  "Sort by: stock age (oldest)": ["排序：库存天数（最旧优先）", "Susun: umur stok (paling lama)"],
  "Sort by: product name": ["排序：产品名称", "Susun: nama produk"],
  "Sort by: issue type": ["排序：问题类型", "Susun: jenis isu"],
  "products are ready": ["项产品已就绪", "produk sudah sedia"],
  "Complete data and no major issues.": ["数据完整，没有重大问题。", "Data lengkap dan tiada isu besar."],
  "Last stock count": ["上次盘点", "Kiraan stok terakhir"],
  "Stock age": ["库存天数", "Umur stok"],
  "View details →": ["查看详情 →", "Lihat butiran →"],
  "Show the underlying numbers and charts": ["显示底层数据与图表", "Tunjukkan nombor dan carta asas"],
  "The stock count is getting old. It still works, but a fresher count would be better.": ["盘点开始过期。仍可使用，但重新盘点会更准确。", "Kiraan stok semakin lama. Ia masih boleh digunakan, tetapi kiraan yang lebih baharu akan lebih baik."],
  "The stock count is more than 14 days old, so it is too old to rely on.": ["盘点已超过 14 天，太旧，不适合作为依据。", "Kiraan stok melebihi 14 hari, jadi ia terlalu lama untuk dipercayai."],
  "No stock count date, so StockLess cannot say how long this stock will last.": ["没有盘点日期，StockLess 无法判断这些库存还能撑多久。", "Tiada tarikh kiraan stok, jadi StockLess tidak dapat menyatakan berapa lama stok ini akan bertahan."],
  "things need your attention": ["项需要您处理", "perkara perlukan perhatian anda"],
  "Here are the issues StockLess found in your file and what you can do about them.": ["以下是 StockLess 在您的文件中发现的问题，以及您可以怎么处理。", "Berikut ialah isu yang StockLess jumpa dalam fail anda dan apa yang boleh anda lakukan."],
  "need fixing": ["需修正", "perlu dibetulkan"],
  "need review": ["需查看", "perlu semakan"],
  "rows affected": ["条记录受影响", "baris terjejas"],
  "What StockLess found": ["StockLess 看到的内容", "Apa yang StockLess jumpa"],
  "What to do": ["该怎么做", "Apa yang perlu dibuat"],
  "Not included in totals": ["未计入总数", "Tidak dikira dalam jumlah"],
  "Included in totals": ["已计入总数", "Dikira dalam jumlah"],
  "Row ": ["第 ", "Baris "],
  "Date needs checking": ["日期需要检查", "Tarikh perlu disemak"],
  "Quantity needs checking": ["数量需要检查", "Kuantiti perlu disemak"],
  "Product information is missing": ["缺少产品信息", "Maklumat produk tiada"],
  "Stock value needs checking": ["库存数值需要检查", "Nilai stok perlu disemak"],
  "StockLess handled ": ["StockLess 已为您处理 ", "StockLess menguruskan "],
  " small issue for you": [" 个小问题", " isu kecil untuk anda"],
  "Your original file has not been changed.": ["您的原始文件没有被更改。", "Fail asal anda tidak diubah."],
  "↓ Download problem list": ["↓ 下载问题清单", "↓ Muat turun senarai masalah"],
  "Unknown product": ["未知产品", "Produk tidak diketahui"],
  "Enter a real date using YYYY-MM-DD.": ["请使用 YYYY-MM-DD 格式填写真实日期。", "Masukkan tarikh sebenar menggunakan YYYY-MM-DD."],
  "Enter a number, using a dot as the decimal separator.": ["请填写数字，小数点使用点号。", "Masukkan nombor, guna titik sebagai pemisah perpuluhan."],
  "Fill in the product code in your file.": ["请在文件中补上产品编号。", "Isikan kod produk dalam fail anda."],
  "Enter a stock count of zero or more, or leave it blank.": ["请填写不小于零的库存数量，或留空。", "Masukkan kiraan stok sifar atau lebih, atau biarkan kosong."],
  "row affected": ["行受影响", "baris terjejas"],
  "Included in totals means the row still counts towards your demand figures — the note is a warning, not a blocker. Not included in totals means StockLess could not read the row safely, so it is left out until you correct it. Your file is never changed either way.": ["「已计入总数」表示该行仍会计入您的需求数据——提示只是提醒，不会阻碍分析。「未计入总数」表示 StockLess 无法安全读取该行，因此在您修正前不计入。无论哪种情况，您的文件都不会被更改。", "\"Dikira dalam jumlah\" bermaksud baris itu masih dikira dalam angka permintaan anda — notanya ialah amaran, bukan halangan. \"Tidak dikira dalam jumlah\" bermaksud StockLess tidak dapat membaca baris itu dengan selamat, jadi ia ditinggalkan sehingga anda membetulkannya. Fail anda tidak pernah diubah."],
  "Product readiness summary": ["商品数据就绪概览", "Ringkasan kesediaan produk"],
  "No products can be assessed": ["暂无可评估商品", "Tiada produk boleh dinilai"],
  "Some products need more data": ["部分商品需要补充数据", "Sesetengah produk memerlukan lebih banyak data"],
  "Your data is ready": ["你的数据已就绪", "Data anda sedia"],
  "Usable evidence with issues to review": ["数据可用，仍有问题需要检查", "Bukti boleh digunakan dengan isu untuk disemak"],
  "Stock or sales evidence is incomplete": ["库存或销售数据不完整", "Bukti stok atau jualan tidak lengkap"],
  "Stock evidence is incomplete or cannot be relied on.": ["库存信息不完整或无法依赖。", "Bukti stok tidak lengkap atau tidak boleh dipercayai."],
  "The stock count is getting old. A fresher count would be better.": ["库存盘点数据逐渐过时，建议更新盘点。", "Kiraan stok semakin lama. Kiraan lebih baharu adalah lebih baik."],
  "Some weeks are missing — they are not zero sales.": ["部分周缺少记录，不代表销量为零。", "Rekod sesetengah minggu tiada — bukan jualan sifar."],
  "Review data issues and stock age before continuing.": ["继续前请检查数据问题和库存盘点年龄。", "Semak isu data dan umur kiraan stok sebelum meneruskan."],
  "Review the available evidence before planning.": ["规划前请检查现有数据。", "Semak bukti yang tersedia sebelum merancang."],
  "Correct your file and upload again where needed. Original cells remain unchanged.": ["如有需要，请修正文件后重新上传。原始单元格保持不变。", "Betulkan fail dan muat naik semula jika perlu. Sel asal tidak berubah."],
  "Sort products": ["商品排序", "Susun produk"],
  "issues to review": ["项问题需要检查", "isu untuk disemak"],
  "Other issues": ["其他问题", "Isu lain"],
  "Here are the issues StockLess found and what you can do about them.": ["以下是 StockLess 发现的问题及处理方法。", "Berikut ialah isu yang ditemui oleh StockLess dan tindakan yang boleh diambil."],
  "safe tidy-ups applied": ["项安全整理已完成", "kemasan selamat digunakan"],
  "Every tidy-up is available in the underlying evidence and download. Your original file has not been changed.": ["所有整理记录可在底层数据和下载报告中查看。原始文件未被修改。", "Semua kemasan tersedia dalam bukti terperinci dan muat turun. Fail asal anda tidak diubah."],
  "Missing weeks are not treated as zero sales.": ["缺失周不会被视为销量为零。", "Minggu yang tiada rekod tidak dianggap sebagai jualan sifar."],
  "How to plan an order": ["如何规划订购", "Cara merancang pesanan"],
  "Your next purchase, at a glance": ["下一次采购，一目了然", "Pembelian seterusnya sepintas lalu"],
  "Can plan": ["可制定计划", "Boleh dirancang"],
  "Usable demand and stock evidence": ["需求和库存数据可用", "Bukti permintaan dan stok boleh digunakan"],
  "Need more data": ["需补充数据", "Perlu lebih banyak data"],
  "Open a product to see the next action": ["打开商品查看处理方法", "Buka produk untuk tindakan seterusnya"],
  "Plans entered": ["已填写计划", "Pelan telah dimasukkan"],
  "Included in the product totals": ["属于上方商品总数", "Termasuk dalam jumlah produk"],
  "Open a product, review the estimate, and enter the quantity you intend to order.": ["打开商品，查看补货估算，再填写计划订购数量。", "Buka produk, semak anggaran dan masukkan kuantiti yang ingin dipesan."],
  "Suggested starting points": ["建议从这里开始", "Cadangan titik permulaan"],
  "Start with these products": ["从这些商品开始", "Mulakan dengan produk ini"],
  "Purchase concerns appear first. Each suggestion uses your current inputs.": ["采购风险优先显示。每项建议均使用当前输入。", "Kebimbangan pembelian dipaparkan dahulu. Setiap cadangan menggunakan input semasa anda."],
  "Review the estimate before entering your plan.": ["填写计划前，请先查看补货估算。", "Semak anggaran sebelum memasukkan pelan anda."],
  "Review and plan →": ["查看并规划 →", "Semak dan rancang →"],
  "See what is needed →": ["查看缺少的信息 →", "Lihat maklumat diperlukan →"],
  "Show:": ["显示：", "Paparkan:"],
  "Purchase planning overview": ["采购规划概览", "Ringkasan perancangan pembelian"],
  "Review data in Step 3 →": ["返回 Step 3 检查数据 →", "Semak data di Langkah 3 →"],
  "Why this estimate? See demand and stock": ["为什么这样估算？查看需求和库存", "Mengapa anggaran ini? Lihat permintaan dan stok"],
  "Why this purchase check?": ["为什么得出这个采购判断？", "Mengapa keputusan semakan pembelian ini?"],
  "This estimate uses general stock and demand. Expiry is a separate check; affected batch quantities are not included in the adjustment.": ["此估算基于一般库存和需求。到期信息单独检查，尚未按受影响批次数量调整补货量。", "Anggaran ini menggunakan stok dan permintaan umum. Tarikh luput disemak berasingan; kuantiti kelompok terjejas belum digunakan untuk pelarasan."],
  "Exact planned order quantity": ["精确计划订购量", "Kuantiti pesanan terancang tepat"],
  "Exact incoming stock quantity": ["精确在途库存量", "Kuantiti stok masuk tepat"],
  "The check still uses the last valid quantity. Correct this field to update it.": ["当前检查仍使用上一次有效数量。请修正此输入以更新结果。", "Semakan masih menggunakan kuantiti sah terakhir. Betulkan medan ini untuk mengemas kini."],
};

// Copy confirmed by the supplied upload and mapping HTML designs.
Object.assign(messages, {
  "Reset order to suggestion": ["重置为建议订购量", "Tetapkan semula pesanan kepada cadangan"],
  "Reset to suggestion": ["重置为建议量", "Kembali kepada cadangan"],
  "Start with what you already have": [
    "从您现有的资料开始",
    "Mulakan dengan apa yang anda sudah ada"
  ],
  "Upload your existing sales file.": [
    "上传您现有的销售文件。",
    "Muat naik fail jualan sedia ada anda."
  ],
  "Required data is enough to get started. Optional data unlocks deeper insights.": [
    "必填数据已足以开始。选填数据可带来更深入的洞察。",
    "Data yang diperlukan sudah cukup untuk bermula. Data pilihan membuka pandangan yang lebih mendalam."
  ],
  "What do you need to get started?": [
    "开始前需要准备什么？",
    "Apa yang anda perlukan untuk bermula?"
  ],
  "Start with the three required attributes. Optional attributes unlock additional insights.": [
    "先准备三项必填属性。选填属性可解锁更多洞察。",
    "Mulakan dengan tiga atribut yang diperlukan. Atribut pilihan membuka pandangan tambahan."
  ],
  "Required data": [
    "必填数据",
    "Data diperlukan"
  ],
  "3 attributes": [
    "3 项属性",
    "3 atribut"
  ],
  "Required": [
    "必填",
    "Diperlukan"
  ],
  "Sale date": [
    "销售日期",
    "Tarikh jualan"
  ],
  "The date each sale or return was recorded.": [
    "每笔销售或退货记录的日期。",
    "Tarikh setiap jualan atau pemulangan direkodkan."
  ],
  "Product identification": [
    "产品识别",
    "Pengenalan produk"
  ],
  "Choose one of the accepted formats to keep products and pack sizes separate.": [
    "请选择一种可接受的格式，让产品与包装规格分开记录。",
    "Pilih salah satu format yang diterima supaya produk dan saiz pek kekal berasingan."
  ],
  "SKU, barcode or product code": [
    "SKU、条形码或产品编号",
    "SKU, kod bar atau kod produk"
  ],
  "Product name + pack size": [
    "产品名称 + 包装规格",
    "Nama produk + saiz pek"
  ],
  "Quantity sold": [
    "销售数量",
    "Kuantiti dijual"
  ],
  "The quantity sold or returned in each record.": [
    "每笔记录中售出或退回的数量。",
    "Kuantiti yang dijual atau dipulangkan dalam setiap rekod."
  ],
  "Drop your CSV file here": [
    "将 CSV 文件拖到这里",
    "Lepaskan fail CSV anda di sini"
  ],
  "Use the export from your POS, marketplace or spreadsheet.": [
    "使用您的收银系统、电商平台或表格导出的文件。",
    "Guna eksport daripada POS, pasaran dalam talian atau hamparan anda."
  ],
  "Choose CSV file": [
    "选择 CSV 文件",
    "Pilih fail CSV"
  ],
  "Use sample file": [
    "使用示例文件",
    "Guna fail contoh"
  ],
  ".CSV · Up to 10 MiB · 100,000 rows · Comma, semicolon or tab separated": [
    ".CSV · 最大 10 MiB · 100,000 行 · 逗号、分号或制表符分隔",
    ".CSV · Sehingga 10 MiB · 100,000 baris · Dipisah koma, koma bertitik atau tab"
  ],
  "Your sales data": [
    "您的销售数据",
    "Data jualan anda"
  ],
  "Demand insights": [
    "需求洞察",
    "Pandangan permintaan"
  ],
  "Smarter restocking": [
    "更聪明的补货",
    "Belian lebih bijak"
  ],
  "Less waste": [
    "减少浪费",
    "Kurang pembaziran"
  ],
  "Your data stays on your device.": [
    "您的数据保留在您的设备上。",
    "Data anda kekal pada peranti anda."
  ],
  "Your CSV is processed directly in this browser. Your sales rows and product identifiers are not uploaded to an AI or API service.": [
    "您的 CSV 文件直接在此浏览器中处理。您的销售记录和产品标识不会上传到任何 AI 或 API 服务。",
    "Fail CSV anda diproses terus dalam pelayar ini. Baris jualan dan pengenalan produk anda tidak dimuat naik ke mana-mana perkhidmatan AI atau API."
  ],
  "Back to the homepage": [
    "返回首页",
    "Kembali ke laman utama"
  ],
  "Continue to column matching": [
    "继续进行列匹配",
    "Teruskan ke padanan lajur"
  ],
  "Homepage": [
    "首页",
    "Laman utama"
  ],
  "Language": [
    "语言",
    "Bahasa"
  ],
  "Upload": [
    "上传",
    "Muat naik"
  ],
  "Map columns": [
    "匹配列",
    "Padan lajur"
  ],
  "Check readiness": [
    "检查就绪",
    "Semak kesediaan"
  ],
  "Plan purchases": [
    "规划采购",
    "Rancang belian"
  ],
  "Sales data": [
    "销售数据",
    "Data jualan"
  ],
  "Sample data loaded — review the mappings before continuing.": [
    "示例数据已载入 — 请在继续前检查匹配结果。",
    "Data contoh dimuatkan — semak padanan sebelum meneruskan."
  ],
  "Make sure StockLess understands your data": [
    "确保 StockLess 正确理解您的数据",
    "Pastikan StockLess memahami data anda"
  ],
  "We found your data. Let's make sure it's right.": [
    "我们找到了您的数据。让我们确认无误。",
    "Kami jumpa data anda. Mari pastikan ia betul."
  ],
  "Review the suggested column matches before continuing. Your original file won't be changed.": [
    "请在继续前检查建议的列匹配。您的原始文件不会被更改。",
    "Semak padanan lajur yang dicadangkan sebelum meneruskan. Fail asal anda tidak akan diubah."
  ],
  "Read successfully": [
    "读取成功",
    "Berjaya dibaca"
  ],
  "Column mapping": [
    "列匹配",
    "Padanan lajur"
  ],
  "Nothing is applied until you confirm it. Sale date, quantity sold and how your products are named or coded are required.": [
    "在您确认之前不会应用任何内容。销售日期、销售数量以及产品的命名或编码方式为必填。",
    "Tiada apa-apa digunakan sehingga anda sahkan. Tarikh jualan, kuantiti dijual dan cara produk anda dinamakan atau dikodkan adalah diperlukan."
  ],
  "of": [
    "/",
    "daripada"
  ],
  "confirmed": [
    "已确认",
    "disahkan"
  ],
  "All matches look right?": [
    "所有匹配看起来都正确吗？",
    "Semua padanan nampak betul?"
  ],
  "Confirm all selected columns and continue in one step.": [
    "一次确认所有选定的列并继续。",
    "Sahkan semua lajur terpilih dan teruskan dalam satu langkah."
  ],
  "Products will be kept separate using: One code column.": [
    "产品将以「单一编码列」方式区分。",
    "Produk akan diasingkan menggunakan: Satu lajur kod."
  ],
  "Confirm all and continue →": [
    "全部确认并继续 →",
    "Sahkan semua dan teruskan →"
  ],
  "StockLess field": [
    "StockLess 字段",
    "Medan StockLess"
  ],
  "Your column": [
    "您的列",
    "Lajur anda"
  ],
  "Preview": [
    "预览",
    "Pratonton"
  ],
  "Status": [
    "状态",
    "Status"
  ],
  "Please confirm": [
    "请确认",
    "Sila sahkan"
  ],
  "Confirm": [
    "确认",
    "Sahkan"
  ],
  "✓ Confirmed": [
    "✓ 已确认",
    "✓ Disahkan"
  ],
  "REQUIRED": [
    "必填",
    "DIPERLUKAN"
  ],
  "How should StockLess identify your products?": [
    "StockLess 应如何识别您的产品？",
    "Bagaimana StockLess patut mengenal pasti produk anda?"
  ],
  "Choose how each product should be identified in your sales data.": [
    "请选择在销售数据中识别每件产品的方式。",
    "Pilih cara setiap produk dikenal pasti dalam data jualan anda."
  ],
  "One code column": [
    "单一编码列",
    "Satu lajur kod"
  ],
  "Use a SKU, barcode, or product code to identify each product.": [
    "使用 SKU、条形码或产品编号来识别每件产品。",
    "Guna SKU, kod bar atau kod produk untuk mengenal pasti setiap produk."
  ],
  "Use the product name together with its pack size.": [
    "使用产品名称连同其包装规格。",
    "Guna nama produk bersama saiz peknya."
  ],
  "✓ Selected": [
    "✓ 已选择",
    "✓ Dipilih"
  ],
  "Use this option": [
    "使用此选项",
    "Guna pilihan ini"
  ],
  "Check your data": [
    "检查您的数据",
    "Semak data anda"
  ],
  "Review your columns and make sure StockLess has the information it needs.": [
    "检查您的列，确保 StockLess 获得所需的信息。",
    "Semak lajur anda dan pastikan StockLess mempunyai maklumat yang diperlukan."
  ],
  "Read your column names": [
    "阅读您的列名称",
    "Baca nama lajur anda"
  ],
  "Match each column to a StockLess field": [
    "将每一列匹配到对应的 StockLess 字段",
    "Padankan setiap lajur dengan medan StockLess"
  ],
  "Review the data preview": [
    "查看数据预览",
    "Semak pratonton data"
  ],
  "Confirm your column mappings": [
    "确认您的列匹配",
    "Sahkan padanan lajur anda"
  ],
  "Identify your products": [
    "识别您的产品",
    "Kenal pasti produk anda"
  ],
  "Choose how StockLess should tell your products apart.": [
    "选择 StockLess 区分产品的方式。",
    "Pilih cara StockLess membezakan produk anda."
  ],
  "Product name together with pack size": [
    "产品名称连同包装规格",
    "Nama produk bersama saiz pek"
  ],
  "Your file is processed directly in your browser. Your sales data and product information are not uploaded to an AI or API service.": [
    "您的文件直接在您的浏览器中处理。您的销售数据和产品信息不会上传到任何 AI 或 API 服务。",
    "Fail anda diproses terus dalam pelayar anda. Data jualan dan maklumat produk anda tidak dimuat naik ke mana-mana perkhidmatan AI atau API."
  ],
  "← Choose another file": [
    "← 选择其他文件",
    "← Pilih fail lain"
  ],
  "Still needed:": [
    "仍需要：",
    "Masih diperlukan:"
  ],
  "Check my data →": [
    "检查我的数据 →",
    "Semak data saya →"
  ],
  "Retailer file": [
    "零售商文件",
    "Fail peruncit"
  ],
  "Clear session": [
    "清除会话",
    "Kosongkan sesi"
  ],
  "When did each sale or return happen?": [
    "每笔销售或退货发生在什么时候？",
    "Bilakah setiap jualan atau pemulangan berlaku?"
  ],
  "Product code, SKU or barcode": [
    "产品编号、SKU 或条形码",
    "Kod produk, SKU atau kod bar"
  ],
  "A code that is unique to each product, so two products are never mixed up.": [
    "每件产品唯一的编码，避免两件产品被混为一谈。",
    "Kod yang unik untuk setiap produk, supaya dua produk tidak bercampur."
  ],
  "Product name": [
    "产品名称",
    "Nama produk"
  ],
  "The name you use for the product.": [
    "您对该产品使用的名称。",
    "Nama yang anda guna untuk produk itu."
  ],
  "Pack size": [
    "包装规格",
    "Saiz pek"
  ],
  "The pack size, so a 10-pack is never counted as the same thing as a 20-pack.": [
    "包装规格，避免 10 包被当成 20 包计算。",
    "Saiz pek, supaya pek 10 tidak dikira sama dengan pek 20."
  ],
  "How many units were sold or returned.": [
    "售出或退回了多少单位。",
    "Berapa unit dijual atau dipulangkan."
  ],
  "Stock on hand": [
    "现有库存",
    "Stok di tangan"
  ],
  "How much you have on the shelf right now.": [
    "您货架上现在有多少。",
    "Berapa banyak yang ada di rak anda sekarang."
  ],
  "Stock count date": [
    "库存盘点日期",
    "Tarikh kiraan stok"
  ],
  "When was your current stock counted?": [
    "您的现有库存是什么时候盘点的？",
    "Bilakah stok semasa anda dikira?"
  ],
  "Add more, see more": [
    "补充更多，看到更多",
    "Tambah lagi, lihat lagi"
  ],
  "Confirm these columns to unlock:": [
    "确认这些列即可解锁：",
    "Sahkan lajur ini untuk membuka:"
  ],
  "Stock freshness, weeks of cover, purchase audit": [
    "库存新鲜度、可覆盖周数、采购审核",
    "Kesegaran stok, minggu liputan, audit belian"
  ],
  "Expiry-aware notes": [
    "到期提醒",
    "Nota sedar luput"
  ],
  "Expiry date": [
    "到期日期",
    "Tarikh luput"
  ],
  "Stock on hand + stock count date": [
    "现有库存 + 库存盘点日期",
    "Stok di tangan + tarikh kiraan stok"
  ],
  "What your file turns into": [
    "您的文件如何转化为结果",
    "Hasil daripada fail anda"
  ]
});

Object.assign(messages, {
  "An order you have already planned but not yet placed.": ["计划已拟定但尚未下单的订单。", "Pesanan yang telah anda rancang tetapi belum dibuat."],
  "Stock you have ordered that has not arrived yet.": ["已下单但尚未到货的库存。", "Stok yang telah dipesan tetapi belum tiba."],
  "When a batch of the product expires.": ["这一批产品何时到期。", "Bila kelompok produk ini tamat tempoh."]
});

Object.assign(messages, {
  "Plan your next order with confidence.": ["让下一次订购更有把握。", "Rancang pesanan seterusnya dengan yakin."],
  "From sales data to your next order": ["从销售数据，到下一次订购", "Daripada data jualan kepada pesanan seterusnya"],
  "Select a product below, then follow these three steps.": ["选择下方商品，再按这三个步骤规划采购。", "Pilih produk di bawah, kemudian ikuti tiga langkah ini."],
  "Review demand": ["查看需求", "Semak permintaan"],
  "See past sales and the four-week range.": ["查看过往销售与未来四周的需求区间。", "Lihat jualan lalu dan julat permintaan empat minggu."],
  "Enter your quantities": ["输入数量", "Masukkan kuantiti anda"],
  "Add your planned order and incoming stock.": ["填写计划订购量和在途库存。", "Tambah pesanan dirancang dan stok dalam perjalanan."],
  "Check before ordering": ["下单前检查", "Semak sebelum membuat pesanan"],
  "Compare the plan with expected demand.": ["比较采购计划与预期需求。", "Bandingkan rancangan dengan permintaan dijangka."]
});

Object.assign(messages, {
  "In {0} week, sales and returns cancelled each other out.": ["其中 {0} 周的销售和退货相互抵消。", "Dalam {0} minggu, jualan dan pulangan mengimbangi satu sama lain."],
  "In {0} weeks, sales and returns cancelled each other out.": ["其中 {0} 周的销售和退货相互抵消。", "Dalam {0} minggu, jualan dan pulangan mengimbangi satu sama lain."],
  "{0} week had returns greater than sales.": ["有 {0} 周的退货量超过销售量。", "{0} minggu mempunyai pulangan melebihi jualan."],
  "{0} weeks had returns greater than sales.": ["有 {0} 周的退货量超过销售量。", "{0} minggu mempunyai pulangan melebihi jualan."]
});

Object.assign(messages, {
  "In stock": ["现有库存", "Stok di tangan"],
  "Your order": ["计划订购", "Pesanan anda"],
  "Check": ["检查结果", "Semakan"],
  "Review →": ["查看 →", "Semak →"],
  "Suggested": ["建议", "Dicadangkan"],
  "See your impact →": ["查看您的影响 →", "Lihat impak anda →"],
  "product is ready": ["项产品已就绪", "produk sudah sedia"],
  "CSV / XLS": ["CSV / Excel", "CSV / Excel"],
  "Drop your CSV or Excel file here": ["将 CSV 或 Excel 文件拖到这里", "Lepaskan fail CSV atau Excel anda di sini"],
  "Choose CSV or Excel file": ["选择 CSV 或 Excel 文件", "Pilih fail CSV atau Excel"],
  ".csv, .xlsx or .xls": [".csv、.xlsx 或 .xls", ".csv, .xlsx atau .xls"],
  "Excel uses the first worksheet with data": ["Excel 将使用第一个有数据的工作表", "Excel menggunakan helaian pertama yang mengandungi data"],
  "Every source row is tracked through readiness; none is silently discarded.": ["每一行原始数据都会被追踪，不会被悄悄丢弃。", "Setiap baris sumber dijejaki; tiada yang dibuang secara senyap."],
  "Matching rows need your decision": ["相同记录需要您作出决定", "Baris sepadan memerlukan keputusan anda"],
  "StockLess checks whether each sale date can be interpreted reliably. Invalid or ambiguous dates are flagged.": ["StockLess 检查每个销售日期是否可靠；无效或含糊的日期会被标记。", "StockLess menyemak sama ada setiap tarikh jualan boleh ditafsir dengan yakin. Tarikh tidak sah atau kabur ditandakan."],
  "Quantities must resolve to valid numbers. Missing, non-numeric or conflicting values are flagged.": ["数量必须是有效数值；缺失、非数字或冲突的值会被标记。", "Kuantiti mesti berupa nombor sah. Nilai hilang, bukan angka atau bercanggah ditandakan."],
  "Each sales row needs a reliable product identifier so sales can be grouped correctly.": ["每一行销售记录都需要可靠的产品标识，才能正确归组。", "Setiap baris jualan memerlukan pengecam produk yang boleh dipercayai supaya jualan dapat dikumpulkan dengan betul."],
  "Identical source rows remain traceable. You can decide whether to count both or exclude repeats.": ["相同的原始行仍可追溯。您可以决定全部计入或排除重复项。", "Baris sumber yang sama kekal boleh dijejaki. Anda boleh memilih sama ada mengira semuanya atau mengecualikan pendua."],
  "Current stock and stock-count dates are optional evidence for coverage and restocking.": ["现有库存和盘点日期是评估库存覆盖与补货的可选依据。", "Stok semasa dan tarikh kiraan stok ialah bukti pilihan untuk liputan dan penambahan stok."],
  "Filter": ["筛选", "Tapis"],
  "Other": ["其他", "Lain-lain"],
});

Object.assign(messages, {
  "Step 1 of 4": [
    "第 1 步 / 共 4 步",
    "Langkah 1 / 4"
  ],
  "Upload your sales file": [
    "上传您的销售记录",
    "Muat naik fail jualan anda"
  ],
  "Use the CSV or Excel export from your POS, marketplace or spreadsheet. Column names don't need to match ours.": [
    "直接用 POS 系统、网店或 Excel 导出的 CSV / Excel 文件就可以，栏位名称不必和我们一样。",
    "Guna fail CSV atau Excel yang dieksport dari sistem POS, kedai online atau hamparan anda. Nama lajur tak perlu sama macam kami."
  ],
  "Ready to match": [
    "可以开始对应栏位了",
    "Sedia untuk dipadankan"
  ],
  "Continue to matching →": [
    "下一步 →",
    "Teruskan →"
  ],
  "Your file needs three columns": [
    "文件里需要有这三栏",
    "Fail anda perlu ada tiga lajur ini"
  ],
  "You'll pair them up in the next step.": [
    "下一步会请您一一对应。",
    "Anda akan padankannya dalam langkah seterusnya."
  ],
  "Each sale or return": [
    "每一笔销售或退货",
    "Setiap jualan atau barang dipulangkan"
  ],
  "Code, or name + pack size": [
    "商品代码，或名称加规格",
    "Kod produk, atau nama + saiz pek"
  ],
  "Returns as negatives": [
    "退货用负数表示",
    "Barang dipulangkan ditulis sebagai negatif"
  ],
  "Optional columns add more": [
    "多几栏，结果更完整",
    "Lajur tambahan, hasil lebih lengkap"
  ],
  "Stock on hand + count date": [
    "现有库存 + 盘点日期",
    "Stok sedia ada + tarikh kira stok"
  ],
  "See how many weeks stock will last": [
    "看库存还能卖几周",
    "Tahu stok cukup untuk berapa minggu"
  ],
  "Planned orders, incoming stock": [
    "计划进货、在途库存",
    "Pesanan dirancang, stok dalam perjalanan"
  ],
  "Check an order before you place it": [
    "下单前先检查一遍",
    "Semak pesanan sebelum anda buat"
  ],
  "Flag batches close to expiry": [
    "提醒快过期的批次",
    "Kenal pasti barang yang hampir luput"
  ],
  "Unit cost": [
    "进货单价",
    "Kos seunit"
  ],
  "Price your impact in ringgit": [
    "用令吉算出您省了多少",
    "Kira impak anda dalam ringgit"
  ],
  "Minimum order, case size, lead time": [
    "最低订量、每箱数量、送货天数",
    "Pesanan minimum, saiz kotak, tempoh penghantaran"
  ],
  "Typed in Step 4": [
    "在第 4 步填写",
    "Isi di Langkah 4"
  ],
  "What happens to your file": [
    "您的文件会变成什么",
    "Apa yang berlaku pada fail anda"
  ],
  "Required and optional columns": [
    "必需和可选栏位",
    "Lajur wajib dan pilihan"
  ],
  "Not yet available": [
    "暂未提供",
    "Belum tersedia"
  ]
});

Object.assign(messages, {
  "Your CSV or Excel file is processed in this browser and no account is required. If you save a dataset, StockLess keeps its records, settings and plans in this browser. Your file is not uploaded to an AI or API service.": [
    "CSV 或 Excel 文件只在此浏览器中处理，无需账户。如果您保存数据集，StockLess 会将其记录、设置和计划保存在此浏览器中。文件不会上传至 AI 或 API 服务。",
    "Fail CSV atau Excel anda diproses dalam pelayar ini tanpa akaun. Jika anda menyimpan set data, StockLess menyimpan rekod, tetapan dan rancangannya dalam pelayar ini. Fail anda tidak dimuat naik ke perkhidmatan AI atau API."
  ]
});

Object.assign(messages, {
  "Step 2 of 4": [
    "第 2 步 / 共 4 步",
    "Langkah 2 / 4"
  ],
  "Sample": [
    "示例",
    "Sampel"
  ],
  "Read": [
    "已读取",
    "Sudah dibaca"
  ],
  "Change": [
    "换文件",
    "Tukar fail"
  ],
  "Check how we read your file": [
    "确认我们读对了您的文件",
    "Semak cara kami baca fail anda"
  ],
  "We matched your columns by their names. Fix anything that's wrong, then confirm. Your file isn't changed.": [
    "我们已按栏位名称自动对应。如有不对请改正，再按确认。原文件不会被改动。",
    "Kami padankan lajur anda ikut namanya. Betulkan mana yang salah, kemudian sahkan. Fail asal anda tak diubah."
  ],
  "Needed to continue": [
    "缺了就无法继续",
    "Perlu ada untuk teruskan"
  ],
  "Each one adds to your results. Choose \"Not in this file\" to skip.": [
    "每多一栏，结果就更完整。没有的话选“文件里没有”即可。",
    "Setiap satu menambah maklumat. Pilih \"Tiada dalam fail\" untuk langkau."
  ],
  "matched": [
    "已对应",
    "dipadankan"
  ],
  "When each sale or return happened": [
    "每笔销售或退货的日期",
    "Bila jualan atau pemulangan berlaku"
  ],
  "How we tell products and pack sizes apart": [
    "用来分辨商品和规格",
    "Cara kami bezakan produk dan saiz pek"
  ],
  "Units sold, or returned as negative numbers": [
    "卖出的数量，退货写负数",
    "Unit dijual; pemulangan ditulis negatif"
  ],
  "How much is on the shelf": [
    "货架上现在有多少",
    "Berapa banyak di rak sekarang"
  ],
  "When that stock was counted": [
    "库存是哪天点的",
    "Bila stok itu dikira"
  ],
  "Orders you plan to place": [
    "您打算下的订单",
    "Pesanan yang anda nak buat"
  ],
  "Ordered but not yet arrived": [
    "已订货但还没到",
    "Sudah dipesan tapi belum sampai"
  ],
  "When each batch expires": [
    "每批货的到期日",
    "Bila setiap kelompok luput"
  ],
  "What you pay your supplier for one unit": [
    "每件向供应商进货的价钱",
    "Harga yang anda bayar kepada pembekal untuk satu unit"
  ],
  "Product code": [
    "商品代码",
    "Kod produk"
  ],
  "Name + pack size": [
    "名称 + 规格",
    "Nama + saiz pek"
  ],
  "This column is already used above.": [
    "这一栏上面已经用过了。",
    "Lajur ini sudah dipakai di atas."
  ],
  "Choose a column to continue.": [
    "请先选一栏才能继续。",
    "Pilih satu lajur dulu untuk teruskan."
  ],
  "Columns we won't use": [
    "用不到的栏位",
    "Lajur yang kami tak guna"
  ],
  "Processed in your browser, never uploaded.": [
    "只在浏览器里处理，不会上传。",
    "Diproses dalam pelayar anda sahaja, tak dimuat naik."
  ],
  "Confirm and check my data →": [
    "确认，开始检查数据 →",
    "Sahkan dan semak data →"
  ],
  "Product Name + Pack Variant": [
    "Product Name + Pack Variant",
    "Product Name + Pack Variant"
  ],
  "Sale date + Quantity sold": [
    "销售日期 + 卖出数量",
    "Tarikh jualan + Kuantiti dijual"
  ],
  "Weeks of cover, recent weekly average, missing-week check, weekly product history": [
    "库存能卖几周、最近每周平均、哪几周没数据、每周销量记录",
    "Tempoh bekalan, purata mingguan terkini, semakan minggu tanpa data, sejarah jualan mingguan"
  ],
  "Stock on hand + Stock count date": [
    "现有库存 + 盘点日期",
    "Stok sedia ada + Tarikh kiraan stok"
  ],
  "Weeks of cover, purchase check, stock freshness": [
    "库存能卖几周、进货检查、库存新不新",
    "Tempoh bekalan, semakan belian, seberapa baru kiraan stok"
  ],
  "Product name and pack size": [
    "商品名称和规格",
    "Nama produk dan saiz pek"
  ],
  "Product code (optional)": [
    "商品代码（选填）",
    "Kod produk (pilihan)"
  ],
  "Keep these details for product names, pack sizes and identity checks.": [
    "保留这些资料，用于显示商品名称、规格和检查商品标识。",
    "Simpan butiran ini untuk nama produk, saiz pek dan semakan identiti."
  ],
  "These columns stay in your original file and are not used in this check.": [
    "这些栏位保留在原文件中，不用于本次检查。",
    "Lajur ini kekal dalam fail asal anda dan tidak digunakan dalam semakan ini."
  ],
  "columns": ["栏", "lajur"],
  "Other matched columns": ["其他已对应栏位", "Lajur lain yang dipadankan"],
  "These extra suggestions are kept for later steps. You can change or clear them.": ["这些额外建议保留用于后续步骤。您可以更改或清除它们。", "Cadangan tambahan ini disimpan untuk langkah seterusnya. Anda boleh mengubah atau mengosongkannya."],
  "All columns are matched.": [
    "所有栏位均已对应。",
    "Semua lajur telah dipadankan."
  ]
});

// Readiness design and live-data adaptations.
Object.assign(messages, {
  "Step 3 of 4": [
    "第 3 步 / 共 4 步",
    "Langkah 3 / 4"
  ],
  "Sample": [
    "示例",
    "Sampel"
  ],
  "Your data stays on your device": [
    "数据只留在您的设备上",
    "Data anda tak keluar dari peranti ini"
  ],
  "Your data is mostly ready": [
    "数据基本没问题",
    "Data anda hampir siap"
  ],
  "products ready": [
    "个商品没问题",
    "produk sedia"
  ],
  "Complete data, no major issues": [
    "数据完整，没有大问题",
    "Data lengkap, tiada masalah besar"
  ],
  "need review": [
    "个要看一下",
    "perlu disemak"
  ],
  "Usable, with something to check": [
    "可以用，但有地方要确认",
    "Boleh guna, tapi ada perkara perlu disemak"
  ],
  "missing data": [
    "个数据不全",
    "data tak cukup"
  ],
  "Can't be planned yet": [
    "暂时没法规划",
    "Belum boleh dirancang"
  ],
  "What we found": [
    "检查结果",
    "Apa yang kami jumpa"
  ],
  "Download list": [
    "下载问题清单",
    "Muat turun senarai"
  ],
  "Dates we couldn't read": [
    "看不懂的日期",
    "Tarikh yang tak dapat dibaca"
  ],
  "Rows with no product": [
    "没有商品的行",
    "Baris tanpa produk"
  ],
  "Stock counts to check": [
    "要确认的库存数",
    "Kiraan stok yang perlu disemak"
  ],
  "Other things to check": [
    "其他要留意的地方",
    "Perkara lain untuk disemak"
  ],
  "Safe tidy-ups applied": [
    "已自动帮您整理",
    "Kami dah kemaskan untuk anda"
  ],
  "Left out": [
    "未计入",
    "Tidak dikira"
  ],
  "Still counted": [
    "照常计入",
    "Tetap dikira"
  ],
  "Done": [
    "已处理",
    "Selesai"
  ],
  "Unknown product": [
    "不明商品",
    "Produk tak diketahui"
  ],
  "Add filter": [
    "筛选",
    "Tapis"
  ],
  "Category": [
    "类别",
    "Kategori"
  ],
  "Issue type": [
    "问题类型",
    "Jenis masalah"
  ],
  "Status": [
    "状态",
    "Status"
  ],
  "Remove filter": [
    "移除筛选",
    "Buang penapis"
  ],
  "Nothing matches these filters.": [
    "没有符合筛选条件的项目。",
    "Tiada yang padan dengan penapis ini."
  ],
  "Products by category": [
    "按类别看商品",
    "Produk ikut kategori"
  ],
  "Search name or code": [
    "搜索名称或代码",
    "Cari nama atau kod"
  ],
  "Show fewer": [
    "收起部分内容",
    "Tunjukkan kurang"
  ],
  "Showing:": [
    "只显示：",
    "Ditunjukkan:"
  ],
  "Clear": [
    "清除",
    "Buang"
  ],
  "All": [
    "全部",
    "Semua"
  ],
  "Beverages": [
    "饮品",
    "Minuman"
  ],
  "Staples": [
    "米面油糖",
    "Barang dapur asas"
  ],
  "Snacks": [
    "零食饼干",
    "Snek & biskut"
  ],
  "Fresh & dairy": [
    "鲜食与奶类",
    "Segar & tenusu"
  ],
  "Cooking & canned": [
    "调味与罐头",
    "Masakan & tin"
  ],
  "Non-food": [
    "非食品",
    "Bukan makanan"
  ],
  "Ready": [
    "没问题",
    "Sedia"
  ],
  "Missing data": [
    "数据不全",
    "Data tak cukup"
  ],
  "Ready for planning": [
    "可以开始规划",
    "Sedia untuk dirancang"
  ],
  "Rows used": [
    "已使用的行",
    "Baris digunakan"
  ],
  "products are ready to plan": [
    "项商品已可规划",
    "produk sedia untuk dirancang"
  ],
  "Missing weeks are never counted as zero sales.": [
    "没有数据的那几周不会被当成零销量。",
    "Minggu tanpa data tak dianggap sebagai jualan sifar."
  ],
  "Checked in your browser. Your file isn't changed.": [
    "只在浏览器里检查，原文件不会被改动。",
    "Disemak dalam pelayar anda. Fail asal tak diubah."
  ],
  "← Back to matching": [
    "← 返回栏位对应",
    "← Kembali ke padanan lajur"
  ],
  "Continue to purchase planning →": [
    "继续规划进货 →",
    "Teruskan ke perancangan belian →"
  ],
  "Last stock count": [
    "上次盘点",
    "Kiraan stok terakhir"
  ],
  "Stock age": [
    "多久前点的",
    "Umur kiraan stok"
  ],
  "Weekly sales": [
    "每周销量",
    "Jualan mingguan"
  ],
  "View details →": [
    "查看详情 →",
    "Lihat butiran →"
  ],
  "Close": [
    "关闭",
    "Tutup"
  ],
  "What to check": [
    "要看的地方",
    "Apa perlu disemak"
  ],
  "Week of": [
    "那一周",
    "Minggu"
  ],
  "Units sold": [
    "卖出件数",
    "Unit dijual"
  ],
  "Show the underlying numbers and charts": [
    "看详细数字和图表",
    "Lihat angka dan carta terperinci"
  ],
  "Problems and tidy-ups": [
    "问题与整理",
    "Masalah dan kemas kini"
  ],
  "Product": [
    "商品",
    "Produk"
  ],
  "Observed value": [
    "原本写的",
    "Nilai asal"
  ],
  "The sale date is later than the analysis date.": [
    "销售日期在分析日期之后。",
    "Tarikh jualan selepas tarikh analisis."
  ],
  "Categories are suggested from product names. Products to check are listed first.": [
    "分类由商品名称推测。需要检查的商品排在前面。",
    "Kategori dicadangkan daripada nama produk. Produk untuk disemak disenaraikan dahulu."
  ],
  "Other / unknown": [
    "其他／未知",
    "Lain-lain / tidak diketahui"
  ],
  "We checked every row. Problems are listed below with what to do. You can continue with usable rows and fix your file later.": [
    "我们检查了每一行。以下列出问题和处理方法。您可以先使用有效记录，稍后修正文件。",
    "Kami menyemak setiap baris. Masalah dan tindakan disenaraikan di bawah. Teruskan dengan baris yang boleh digunakan dan betulkan fail kemudian."
  ],
  "Your data needs corrections": [
    "您的数据需要修正",
    "Data anda perlu dibetulkan"
  ],
  "rows to fix in your file": [
    "行需要在文件中修正",
    "baris perlu dibetulkan dalam fail"
  ],
  "rows left out of": [
    "行未计入，总行数为",
    "baris diketepikan daripada"
  ],
  "Your file isn't changed": [
    "原始文件未被更改",
    "Fail anda tidak diubah"
  ],
  "stock checks": [
    "项库存检查",
    "semakan stok"
  ],
  "completed items": [
    "项已完成事项",
    "item selesai"
  ],
  "← All filters": [
    "← 所有筛选",
    "← Semua penapis"
  ],
  "Show fewer products": [
    "显示较少商品",
    "Tunjukkan kurang produk"
  ],
  "Show all products": [
    "显示所有商品",
    "Tunjukkan semua produk"
  ],
  "Show all findings": [
    "显示所有发现",
    "Tunjukkan semua penemuan"
  ],
  "Quantities to check": [
    "需要检查的数量",
    "Kuantiti untuk disemak"
  ],
  "Confirm date formats to use these rows": [
    "确认日期格式以使用这些行",
    "Sahkan format tarikh untuk menggunakan baris ini"
  ],
  "Choose the format used by this whole column. Ambiguous dates are excluded until confirmed.": [
    "选择整列使用的日期格式。含糊的日期在确认前被排除。",
    "Pilih format bagi seluruh lajur ini. Tarikh kabur diketepikan sehingga disahkan."
  ],
  "products can be planned with a note to review": [
    "项商品可规划，但需要查看提示",
    "produk boleh dirancang dengan nota untuk disemak"
  ],
  "products need more data before planning": [
    "项商品在规划前需要更多数据",
    "produk memerlukan lebih banyak data sebelum dirancang"
  ],
  "Duplicate rows handled automatically": [
    "重复行已自动处理",
    "Baris pendua dikendalikan secara automatik"
  ],
  "duplicate groups": [
    "组重复行",
    "kumpulan pendua"
  ],
  "repeated rows left out": [
    "行重复记录未计入",
    "baris pendua diketepikan"
  ],
  "Every finding retains its source rows and original evidence.": [
    "每项发现均保留来源行和原始记录。",
    "Setiap penemuan mengekalkan baris sumber dan bukti asal."
  ],
  "Download all row evidence": [
    "下载所有行记录",
    "Muat turun semua bukti baris"
  ],
  "No problems found.": [
    "未发现问题。",
    "Tiada masalah ditemui."
  ],
  "Fewer than four of the last eight complete weeks have sales records.": [
    "最近八个完整周中，有销售记录的周少于四个。",
    "Kurang daripada empat minggu dalam lapan minggu lengkap terakhir mempunyai rekod jualan."
  ],
  "This sale is far larger than this product's usual recorded sales.": [
    "此笔销量远高于该商品通常的销售记录。",
    "Jualan ini jauh lebih besar daripada jualan biasa produk ini."
  ],
  "Check that the quantity is right. This sale is still counted.": [
    "检查数量是否正确。此笔销售仍然计入。",
    "Semak sama ada kuantiti betul. Jualan ini masih dikira."
  ],
  "One product code is used for different product names or pack sizes.": [
    "同一商品编码用于不同商品名称或包装规格。",
    "Satu kod produk digunakan untuk nama produk atau saiz pek yang berbeza."
  ],
  "The same product name and pack size appear under different codes.": [
    "相同商品名称和包装规格使用不同编码。",
    "Nama produk dan saiz pek yang sama muncul di bawah kod berbeza."
  ],
  "Check the product names, codes and pack sizes in your file. Original identifiers are preserved.": [
    "检查商品名称、编码和包装规格。原始标识保持不变。",
    "Semak nama, kod dan saiz pek dalam fail. Pengecam asal dikekalkan."
  ],
  "Handled automatically. Your file is unchanged.": [
    "已自动处理。原始文件未被更改。",
    "Dikendalikan secara automatik. Fail anda tidak berubah."
  ],
  "Nothing to fix. Original values are preserved.": [
    "无需修正。原始值已保留。",
    "Tiada yang perlu dibetulkan. Nilai asal dikekalkan."
  ],
  "Used the confirmed date format.": [
    "使用了已确认的日期格式。",
    "Format tarikh yang disahkan digunakan."
  ],
  "Extra spaces removed.": [
    "已移除多余空格。",
    "Ruang tambahan dibuang."
  ],
  "Line endings normalised.": [
    "已统一换行符。",
    "Pengakhiran baris diseragamkan."
  ],
  "No usable stock count date.": [
    "没有可用的库存清点日期。",
    "Tiada tarikh kiraan stok yang boleh digunakan."
  ],
  "Count your stock again and update the count date in your file.": [
    "重新清点库存，并更新文件中的清点日期。",
    "Kira stok semula dan kemas kini tarikh kiraan dalam fail."
  ],
  "Stock was counted {0} days ago.": [
    "库存清点于 {0} 天前。",
    "Stok dikira {0} hari lalu."
  ],
  "Identical rows: kept source row {0} and left out {1} repeated row(s).": [
    "相同行：保留来源行 {0}，并排除 {1} 行重复记录。",
    "Baris serupa: baris sumber {0} dikekalkan dan {1} baris pendua diketepikan."
  ]
});

Object.assign(messages, {"Apply filters": ["应用筛选", "Gunakan penapis"]});
Object.assign(messages, purchaseMessages);
Object.assign(messages, savedWorkspaceMessages);

Object.assign(messages, epic123Messages);
Object.assign(messages, onboardingMessages);
Object.assign(messages, i3CompletionMessages);
Object.assign(messages, {
  "Readiness view": ["检查结果视图", "Paparan kesediaan"],
  "Products": ["商品", "Produk"],
  "Rows in your file": ["文件里的行", "Baris dalam fail anda"],
  "of {0} rows will be used": ["行会被使用，共 {0} 行", "daripada {0} baris akan digunakan"],
  "{0} rows used, {1} left out": ["使用 {0} 行，未使用 {1} 行", "{0} baris digunakan, {1} diketepikan"],
  "Used in the plan": ["用于计划", "Digunakan dalam pelan"],
  "Tidied for you (still used)": ["已帮您整理（仍会使用）", "Dikemas untuk anda (masih digunakan)"],
  "Why {0} rows were left out": ["为什么有 {0} 行没用上", "Kenapa {0} baris diketepikan"],
  "Why 1 row was left out": ["为什么有 1 行没用上", "Kenapa 1 baris diketepikan"],
  "Repeated rows (latest kept)": ["重复的行（保留最新一行）", "Baris berulang (yang terbaru disimpan)"],
  "Other reasons": ["其他原因", "Sebab lain"],
  "Nothing to fix. Every row can be used.": ["没有需要修改的，每一行都能用。", "Tiada apa perlu dibaiki. Semua baris boleh digunakan."],
  "Nothing to fix": ["不用修改", "Tiada apa perlu dibaiki"],
  "Fix {0} rows in your file": ["在文件里修改这 {0} 行", "Baiki {0} baris dalam fail anda"],
  "Fix 1 row in your file": ["在文件里修改这 1 行", "Baiki 1 baris dalam fail anda"],
  "Download the list to see these rows": ["下载清单查看这些行", "Muat turun senarai untuk lihat baris ini"],
  "Quantity isn't a number": ["数量不是数字", "Kuantiti bukan nombor"],
  "No product code": ["没有商品代码", "Tiada kod produk"],
  "Or continue now — these rows are simply left out of the plan.": ["也可以现在继续，这些行只是不会算进计划里。", "Atau teruskan sekarang — baris ini cuma tak dikira dalam pelan."],
  "Show these rows in “What we found” ↓": ["在「检查结果」里查看这些行 ↓", "Lihat baris ini dalam “Apa yang kami jumpa” ↓"],
  "See every finding as a table": ["用表格查看全部检查结果", "Lihat semua dapatan dalam jadual"],
  "Issue": ["问题", "Masalah"],
  "Reason and action": ["原因和处理方法", "Sebab dan tindakan"],
  "Use": ["结果", "Hasil"],
  "View affected rows": ["查看受影响的行", "Lihat baris terjejas"],
  "1 affected row": ["1 行受影响", "1 baris terjejas"],
  "{0} affected rows": ["{0} 行受影响", "{0} baris terjejas"],
  "Affected rows for": ["以下项目的受影响行", "Baris terjejas untuk"],
  "Your data stays on this device.": ["您的数据只保存在这台设备上。", "Data anda kekal pada peranti ini."],
  "Read in this browser": ["在此浏览器中读取", "Dibaca dalam pelayar ini"],
  "Reading your file": ["正在读取您的文件", "Membaca fail anda"],
  "Almost there": ["快好了", "Hampir siap"],
  "Finding the columns": ["正在识别各列", "Mencari lajur"],
  "Reading rows": ["正在读取数据行", "Membaca baris"],
  "Opening the file…": ["正在打开文件…", "Membuka fail…"],
  "Working out which columns hold what…": ["正在判断每一列的内容…", "Mengenal pasti kandungan setiap lajur…"],
  "Reading your sales rows…": ["正在读取您的销售记录…", "Membaca baris jualan anda…"],
  "Putting your products together…": ["正在整理您的产品…", "Menyusun produk anda…"],
  "Big files can take a little longer.": ["文件较大时会稍慢一些。", "Fail besar mungkin mengambil masa lebih sedikit."],
  "In progress": ["进行中", "Sedang berjalan"],
  "Delivery falls outside the next 4 weeks. Review this product individually.": ["送货时间在未来四周之外。请单独查看此商品。", "Penghantaran di luar 4 minggu akan datang. Semak produk ini secara individu."],
  "The supplier quantity exceeds the storage limit. Review this product individually.": ["供应商订购量超过储存限制。请单独查看此商品。", "Kuantiti pembekal melebihi had penyimpanan. Semak produk ini secara individu."],
  "A reliable purchase check is required first.": ["请先完成可靠的采购检查。", "Semakan belian yang boleh dipercayai diperlukan dahulu."],
});
