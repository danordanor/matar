#!/usr/bin/env python3
"""Generates index.html from template.html (Hebrew only)."""
import json, os

L = dict(
  lang="he", dir="rtl", base="", out="index.html",
  title="מטר", desc="תראו אותו גדל.", name="מטר", top="מטר · בר מצווה",
  play="לצפייה בסרטון", full="מסך מלא", open_book="פתחו את הספר", close_book="סגירת הספר",
  hint="לחצו על הכריכה כדי להתחיל", hint_open="גררו את הדף · חיצים לדפדוף", hint_back="לחצו על הספר כדי לצפות שוב",
  p_front="כריכה",
  book=dict(name="מטר", sub="תראו אותו גדל", label="בר מצווה", credit="באהבה, אמא, אבא, מידן ואייר",
            line1="שלוש עשרה שנים. סרטון אחד.",
            story="הוא הגיע אלינו קטן, גדל בבריכות, בנחלים ועל טרמפולינות, מוקף באנשים שאוהבים אותו. ועכשיו הוא בן שלוש עשרה.",
            next="לסרטון",
            blurbLabel="תקציר",
            blurb="מהבטן של אמא, דרך המגבת האדומה, הבריכות, הנחלים והטרמפולינות, ועד היום שבו הוא עולה לתורה. כל התמונות שצילמנו לאורך השנים חוזרות לחיים, בסרטון אחד.",
            again="לצפייה שוב", p_front="כריכה", p_page="עמוד 1", p_back="תקציר"),
)

KEYS = ["lang", "dir", "base", "title", "desc", "name", "top", "play", "full",
        "open_book", "close_book", "hint", "hint_open", "hint_back", "p_front"]
HERE = os.path.dirname(os.path.abspath(__file__))
html = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
b = dict(L["book"]); b.update(dir=L["dir"], base=L["base"])
for k in KEYS: html = html.replace("{{" + k + "}}", L[k])
import time; V = str(int(time.time()))
html = html.replace("book.js\"", "book.js?v=" + V + "\"")
html = html.replace("{{book_json}}", json.dumps(b, ensure_ascii=False))
assert "{{" not in html, html[html.index("{{"):html.index("{{") + 40]
open(os.path.join(HERE, L["out"]), "w", encoding="utf-8").write(html); print("wrote index.html")
