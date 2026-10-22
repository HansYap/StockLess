"""Build the StockLess expo QR and printable signs without external services."""

from pathlib import Path
import argparse
import json
import shutil
from urllib.parse import urlsplit

from PIL import Image
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, A5
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "frontend" / "public"
KIT = ROOT / "outputs" / "expo"
PDF_OUTPUT = ROOT / "output" / "pdf"
INK = "#203D35"
GREEN = "#327563"
CREAM = "#F4F6EC"
MUTED = "#64765F"
QR_INK = "#163D30"


def qr_matrix(value):
    qr = QrCodeWidget(value, barLevel="H").qr
    qr.make()
    return [[bool(qr.isDark(row, col)) for col in range(qr.moduleCount)]
            for row in range(qr.moduleCount)]


def write_qr(matrix):
    quiet = 4
    size = len(matrix) + quiet * 2
    pixel_scale = 32
    png = Image.new("RGB", (size, size), "white")
    for row, line in enumerate(matrix):
        for col, dark in enumerate(line):
            if dark:
                png.putpixel((col + quiet, row + quiet), tuple(bytes.fromhex(QR_INK[1:])))
    png.resize((size * pixel_scale, size * pixel_scale), Image.Resampling.NEAREST).save(
        KIT / "StockLess-QR.png", dpi=(600, 600))
    paths = " ".join(
        f"M{col + quiet} {row + quiet}h1v1h-1z"
        for row, line in enumerate(matrix) for col, dark in enumerate(line) if dark)
    (KIT / "StockLess-QR.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        f'width="50mm" height="50mm" shape-rendering="crispEdges">'
        f'<rect width="{size}" height="{size}" fill="#fff"/>'
        f'<path fill="{QR_INK}" d="{paths}"/></svg>', encoding="utf-8")


def draw_qr(pdf, matrix, x, y, width):
    size = len(matrix) + 8
    module = width / size
    pdf.setFillColor(colors.white)
    pdf.rect(x, y, width, width, stroke=0, fill=1)
    pdf.setFillColor(colors.HexColor(QR_INK))
    path = pdf.beginPath()
    for row, line in enumerate(matrix):
        for col, dark in enumerate(line):
            if dark:
                path.rect(x + (col + 4) * module,
                          y + (size - row - 5) * module, module, module)
    pdf.drawPath(path, stroke=0, fill=1)


def draw_sign(size_name, page_size, matrix, flyer_url):
    path = PDF_OUTPUT / f"StockLess-Booth-Sign-{size_name}.pdf"
    pdf = canvas.Canvas(str(path), pagesize=page_size, pageCompression=1)
    pdf.setTitle(f"StockLess - {size_name} Expo Booth Sign")
    pdf.setAuthor("Nexus 12")
    pdf.setSubject(f"Scan to explore StockLess: {flyer_url}")
    width, height = page_size
    scale = width / A5[0]

    def center(text, y, font_size, color=INK, bold=False):
        pdf.setFillColor(colors.HexColor(color))
        pdf.setFont("ExpoBold" if bold else "ExpoRegular", font_size * scale)
        pdf.drawCentredString(width / 2, y, text)

    pdf.setFillColor(colors.HexColor(CREAM))
    pdf.rect(0, 0, width, height, stroke=0, fill=1)
    pdf.setFillColor(colors.HexColor("#E2EBDB"))
    pdf.ellipse(-width * .25, -height * .15, width * 1.25, height * .18, stroke=0, fill=1)
    logo = PUBLIC / "report" / "stockless-logo.png"
    with Image.open(logo) as image:
        logo_ratio = image.height / image.width
    logo_width = 66 * mm * scale
    pdf.drawImage(str(logo), (width - logo_width) / 2, height * .865,
                  width=logo_width, height=logo_width * logo_ratio,
                  mask="auto", preserveAspectRatio=True)

    center("SMARTER RESTOCKING. LESS FOOD WASTE.", height * .79, 7.2, MUTED, True)
    center("Your next order,", height * .705, 23, INK, True)
    center("with more confidence.", height * .654, 23, GREEN, True)
    center("Built for small food retailers.", height * .592, 10, MUTED)

    qr_width = 50 * mm * scale
    qr_x = (width - qr_width) / 2
    qr_y = height * .425 - qr_width / 2
    pdf.setFillColor(colors.white)
    pdf.setStrokeColor(colors.HexColor("#D6E1CF"))
    pdf.setLineWidth(.75)
    pdf.roundRect(qr_x - 4 * mm, qr_y - 4 * mm,
                  qr_width + 8 * mm, qr_width + 8 * mm, 4 * mm,
                  stroke=1, fill=1)
    draw_qr(pdf, matrix, qr_x, qr_y, qr_width)
    pdf.linkURL(flyer_url, (qr_x, qr_y, qr_x + qr_width, qr_y + qr_width), relative=0)

    center("SCAN TO EXPLORE STOCKLESS", height * .254, 10, GREEN, True)
    display_url = flyer_url.removeprefix("https://").rstrip("/")
    center(display_url, height * .212, 9, INK, True)
    center("Free to use  |  No sign-up", height * .166, 8, MUTED)

    stocky_size = 23 * mm * scale
    stocky_x, stocky_y = width * .12, height * .035
    pdf.drawImage(str(PUBLIC / "report" / "stocky-hello.png"), stocky_x, stocky_y,
                  width=stocky_size, height=stocky_size * 226 / 220,
                  mask="auto", preserveAspectRatio=True)
    pdf.setFillColor(colors.HexColor(INK))
    pdf.setFont("ExpoBold", 9 * scale)
    pdf.drawString(width * .335, height * .095, "Say hello to Stocky.")
    pdf.setFillColor(colors.HexColor(MUTED))
    pdf.setFont("ExpoRegular", 7.8 * scale)
    pdf.drawString(width * .335, height * .069, "Try the sample data at our booth.")
    pdf.drawString(width * .335, height * .044, "by Nexus 12 - Made in Malaysia")
    pdf.showPage()
    pdf.save()
    shutil.copy2(path, KIT / path.name)
    return path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-url", default="https://stockless.pages.dev/")
    args = parser.parse_args()
    parsed = urlsplit(args.site_url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.query or parsed.fragment:
        raise ValueError("Use the public HTTPS website root, without query or fragment.")
    flyer_url = args.site_url.rstrip("/") + "/flyer/"
    KIT.mkdir(parents=True, exist_ok=True)
    PDF_OUTPUT.mkdir(parents=True, exist_ok=True)
    font_dir = Path("C:/Windows/Fonts")
    pdfmetrics.registerFont(TTFont("ExpoRegular", str(font_dir / "segoeui.ttf")))
    pdfmetrics.registerFont(TTFont("ExpoBold", str(font_dir / "segoeuib.ttf")))
    matrix = qr_matrix(flyer_url)
    write_qr(matrix)
    outputs = [draw_sign("A4", A4, matrix, flyer_url), draw_sign("A5", A5, matrix, flyer_url)]
    manifest = {
        "flyer_url": flyer_url,
        "qr_error_correction": "H",
        "qr_modules": len(matrix),
        "quiet_zone_modules": 4,
        "printed_qr_mm": {"A5": 50, "A4": round(50 * A4[0] / A5[0], 1)},
        "pdfs": [str(path) for path in outputs],
    }
    (KIT / "expo-kit.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (KIT / "START-HERE.txt").write_text(
        "STOCKLESS EXPO KIT\n\n"
        f"Flyer: {flyer_url}\n"
        "1. Deploy the existing website with the new /flyer/ page.\n"
        "2. Confirm that the live flyer and its Try StockLess button work.\n"
        "3. Print either booth PDF at 100% / actual size, in portrait.\n"
        "4. Test the printed QR on two phones using mobile data.\n"
        "5. Keep StockLess-Flyer.png ready to share through WhatsApp.\n\n"
        "The QR points directly to the permanent flyer URL. Update the flyer\n"
        "at that address to reuse the same printed QR. No QR subscription is needed.\n",
        encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
