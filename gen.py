#!/usr/bin/env python3
"""Generates index.html (Hebrew) and en/index.html (English) from one template."""
import json, os

LANGS = {
  "he": dict(
    lang="he", dir="rtl", base="", out="index.html", other="en/", other_label="English",
    title="מטר", desc="תראו אותו גדל.", name="מטר", top="מטר · בר מצווה",
    play="לצפייה בסרט", full="מסך מלא", open_book="פתחו את הספר", close_book="סגירת הספר",
    hint="לחצו על הכריכה כדי להתחיל", hint_open="גררו את הדף · חיצים לדפדוף", hint_back="לחצו על הספר כדי לצפות שוב",
    p_front="כריכה",
    book=dict(name="מטר", sub="תראו אותו גדל", label="בר מצווה", credit="באהבה, אמא, אבא, מידן ואייר",
              blurbLabel="תקציר",
              blurb="מהבטן של אמא, דרך המגבת האדומה, הבריכות, הנחלים והטרמפולינות, ועד היום שבו הוא עולה לתורה. כל התמונות שצילמנו לאורך השנים חוזרות לחיים, בסרט אחד.",
              again="לצפייה שוב", p_front="כריכה", p_open="הסרט", p_back="תקציר",
              line1="שלוש עשרה שנים. סרט אחד.", w1="הוא הגיע אלינו קטן,", w2="גדל בבריכות, בנחלים ועל טרמפולינות,",
              w3="מוקף באנשים שאוהבים אותו,", w4="ועכשיו הוא בן שלוש עשרה."),
  ),
  "en": dict(
    lang="en", dir="ltr", base="../", out="en/index.html", other="../", other_label="עברית",
    title="Matar", desc="Watch him grow.", name="Matar", top="Matar · Bar Mitzvah",
    play="Watch the film", full="Full screen", open_book="Open the book", close_book="Close book",
    hint="Click the cover to begin", hint_open="Drag the paper · arrows to turn", hint_back="Click the book to watch again",
    p_front="Front cover",
    book=dict(name="Matar", sub="Watch him grow", label="Bar Mitzvah", credit="With love, Mom, Dad, Meidan & Iyar",
              blurbLabel="The story",
              blurb="From before he was born, through the red towel, the pools, the streams and the trampolines, all the way to the day he is called to the Torah. Every photo we took over the years comes back to life in one film.",
              again="Watch again", p_front="Front cover", p_open="The film", p_back="The story",
              line1="Thirteen years. One film.", w1="He came to us small,", w2="grew up in pools, streams and on trampolines,",
              w3="surrounded by people who love him,", w4="and now he is thirteen."),
  ),
}

KEYS = ["lang", "dir", "base", "title", "desc", "name", "top", "other", "other_label", "play", "full",
        "open_book", "close_book", "hint", "hint_open", "hint_back", "p_front"]
HERE = os.path.dirname(os.path.abspath(__file__))
TPL = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
for L in LANGS.values():
    b = dict(L["book"]); b.update(dir=L["dir"], base=L["base"])
    html = TPL
    for k in KEYS: html = html.replace("{{" + k + "}}", L[k])
    html = html.replace("{{book_json}}", json.dumps(b, ensure_ascii=False))
    assert "{{" not in html, html[html.index("{{"):html.index("{{") + 40]
    out = os.path.join(HERE, L["out"]); os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(html); print("wrote", out)
