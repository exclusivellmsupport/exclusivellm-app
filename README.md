# exclusivellm-app
Exclusive LLM website - exclusivellm.app

## Sayfaları üretme
Sayfalar elle düzenlenmez. Kaynak: `_src/index.html` (iki dilli şablon) ve `_src/apps.json` (üretimdeki oyunların sayfaları).
Değişiklikten sonra `python _src/build.py` çalıştır; `index.html`, `en/`, oyun klasörleri, `sitemap.xml` ve `robots.txt` yeniden üretilir.
