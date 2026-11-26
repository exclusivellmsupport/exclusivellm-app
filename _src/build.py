"""exclusivellm.app üretici.

Kaynak: _src/index.html (iki dilli şablon: <span class="tr"> / <span class="en">) + _src/apps.json (üretimdeki oyunların sayfaları).
Çıktı (deponun kökü): index.html (TR), en/index.html (EN), <slug>/index.html, en/<slug>/index.html, sitemap.xml, robots.txt.

Kullanım:  python _src/build.py
Şablonu ya da apps.json'u değiştirdikten sonra her zaman çalıştır; çıktı dosyalarını elle düzenleme.
"""
from __future__ import annotations

import copy
import hashlib
import html
import json
import re
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "_src"

# --- Kararlı tarihler (20.11.2026) ------------------------------------------------------------------
# sitemap <lastmod>, rehberlerin JSON-LD dateModified'i ve games.json "updated" yalnızca sayfanın içeriği
# (tarihler çıkarılarak) gerçekten değişince bugüne ilerler; aksi hâlde _src/lastmod.json'daki tarih kalır.
LASTMOD_FILE = SRC / "lastmod.json"
_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
_lastmod: dict = json.loads(LASTMOD_FILE.read_text(encoding="utf-8")) if LASTMOD_FILE.exists() else {}


def stable_date(key: str, text: str) -> str:
    h = hashlib.sha1(_DATE_RE.sub("", text).encode("utf-8")).hexdigest()
    rec = _lastmod.get(key)
    if rec and rec.get("hash") == h:
        return rec["date"]
    d = date.today().isoformat()
    _lastmod[key] = {"hash": h, "date": d}
    return d
DOMAIN = "https://exclusivellm.app"
LANGS = ("tr", "en", "es")
BASE = {"tr": "/", "en": "/en/", "es": "/es/"}
OG_LOCALE = {"tr": "tr_TR", "en": "en_US", "es": "es_ES"}

# --- Dil başına öne çıkan grafik (19.11.2026) ----------------------------------------------------------
# img/<ad>-feature.jpg temel dosyadır; img/<ad>-feature-<dil>.jpg varsa o dilin sayfalarında (görsel, og:image,
# JSON-LD, games.json) o kullanılır. Yazılı grafik her dilde o dilin yazısıyla görünmeli: denetim aşağıda.
FEATURE_BASE_LANG = {"woodoraclassic-feature.jpg": "tr", "blockfour-feature.jpg": "tr"}  # belirtilmeyen: "en"
FEATURE_ONE_FOR_ALL = {  # yalnızca logo/marka yazısı olan, her dilde aynı kalabilen grafikler
    # toppleisles-feature.jpg 20.11.2026'dan beri dil başına yazılı (Top ile Yık / Cannon Smash / Cañón y Torres)
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
    texts = "\n".join((SRC / f).read_text(encoding="utf-8") for f in ("apps.json", "pages.json", "index.html", "build.py", "i18n_es.json", "updates.json")
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
        "title": "Exclusive LLM: Ücretsiz Bulmaca ve Zekâ Oyunları (Android)",
        "description": "Android için ücretsiz bulmaca ve zekâ oyunları: BlockFour, BlockNest, Woodora Classic ve Exclusive Quiz. İnternetsiz oynanır, ölçülü reklam, sade tasarım.",
    },
    "en": {
        "title": "Exclusive LLM: Free Puzzle & Brain Games for Android",
        "description": "Free puzzle and brain games for Android: BlockFour, BlockNest, Woodora Classic and Exclusive Quiz. Play offline, measured ads, clean design.",
    },
    "es": {
        "title": "Exclusive LLM: juegos de puzles gratis para Android",
        "description": "Juegos de puzles y de lógica gratis para Android: BlockFour, BlockNest, Woodora Classic y Exclusive Quiz. Sin internet, anuncios moderados.",
    },
}
UI = {
    "tr": {"home": "Ana sayfa", "games": "Oyunlar", "shots": "Ekran görüntüleri", "video": "Tanıtım videosu",
           "watch": "Videoyu oynat", "features": "Özellikler", "faq": "Sık sorulan sorular", "others": "Diğer oyunlarımız",
           "eyebrow_media": "Oyundan kareler", "eyebrow_play": "Oynanış", "eyebrow_faq": "Merak edilenler",
           "eyebrow_more": "Exclusive LLM", "free": "Google Play'de ücretsiz",
           "open": "Aç", "close": "Kapat", "qr": "Telefonunla tara, Google Play'de aç"},
    "en": {"home": "Home", "games": "Games", "shots": "Screenshots", "video": "Trailer",
           "watch": "Play video", "features": "Features", "faq": "Frequently asked questions", "others": "More of our games",
           "eyebrow_media": "In the game", "eyebrow_play": "Gameplay", "eyebrow_faq": "Questions", "eyebrow_more": "Exclusive LLM",
           "free": "Free on Google Play", "open": "Open", "close": "Close", "qr": "Scan with your phone to open Google Play"},
    "es": {"home": "Inicio", "games": "Juegos", "shots": "Capturas de pantalla", "video": "Tráiler",
           "watch": "Reproducir video", "features": "Características", "faq": "Preguntas frecuentes", "others": "Más juegos nuestros",
           "eyebrow_media": "En el juego", "eyebrow_play": "Jugabilidad", "eyebrow_faq": "Preguntas", "eyebrow_more": "Exclusive LLM",
           "free": "Gratis en Google Play", "open": "Abrir", "close": "Cerrar", "qr": "Escanea con tu móvil para abrir Google Play"},
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
    return {"@context": "https://schema.org", "@type": "Organization", "@id": DOMAIN + "/#org", "name": "Exclusive LLM", "url": DOMAIN + "/",
            "logo": DOMAIN + "/img/logo.png", "email": "support@exclusivellm.app",
            "sameAs": ["https://www.instagram.com/exclusive.llm/", "https://www.tiktok.com/@exclusivellm",
                       "https://www.youtube.com/@Exclusivellm", "https://x.com/exclusivellm",
                       "https://www.facebook.com/profile.php?id=61597099824655"]}


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
    main = soup.find("main")  # 24.11.2026: ortak menü/altbilgi değişikliği tüm sayfaların lastmod'unu oynatmasın
    key_text = (str(main) if main else text) + (soup.title.string if soup.title else "") + str(soup.find("meta", attrs={"name": "description"}))
    d = stable_date(path.relative_to(ROOT).as_posix(), key_text)
    text = text.replace(f'"dateModified": "{date.today().isoformat()}"', f'"dateModified": "{d}"')
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


def qr_file(app: dict, lang: str) -> str:
    """Masaüstü ziyaretçisi için Play QR kodu (img/qr/<slug>-<dil>.svg); UTM medium=qr ile ayrı ölçülür."""
    import segno
    url = (f"{PLAY_PREFIX}{app['package']}&utm_source=exclusivellm_site&utm_medium=qr"
           f"&utm_campaign=site_{app['slug']}_qr&utm_content={lang}")
    rel = f"qr/{app['slug']}-{lang}.svg"
    out = ROOT / "img" / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    segno.make(url, error="m").save(str(out), kind="svg", scale=4, border=2, dark="#0b1020", light="#ffffff", xmldecl=False)
    return rel


def get_extras(app: dict, lang: str) -> tuple[str, str]:
    """(QR kutusu, Android alt bandı) HTML'i. Bant yalnızca Android'de app.js ile görünür."""
    ui, name = UI[lang], esc(app["name"])
    qr = (f'<div class="qr-box" aria-hidden="true"><img src="/img/{qr_file(app, lang)}" alt="" width="112" height="112">'
          f'<span>{esc(ui["qr"])}</span></div>')
    bar = (f'<div class="getbar" id="getbar" hidden><img src="/img/{app["icon"]}" alt="" width="44" height="44">'
           f'<span><b>{name}</b><small>{esc(ui["free"])}</small></span>'
           f'<a class="getbar-btn" href="{PLAY_PREFIX}{app["package"]}" target="_blank" rel="noopener">{esc(ui["open"])}</a>'
           f'<button type="button" class="getbar-x" aria-label="{esc(ui["close"])}">×</button></div>')
    return qr, bar


PRIVACY_LABEL = {"tr": "Gizlilik politikası", "en": "Privacy policy", "es": "Política de privacidad"}


def h1_sub(app: dict, lang: str) -> str:
    """H1'deki anahtar kelimeli alt başlık (24.11.2026): apps.json "h1_sub", yoksa başlığın ':' ile ' | ' arası."""
    t = app[lang]
    if t.get("h1_sub"):
        return t["h1_sub"]
    title = t["title"].split(" | ")[0]
    return title.split(":", 1)[1].strip() if ":" in title else t["tagline"]


def game_main(app: dict, lang: str, apps: list[dict], has_guide: bool = False, updates_html: str = "", related_html: str = "") -> str:
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
          <img src="https://i.ytimg.com/vi/{vid}/hqdefault.jpg" alt="{name} {esc(ui["video"].lower())}" loading="lazy" width="480" height="360">
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
    qr, bar = get_extras(app, lang)
    privacy = (f'<p class="intro" style="text-align:center;margin-top:18px"><a href="/{app["slug"]}-privacy.html">{esc(PRIVACY_LABEL[lang])}</a></p>'
               if (ROOT / f'{app["slug"]}-privacy.html').exists() else "")
    return f'''
  <main id="top" class="gp">{bar}
    <section class="gp-hero">
      <div class="wrap gp-grid">
        <div>
          <nav class="crumb" aria-label="breadcrumb"><a href="{base}">{esc(ui["home"])}</a><span>›</span><a href="{base}#apps">{esc(ui["games"])}</a><span>›</span><span>{name}</span></nav>
          <div class="head-row"><img src="/img/{app["icon"]}" alt="{name}" width="84" height="84"><div><h1>{name}<span class="h1-sub">{esc(h1_sub(app, lang))}</span></h1><div class="tags">{tags}</div></div></div>
          <p class="lead">{esc(t["tagline"])}</p>
          <p class="intro">{esc(t["intro"])}</p>
          <div class="cta-row" id="play-slot">{guide_link}{qr}</div>
        </div>
        <div class="gp-media"><img src="/img/{app["feature"]}" alt="{name}" width="1024" height="500" fetchpriority="high"></div>
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
    </section>{updates_html}{related_html}
    <section class="gp-sec">
      <div class="wrap">
        <div class="head center"><span class="eyebrow">{esc(ui["eyebrow_faq"])}</span><h2 class="title">{esc(ui["faq"])}</h2></div>
        <div class="faq">{faq}</div>
        {privacy}
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
         "publisher": {"@type": "Organization", "@id": DOMAIN + "/#org", "name": "Exclusive LLM", "url": DOMAIN + "/"}},
        {"@context": "https://schema.org", "@type": "FAQPage",
         "mainEntity": [{"@type": "Question", "name": q["q"], "acceptedAnswer": {"@type": "Answer", "text": q["a"]}} for q in t["faq"]]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": UI[lang]["home"], "item": DOMAIN + BASE[lang]},
            {"@type": "ListItem", "position": 2, "name": UI[lang]["games"], "item": DOMAIN + BASE[lang] + "#apps"},
            {"@type": "ListItem", "position": 3, "name": app["name"], "item": url}]},
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
        <div class="gp-media"><img src="/img/{image}" alt="" width="1024" height="500" fetchpriority="high"></div>
      </div>
    </section>'''


GUIDE_APPS: set[str] = set()  # build() doldurur: rehberi olan oyunlar (24.11.2026: Quiz'in olmayan rehberine 404 bağlantı vardı)


def app_cards(apps: list[dict], lang: str, play_html: dict[str, str]) -> str:
    base, pu = BASE[lang], PAGE_UI[lang]
    cards = []
    for a in apps:
        cards.append(
            f'<div class="card-game"><a class="other" href="{base}{a["slug"]}/"><img src="/img/{a["icon"]}" alt="" width="56" height="56" loading="lazy">'
            f'<span><b>{esc(a["name"])}</b><small>{esc(a[lang]["tagline"])}</small></span></a>'
            f'<div class="cta-row">{play_html[a["package"]]}'
            + (f'<a class="more" href="{base}{a["slug"]}/guide/">{esc(pu["guide"])} <span aria-hidden="true">→</span></a>' if a["slug"] in GUIDE_APPS else "")
            + '</div></div>')
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
        f'<a class="asset" href="/img/{a["file"]}" download><img src="/img/{a.get("thumb", a["file"])}" alt="{esc(a["label"])}" loading="lazy" width="144" height="144">'
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


GUIDES_UI = {
    "tr": {"crumb": "Rehberler", "eyebrow": "Rehberler ve ipuçları", "h1": "Oyun rehberleri ve ipuçları",
           "title": "Oyun Rehberleri: Blok Bulmaca, 2048 ve Bilgi Yarışması",
           "description": "Blok bulmaca, 2048, renk sıralama, düşen bloklar ve bilgi yarışması için kurallar, taktikler ve ipuçları. Oyunlarımızın rehberleri tek sayfada.",
           "lead": "Kurallar, taktikler ve daha yüksek skor için ipuçları.",
           "intro": "Oyunlarımızı daha iyi oynamak ya da bir türü ilk kez öğrenmek için hazırladığımız rehberler burada. Her rehber kısa bölümlerden oluşur ve ilgili oyuna bağlanır.",
           "related": "Bu oyunla ilgili rehberler", "read": "Oku"},
    "en": {"crumb": "Guides", "eyebrow": "Guides and tips", "h1": "Game guides and tips",
           "title": "Game Guides: Block Puzzle, 2048, Trivia Tips | Exclusive LLM",
           "description": "Rules, strategies and tips for block puzzle, 2048, color sort, falling blocks and trivia. All of our game guides on one page.",
           "lead": "Rules, strategies and tips for higher scores.",
           "intro": "Here are the guides we wrote to help you play our games better or learn a game type for the first time. Each guide is split into short sections and links to the game it covers.",
           "related": "Guides for this game", "read": "Read"},
    "es": {"crumb": "Guías", "eyebrow": "Guías y consejos", "h1": "Guías y consejos de juegos",
           "title": "Guías de juegos: bloques, 2048 y preguntas | Exclusive LLM",
           "description": "Reglas, estrategias y consejos para puzzles de bloques, 2048, ordenar colores, bloques que caen y juegos de preguntas. Todas nuestras guías.",
           "lead": "Reglas, estrategias y consejos para lograr más puntos.",
           "intro": "Aquí están las guías que escribimos para jugar mejor a nuestros juegos o aprender un tipo de juego por primera vez. Cada guía tiene secciones cortas y enlaza al juego correspondiente.",
           "related": "Guías de este juego", "read": "Leer"},
}
GUIDES_PATH = "guides/"


def content_list(pages: dict) -> list[dict]:
    """Rehber dizinine giren sayfalar: kategori/hub sayfaları + rehberler (basın kiti hariç)."""
    return [pages["hub"]] + pages.get("hubs", []) + pages["guides"]


def link_cards(items: list[dict], lang: str) -> str:
    base, ui = BASE[lang], GUIDES_UI[lang]
    return '<div class="feats">' + "".join(
        f'<div class="col"><h3><a href="{base}{it["path"]}">{esc(it[lang]["h1"])}</a></h3><p>{esc(it[lang]["description"])}</p>'
        f'<p><a class="more" href="{base}{it["path"]}">{esc(ui["read"])} <span aria-hidden="true">→</span></a></p></div>'
        for it in items) + "</div>"


def related_section(slug: str, lang: str, pages: dict) -> str:
    items = [it for it in content_list(pages) if it.get("app") == slug or slug in it.get("apps", [])]
    if not items:
        return ""
    ui = GUIDES_UI[lang]
    return sec(ui["eyebrow"], ui["related"], link_cards(items, lang))


def guides_index_main(pages: dict, lang: str) -> str:
    ui = GUIDES_UI[lang]
    t = {"eyebrow": ui["eyebrow"], "h1": ui["h1"], "lead": ui["lead"], "intro": ui["intro"]}
    return ('\n  <main id="top" class="gp">' + page_hero(t, lang, [(ui["crumb"], "")], "blockfour-feature.jpg")
            + sec(ui["eyebrow"], ui["crumb"], link_cards(content_list(pages), lang)) + "\n  </main>\n")


def build_guides_index(pages: dict, lang: str, out_dir: Path) -> str:
    soup = page_soup(lang)
    set_lang_switch(soup, lang, GUIDES_PATH)
    for a in soup.select("header a[href^='#'], footer a[href^='#']"):
        a["href"] = BASE[lang] + a["href"]
    soup.find("main").replace_with(BeautifulSoup(guides_index_main(pages, lang), "html.parser"))
    url = DOMAIN + BASE[lang] + GUIDES_PATH
    ui = GUIDES_UI[lang]
    ld = [crumbs_ld(lang, [(ui["crumb"], url)]),
          {"@context": "https://schema.org", "@type": "ItemList", "name": ui["h1"], "itemListElement": [
              {"@type": "ListItem", "position": i + 1, "name": it[lang]["h1"], "url": DOMAIN + BASE[lang] + it["path"]}
              for i, it in enumerate(content_list(pages))]}]
    set_head(soup, lang, GUIDES_PATH, ui["title"], ui["description"], "blockfour-feature.jpg", ld)
    tag_play_links(soup, "guides", lang)
    write(out_dir / GUIDES_PATH / "index.html", soup)
    return BASE[lang] + GUIDES_PATH


def guide_main(g: dict, lang: str, apps: list[dict], play: dict[str, str]) -> str:
    t, app = g[lang], next(a for a in apps if a["slug"] == g["app"])
    base = BASE[lang]
    cta = play[app["package"]] + f'<a class="more" href="{base}{app["slug"]}/">{esc(PAGE_UI[lang]["about"])} <span aria-hidden="true">→</span></a>'
    others = [a for a in apps if a["slug"] != app["slug"]]
    return ('\n  <main id="top" class="gp">' + page_hero(t, lang, [(app["name"], f'{base}{app["slug"]}/'), (t["crumb"], "")], app["feature"], cta)
            + sec(t["eyebrow"], t["crumb"], f'<div class="feats">{section_cols(t["sections"])}</div>')
            + (sec(UI[lang]["eyebrow_faq"], PAGE_UI[lang]["faq"], faq_html(t["faq"]), True) if t.get("faq") else "")
            + sec(UI[lang]["eyebrow_more"], UI[lang]["others"], app_cards(others, lang, play)) + "\n  </main>\n")


def article_ld(t: dict, url: str, image: str) -> dict:
    return {"@context": "https://schema.org", "@type": "Article", "headline": t["h1"], "description": t["description"],
            "image": DOMAIN + "/img/" + image, "url": url, "datePublished": "2026-11-16", "dateModified": date.today().isoformat(),
            "author": {"@type": "Organization", "name": "Exclusive LLM", "url": DOMAIN + "/"},
            "publisher": {"@type": "Organization", "name": "Exclusive LLM", "logo": {"@type": "ImageObject", "url": DOMAIN + "/img/logo.png"}}}


def build_content_pages(apps: list[dict], pages: dict, lang: str, out_dir: Path) -> list[str]:
    urls = []
    specs = ([("hub", pages["hub"], hub_main)] + [("hub", h, hub_main) for h in pages.get("hubs", [])]
             + [("press", pages["press"], press_main)] + [("guide", g, guide_main) for g in pages["guides"]])
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
            if t.get("faq"):
                ld.append(faq_ld(t["faq"]))
        set_head(soup, lang, path, t["title"], t["description"], image, ld)
        camp = ("hub" if p is pages["hub"] else "hub_" + p["path"].strip("/").replace("-", "_")) if kind == "hub" else kind
        if kind == "guide":
            camp = p["app"] + "_guide" if path == p["app"] + "/guide/" else "page_" + path.strip("/").replace("/", "_").replace("-", "_")
        tag_play_links(soup, camp, lang)
        write(out_dir / path / "index.html", soup)
        urls.append(BASE[lang] + path)
    return urls


# --- Yenilikler: üretimdeki uygulamaların önemli güncellemeleri (21.11.2026) ----------------------------
# Kaynak _src/updates.json (kurallar dosyanın başındaki "_aciklama"da). Çıktı: /updates/ (+ /en/, /es/),
# her dilde Atom beslemesi updates/feed.xml ve her uygulama sayfasında o uygulamanın son 3 girdisi.
UPDATES_PATH = "updates/"
UPDATE_TYPES = ("launch", "feature", "content", "look")
MONTHS = {
    "tr": ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    "es": ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
}
UPD_UI = {
    "tr": {"crumb": "Yenilikler", "eyebrow": "Yenilikler", "h1": "Oyunlarımızdaki yenilikler",
           "title": "Yenilikler: Oyunlarımızdaki Önemli Güncellemeler | Exclusive LLM",
           "description": "BlockFour, BlockNest, Woodora Classic ve Exclusive Quiz'e gelen yeni modlar, içerikler, Google Play Oyunlar desteği ve görünüm yenilemeleri.",
           "lead": "Google Play'deki oyunlarımıza gelen önemli güncellemeler, en yenisi en üstte.",
           "intro": "Burada yalnızca oyunda fark edeceğin değişiklikleri yazıyoruz: yeni modlar ve içerikler, başarımlar, yeni görünümler. Güncellemeler Google Play üzerinden otomatik gelir; oyunu güncel tutman yeterli.",
           "list": "Tüm güncellemeler", "latest": "Son güncellemeler", "all": "Tüm yenilikler", "page": "Oyun sayfası",
           "app_title": "Yenilikler", "feed": "Atom beslemesi ile takip et", "version": "Sürüm",
           "types": {"launch": "Yayında", "feature": "Yeni özellik", "content": "Yeni içerik", "look": "Yeni görünüm"}},
    "en": {"crumb": "What's new", "eyebrow": "What's new", "h1": "What's new in our games",
           "title": "What's New: Major Updates to Our Games | Exclusive LLM",
           "description": "New modes, new content, Google Play Games support and fresh looks in BlockFour, BlockNest, Woodora Classic and Exclusive Quiz.",
           "lead": "Major updates to our games on Google Play, newest first.",
           "intro": "We only list changes you will notice in the game: new modes and content, achievements and new looks. Updates arrive automatically through Google Play; just keep the game up to date.",
           "list": "All updates", "latest": "Latest updates", "all": "All updates", "page": "Game page",
           "app_title": "What's new", "feed": "Follow with the Atom feed", "version": "Version",
           "types": {"launch": "Now on Google Play", "feature": "New feature", "content": "New content", "look": "New look"}},
    "es": {"crumb": "Novedades", "eyebrow": "Novedades", "h1": "Novedades de nuestros juegos",
           "title": "Novedades de nuestros juegos | Exclusive LLM",
           "description": "Nuevos modos, nuevo contenido, Google Play Juegos y nuevos diseños en BlockFour, BlockNest, Woodora Classic y Exclusive Quiz.",
           "lead": "Las actualizaciones importantes de nuestros juegos en Google Play, primero las más recientes.",
           "intro": "Aquí solo contamos los cambios que notarás en el juego: nuevos modos y contenido, logros y nuevos diseños. Las actualizaciones llegan solas desde Google Play; solo mantén el juego actualizado.",
           "list": "Todas las actualizaciones", "latest": "Últimas actualizaciones", "all": "Todas las novedades", "page": "Página del juego",
           "app_title": "Novedades", "feed": "Síguelas con el feed Atom", "version": "Versión",
           "types": {"launch": "Ya en Google Play", "feature": "Nueva función", "content": "Nuevo contenido", "look": "Nuevo diseño"}},
}


def load_updates(apps: list[dict]) -> tuple[list[dict], list[str]]:
    path = SRC / "updates.json"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"entries": []}
    slugs = {a["slug"] for a in apps}
    errors, seen, out = [], set(), []
    for e in data.get("entries", []):
        uid = f"{e.get('app')}-{e.get('version')}"
        if e.get("app") not in slugs:
            errors.append(f"updates.json '{uid}': '{e.get('app')}' üretimde değil (apps.json'da yok)")
            continue
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(e.get("date", ""))):
            errors.append(f"updates.json '{uid}': date YYYY-MM-DD olmalı")
            continue
        if e.get("type") not in UPDATE_TYPES:
            errors.append(f"updates.json '{uid}': type {UPDATE_TYPES} değerlerinden biri olmalı")
            continue
        if uid in seen:
            errors.append(f"updates.json '{uid}': aynı uygulama + sürüm iki kez yazılmış")
            continue
        seen.add(uid)
        for l in LANGS:
            if l not in e:
                if "en" not in e:
                    errors.append(f"updates.json '{uid}': '{l}' ve 'en' metni yok")
                    break
                print(f"UYARI: updates.json '{uid}' için '{l}' metni yok, İngilizcesi kullanıldı")
                e[l] = e["en"]
            elif not e[l].get("title") or not e[l].get("items"):
                errors.append(f"updates.json '{uid}': '{l}' için title ve items gerekli")
        e["id"] = re.sub(r"[^a-z0-9-]", "-", uid.lower())
        out.append(e)
    out.sort(key=lambda e: (e["date"], e["version"]), reverse=True)
    return out, errors


def fmt_date(d: str, lang: str) -> str:
    y, m, day = (int(x) for x in d.split("-"))
    mon = MONTHS[lang][m - 1]
    return {"tr": f"{day} {mon} {y}", "en": f"{mon} {day}, {y}", "es": f"{day} de {mon} de {y}"}[lang]


def update_cards(entries: list[dict], lang: str, apps: list[dict], play: dict[str, str] | None, show_app: bool = True) -> str:
    by = {a["slug"]: a for a in apps}
    ui, base = UPD_UI[lang], BASE[lang]
    out = []
    for e in entries:
        app, t = by[e["app"]], e[lang]
        head = ""
        if show_app:
            head = (f'<a class="upd-app" href="{base}{app["slug"]}/"><img src="/img/{app["icon"]}" alt="" width="44" height="44" loading="lazy">'
                    f'<b>{esc(app["name"])}</b></a>')
        cta = ""
        if play is not None:
            cta = (f'<div class="cta-row">{play[app["package"]]}'
                   f'<a class="more" href="{base}{app["slug"]}/">{esc(ui["page"])} <span aria-hidden="true">→</span></a></div>')
        out.append(
            f'<article class="upd" id="{e["id"]}">{head}'
            f'<div class="upd-meta"><span class="tag upd-{e["type"]}">{esc(ui["types"][e["type"]])}</span>'
            f'<time datetime="{e["date"]}">{fmt_date(e["date"], lang)}</time><span>{esc(ui["version"])} {esc(e["version"])}</span></div>'
            f'<h3>{esc(t["title"])}</h3><ul>{"".join(f"<li>{esc(i)}</li>" for i in t["items"])}</ul>{cta}</article>')
    return f'<div class="upds">{"".join(out)}</div>'


def app_updates_section(app: dict, lang: str, entries: list[dict], apps: list[dict]) -> str:
    mine = [e for e in entries if e["app"] == app["slug"]][:3]
    if not mine:
        return ""
    ui = UPD_UI[lang]
    more = f'<p class="upd-more"><a class="more" href="{BASE[lang]}{UPDATES_PATH}">{esc(ui["all"])} <span aria-hidden="true">→</span></a></p>'
    return sec(app["name"], ui["app_title"], update_cards(mine, lang, apps, None, show_app=False) + more)


def updates_main(entries: list[dict], lang: str, apps: list[dict], play: dict[str, str]) -> str:
    ui = UPD_UI[lang]
    feed = f'<a class="more" href="{BASE[lang]}{UPDATES_PATH}feed.xml">{esc(ui["feed"])} <span aria-hidden="true">→</span></a>'
    hero = page_hero(ui, lang, [(ui["crumb"], "")], "blockfour-feature.jpg", feed)
    # Genel sayfa: tek bir oyunun grafiği yerine, en son güncellenen sıradaki uygulamaların simgeleri (o uygulamanın son girdisine gider)
    order = list(dict.fromkeys(e["app"] for e in entries)) + [a["slug"] for a in apps]
    by = {a["slug"]: a for a in apps}
    tiles = "".join(
        f'<a class="upd-tile" href="#{next(e["id"] for e in entries if e["app"] == s)}"><img src="/img/{by[s]["icon"]}" alt="" width="64" height="64">'
        f'<b>{esc(by[s]["name"])}</b><small>{fmt_date(next(e["date"] for e in entries if e["app"] == s), lang)}</small></a>'
        for s in dict.fromkeys(order) if any(e["app"] == s for e in entries))
    hero = re.sub(r'<div class="gp-media">.*?</div>', f'<div class="gp-media upd-tiles">{tiles}</div>', hero, flags=re.S)
    return ('\n  <main id="top" class="gp">' + hero
            + sec(ui["eyebrow"], ui["list"], update_cards(entries, lang, apps, play)) + "\n  </main>\n")


def write_updates_feed(entries: list[dict], lang: str, apps: list[dict], out_dir: Path) -> None:
    by, ui = {a["slug"]: a for a in apps}, UPD_UI[lang]
    page = DOMAIN + BASE[lang] + UPDATES_PATH
    updated = (entries[0]["date"] if entries else "2026-11-21") + "T12:00:00Z"
    items = []
    for e in entries[:30]:
        app, t = by[e["app"]], e[lang]
        body = "<ul>" + "".join(f"<li>{esc(i)}</li>" for i in t["items"]) + "</ul>"
        items.append(
            f"  <entry>\n    <title>{esc(app['name'] + ' ' + e['version'] + ': ' + t['title'])}</title>\n"
            f'    <link href="{page}#{e["id"]}"/>\n    <id>{page}#{e["id"]}</id>\n'
            f"    <updated>{e['date']}T12:00:00Z</updated>\n"
            f'    <category term="{esc(app["name"])}"/>\n'
            f'    <content type="html">{esc(body)}</content>\n  </entry>')
    xml = (f'<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="{lang}">\n'
           f"  <title>{esc('Exclusive LLM — ' + ui['h1'])}</title>\n  <subtitle>{esc(ui['lead'])}</subtitle>\n"
           f'  <link href="{page}"/>\n  <link rel="self" href="{page}feed.xml"/>\n  <id>{page}</id>\n'
           f"  <updated>{updated}</updated>\n  <author><name>Exclusive LLM</name><email>support@exclusivellm.app</email></author>\n"
           + "\n".join(items) + "\n</feed>\n")
    p = out_dir / UPDATES_PATH / "feed.xml"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(xml, encoding="utf-8")


def build_updates_page(entries: list[dict], lang: str, apps: list[dict], out_dir: Path) -> str:
    ui = UPD_UI[lang]
    soup = page_soup(lang)
    set_lang_switch(soup, lang, UPDATES_PATH)
    for a in soup.select("header a[href^='#'], footer a[href^='#']"):
        a["href"] = BASE[lang] + a["href"]
    play = play_html_map(soup, apps)
    soup.find("main").replace_with(BeautifulSoup(updates_main(entries, lang, apps, play), "html.parser"))
    url = DOMAIN + BASE[lang] + UPDATES_PATH
    set_head(soup, lang, UPDATES_PATH, ui["title"], ui["description"], "blockfour-feature.jpg",
             [crumbs_ld(lang, [(ui["crumb"], url)])])
    soup.head.append(BeautifulSoup(f'<link rel="alternate" type="application/atom+xml" title="{esc(ui["h1"])}" href="{url}feed.xml">',
                                   "html.parser"))
    tag_play_links(soup, "updates", lang)
    write(out_dir / UPDATES_PATH / "index.html", soup)
    write_updates_feed(entries, lang, apps, out_dir)
    return BASE[lang] + UPDATES_PATH


def games_json(apps: list[dict]) -> None:
    """Oyun içi 'Diğer oyunlarımız' ekranı bu dosyayı okur (yalnızca üretimdeki oyunlar)."""
    data = {"version": 1, "updated": date.today().isoformat(), "site": DOMAIN + "/", "games": [
        {"slug": a["slug"], "name": a["name"], "package": a["package"], "icon": f"{DOMAIN}/img/{a['icon']}",
         "icon512": f"{DOMAIN}/img/press/{a['icon'].rsplit('.', 1)[0]}-icon-512.png" if (ROOT / "img" / "press" / f"{a['icon'].rsplit('.', 1)[0]}-icon-512.png").exists() else f"{DOMAIN}/img/{a['icon']}",
         "feature": f"{DOMAIN}/img/{a['feature']}",
         "features": {l: f"{DOMAIN}/img/{feature_for(a['feature'], l)}" for l in LANGS},
         "tagline": {l: a[l]["tagline"] for l in LANGS if l in a},
         "page": {l: DOMAIN + BASE[l] + a["slug"] + "/" for l in LANGS}} for a in apps]}
    data["updated"] = stable_date("games.json", json.dumps(data, ensure_ascii=False))
    (ROOT / "games.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


# --- Paylaşım başına kısa linkler: /go/<kod>/ (21.11.2026) ----------------------------------------
# Amaç: sosyal medyadan siteye / Play'e kaç kişinin tıkladığını paylaşım başına ölçmek. Cloudflare Web Analytics
# sorgu dizgesini (utm_…) kaydetmez, yalnızca yolu kaydeder; bu yüzden her paylaşımın kendi yolu var.
# Sayfa açılır → Cloudflare sayar → hedefe yönlenir (Play hedefinde UTM'li link: Play Console edinme raporu da görür).
# Yönlendirme, Cloudflare'in sayım isteği (XHR /cdn-cgi/rum, yüklemeden hemen sonra) bitince yapılır; engellenirse 2,5 sn.
# Kaynak _src/links.json: {"<kod>": {"package": "...", "platform": "youtube|x|instagram|tiktok|facebook",
#                                     "hedef": "play|site", "dil": "tr|en", "not": "..."}}
# Kod yayına girdikten sonra silinmez/değiştirilmez (eski paylaşımlardaki link kırılır); sayfa da silinmez.
GO_PLATFORMS = {"youtube", "x", "instagram", "tiktok", "facebook", "deneme", "app"}  # facebook: 23.11.2026
# "app" = uygulama içi "Arkadaşına gönder" (23.11.2026). Bu kodların hedefi "otomatik": uygulama apps.json'da
# (üretimde) ise UTM'li Play sayfası (utm_medium=share), değilse site. Kod uygulamaya gömülü olduğu için hiç
# değişmez; üretime geçince hedef kendiliğinden Play olur (yalnızca siteyi yeniden üretmek yeter).
GO_TEXT = {"tr": ("Google Play açılıyor…", "Site açılıyor…", "Açılmazsa dokun"),
           "en": ("Opening Google Play…", "Opening the site…", "Tap if nothing happens")}


def go_targets(apps: list[dict]) -> tuple[dict[str, dict], list[str]]:
    path = SRC / "links.json"
    links = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    by_pkg = {a["package"]: a for a in apps}
    out: dict[str, dict] = {}
    errors: list[str] = []
    for code, l in links.items():
        if code.startswith("_"):
            continue  # açıklama satırları
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", code) or len(code) > 48:
            errors.append(f"links.json '{code}': kod yalnızca küçük harf, rakam ve tire olmalı (≤48)")
            continue
        plat, hedef, lang, pkg = l.get("platform"), l.get("hedef", "play"), l.get("dil", "tr"), l.get("package")
        if plat not in GO_PLATFORMS or hedef not in ("play", "site", "otomatik") or lang not in GO_TEXT:
            errors.append(f"links.json '{code}': platform/hedef/dil geçersiz")
            continue
        app = by_pkg.get(pkg)
        if hedef == "otomatik":
            hedef = "play" if app else "site"
        if hedef == "play":
            if not app:
                errors.append(f"links.json '{code}': {pkg} üretimde değil (apps.json'da yok); kapalı testteki uygulamada hedef 'site' olmalı")
                continue
            medium = "share" if plat == "app" else "social"
            target = (f"https://play.google.com/store/apps/details?id={pkg}"
                      f"&utm_source={plat}&utm_medium={medium}&utm_campaign={code}")
        else:
            base = "/" if lang == "tr" else f"/{lang}/"
            target = DOMAIN + base + (app["slug"] + "/" if app else "")
        # Önizleme kartı (X/WhatsApp/Telegram linki açınca görünen): canlı Play adı + o dilin öne çıkan grafiği
        title = app["name"] if app else "Exclusive LLM"
        image = f"{DOMAIN}/img/{feature_for(app['feature'], lang)}" if app else f"{DOMAIN}/img/blockfour-feature.jpg"
        desc = app[lang]["description"] if app and lang in app else ""
        out[code] = {"target": target, "lang": lang, "hedef": hedef, "title": title, "image": image, "desc": desc}
    return out, errors


def write_go_pages(targets: dict[str, dict]) -> None:
    for code, t in targets.items():
        url = html.escape(t["target"], quote=True)
        js = json.dumps(t["target"])
        msg_play, msg_site, tap = GO_TEXT[t["lang"]]
        msg = msg_play if t["hedef"] == "play" else msg_site
        page = f"""<!doctype html>
<html lang="{t['lang']}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer-when-downgrade">
<meta http-equiv="refresh" content="3;url={url}">
<title>{html.escape(t['title'])}</title>
<meta property="og:title" content="{html.escape(t['title'], quote=True)}">
<meta property="og:description" content="{html.escape(t['desc'], quote=True)}">
<meta property="og:image" content="{html.escape(t['image'], quote=True)}">
<meta name="twitter:card" content="summary_large_image">
<style>html,body{{margin:0;height:100%;background:#050B16;color:#e8eefc;font:16px/1.5 system-ui,sans-serif}}
main{{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;text-align:center;padding:0 16px}}
a{{color:#7cc4ff}}</style></head>
<body><main><p>{msg}</p><a href="{url}">{tap}</a></main>
<script>(function(){{var u={js},d=0,g=function(){{if(!d){{d=1;location.replace(u)}}}},X=XMLHttpRequest.prototype,o=X.open;
X.open=function(m,a){{if(String(a).indexOf("/cdn-cgi/rum")>-1)this.addEventListener("loadend",function(){{setTimeout(g,50)}});return o.apply(this,arguments)}};
setTimeout(g,2500)}})();</script>
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{json.dumps({"token": CF_TOKEN})}'></script>
</body></html>
"""
        p = ROOT / "go" / code / "index.html"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(page, encoding="utf-8")


def build() -> list[str]:
    apps = json.loads((SRC / "apps.json").read_text(encoding="utf-8"))
    pages = json.loads((SRC / "pages.json").read_text(encoding="utf-8"))
    GUIDE_APPS.update(g["app"] for g in pages["guides"] if g["path"] == g["app"] + "/guide/")
    go, go_errors = go_targets(apps)
    updates, upd_errors = load_updates(apps)
    errors = check_features() + check_names(apps) + go_errors + upd_errors
    if errors:
        raise SystemExit("SİTE ÜRETİLMEDİ — düzeltilmesi gerekenler:\n  - " + "\n  - ".join(errors))
    # Bir dilin metni yoksa İngilizcesi kullanılır (yeni oyun eklerken "es" bloğunu unutma)
    for obj in apps + [pages["hub"], pages["press"]] + pages.get("hubs", []) + pages["guides"]:
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
            has_guide = app["slug"] in GUIDE_APPS
            main.replace_with(BeautifulSoup(game_main(app, lang, apps, has_guide, app_updates_section(app, lang, updates, apps),
                                                      related_section(app["slug"], lang, pages)),
                                            "html.parser"))
            soup.select_one("#play-slot").insert(0, btn)
            del soup.select_one("#play-slot")["id"]
            set_head(soup, lang, app["slug"] + "/", app[lang]["title"], app[lang]["description"], app["feature"], game_ld(app, lang))
            tag_play_links(soup, app["slug"], lang)
            gb = soup.select_one("a.getbar-btn")
            if gb:
                gb["href"] = gb["href"].replace(f"utm_campaign=site_{app['slug']}&", f"utm_campaign=site_{app['slug']}_banner&")
                gb["data-page"] = app["slug"] + "_banner"
            write(out_dir / app["slug"] / "index.html", soup)
            urls.append(BASE[lang] + app["slug"] + "/")
        urls += build_content_pages(apps, pages, lang, out_dir)
        urls.append(build_guides_index(pages, lang, out_dir))
        urls.append(build_updates_page(updates, lang, apps, out_dir))
    games_json(apps)
    write_go_pages(go)  # sitemap'e girmez; noindex (önizleme kartı için tarayıcı botlarına açık)
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
            page = (u.lstrip("/") + "index.html")
            lm = _lastmod.get(page, {}).get("date", today)
            items.append(f"  <url>\n    <loc>{DOMAIN}{u}</loc>\n    <lastmod>{lm}</lastmod>{alts}\n  </url>")
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + "\n".join(items) + "\n</urlset>\n", encoding="utf-8")
    (ROOT / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\n\nSitemap: {DOMAIN}/sitemap.xml\n", encoding="utf-8")  # _src is not published (_config.yml)
    LASTMOD_FILE.write_text(json.dumps(_lastmod, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    return urls


if __name__ == "__main__":
    for u in build():
        print(DOMAIN + u)
