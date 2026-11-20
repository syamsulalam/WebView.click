"""Derive a WebView site name or verify the links and routes in its static export."""

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET


HOST = "sites.webview.click"
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def publication_slug(prospect):
    def normalize(value):
        if not isinstance(value, str):
            raise ValueError("Supply a business name, niche, country code and city.")
        ascii_text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
        return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")

    country = prospect.get("country")
    if not isinstance(country, str) or not re.fullmatch("[A-Za-z]{2}", country):
        raise ValueError("Supply the reviewed two-letter country code, such as AE.")
    niche = prospect.get("niche") or (prospect.get("category") or {}).get("raw")
    parts = [normalize(value) for value in (prospect.get("name"), niche, country, prospect.get("city"))]
    slug = "-".join(parts)
    if not all(parts) or len(slug) > 63:
        raise ValueError("The four publication name segments must fit within 63 URL characters.")
    return slug


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.targets = set()
        self.references = set()
        self.feed(html)
        self.close()

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        for attr in ("id", "name") if tag == "a" else ("id",):
            if values.get(attr):
                self.targets.add(values[attr])
        if tag == "base":
            raise ValueError("Static pages must use their own URL as the link base.")
        if tag in ("a", "area") and "href" in values:
            self.references.add(("link", values["href"] or ""))
        if tag in ("img", "script", "source", "video", "iframe") and values.get("src"):
            self.references.add(("asset", values["src"]))
        if tag == "link" and (set((values.get("rel") or "").split()) &
                              {"canonical", "alternate", "stylesheet", "icon", "apple-touch-icon"}):
            if values.get("href"):
                self.references.add(("asset", values["href"]))
        if tag in ("img", "source") and (srcset := values.get("srcset")) and not srcset.startswith("data:"):
            self.references.update(("asset", entry.split()[0]) for entry in srcset.split(",") if entry.strip())


def verify_export(folder, slug):
    if len(slug) > 63 or not SLUG.fullmatch(slug):
        raise ValueError("Invalid WebView site name.")
    prefix = f"/{slug}/"
    base = f"https://{HOST}{prefix}"
    folder = folder.resolve()
    pages = {}
    for path in folder.rglob("index.html"):
        if not path.resolve().is_relative_to(folder) or not path.is_file():
            raise ValueError("Export page escapes its artifact directory.")
        subpath = path.parent.relative_to(folder).as_posix()
        route = prefix + (subpath + "/" if subpath != "." else "")
        pages[route] = Page(path.read_text(encoding="utf-8"))
    urls = [entry[0].text for entry in ET.parse(folder / "sitemap.xml").getroot()]
    if prefix not in pages or len(urls) != len(pages) or set(urls) != {
        f"https://{HOST}{route}" for route in pages
    }:
        raise ValueError("Sitemap and exported pages differ.")
    internal = set()
    external = set()
    for route, page in pages.items():
        for kind, ref in sorted(page.references):
            if not ref or ref != ref.strip() or re.search(r"[\x00-\x1f\x7f\\]", ref):
                raise ValueError(f"{route} contains an empty or malformed {kind}.")
            raw = urlsplit(ref)
            if kind == "link" and raw.scheme in {"tel", "mailto", "sms"}:
                if not raw.path or raw.netloc or (raw.scheme == "tel" and not re.fullmatch(r"\+[1-9][0-9]{7,14}", raw.path)):
                    raise ValueError(f"{route} contains an invalid contact action: {ref}")
                continue
            if raw.scheme == "data" and kind == "asset":
                continue
            resolved = urlsplit(urljoin(urljoin(base, route), ref))
            if (resolved.scheme not in {"http", "https"} or not resolved.hostname or
                    resolved.username is not None or resolved.password is not None):
                raise ValueError(f"{route} contains an unsupported {kind}: {ref}")
            if resolved.hostname == "wpwv.codev.id":
                raise ValueError(f"{route} still links to WordPress staging: {ref}")
            if resolved.hostname != HOST:
                if kind == "link":
                    external.add(ref)
                continue
            target = unquote(resolved.path)
            clean = target.removesuffix("/")
            if resolved.netloc != HOST or resolved.scheme != "https" or not target.startswith(prefix) or (
                any(segment in ("", ".", "..") for segment in clean[1:].split("/"))
                or re.search(r"[\x00-\x1f\x7f\\]", target)
            ):
                raise ValueError(f"{route} links outside the static site: {ref}")
            if target.endswith("/index.html"):
                target = target.removesuffix("index.html")
            resolved_page = pages.get(target) or pages.get(target + "/")
            if resolved_page is not None:
                if kind == "link" and resolved.fragment and unquote(resolved.fragment) not in resolved_page.targets:
                    raise ValueError(f"{route} links to a missing fragment: {ref}")
            else:
                asset = (folder / target.removeprefix(prefix)).resolve()
                if not asset.is_relative_to(folder) or not asset.is_file():
                    raise ValueError(f"{route} links to a missing file or page: {ref}")
            internal.add((route, ref))
    return {"pages": len(pages), "internal_references": len(internal), "external_links": len(external)}


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    subcommands = cli.add_subparsers(dest="command", required=True)
    subcommands.add_parser("slug").add_argument("brief", type=Path)
    check = subcommands.add_parser("check")
    check.add_argument("folder", type=Path)
    check.add_argument("slug")
    args = cli.parse_args()
    try:
        if args.command == "slug":
            print(publication_slug(json.loads(args.brief.read_text(encoding="utf-8-sig"))))
        else:
            print(json.dumps(verify_export(args.folder, args.slug)))
    except (OSError, ValueError, TypeError, AttributeError, IndexError, ET.ParseError) as error:
        cli.exit(2, f"WebView export check failed: {error}\n")
