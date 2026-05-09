#!/usr/bin/env python3
"""
Create a synthetic Ukrainian internal passport image with real field text.
Used for Task 48 live OCR proof — proves full Vision→DeepSeek→DB pipeline.
"""
from PIL import Image, ImageDraw, ImageFont
import sys, os

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/test-passport-ua.jpg"

# Passport page dimensions (A5 landscape approximation)
W, H = 1200, 850

img = Image.new("RGB", (W, H), color=(250, 248, 240))
draw = ImageDraw.Draw(img)

# Background subtle texture
for y in range(0, H, 40):
    draw.line([(0, y), (W, y)], fill=(235, 232, 220), width=1)

# Header block
draw.rectangle([0, 0, W, 70], fill=(0, 82, 164))  # Ukrainian blue
draw.text((W//2, 35), "ПАСПОРТ ГРОМАДЯНИНА УКРАЇНИ", fill="white", anchor="mm",
          font=ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24) if os.path.exists("/System/Library/Fonts/Helvetica.ttc") else ImageFont.load_default())

# Attempt to load a font; fall back to default
def get_font(size=18):
    for path in [
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]:
        if os.path.exists(path):
            try: return ImageFont.truetype(path, size)
            except: pass
    return ImageFont.load_default()

font_label = get_font(14)
font_value = get_font(20)
font_header = get_font(24)

# Redraw header with better font
draw.rectangle([0, 0, W, 70], fill=(0, 82, 164))
draw.text((W//2, 35), "ПАСПОРТ ГРОМАДЯНИНА УКРАЇНИ", fill="white",
          anchor="mm", font=font_header)

# Series + number block (top right)
draw.text((950, 90), "Серія / Series", fill=(100, 100, 100), font=font_label)
draw.text((950, 110), "АА 123456", fill=(10, 10, 10), font=font_value)

# Field definitions: (label_uk, label_en, value, x, y)
fields = [
    ("ПРІЗВИЩЕ / Surname",         "ШЕВЧЕНКО",                   50,  110),
    ("ІМ'Я / Given names",         "ТАРАС ГРИГОРОВИЧ",           50,  180),
    ("СТАТЬ / Sex",                "Ч / M",                      50,  250),
    ("ГРОМАДЯНСТВО / Nationality", "УКРАЇНЕЦЬ / UKRAINIAN",      50,  320),
    ("ДАТА НАРОДЖЕННЯ / Date of birth", "09 БЕРЕЗНЯ 1814",       50,  390),
    ("МІСЦЕ НАРОДЖЕННЯ / Place of birth", "М. МОРИНЦІ",         50,  460),
    ("ОРГАН ВИДАЧІ / Issued by",   "ДМС ЧЕРКАСЬКОЇ ОБЛ.",       50,  530),
    ("ДАТА ВИДАЧІ / Date of issue","12 КВІТНЯ 2010",             50,  600),
    ("ДІЙСНИЙ ДО / Expiry date",   "12 КВІТНЯ 2030",            50,  670),
]

for label, value, x, y in fields:
    draw.text((x, y),      label, fill=(80, 80, 80),  font=font_label)
    draw.text((x, y + 22), value, fill=(5, 5, 30),    font=font_value)
    draw.line([(x, y + 46), (x + 550, y + 46)], fill=(180, 180, 180), width=1)

# Photo placeholder
draw.rectangle([830, 90, 1100, 380], outline=(150, 150, 150), width=2, fill=(220, 220, 220))
draw.text((965, 235), "ФОТО", fill=(120, 120, 120), anchor="mm", font=font_header)

# MRZ zone at bottom
draw.rectangle([0, 780, W, H], fill=(240, 245, 255))
draw.text((50, 797), "P<UKRSHEVCHENKO<<TARAS<GRYGOROVYCH<<<<<<<<<<<<", fill=(30, 30, 30), font=font_label)
draw.text((50, 817), "AA1234563UKR8140309M3004129<<<<<<<<<<<<<<<<<<", fill=(30, 30, 30), font=font_label)

img.save(OUT, "JPEG", quality=90)
print(f"Saved: {OUT}  ({W}x{H})")
