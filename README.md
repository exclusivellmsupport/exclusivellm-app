# exclusivellm-app
Exclusive LLM website - exclusivellm.app

## Sayfaları üretme
Sayfalar elle düzenlenmez. Kaynak: `_src/index.html` (iki dilli şablon) ve `_src/apps.json` (üretimdeki oyunların sayfaları).
Değişiklikten sonra `python _src/build.py` çalıştır; `index.html`, `en/`, oyun klasörleri, `sitemap.xml` ve `robots.txt` yeniden üretilir.

## Diller ve içerik
- Diller: TR (`/`), EN (`/en/`), ES (`/es/`). Şablon TR/EN yazılır; ES metinleri `_src/i18n_es.json` (şablondaki her `.en` öğesinin İspanyolcası), oyun ve sayfa metinleri `apps.json` / `pages.json` içindeki `"es"` blokları. Şablona yeni `.en` metni eklersen `i18n_es.json`'a da ekle (yoksa üretim uyarı verir).
- `_src/pages.json`: kategori sayfası (`/block-puzzle-games/`), basın kiti (`/press/`) ve oyun rehberleri (`/<slug>/guide/`).
- `games.json`: üretimdeki oyunların listesi; oyunlardaki "Diğer oyunlarımız" ekranı okur. `apps.json`'dan üretilir.
- Ölçüm: Cloudflare Web Analytics (çerezsiz, `CF_TOKEN` build.py'de). Play linkleri `utm_source=exclusivellm_site` taşır.

## Yenilikler (21.11.2026)
- Üretimdeki uygulamaların **önemli** güncellemeleri `_src/updates.json`'a yazılır; `python _src/build.py` şunları üretir: `/updates/` (+ `/en/`, `/es/`), her dilde Atom beslemesi `updates/feed.xml` ve her uygulama sayfasında o uygulamanın son 3 girdisi ("Yenilikler" bölümü, Özellikler ile SSS arasında). Üst menüde ve altbilgide "Yenilikler" bağlantısı var.
- Girdi: `app` (apps.json slug, yalnızca üretimdekiler), `version`, `date` (üretimde yayına girdiği gün), `type` (`launch` | `feature` | `content` | `look`), `tr`/`en`/`es` → `title` + `items`. Yalnızca oyuncunun fark edeceği değişiklikler yazılır; reklam ayarı, kütüphane, imza, iç düzeltme yazılmaz. Kurallar dosyanın başındaki `_aciklama`da; build hatalı girdide siteyi üretmez.
- Bir uygulama üretime geçtiğinde `launch` girdisi eklenir. Girdinin bağlantısı `/updates/#<app>-<sürüm>`; yayına giren girdinin uygulama + sürümü değiştirilmez.

## "Yolda" kartları (20.11.2026)
Kapalı testteki uygulamanın kartında görselin üstüne rozet konmaz (görseldeki yazıyla çakışıyordu). Etiket uygulama adının yanında durur:
`<h3>Uygulama Adı <span class="soon-pill"><span class="tr">YAKINDA</span><span class="en">COMING SOON</span></span></h3>` (ES: `PRÓXIMAMENTE`, `i18n_es.json`).

## Oyun sayfalarında Play bandı ve QR (20.11.2026)
`build.py` her oyun sayfasına masaüstü için Play QR kodu (`img/qr/<slug>-<dil>.svg`, `utm_medium=qr`) ve yalnızca Android'de görünen alt bant (`#getbar`, `utm_campaign=site_<slug>_banner`, `assets/app.js`) ekler. QR için `pip install segno`.
`pages.json` → `hubs`: ek arama sayfaları (ör. `/offline-games/` "İnternetsiz oyunlar").
