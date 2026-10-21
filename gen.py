#!/usr/bin/env python3
"""Generates index.html (Hebrew) and en/index.html (English) from one template."""
import json, os

LANGS = {
  "he": dict(
    lang="he", dir="rtl", base="", out="index.html", other="en/", other_label="English",
    title="מטר", desc="תראו אותו גדל.",
    top="מטר · בר מצווה", hint="לחצו על הכריכה כדי לפתוח",
    book=dict(name="מטר", sub="תראו אותו גדל", line1="שלוש עשרה שנים.", line2="סרט אחד.",
              film="הסרט", mazal1="מזל טוב,", mazal2="מטר", love="באהבה, אמא, אבא, מידן ואייר",
              blurbLabel="תקציר",
              blurb="מהבטן של אמא, דרך המגבת האדומה, הבריכות, הנחלים והטרמפולינות, ועד היום שבו הוא עולה לתורה. כל התמונות שצילמנו לאורך השנים חוזרות לחיים, בסרט אחד.",
              watch="לצפייה בסרט"),
    play="לצפייה בסרט", again="שוב", close="סגירה", mazal="מזל טוב",
  ),
  "en": dict(
    lang="en", dir="ltr", base="../", out="en/index.html", other="../", other_label="עברית",
    title="Matar", desc="Watch him grow.",
    top="Matar · Bar Mitzvah", hint="Tap the cover to open",
    book=dict(name="Matar", sub="Watch him grow", line1="Thirteen years.", line2="One film.",
              film="The film", mazal1="Mazal tov,", mazal2="Matar", love="With love, Mom, Dad, Meidan & Iyar",
              blurbLabel="THE STORY",
              blurb="From before he was born, through the red towel, the pools, the streams and the trampolines, all the way to the day he is called to the Torah. Every photo we took over the years comes back to life in one film.",
              watch="Watch the film"),
    play="Watch the film", again="Again", close="Close", mazal="Mazal tov",
  ),
}

TPL = open(os.path.join(os.path.dirname(__file__), "template.html"), encoding="utf-8").read()
for k, L in LANGS.items():
    b = dict(L["book"]); b.update(dir=L["dir"], base=L["base"])
    html = TPL
    for key in ["lang", "dir", "base", "title", "desc", "top", "hint", "other", "other_label", "play", "again", "close", "mazal"]:
        html = html.replace("{{" + key + "}}", L[key])
    html = html.replace("{{book_json}}", json.dumps(b, ensure_ascii=False))
    out = os.path.join(os.path.dirname(__file__), L["out"]); os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    open(out, "w", encoding="utf-8").write(html); print("wrote", out)
