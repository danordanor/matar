#!/usr/bin/env python3
"""Generates index.html from template.html (Hebrew only)."""
import json, os

L = dict(
  lang="he", dir="rtl", base="", out="index.html",
  title="מטר · בר מצווה", desc="תראו אותו גדל.", name="מטר · בר מצווה", top="מטר · בר מצווה",
  play="לצפייה בסרטון", pause="השהיית הסרטון", full="מסך מלא", open_book="פתחו את הספר", close_book="סגירת הספר",
  hint="לחצו על הכריכה כדי להתחיל", hint_open="גררו את הדף · חיצים לדפדוף", hint_back="לחצו על הספר כדי לצפות שוב",
  p_front="כריכה", add="הוסיפו ברכה",
  lock_title="הספר עוד סגור.", lock_text="ספר הבר מצווה של מטר ייפתח בקרוב. בינתיים אפשר כבר לכתוב לו ברכה ולהוסיף תמונה, והיא תחכה לו בפנים.", tv_qr1="רוצים להוסיף ברכה?", tv_qr2="סרקו, כתבו ברכה והוסיפו תמונה", tv_start="הפעלת הספר",
  book=dict(name="מטר", sub="תראו אותו גדל", label="בר מצווה", credit="באהבה, אמא, אבא, מידן ואייר",
            line1="שלוש עשרה שנים. סרטון אחד.",
            story="הוא הגיע אלינו קטן, גדל בבריכות, בנחלים ועל טרמפולינות, מוקף באנשים שאוהבים אותו. ועכשיו הוא בן שלוש עשרה.",
            next="לסרטון",
            blurbLabel="תקציר",
            blurb="מהבטן של אמא, דרך המגבת האדומה, הבריכות, הנחלים והטרמפולינות, ועד היום שבו הוא עולה לתורה. כל התמונות שצילמנו לאורך השנים חוזרות לחיים, בסרטון אחד.",
            bless=[
              dict(label="מאמא ואבא", title="מטר שלנו,",
                   body="שלוש עשרה שנים שאנחנו מסתכלים עליך גדל, ומתרגשים מחדש כל יום. אתה סקרן, מצחיק, אמיץ ועם לב ענק. תמשיך לטפס גבוה, לשאול שאלות ולהיות בדיוק מי שאתה. אנחנו תמיד פה, מאחוריך.",
                   sign="מזל טוב, אמא ואבא"),
              dict(label="ממידן", title="מטר,", photo="f/72.jpg",
                   body="אתה האח הכי טוב בעולם. תודה שאתה משחק איתי ומצחיק אותי. אני אוהב אותך המון.",
                   sign="מזל טוב, מידן"),
              dict(label="מאייר", title="אחי,", photo="d/01.jpg",
                   body="אחי הקטן כבר לא כל כך קטן. תודה על כל הצחוקים, המשחקים והריבים שנגמרים בצחוק. אני גאה בך ותמיד אהיה בשבילך.",
                   sign="מזל טוב, אייר"),
            ],
            duo="מטר ואייר", fromLabel="ברכה מאת",
            inviteLabel="ספר הברכות", invite1="גם אתם", invite2="רוצים לברך?", inviteUrl="danor.studio/matar/add",
            again="לצפייה שוב", p_front="כריכה", p_page="עמוד 1", p_back="תקציר"),
)

KEYS = ["lang", "dir", "base", "title", "desc", "name", "top", "play", "pause", "full",
        "open_book", "close_book", "hint", "hint_open", "hint_back", "p_front", "add", "tv_qr1", "tv_qr2", "tv_start"]
HERE = os.path.dirname(os.path.abspath(__file__))
# LOCKED: guests at / see only the lock page; the book lives at /danor/ (the private link).
# Set LOCKED = False to put the book back at / for everyone.
LOCKED = True
import time; V = str(int(time.time()))

def book(base, out):
  html = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
  b = dict(L["book"]); b.update(dir=L["dir"], base=base, play=L["play"], pause=L["pause"])
  for k in KEYS: html = html.replace("{{" + k + "}}", base if k == "base" else L[k])
  html = html.replace("book.js\"", "book.js?v=" + V + "\"")
  html = html.replace("{{book_json}}", json.dumps(b, ensure_ascii=False))
  assert "{{" not in html, html[html.index("{{"):html.index("{{") + 40]
  os.makedirs(os.path.dirname(os.path.join(HERE, out)) or HERE, exist_ok=True)
  open(os.path.join(HERE, out), "w", encoding="utf-8").write(html); print("wrote", out)

LOCK = """<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>%(title)s</title><meta name="description" content="%(desc)s"><meta name="theme-color" content="#FFD24A">
<link rel="icon" href="icon.svg" type="image/svg+xml"><link rel="icon" href="favicon-32.png" sizes="32x32" type="image/png"><link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>
  @font-face { font-family: "Swiss"; font-weight: 400; src: url(fonts/plex-hebrew-400.woff2) format("woff2"); }
  @font-face { font-family: "Swiss"; font-weight: 600; src: url(fonts/plex-hebrew-600.woff2) format("woff2"); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Swiss", system-ui, sans-serif; color: #16140f; -webkit-font-smoothing: antialiased; min-height: 100svh; display: grid; place-items: center; text-align: center; padding: 24px;
         background: linear-gradient(135deg, #FFE27A, #FFC83A 50%%, #F4A62A); }
  small { font-size: 14px; opacity: .65; }
  h1 { font-weight: 600; font-size: clamp(40px, 9vw, 72px); line-height: 1.05; letter-spacing: -.02em; margin: 16px 0 14px; }
  p { font-size: 17px; line-height: 1.5; max-width: 26em; margin: 0 auto 28px; }
  a { display: inline-block; padding: 14px 26px; background: #16140f; color: #fff; text-decoration: none; font-size: 17px; }
</style>
</head>
<body><div><small>%(title)s</small><h1>%(lock_title)s</h1><p>%(lock_text)s</p><a href="add/">%(add)s</a></div></body>
</html>
"""

book("../", "danor/index.html")
if LOCKED:
  open(os.path.join(HERE, "index.html"), "w", encoding="utf-8").write(LOCK % L); print("wrote index.html (lock)")
else:
  book("", "index.html")
