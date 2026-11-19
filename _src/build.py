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
LANGS = ("tr", "en", "es")
BASE = {"tr": "/", "en": "/en/", "es": "/es/"}
OG_LOCALE = {"tr": "tr_TR", "en": "en_US", "es": "es_ES"}

# --- Dil başına öne çıkan grafik (19.11.2026) ----------------------------------------------------------
# img/<ad>-feature.jpg temel dosyadır; img/<ad>-feature-<dil>.jpg varsa o dilin sayfalarında (görsel, og:image,
# JSON-LD, games.json) o kullanılır. Yazılı grafik her dilde o dilin yazısıyla görünmeli: denetim aşağıda.
FEATURE_BASE_LANG = {"woodoraclassic-feature.jpg": "tr", "blockfour-feature.jpg": "tr"}  # belirtilmeyen: "en"
FEATURE_ONE_FOR_ALL = {  # yalnızca logo/marka yazısı olan, her dilde aynı kalabilen grafikler
    "toppleisles-feature.jpg": "yalnızca oyun logosu (TOPPLE ISLES · CANNON SMASH)",
}
FEATURE_MISSING_OK = {  # (grafik, dil): uygulamada o dil yok, İngilizcesi gösterilir
    ("wordsky-feature.jpg", "es"): "Wordsky yalnızca TR/EN",
    ("quiz-feature.jpg", "es"): "Exclusive Quiz yalnızca TR/EN",
}
_FEATURE_RE = re.compile(r"([\w-]+-feature)\.jpg")


def feature_for(name: str, lang: str) -> str:
    stem = name.rsplit(".", 1)[0]
    cand = f"{stem}-{lang}.jpg"
    return cand if (ROOT / "img" / cand).exists() else name


def localize_features(text: str, lang: str) -> str:
    return _FEATURE_RE.sub(lambda m: feature_for(m.group(0), lang), text)


def check_features() -> list[str]:
    """Sitede kullanılan her yazılı grafiğin her dilde doğru yazılı sürümü var mı?"""
    used = set(_FEATURE_RE.findall((SRC / "index.html").read_text(encoding="utf-8")))
    used |= {a["feature"].rsplit(".", 1)[0] for a in json.loads((SRC / "apps.json").read_text(encoding="utf-8"))}
    errors = []
    for stem in sorted(used):
        base = stem + ".jpg"
        if base in FEATURE_ONE_FOR_ALL:
            continue
        for lang in LANGS:
            if (ROOT / "img" / f"{stem}-{lang}.jpg").exists() or FEATURE_BASE_LANG.get(base, "en") == lang \
                    or (base, lang) in FEATURE_MISSING_OK:
                continue
            errors.append(f"{base}: '{lang}' sayfası için img/{stem}-{lang}.jpg yok (temel dosya '{FEATURE_BASE_LANG.get(base, 'en')}' yazılı)")
    return errors


# --- Uygulama adı = canlı Play adı (19.11.2026) -----------------------------------------------------------
# apps.json'daki "name", Play başlığının ":"'dan önceki kısmıyla harfi harfine aynı olmalı (ör. BlockFour tek kelime,
# iki kelime değil). Ağ yoksa uyarı verilir, site yine üretilir; uyuşmazlık varsa site üretilmez.
def play_titles(pkg: str) -> dict[str, str]:
    import urllib.request
    out = {}
    for hl in LANGS:
        req = urllib.request.Request(f"https://play.google.com/store/apps/details?id={pkg}&hl={hl}&gl=US",
                                     headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            m = re.search(r'<title id="main-title">([^<]*)', r.read().decode("utf-8", "replace"))
        if m:
            out[hl] = html.unescape(m.group(1)).rsplit(" - ", 1)[0].strip()
    return out


def check_names(apps: list[dict]) -> list[str]:
    errors = []
    texts = "\n".join((SRC / f).read_text(encoding="utf-8") for f in ("apps.json", "pages.json", "index.html", "build.py", "i18n_es.json")
                      if (SRC / f).exists())
    texts += "\n".join(f.read_text(encoding="utf-8") for f in ROOT.glob("*-privacy.html"))  # elle yazılan gizlilik sayfaları
    for a in apps:
        name = a["name"]
        try:
            titles = play_titles(a["package"])
        except Exception as e:  # ağ yok
            print(f"UYARI: {name} için Play başlığı okunamadı ({e}); ad denetimi atlandı")
            titles = {}
        for hl, t in titles.items():
            if t.split(":")[0].strip() != name:
                errors.append(f"{a['slug']}: apps.json adı '{name}', Play ({hl}) başlığı '{t}'")
        # aynı adın boşluklu/boşluksuz başka yazımı (ör. iki kelimeli yazım)
        squashed = name.replace(" ", "")
        pat = re.compile(r"\b" + r"\s*".join(map(re.escape, squashed)) + r"\b")
        wrong = sorted({m.group(0) for m in pat.finditer(texts) if m.group(0) != name})
        if wrong:
            errors.append(f"{a['slug']}: kaynaklarda yanlış yazım {wrong} (doğrusu '{name}')")
    return errors


HOME = {
    "tr": {
        "title": "Exclusive LLM Oyunları: Rahatlatıcı Mobil Oyunlar ve Uygulamalar",
        "description": "Exclusive LLM, Android için sakin ve kullanıcı dostu oyunlar ve uygulamalar geliştirir: ölçülü reklam, sade tasarım, gizliliğe saygı. BlockFour, BlockNest ve Woodora Classic Google Play'de ücretsiz.",
    },
    "en": {
        "title": "Exclusive LLM Games: Relaxing Mobile Games & Apps",
        "description": "Exclusive LLM builds calm, user-friendly Android games and apps with measured ads, clean design and respect for your privacy. BlockFour, BlockNest and Woodora Classic are free on Google Play.",
    },
    "es": {
        "title": "Juegos de Exclusive LLM: juegos y apps móviles relajantes",
        "description": "Exclusive LLM crea juegos y apps para Android tranquilos y fáciles de usar: anuncios moderados, diseño limpio y respeto por tu privacidad. BlockFour, BlockNest y Woodora Classic, gratis en Google Play.",
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
    "es": {"home": "Inicio", "games": "Juegos", "shots": "Capturas de pantalla", "video": "Tráiler",
           "watch": "Reproducir video", "features": "Características", "faq": "Preguntas frecuentes", "others": "Más juegos nuestros",
           "eyebrow_media": "En el juego", "eyebrow_play": "Jugabilidad", "eyebrow_faq": "Preguntas", "eyebrow_more": "Exclusive LLM",
           "free": "Gratis en Google Play"},
}


GENRE = {"PuzzleGame": "Puzzle", "StrategyGame": "Strategy", "ArcadeGame": "Arcade", "TriviaGame": "Trivia",
         "CasualGame": "Casual", "ActionGame": "Action", "BoardGame": "Board"}


def esc(s: str) -> str:
    return html.escape(s, quote=True)


_ES_MAP: dict[str, str] | None = None


def es_map() -> dict[str, str]:
    """_src/i18n_es.json: şablondaki her .en öğesinin iç HTML'i -> İspanyolcası."""
    global _ES_MAP
    if _ES_MAP is None:
        items = json.loads((SRC / "i18n_es.json").read_text(encoding="utf-8"))
        _ES_MAP = {BeautifulSoup(i["en"], "html.parser").decode(): i["es"] for i in items}
    return _ES_MAP


def page_soup(lang: str) -> BeautifulSoup:
    """Şablonu tek dile indirger, yolları köke göre mutlak yapar.
    Şablon TR/EN yazılır; ES sürümü .en öğelerinin _src/i18n_es.json ile çevrilmesiyle üretilir."""
    raw = (SRC / "index.html").read_text(encoding="utf-8").replace("{{base}}", BASE[lang])
    soup = BeautifulSoup(raw, "html.parser")
    if lang == "es":
        for el in soup.select(".tr"):
            el.decompose()
        m, missing = es_map(), []
        for el in soup.select(".en"):
            key = el.decode_contents()
            if key in m:
                el.clear()
                el.append(BeautifulSoup(m[key], "html.parser"))
            elif el.parent is not None:
                missing.append(key[:60])
        for el in soup.select(".en"):
            el["class"] = ["es" if c == "en" else c for c in el["class"]]
        if missing:
            print("UYARI: İspanyolcası olmayan metinler:", missing)
    else:
        for el in soup.select(".tr, .en, .es"):
            if not el.decomposed and lang not in el.get("class", []):
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
    image = feature_for(image, lang)
    # sayfadaki öne çıkan grafikler o dilin sürümüne (img src, style="--img:url(...)")
    for el in soup.select("img[src*='-feature'], [style*='-feature']"):
        for attr in ("src", "style"):
            if el.get(attr):
                el[attr] = localize_features(el[attr], lang)
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
        s.string = localize_features(json.dumps(obj, ensure_ascii=False), lang)
        head.append(s)
        head.append("\n")


def org_ld() -> dict:
    return {"@context": "https://schema.org", "@type": "Organization", "name": "Exclusive LLM", "url": DOMAIN + "/",
            "logo": DOMAIN + "/img/logo.png", "email": "support@exclusivellm.app",
            "sameAs": ["https://www.instagram.com/exclusive.llm/", "https://www.tiktok.com/@exclusivellm",
                       "https://www.youtube.com/@Exclusivellm", "https://x.com/exclusivellm"]}


def website_ld(lang: str) -> dict:
    """Google bu işaretlemeyi arama sonuçlarındaki site adı için kullanır."""
    return {"@context": "https://schema.org", "@type": "WebSite", "name": "Exclusive LLM",
            "alternateName": ["Exclusive LLM Games", "exclusivellm.app"], "url": DOMAIN + "/", "inLanguage": lang}


def games_ld(apps: list[dict], lang: str) -> dict:
    return {"@context": "https://schema.org", "@type": "ItemList", "name": UI[lang]["games"],
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": a["name"],
                                 "url": DOMAIN + BASE[lang] + a["slug"] + "/"} for i, a in enumerate(apps)]}


PLAY_PREFIX = "https://play.google.com/store/apps/details?id="


def tag_play_links(soup: BeautifulSoup, page: str, lang: str) -> None:
    """Play linklerine UTM ekler (Play Console > Mağaza girişi edinme raporunda 'exclusivellm_site' olarak görünür)
    ve app.js'in tıklama ölçümü için data-play / data-page özniteliklerini koyar."""
    for a in soup.select(f'a[href^="{PLAY_PREFIX}"]'):
        pkg = a["href"][len(PLAY_PREFIX):].split("&")[0]
        a["href"] = (f"{PLAY_PREFIX}{pkg}&utm_source=exclusivellm_site&utm_medium=website"
                     f"&utm_campaign=site_{page}&utm_content={lang}")
        a["data-play"] = pkg
        a["data-page"] = page


CF_TOKEN = "077ef39b685d4709a8f59845f57dfc06"  # Cloudflare Web Analytics (çerezsiz), hesap: dash.cloudflare.com


def add_beacon(soup: BeautifulSoup) -> None:
    s = soup.new_tag("script", defer=None, src="https://static.cloudflareinsights.com/beacon.min.js")
    s["data-cf-beacon"] = json.dumps({"token": CF_TOKEN})
    soup.body.append(s)
    soup.body.append("\n")


def write(path: Path, soup: BeautifulSoup) -> None:
    if CF_TOKEN and not soup.select_one("script[data-cf-beacon]"):
        add_beacon(soup)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = "<!doctype html>\n" + str(soup).replace("<!DOCTYPE html>", "").replace("<!doctype html>", "").lstrip()
    path.write_text(text, encoding="utf-8")


def play_button(soup: BeautifulSoup, pkg: str):
    tpl = soup.select_one("a.play")
    btn = copy.copy(tpl)
    btn["href"] = f"https://play.google.com/store/apps/details?id={pkg}"
    return btn


def shot_size(name: str) -> tuple[int, int]:
    """Real pixel size of img/shots/<name> (avoids layout shift); falls back to 540x960."""
    try:
        from PIL import Image
        with Image.open(ROOT / "img" / "shots" / name) as im:
            return im.size
    except Exception:
        return 540, 960


def shots_for(app: dict, lang: str) -> list[str]:
    """shots is a list (same for every language) or a dict {"tr": [...], "en": [...]}."""
    s = app["shots"]
    return s.get(lang) or s.get("tr") or [] if isinstance(s, dict) else s


def game_main(app: dict, lang: str, apps: list[dict], has_guide: bool = False) -> str:
    t, ui, base = app[lang], UI[lang], BASE[lang]
    name = esc(app["name"])
    guide_link = (f'<a class="more" href="{base}{app["slug"]}/guide/">{esc(PAGE_UI[lang]["guide"])} <span aria-hidden="true">→</span></a>'
                  if has_guide else "")
    tags = "".join(f'<span class="tag">{esc(x)}</span>' for x in t["tags"])
    shots = "".join(
        f'<img src="/img/shots/{s}" alt="{name} {esc(ui["shots"].lower())} {i + 1}" loading="lazy" width="{shot_size(s)[0]}" height="{shot_size(s)[1]}">'
        for i, s in enumerate(shots_for(app, lang)))
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
          <div class="cta-row" id="play-slot">{guide_link}</div>
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
        # Google: oyunlar VideoGame + SoftwareApplication birlikte işaretlenir
        {"@context": "https://schema.org", "@type": ["VideoGame", "SoftwareApplication"], "name": app["name"], "url": url,
         "description": t["description"], "applicationCategory": "GameApplication", "applicationSubCategory": app["category"],
         "operatingSystem": "Android", "gamePlatform": "Android", "genre": GENRE.get(app["category"], app["category"]),
         "inLanguage": app["languages"], "image": DOMAIN + "/img/" + app["feature"],
         "screenshot": [DOMAIN + "/img/shots/" + s for s in shots_for(app, lang)], "installUrl": play, "downloadUrl": play,
         "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
         "publisher": {"@type": "Organization", "name": "Exclusive LLM", "url": DOMAIN + "/"}},
        {"@context": "https://schema.org", "@type": "FAQPage",
         "mainEntity": [{"@type": "Question", "name": q["q"], "acceptedAnswer": {"@type": "Answer", "text": q["a"]}} for q in t["faq"]]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": UI[lang]["home"], "item": DOMAIN + BASE[lang]},
            {"@type": "ListItem", "position": 2, "name": app["name"], "item": url}]},
    ]


PAGE_UI = {
    "tr": {"guide": "İpuçları ve rehber", "about": "Oyun hakkında", "download": "İndir", "faq": "Sık sorulan sorular"},
    "en": {"guide": "Tips and guide", "about": "About the game", "download": "Download", "faq": "Frequently asked questions"},
    "es": {"guide": "Consejos y guía", "about": "Sobre el juego", "download": "Descargar", "faq": "Preguntas frecuentes"},
}


def section_cols(sections: list[dict]) -> str:
    out = []
    for sec in sections:
        body = "".join(f"<p>{esc(p)}</p>" for p in sec.get("p", []))
        if sec.get("items"):
            body += "<ul>" + "".join(f"<li>{esc(i)}</li>" for i in sec["items"]) + "</ul>"
        out.append(f'<div class="col"><h3>{esc(sec["h"])}</h3>{body}</div>')
    return "".join(out)


def sec(eyebrow: str, title: str, inner: str, center: bool = False) -> str:
    c = " center" if center else ""
    return (f'\n    <section class="gp-sec">\n      <div class="wrap">\n        <div class="head{c}"><span class="eyebrow">{esc(eyebrow)}</span>'
            f'<h2 class="title">{esc(title)}</h2></div>\n        {inner}\n      </div>\n    </section>')


def page_hero(t: dict, lang: str, crumbs: list[tuple[str, str]], image: str, cta: str = "") -> str:
    base = BASE[lang]
    trail = f'<a href="{base}">{esc(UI[lang]["home"])}</a>' + "".join(
        f'<span>›</span><a href="{href}">{esc(label)}</a>' if href else f"<span>›</span><span>{esc(label)}</span>"
        for label, href in crumbs)
    return f'''
    <section class="gp-hero">
      <div class="wrap gp-grid">
        <div>
          <nav class="crumb" aria-label="breadcrumb">{trail}</nav>
          <span class="eyebrow">{esc(t["eyebrow"])}</span>
          <h1>{esc(t["h1"])}</h1>
          <p class="lead">{esc(t["lead"])}</p>
          <p class="intro">{esc(t["intro"])}</p>
          {f'<div class="cta-row">{cta}</div>' if cta else ""}
        </div>
        <div class="gp-media"><img src="/img/{image}" alt="" width="1024" height="500"></div>
      </div>
    </section>'''


def app_cards(apps: list[dict], lang: str, play_html: dict[str, str]) -> str:
    base, pu = BASE[lang], PAGE_UI[lang]
    cards = []
    for a in apps:
        cards.append(
            f'<div class="card-game"><a class="other" href="{base}{a["slug"]}/"><img src="/img/{a["icon"]}" alt="" width="56" height="56" loading="lazy">'
            f'<span><b>{esc(a["name"])}</b><small>{esc(a[lang]["tagline"])}</small></span></a>'
            f'<div class="cta-row">{play_html[a["package"]]}<a class="more" href="{base}{a["slug"]}/guide/">{esc(pu["guide"])} <span aria-hidden="true">→</span></a></div></div>')
    return f'<div class="game-cards">{"".join(cards)}</div>'


def faq_html(faq: list[dict]) -> str:
    return '<div class="faq">' + "".join(
        f'<details><summary>{esc(q["q"])}</summary><p>{esc(q["a"])}</p></details>' for q in faq) + "</div>"


def faq_ld(faq: list[dict]) -> dict:
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q["q"], "acceptedAnswer": {"@type": "Answer", "text": q["a"]}} for q in faq]}


def crumbs_ld(lang: str, items: list[tuple[str, str]]) -> dict:
    full = [(UI[lang]["home"], DOMAIN + BASE[lang])] + items
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(full)]}


def play_html_map(soup: BeautifulSoup, apps: list[dict]) -> dict[str, str]:
    return {a["package"]: str(play_button(soup, a["package"])) for a in apps}


def hub_main(p: dict, lang: str, apps: list[dict], play: dict[str, str]) -> str:
    t = p[lang]
    chosen = [next(a for a in apps if a["slug"] == s) for s in p["apps"]]
    cmp = t["compare"]
    table = ('<div class="cmp-wrap"><table class="cmp"><thead><tr>' + "".join(f"<th>{esc(h)}</th>" for h in cmp["head"]) + "</tr></thead><tbody>"
             + "".join("<tr>" + "".join(f"<td>{esc(c)}</td>" for c in row) + "</tr>" for row in cmp["rows"]) + "</tbody></table></div>")
    return ('\n  <main id="top" class="gp">' + page_hero(t, lang, [(t["crumb"], "")], p["image"])
            + sec(UI[lang]["eyebrow_more"], UI[lang]["games"], app_cards(chosen, lang, play))
            + sec(t["eyebrow"], cmp["title"], table)
            + sec(t["eyebrow"], t["h1"], f'<div class="feats">{section_cols(t["sections"])}</div>')
            + sec(UI[lang]["eyebrow_faq"], PAGE_UI[lang]["faq"], faq_html(t["faq"]), True) + "\n  </main>\n")


def press_main(p: dict, lang: str, apps: list[dict], play: dict[str, str]) -> str:
    t = p[lang]
    assets = '<div class="assets">' + "".join(
        f'<a class="asset" href="/img/{a["file"]}" download><img src="/img/{a["file"]}" alt="{esc(a["label"])}" loading="lazy">'
        f'<span><b>{esc(a["label"])}</b><small>{esc(a["size"])} · {esc(PAGE_UI[lang]["download"])}</small></span></a>'
        for a in p["assets"]) + "</div>"
    games = '<div class="feats">' + "".join(
        f'<div class="col"><h3>{esc(a["name"])}</h3><p>{esc(a[lang]["intro"])}</p><ul>'
        f'<li><a href="{BASE[lang]}{a["slug"]}/">exclusivellm.app{BASE[lang]}{a["slug"]}/</a></li>'
        f'<li><a href="{PLAY_PREFIX}{a["package"]}" target="_blank" rel="noopener">Google Play: {a["package"]}</a></li></ul></div>'
        for a in apps) + "</div>"
    contact = f'<p class="intro">{esc(t["contact"])}</p><p><a class="btn ghost" href="mailto:support@exclusivellm.app">support@exclusivellm.app</a></p>'
    return ('\n  <main id="top" class="gp">' + page_hero(t, lang, [(t["crumb"], "")], p["image"])
            + sec(t["eyebrow"], t["h1"], f'<div class="feats">{section_cols(t["sections"])}</div>')
            + sec(t["eyebrow"], t["assets_title"], assets)
            + sec(t["eyebrow"], t["games_title"], games)
            + sec(t["eyebrow"], t["contact_title"], contact) + "\n  </main>\n")


def guide_main(g: dict, lang: str, apps: list[dict], play: dict[str, str]) -> str:
    t, app = g[lang], next(a for a in apps if a["slug"] == g["app"])
    base = BASE[lang]
    cta = play[app["package"]] + f'<a class="more" href="{base}{app["slug"]}/">{esc(PAGE_UI[lang]["about"])} <span aria-hidden="true">→</span></a>'
    others = [a for a in apps if a["slug"] != app["slug"]]
    return ('\n  <main id="top" class="gp">' + page_hero(t, lang, [(app["name"], f'{base}{app["slug"]}/'), (t["crumb"], "")], app["feature"], cta)
            + sec(t["eyebrow"], t["crumb"], f'<div class="feats">{section_cols(t["sections"])}</div>')
            + sec(UI[lang]["eyebrow_more"], UI[lang]["others"], app_cards(others, lang, play)) + "\n  </main>\n")


def article_ld(t: dict, url: str, image: str) -> dict:
    return {"@context": "https://schema.org", "@type": "Article", "headline": t["h1"], "description": t["description"],
            "image": DOMAIN + "/img/" + image, "url": url, "datePublished": "2026-11-16", "dateModified": date.today().isoformat(),
            "author": {"@type": "Organization", "name": "Exclusive LLM", "url": DOMAIN + "/"},
            "publisher": {"@type": "Organization", "name": "Exclusive LLM", "logo": {"@type": "ImageObject", "url": DOMAIN + "/img/logo.png"}}}


def build_content_pages(apps: list[dict], pages: dict, lang: str, out_dir: Path) -> list[str]:
    urls = []
    specs = [("hub", pages["hub"], hub_main), ("press", pages["press"], press_main)] + [("guide", g, guide_main) for g in pages["guides"]]
    for kind, p, fn in specs:
        soup = page_soup(lang)
        path, t = p["path"], p[lang]
        set_lang_switch(soup, lang, path)
        for a in soup.select("header a[href^='#'], footer a[href^='#']"):
            a["href"] = BASE[lang] + a["href"]
        play = play_html_map(soup, apps)
        soup.find("main").replace_with(BeautifulSoup(fn(p, lang, apps, play), "html.parser"))
        url = DOMAIN + BASE[lang] + path
        if kind == "hub":
            ld = [faq_ld(t["faq"]), crumbs_ld(lang, [(t["crumb"], url)]), games_ld([a for s in p["apps"] for a in apps if a["slug"] == s], lang)]
            image = p["image"]
        elif kind == "press":
            ld = [org_ld(), crumbs_ld(lang, [(t["crumb"], url)])]
            image = p["image"]
        else:
            app = next(a for a in apps if a["slug"] == p["app"])
            image = app["feature"]
            ld = [article_ld(t, url, image), crumbs_ld(lang, [(app["name"], DOMAIN + BASE[lang] + app["slug"] + "/"), (t["crumb"], url)])]
        set_head(soup, lang, path, t["title"], t["description"], image, ld)
        tag_play_links(soup, kind if kind != "guide" else p["app"] + "_guide", lang)
        write(out_dir / path / "index.html", soup)
        urls.append(BASE[lang] + path)
    return urls


def games_json(apps: list[dict]) -> None:
    """Oyun içi 'Diğer oyunlarımız' ekranı bu dosyayı okur (yalnızca üretimdeki oyunlar)."""
    data = {"version": 1, "updated": date.today().isoformat(), "site": DOMAIN + "/", "games": [
        {"slug": a["slug"], "name": a["name"], "package": a["package"], "icon": f"{DOMAIN}/img/{a['icon']}",
         "icon512": f"{DOMAIN}/img/press/{a['icon'].rsplit('.', 1)[0]}-icon-512.png" if (ROOT / "img" / "press" / f"{a['icon'].rsplit('.', 1)[0]}-icon-512.png").exists() else f"{DOMAIN}/img/{a['icon']}",
         "feature": f"{DOMAIN}/img/{a['feature']}",
         "features": {l: f"{DOMAIN}/img/{feature_for(a['feature'], l)}" for l in LANGS},
         "tagline": {l: a[l]["tagline"] for l in LANGS if l in a},
         "page": {l: DOMAIN + BASE[l] + a["slug"] + "/" for l in LANGS}} for a in apps]}
    (ROOT / "games.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def build() -> list[str]:
    apps = json.loads((SRC / "apps.json").read_text(encoding="utf-8"))
    pages = json.loads((SRC / "pages.json").read_text(encoding="utf-8"))
    errors = check_features() + check_names(apps)
    if errors:
        raise SystemExit("SİTE ÜRETİLMEDİ — düzeltilmesi gerekenler:\n  - " + "\n  - ".join(errors))
    # Bir dilin metni yoksa İngilizcesi kullanılır (yeni oyun eklerken "es" bloğunu unutma)
    for obj in apps + [pages["hub"], pages["press"]] + pages["guides"]:
        for l in LANGS:
            if l not in obj:
                print(f"UYARI: {obj.get('slug') or obj.get('path')} için '{l}' metni yok, İngilizcesi kullanıldı")
                obj[l] = obj["en"]
    urls: list[str] = []
    for lang in LANGS:
        out_dir = ROOT / BASE[lang].strip("/") if BASE[lang] != "/" else ROOT
        # ana sayfa
        soup = page_soup(lang)
        set_lang_switch(soup, lang, "")
        set_head(soup, lang, "", HOME[lang]["title"], HOME[lang]["description"], "blockfour-feature.jpg",
                 [org_ld(), website_ld(lang), games_ld(apps, lang)])
        tag_play_links(soup, "home", lang)
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
            has_guide = any(g["app"] == app["slug"] for g in pages["guides"])
            main.replace_with(BeautifulSoup(game_main(app, lang, apps, has_guide), "html.parser"))
            soup.select_one("#play-slot").insert(0, btn)
            del soup.select_one("#play-slot")["id"]
            set_head(soup, lang, app["slug"] + "/", app[lang]["title"], app[lang]["description"], app["feature"], game_ld(app, lang))
            tag_play_links(soup, app["slug"], lang)
            write(out_dir / app["slug"] / "index.html", soup)
            urls.append(BASE[lang] + app["slug"] + "/")
        urls += build_content_pages(apps, pages, lang, out_dir)
    games_json(apps)
    # sitemap + robots
    today = date.today().isoformat()
    groups: dict[str, list[str]] = {}
    for u in urls:
        key = next((u[len(BASE[l]) - 1:] for l in LANGS if BASE[l] != "/" and u.startswith(BASE[l])), u)
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
