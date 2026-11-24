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

## SEO paketi (24.11.2026)
- **Rehberler:** `pages.json` → `guides` (tek oyuna bağlı makale, isteğe bağlı `faq`) ve `hubs` (birden çok oyun, karşılaştırma tablosu). Yol `<oyun>/guide/` değilse de rehber olabilir (ör. `how-to-play-2048/`). `/guides/` dizini, oyun sayfalarındaki "Bu oyunla ilgili rehberler" bölümü ve altbilgideki "Rehberler ve ipuçları" bağlantısı otomatik üretilir. Rehberi olmayan oyuna "İpuçları" bağlantısı verilmez.
- **İçerik kuralları:** her dil ≥800 kelime, yalnızca koddan doğrulanmış oyun bilgisi, rakip marka başlıkta yok, "reklamsız" yok, sağlık iddiası yok, ilgisiz anahtar kelime yok (Google spam politikası).
- **Oyun sayfası H1'i:** ad + anahtar kelimeli alt başlık (`apps.json` → `h1_sub`, yoksa başlığın `:` sonrası). Ana sayfa H1'i hero'daki küçük etiket ("Android için ücretsiz bulmaca ve zekâ oyunları"); büyük döner yazı `p.hero-title`.
- **lastmod** yalnızca `<main>` + başlık/açıklama değişince ilerler (ortak menü/altbilgi değişikliği tüm sayfaları "yeni" göstermez).
- **IndexNow:** anahtar dosyası kökte `4cf25974ad6d42acc2d747e65442700b.txt` (silme). Site yayına girdikten sonra PowerShell'den `python _src/indexnow.py` (bugün değişenler) ya da `--all`. Bing, Yandex, Seznam, Naver, Yep'e bildirir; Google için Search Console kullanılır.
