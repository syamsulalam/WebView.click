"""Bind reviewed text to an alternate static WebView locale."""

from argparse import ArgumentParser
from html import escape, unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urlsplit, urlunsplit
import xml.etree.ElementTree as ET


SKIP = {"script", "style", "noscript", "template", "svg"}
TEXT_ATTRS = {"alt", "aria-label", "title", "placeholder"}
PHONE = re.compile(r"(\+[1-9]\d[\d \u00a0]*\d)")


class Page(HTMLParser):
    def __init__(self, original, translated, routes, locale, catalog, alternate):
        super().__init__(convert_charrefs=False)
        self.original, self.translated, self.routes = original, translated, routes
        self.locale, self.catalog, self.alternate = locale, catalog, alternate
        self.parts = []
        self.skip = []
        self.lang = "en"
        self.pending = []

    def text(self, value):
        raw = value.strip()
        if self.alternate and any(character.isalpha() for character in raw):
            return value.replace(raw, self.catalog[raw], 1)
        return value

    def flush_text(self):
        if self.pending:
            raw = "".join(self.pending)
            decoded = unescape(raw)
            text = self.text(decoded) if not self.skip else decoded
            if not self.skip and self.alternate and self.locale.get("direction") == "rtl" and PHONE.search(text):
                self.parts.append("".join(escape(part, quote=False) if index % 2 == 0 else
                                          f'<bdi dir="ltr">{part}</bdi>'
                                          for index, part in enumerate(PHONE.split(text))))
            else:
                self.parts.append(escape(text, quote=False) if text != decoded else raw)
            self.pending.clear()

    def handle_data(self, data):
        self.pending.append(data)

    def handle_entityref(self, name):
        self.pending.append(f"&{name};")

    def handle_charref(self, name):
        self.pending.append(f"&#{name};")

    def tag(self, tag, attrs, closing):
        self.flush_text()
        if tag in SKIP and not closing:
            self.skip.append(tag)
        before = dict(attrs)
        if tag == "html":
            self.lang = before.get("lang") or "en"
        if self.skip:
            return self.get_starttag_text()
        after = before.copy()
        if self.alternate:
            for name, value in attrs:
                if value and (name in TEXT_ATTRS or (tag == "meta" and name == "content" and
                              (before.get("name") in {"description", "twitter:title", "twitter:description"} or
                               before.get("property") in {"og:title", "og:description"}))):
                    after[name] = self.text(value)
            if tag == "html" and self.locale:
                after.update(lang=self.locale["tag"], dir=self.locale["direction"])
            if tag == "a" or (tag == "link" and before.get("rel") == "canonical"):
                link = urlsplit(before.get("href") or "")
                if (not link.netloc or link.netloc == self.original.netloc) and link.path in self.routes:
                    after["href"] = urlunsplit(link._replace(path=self.routes[link.path]))
            if tag == "meta" and before.get("property") == "og:url":
                after["content"] = self.translated.geturl()
            if tag == "meta" and before.get("property") == "og:locale" and self.locale:
                after["content"] = self.locale["tag"].replace("-", "_")
        if after == before:
            return self.get_starttag_text()
        values = "".join(f' {name}="{escape(value, quote=True)}"' if value is not None else f" {name}"
                         for name, value in after.items())
        return f"<{tag}{values}{' /' if closing else ''}>"

    def handle_starttag(self, tag, attrs):
        self.parts.append(self.tag(tag, attrs, False))
        if tag == "body" and self.locale:
            target = self.original.path if self.alternate else self.translated.path
            language = self.lang if self.alternate else self.locale["tag"]
            label = self.locale["source_label"] if self.alternate else self.locale["label"]
            self.parts.append(f'<div class="wv-language"><a href="{escape(target, quote=True)}" '
                              f'lang="{escape(language, quote=True)}" hreflang="{escape(language, quote=True)}">'
                              f'{escape(label)}</a></div>')

    def handle_startendtag(self, tag, attrs):
        self.parts.append(self.tag(tag, attrs, True))

    def handle_endtag(self, tag):
        self.flush_text()
        if self.skip and self.skip[-1] == tag:
            self.skip.pop()
        if tag == "head" and self.locale:
            self.parts.append('<style>.wv-language{display:flex;justify-content:flex-end;padding-inline:1rem}'
                              '.wv-language a{display:inline-flex;align-items:center;min-height:44px;padding-inline:.5rem}'
                              '.wv-language a:focus-visible{outline:2px solid currentColor}'
                              '[dir="rtl"] .ast-desktop .main-header-menu > .menu-item-has-children > .sub-menu'
                              '{left:auto;right:0}[dir="rtl"] .site-branding{padding-inline-start:1rem}</style>')
            for lang, url in ((self.lang, self.original), (self.locale["tag"], self.translated)):
                self.parts.append(f'<link rel="alternate" hreflang="{escape(lang, quote=True)}" '
                                  f'href="{escape(url.geturl(), quote=True)}">')
        self.parts.append(f"</{tag}>")

    def handle_decl(self, decl):
        self.flush_text()
        self.parts.append(f"<!{decl}>")

    def handle_comment(self, data):
        self.flush_text()
        self.parts.append(f"<!--{data}-->")

    def finish(self, html):
        self.feed(html)
        self.close()
        self.flush_text()
        return "".join(self.parts)


class Collect(dict):
    def __missing__(self, key):
        self[key] = key
        return key


def localize(export, config=None):
    sitemap = export / "sitemap.xml"
    tree = ET.parse(sitemap)
    urls = [urlsplit(item[0].text) for item in tree.getroot()]
    if not urls or not re.fullmatch(r"/[a-z0-9-]+/", urls[0].path):
        raise ValueError("Expected a WebView export rooted at a single site slug.")
    prefix = urls[0].path
    locale = config or {}
    tag = locale.get("tag", "")
    if config and (not re.fullmatch(r"[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*", tag) or
                   locale.get("direction") not in {"ltr", "rtl"} or
                   not all(isinstance(locale.get(key), str) and locale[key].strip() for key in ("label", "source_label"))):
        raise ValueError("Supply a language tag, reading direction and both language labels.")
    alternate_prefix = f"{prefix}{tag.lower()}/"
    catalog = locale["text"] if config else Collect()
    if not isinstance(catalog, dict) or any(not isinstance(value, str) or not value.strip() for value in catalog.values()):
        raise ValueError("Every catalog entry needs reviewed text.")
    routes = {}
    for url in urls:
        relative = url.path.removeprefix(prefix)
        if url.netloc != urls[0].netloc or not url.path.startswith(prefix) or not url.path.endswith("/") or (
                relative and not re.fullmatch(r"(?:[a-z0-9-]+/)+", relative)):
            raise ValueError(f"Unexpected sitemap entry: {url.geturl()}")
        routes[url.path] = alternate_prefix + relative
    if config and (export / tag.lower()).exists():
        raise ValueError("The alternate language would collide with an existing route. Start from a fresh export.")
    writes = []
    for url in urls:
        path = export / url.path.removeprefix(prefix) / "index.html"
        translated = url._replace(path=routes[url.path])
        html = path.read_text(encoding="utf-8")
        localized = Page(url, translated, routes, locale, catalog, alternate=True).finish(html)
        if config:
            writes.append((path, Page(url, translated, routes, locale, catalog, alternate=False).finish(html)))
            writes.append((export / translated.path.removeprefix(prefix) / "index.html", localized))
            entry = ET.SubElement(tree.getroot(), "url")
            ET.SubElement(entry, "loc").text = translated.geturl()
    if config:
        for path, html in writes:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(html, encoding="utf-8")
        ET.register_namespace("", "http://www.sitemaps.org/schemas/sitemap/0.9")
        tree.write(sitemap, encoding="utf-8", xml_declaration=True)
    return catalog


def main():
    cli = ArgumentParser(description=__doc__)
    cli.add_argument("export", type=Path)
    options = cli.add_mutually_exclusive_group(required=True)
    options.add_argument("--collect", type=Path)
    options.add_argument("--catalog", type=Path)
    args = cli.parse_args()
    try:
        if args.collect:
            args.collect.write_text(json.dumps(localize(args.export), ensure_ascii=False, indent=2), encoding="utf-8")
        else:
            localize(args.export, json.loads(args.catalog.read_text(encoding="utf-8-sig")))
    except (OSError, ValueError, KeyError, TypeError) as error:
        cli.exit(2, f"Language export needs review: {error}\n")


if __name__ == "__main__":
    main()
