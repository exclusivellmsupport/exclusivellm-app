"""exclusivellm.app üretici.

Kaynak: _src/index.html (iki dilli şablon: <span class="tr"> / <span class="en">) + _src/apps.json (üretimdeki oyunların sayfaları).
Çıktı (deponun kökü): index.html (TR), en/index.html (EN), <slug>/index.html, en/<slug>/index.html, sitemap.xml, robots.txt.

Kullanım:  python _src/build.py
Şablonu ya da apps.json'u değiştirdikten sonra her zaman çalıştır; çıktı dosyalarını elle düzenleme.
"""
from __future__ import annotations

import copy
import html
import json
import re
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "_src"
DOMAIN = "https://exclusivellm.app"
LANGS = ("tr", "en")
BASE = {"tr": "/", "en": "/en/"}
OG_LOCALE = {"tr": "tr_TR", "en": "en_US"}

HOME = {
    "tr": {
        "title": "Exclusive LLM Oyunları: Rahatlatıcı Mobil Oyunlar ve Uygulamalar",
        "description": "Exclusive LLM, Android için sakin ve kullanıcı dostu oyunlar ve uygulamalar geliştirir: ölçülü reklam, sade tasarım, gizliliğe saygı. Block Four ve BlockNest Google Play'de ücretsiz.",
    },
    "en": {
        "title": "Exclusive LLM Games: Relaxing Mobile Games & Apps",
        "description": "Exclusive LLM builds calm, user-friendly Android games and apps with measured ads, clean design and respect for your privacy. Block Four and BlockNest are free on Google Play.",
    },
}
UI = {
    "tr": {"home": "Ana sayfa", "games": "Oyunlar", "shots": "Ekran görüntüleri", "video": "Tanıtım videosu",
           "watch": "Videoyu oynat", "features": "Özellikler", "faq": "Sık sorulan sorular", "others": "Diğer oyunlarımız",
           "eyebrow_media": "Oyundan kareler", "eyebrow_play": "Oynanış", "eyebrow_faq": "Merak edilenler",
           "eyebrow_more": "Exclusive LLM", "free": "Google Play'de ücretsiz"},
    "en": {"home": "Home", "games": "Games", "shots": "Screenshots", "video": "Trailer",
           "watch": "Play video", "features": "Features", "faq": "Frequently asked questions", "others": "More of our games",
           "eyebrow_media": "In the game", "eyebrow_play": "Gameplay", "eyebrow_faq": "Questions", "eyebrow_more": "Exclusive LLM",
           "free": "Free on Google Play"},
}


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def page_soup(lang: str) -> BeautifulSoup:
    """Şablonu tek dile indirger, yolları köke göre mutlak yapar."""
    raw = (SRC / "index.html").read_text(encoding="utf-8").replace("{{base}}", BASE[lang])
    soup = BeautifulSoup(raw, "html.parser")
    other = "en" if lang == "tr" else "tr"
    for el in soup.select(f".{other}"):
        el.decompose()
    soup.html["lang"] = lang
    soup.body["data-lang"] = lang
    for tag, attr in (("img", "src"), ("link", "href"), ("script", "src"), ("a", "href")):
        for el in soup.find_all(tag):
            v = el.get(attr)
            if v and re.match(r"^(img|assets)/", v):
                el[attr] = "/" + v
    return soup


def set_lang_switch(soup: BeautifulSoup, lang: str, path: str) -> None:
    """path: dil önekinden sonraki yol, örn. '' ya da 'blocknest/'."""
    box = soup.select_one(".lang")
    box.clear()
    for l in LANGS:
        a = soup.new_tag("a", href=BASE[l] + path, hreflang=l)
        a["lang"] = l
        if l == lang:
            a["class"] = "on"
            a["aria-current"] = "page"
        a.string = l.upper()
        box.append(a)


def set_head(soup: BeautifulSoup, lang: str, path: str, title: str, desc: str, image: str, ld: list[dict]) -> None:
    head = soup.head
    keep_tags = []
    for el in list(head.children):
        if getattr(el, "name", None) is None:
            el.extract()
            continue
        n = el.name
        if n == "title" or (n == "meta" and (el.get("name") in ("description", "twitter:card") or el.get("property", "").startswith("og:"))) \
                or (n == "link" and el.get("rel") in (["canonical"], ["alternate"])) or (n == "script" and el.get("type") == "application/ld+json"):
            el.decompose()
        else:
            keep_tags.append(el.extract())
    url = DOMAIN + BASE[lang] + path
    parts = [
        '<meta charset="utf-8">',
        f"<title>{esc(title)}</title>",
        f'<meta name="description" content="{esc(desc)}">',
        f'<link rel="canonical" href="{url}">',
    ]
    for l in LANGS:
        parts.append(f'<link rel="alternate" hreflang="{l}" href="{DOMAIN + BASE[l] + path}">')
    parts.append(f'<link rel="alternate" hreflang="x-default" href="{DOMAIN + BASE["en"] + path}">')
    parts += [
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Exclusive LLM">',
        f'<meta property="og:locale" content="{OG_LOCALE[lang]}">',
        f'<meta property="og:title" content="{esc(title)}">',
        f'<meta property="og:description" content="{esc(desc)}">',
        f'<meta property="og:image" content="{DOMAIN}/img/{image}">',
        f'<meta property="og:url" content="{url}">',
        '<meta name="twitter:card" content="summary_large_image">',
    ]
    frag = BeautifulSoup("\n".join(parts), "html.parser")
    head.clear()
    head.append("\n  ")
    for el in [e for e in frag.contents if getattr(e, "name", None)]:
        if el.name == "meta" and el.get("charset"):
            continue
        head.append(el)
        head.append("\n  ")
    for el in keep_tags:
        if el.name == "meta" and el.get("charset"):
            head.insert(0, el)
            continue
        head.append(el)
        head.append("\n  ")
    for obj in ld:
        s = soup.new_tag("script", type="application/ld+json")
        s.string = json.dumps(obj, ensure_ascii=False)
        head.append(s)
        head.append("\n")


def org_ld() -> dict:
    return {"@context": "https://schema.org", "@type": "Organization", "name": "Exclusive LLM", "url": DOMAIN + "/",
            "logo": DOMAIN + "/img/logo.png", "email": "support@exclusivellm.app",
            "sameAs": ["https://www.instagram.com/exclusive.llm/", "https://www.tiktok.com/@exclusivellm",
                       "https://www.youtube.com/@Exclusivellm"]}


def write(path: Path, soup: BeautifulSoup) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = "<!doctype html>\n" + str(soup).replace("<!DOCTYPE html>", "").replace("<!doctype html>", "").lstrip()
    path.write_text(text, encoding="utf-8")


def play_button(soup: BeautifulSoup, pkg: str):
    tpl = soup.select_one("a.play")
    btn = copy.copy(tpl)
    btn["href"] = f"https://play.google.com/store/apps/details?id={pkg}"
    return btn


def game_main(app: dict, lang: str, apps: list[dict]) -> str:
    t, ui, base = app[lang], UI[lang], BASE[lang]
    name = esc(app["name"])
    tags = "".join(f'<span class="tag">{esc(x)}</span>' for x in t["tags"])
    shots = "".join(
        f'<img src="/img/shots/{s}" alt="{name} {esc(ui["shots"].lower())} {i + 1}" loading="lazy" width="540" height="1096">'
        for i, s in enumerate(app["shots"]))
    vid = app.get("video", {}).get(lang)
    video = ""
    if vid:
        video = f'''
    <section class="gp-sec">
      <div class="wrap">
        <div class="head center"><span class="eyebrow">{esc(ui["eyebrow_play"])}</span><h2 class="title">{esc(ui["video"])}</h2></div>
        <div class="yt" data-id="{vid}" data-title="{name}" role="button" tabindex="0" aria-label="{esc(ui["watch"])}">
          <img src="https://i.ytimg.com/vi/{vid}/hqdefault.jpg" alt="{name} {esc(ui["video"].lower())}" loading="lazy">
          <button type="button" aria-label="{esc(ui["watch"])}"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
        </div>
      </div>
    </section>'''
    cols = "".join(
        f'<div class="col"><h3>{esc(sec["h"])}</h3><ul>{"".join(f"<li>{esc(i)}</li>" for i in sec["items"])}</ul></div>'
        for sec in t["sections"])
    cols += f'<div class="col"><h3>{esc(ui["features"])}</h3><ul>{"".join(f"<li>{esc(i)}</li>" for i in t["features"])}</ul></div>'
    faq = "".join(f'<details><summary>{esc(q["q"])}</summary><p>{esc(q["a"])}</p></details>' for q in t["faq"])
    others = "".join(
        f'<a class="other" href="{base}{o["slug"]}/"><img src="/img/{o["icon"]}" alt="" width="56" height="56" loading="lazy">'
        f'<span><b>{esc(o["name"])}</b><small>{esc(o[lang]["tagline"])}</small></span></a>'
        for o in apps if o["slug"] != app["slug"])
    others += (f'<a class="other" href="{base}#apps"><img src="/img/favicon.png" alt="" width="56" height="56" loading="lazy">'
               f'<span><b>{esc(ui["games"])}</b><small>exclusivellm.app</small></span></a>')
    return f'''
  <main id="top" class="gp">
    <section class="gp-hero">
      <div class="wrap gp-grid">
        <div>
          <nav class="crumb" aria-label="breadcrumb"><a href="{base}">{esc(ui["home"])}</a><span>›</span><a href="{base}#apps">{esc(ui["games"])}</a><span>›</span><span>{name}</span></nav>
          <div class="head-row"><img src="/img/{app["icon"]}" alt="{name}" width="84" height="84"><div><h1>{name}</h1><div class="tags">{tags}</div></div></div>
          <p class="lead">{esc(t["tagline"])}</p>
          <p class="intro">{esc(t["intro"])}</p>
          <div class="cta-row" id="play-slot"></div>
        </div>
        <div class="gp-media"><img src="/img/{app["feature"]}" alt="{name}" width="1024" height="500"></div>
      </div>
    </section>
    <section class="gp-sec">
      <div class="wrap">
        <div class="head"><span class="eyebrow">{esc(ui["eyebrow_media"])}</span><h2 class="title">{esc(ui["shots"])}</h2></div>
        <div class="shots">{shots}</div>
      </div>
    </section>{video}
    <section class="gp-sec">
      <div class="wrap">
        <div class="head"><span class="eyebrow">{name}</span><h2 class="title">{esc(ui["features"])}</h2></div>
        <div class="feats">{cols}</div>
      </div>
    </section>
    <section class="gp-sec">
      <div class="wrap">
        <div class="head center"><span class="eyebrow">{esc(ui["eyebrow_faq"])}</span><h2 class="title">{esc(ui["faq"])}</h2></div>
        <div class="faq">{faq}</div>
      </div>
    </section>
    <section class="gp-sec">
      <div class="wrap">
        <div class="head"><span class="eyebrow">{esc(ui["eyebrow_more"])}</span><h2 class="title">{esc(ui["others"])}</h2></div>
        <div class="others">{others}</div>
      </div>
    </section>
  </main>
'''


def game_ld(app: dict, lang: str) -> list[dict]:
    t, url = app[lang], DOMAIN + BASE[lang] + app["slug"] + "/"
    play = f"https://play.google.com/store/apps/details?id={app['package']}"
    return [
        {"@context": "https://schema.org", "@type": "SoftwareApplication", "name": app["name"], "url": url,
         "description": t["description"], "applicationCategory": "GameApplication", "applicationSubCategory": app["category"],
         "operatingSystem": "Android", "inLanguage": app["languages"], "image": DOMAIN + "/img/" + app["feature"],
         "screenshot": [DOMAIN + "/img/shots/" + s for s in app["shots"]], "installUrl": play, "downloadUrl": play,
         "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
         "publisher": {"@type": "Organization", "name": "Exclusive LLM", "url": DOMAIN + "/"}},
        {"@context": "https://schema.org", "@type": "FAQPage",
         "mainEntity": [{"@type": "Question", "name": q["q"], "acceptedAnswer": {"@type": "Answer", "text": q["a"]}} for q in t["faq"]]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": UI[lang]["home"], "item": DOMAIN + BASE[lang]},
            {"@type": "ListItem", "position": 2, "name": app["name"], "item": url}]},
    ]


def build() -> list[str]:
    apps = json.loads((SRC / "apps.json").read_text(encoding="utf-8"))
    urls: list[str] = []
    for lang in LANGS:
        out_dir = ROOT if lang == "tr" else ROOT / "en"
        # ana sayfa
        soup = page_soup(lang)
        set_lang_switch(soup, lang, "")
        set_head(soup, lang, "", HOME[lang]["title"], HOME[lang]["description"], "blockfour-feature.jpg", [org_ld()])
        write(out_dir / "index.html", soup)
        urls.append(BASE[lang])
        # oyun sayfaları
        for app in apps:
            soup = page_soup(lang)
            set_lang_switch(soup, lang, app["slug"] + "/")
            for a in soup.select("header a[href^='#'], footer a[href^='#']"):
                a["href"] = BASE[lang] + a["href"]
            btn = play_button(soup, app["package"])
            main = soup.find("main")
            main.replace_with(BeautifulSoup(game_main(app, lang, apps), "html.parser"))
            soup.select_one("#play-slot").append(btn)
            del soup.select_one("#play-slot")["id"]
            set_head(soup, lang, app["slug"] + "/", app[lang]["title"], app[lang]["description"], app["feature"], game_ld(app, lang))
            write(out_dir / app["slug"] / "index.html", soup)
            urls.append(BASE[lang] + app["slug"] + "/")
    # sitemap + robots
    today = date.today().isoformat()
    groups: dict[str, list[str]] = {}
    for u in urls:
        key = u[len("/en"):] if u.startswith("/en/") else u
        groups.setdefault(key, []).append(u)
    items = []
    for key, us in groups.items():
        for u in us:
            alts = "".join(
                f'\n    <xhtml:link rel="alternate" hreflang="{l}" href="{DOMAIN}{BASE[l]}{key.lstrip("/")}"/>' for l in LANGS)
            alts += f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{DOMAIN}/en/{key.lstrip("/")}"/>'
            items.append(f"  <url>\n    <loc>{DOMAIN}{u}</loc>\n    <lastmod>{today}</lastmod>{alts}\n  </url>")
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + "\n".join(items) + "\n</urlset>\n", encoding="utf-8")
    (ROOT / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nDisallow: /_src/\n\nSitemap: {DOMAIN}/sitemap.xml\n", encoding="utf-8")
    return urls


if __name__ == "__main__":
    for u in build():
        print(DOMAIN + u)
