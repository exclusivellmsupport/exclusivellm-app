"""IndexNow: değişen sayfaları Bing, Yandex, Seznam, Naver ve Yep'e anında bildirir (Google kullanmaz) — 24.11.2026.

Kullanım (Bash'te ağ yok, PowerShell'den):  python _src/indexnow.py            -> sitemap'te lastmod'u bugün olanlar
                                             python _src/indexnow.py --all      -> sitemap'teki tüm adresler
                                             python _src/indexnow.py --since 2026-11-20
Siteyi GitHub'a gönderip yayına girdikten SONRA çalıştır (anahtar dosyası canlıda olmalı).
Aynı değişmemiş adresleri tekrar tekrar gönderme: IndexNow 429 döndürür.
"""
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOST = "exclusivellm.app"
KEY = "4cf25974ad6d42acc2d747e65442700b"  # anahtar dosyası: /<KEY>.txt (site kökünde, silme)


def urls_from_sitemap(since: str | None) -> list[str]:
    xml = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    out = []
    for loc, lm in re.findall(r"<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>", xml):
        if since is None or lm >= since:
            out.append(loc)
    return out


def main() -> None:
    args = sys.argv[1:]
    if "--all" in args:
        since = None
    elif "--since" in args:
        since = args[args.index("--since") + 1]
    else:
        since = date.today().isoformat()
    urls = urls_from_sitemap(since)
    if not urls:
        print("Gönderilecek adres yok (lastmod >=", since, ")")
        return
    assert (ROOT / f"{KEY}.txt").read_text(encoding="utf-8").strip() == KEY
    body = json.dumps({"host": HOST, "key": KEY, "keyLocation": f"https://{HOST}/{KEY}.txt", "urlList": urls}).encode()
    req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body,
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"IndexNow {r.status}: {len(urls)} adres gönderildi")
    except urllib.error.HTTPError as e:
        print(f"IndexNow HATA {e.code}: {e.read()[:300]!r}  (403 anahtar, 422 alan adı, 429 çok sık)")
        sys.exit(1)


if __name__ == "__main__":
    main()
