#!/usr/bin/env python3
"""Generates index.html from template.html (Hebrew only)."""
import json, os

L = dict(
  lang="he", dir="rtl", base="", out="index.html",
  title="מטר · בר מצווה", desc="תראו אותו גדל.", name="מטר · בר מצווה", top="מטר · בר מצווה",
  play="לצפייה בסרטון", pause="השהיית הסרטון", full="מסך מלא", open_book="פתחו את הספר", close_book="סגירת הספר",
  hint="לחצו על הכריכה כדי להתחיל", hint_open="גררו את הדף · חיצים לדפדוף", hint_back="לחצו על הספר כדי לצפות שוב",
  p_front="כריכה", add="הוסיפו ברכה",
  launch="2099-01-01T00:00:00+03:00", peek="danor",
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
        "open_book", "close_book", "hint", "hint_open", "hint_back", "p_front", "add", "launch", "peek", "lock_title", "lock_text", "tv_qr1", "tv_qr2", "tv_start"]
HERE = os.path.dirname(os.path.abspath(__file__))
html = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
b = dict(L["book"]); b.update(dir=L["dir"], base=L["base"], play=L["play"], pause=L["pause"])
for k in KEYS: html = html.replace("{{" + k + "}}", L[k])
import time; V = str(int(time.time()))
html = html.replace("book.js\"", "book.js?v=" + V + "\"")
html = html.replace("{{book_json}}", json.dumps(b, ensure_ascii=False))
assert "{{" not in html, html[html.index("{{"):html.index("{{") + 40]
open(os.path.join(HERE, L["out"]), "w", encoding="utf-8").write(html); print("wrote index.html")
