Noto Sans SC, regular static instance (weight 400).

Upstream: https://github.com/google/fonts/tree/main/ofl/notosanssc
Downloaded 2026-10-08 from the official Google Fonts repository.
Licence: SIL Open Font License 1.1; see NotoSansSC-OFL.txt.

The upstream NotoSansSC[wght].ttf was converted to a static regular instance
using fontTools 4.66.1 varLib.instancer (all glyphs preserved). This avoids
variable-font rendering defects in PDF readers. PDF embeds the complete static
font because the JavaScript subsetter can drop glyph outlines; Latin report text
uses the standard Helvetica font. The CJK font is fetched only
from this application's origin when PDF export is requested. No report text,
merchant records or product names are sent to a font service.

Reproduce with an upstream copy and fontTools:

    fonttools varLib.instancer 'NotoSansSC[wght].ttf' wght=400 -o NotoSansSC.ttf

Keep the OFL licence alongside redistributed font bytes.
