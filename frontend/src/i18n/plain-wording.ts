/**
 * Plain-language wording from the UX review (Oct 2026).
 * Maps an existing interface string to [English, 中文, Bahasa Melayu].
 * Checked before messages.ts, so the old English text can stay as the key.
 * Malay and Chinese are drafts and still need a native speaker's check.
 */
export const plainWording: Readonly<Record<string, readonly [string, string, string]>> = {
  // Step names, the same everywhere
  "Add your file": ["Add your file", "添加文件", "Tambah fail"],
  "Map columns": ["Check the columns", "检查栏位", "Semak lajur"],
  "Match your columns": ["Check the columns", "检查栏位", "Semak lajur"],
  "Check readiness": ["Check your file", "检查您的文件", "Semak fail anda"],
  "Match columns": ["Check the columns", "检查栏位", "Semak lajur"],
  "Data readiness": ["Check your file", "检查您的文件", "Semak fail anda"],
  "Your order list": ["Your order list", "您的订货清单", "Senarai pesanan anda"],
  // Step 1
  "Upload your sales file": ["Add your sales file", "添加您的销售文件", "Tambah fail jualan anda"],
  "Use the CSV or Excel export from your POS, marketplace or spreadsheet. Column names don't need to match ours.": [
    "Any Excel or CSV from your till or spreadsheet works. Your column names don't need to match ours.",
    "收银机或电子表格导出的任何 Excel 或 CSV 都可以。栏位名称不必与我们的一致。",
    "Mana-mana fail Excel atau CSV daripada mesin juruwang atau hamparan anda boleh digunakan. Nama lajur tidak perlu sama dengan kami.",
  ],
  "Choose CSV or Excel file": ["Choose file", "选择文件", "Pilih fail"],
  "Use sample file": ["Try with sample data", "用示例数据试试", "Cuba dengan data contoh"],
  "Your file needs three columns": ["Your file needs 3 columns", "您的文件需要 3 个栏位", "Fail anda perlu 3 lajur"],
  "Optional columns add more": ["Add more details (optional)", "添加更多详情（可选）", "Butiran tambahan (pilihan)"],
  "Retailer file": ["Your file", "您的文件", "Fail anda"],
  // Step 2
  "Required": ["Must have", "必须有", "Wajib"],
  "Optional": ["Add more details", "更多详情", "Butiran tambahan"],
  "Product code": ["Code", "编码", "Kod"],
  "Name + pack size": ["Name + size", "名称 + 规格", "Nama + saiz"],
  "We matched your columns by their names. Fix anything that's wrong, then confirm. Your file isn't changed.": [
    "I matched these 3 for you. Do they look right?",
    "我已为您对应好这 3 项。看起来对吗？",
    "Saya sudah padankan 3 lajur ini untuk anda. Nampak betul?",
  ],
  "Clear session": ["Start over", "重新开始", "Mula semula"],
  "Confirm and check my data →": ["Looks right →", "没问题 →", "Nampak betul →"],
  "Confirm all and continue →": ["Yes, all good →", "是的，全部没问题 →", "Ya, semua betul →"],
  "All matches look right?": ["Everything look right?", "全部都对吗？", "Semua nampak betul?"],
  "ready": ["ready", "已就绪", "sedia"],
  // Step 3
  "Your data is mostly ready": ["Good news: most products are ready to plan", "好消息：大部分商品已可规划", "Berita baik: kebanyakan produk sedia untuk dirancang"],
  "We checked every row. Problems are listed below with what to do. You can continue with usable rows and fix your file later.": [
    "You can make your order list now. Anything below can wait.",
    "您现在就可以制作订货清单。下面的内容可以稍后处理。",
    "Anda boleh buat senarai pesanan sekarang. Perkara di bawah boleh tunggu.",
  ],
  "← Back to matching": ["← Check the columns", "← 检查栏位", "← Semak lajur"],
  "Continue to purchase planning →": ["Make my order list →", "制作我的订货清单 →", "Buat senarai pesanan saya →"],
  "rows to fix in your file": ["lines skipped. Your file isn't changed.", "行已跳过。您的文件不会被更改。", "baris dilangkau. Fail anda tidak diubah."],
  "Safe tidy-ups applied": ["Small fixes we made for you", "我们为您做的小修正", "Pembetulan kecil yang kami buat"],
  "Rows used": ["Lines we can use", "可用的行", "Baris yang boleh digunakan"],
  "Missing weeks are never counted as zero sales.": [
    "A week with no record is never counted as zero sales.",
    "没有记录的一周不会被算作零销售。",
    "Minggu tanpa rekod tidak dikira sebagai jualan sifar.",
  ],
  "Estimating demand locally…": ["Working out what you'll sell…", "正在估算您的销量…", "Mengira jualan anda…"],
  // Purchase plan / shared
  "Incoming stock": ["Already ordered, not here yet", "已订购，尚未到货", "Sudah dipesan, belum sampai"],
  "Weeks of cover": ["Stock lasts (weeks)", "库存可撑（周）", "Stok cukup (minggu)"],
  "Possible excess stock": ["Extra stock that may not sell", "可能卖不完的多余库存", "Stok lebih yang mungkin tak laku"],
  // Upload history
  "Clear Everything": ["Clear everything…", "全部清除…", "Padam semuanya…"],
  "In Upload history, use Delete beside an upload and confirm Remove upload to delete that upload and its saved plan. Use Clear Everything to remove all saved uploads and settings from this browser.": [
    "In Upload history, use Delete beside an upload and confirm Remove upload to delete that upload and its saved plan. Use Clear everything… to remove all saved uploads and settings from this browser.",
    "在上传历史中，点击文件旁的删除，再确认移除上传，以删除该文件及其保存的计划。点击全部清除…，以移除此浏览器中的全部上传和设置。",
    "Dalam Sejarah muat naik, pilih Padam di sebelah fail dan sahkan Buang muat naik untuk memadam fail dan pelan disimpan. Pilih Padam semuanya… untuk membuang semua muat naik dan tetapan dalam pelayar ini.",
  ],
  "Clear session clears only the file currently open. It does not delete saved uploads. Your original files are not changed.": [
    "Start over clears only the file currently open. It does not delete saved uploads. Your original files are not changed.",
    "重新开始仅清除当前打开的文件，不会删除已保存的上传，也不会改变原始文件。",
    "Mula semula hanya mengosongkan fail yang sedang dibuka. Ia tidak memadam muat naik disimpan. Fail asal anda tidak diubah.",
  ],
  // Guide tips that name a renamed button
  "Continue to purchase planning when you are ready. Products that need more data may have no suggestion yet; you can fix them later. Need review does not mean the whole file must be perfect.": [
    "Press Make my order list when you are ready. Products that need more sales history may have no suggestion yet; you can fix them later. Need review does not mean the whole file must be perfect.",
    "准备好后，点击“制作我的订货清单”。需要更多销售记录的商品可能暂时没有建议，可以之后再修正。“需要检查”并不要求整个文件必须完美。",
    "Tekan Buat senarai pesanan saya apabila bersedia. Produk yang perlu lebih sejarah jualan mungkin belum mempunyai cadangan; anda boleh membetulkannya kemudian. Perlu semakan tidak bermakna seluruh fail mesti sempurna.",
  ],
  "Continue becomes available when there are usable sales rows. Use Back to matching to correct column choices, or return to Upload with your corrected file. Your original file stays on your device.": [
    "Make my order list becomes available when there are usable sales lines. Use Check the columns to correct column choices, or return to Add your file with your corrected file. Your original file stays on your device.",
    "有可用销售记录后即可制作订货清单。点击“检查栏位”修正栏位选择，或返回“添加文件”上传修正后的文件。原始文件保留在您的设备上。",
    "Buat senarai pesanan saya tersedia apabila ada baris jualan yang boleh digunakan. Guna Semak lajur untuk membetulkan pilihan lajur, atau kembali ke Tambah fail dengan fail yang dibetulkan. Fail asal kekal pada peranti anda.",
  ],
  "Download the analysis to keep your estimates, or the order list for current positive order quantities. Back to the purchase plan lets you adjust quantities and review the updated impact. Downloads do not place an order.": [
    "Download the analysis to keep your estimates, or the order list for current positive order quantities. Back to my plan lets you adjust quantities and review the updated impact. Downloads do not place an order.",
    "下载分析以保存估算，或下载包含当前正数订量的订单清单。“返回我的计划”可调整数量并查看更新后的影响。下载不会下单。",
    "Muat turun analisis untuk menyimpan anggaran, atau senarai pesanan untuk kuantiti positif semasa. Kembali ke pelan saya untuk melaraskan kuantiti dan menyemak impak terkini. Muat turun tidak membuat pesanan.",
  ],
};
