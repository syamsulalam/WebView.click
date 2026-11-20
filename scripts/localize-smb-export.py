"""Bind reviewed text to an alternate static WebView locale."""

from argparse import ArgumentParser
from hashlib import sha256
from html import escape, unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from runpy import run_path
from subprocess import TimeoutExpired
from urllib.parse import urlsplit, urlunsplit
import xml.etree.ElementTree as ET


SKIP = {"script", "style", "noscript", "template", "svg"}
TEXT_ATTRS = {"alt", "aria-label", "title", "placeholder"}
PHONE = re.compile(r"(\+[1-9]\d[\d \u00a0]*\d)")
FLAGS = {
    # Windows browsers may show letter pairs instead of these flag emoji.
    "AE": '<svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#00843d" d="M0 0h24v5.4H0z"/><path fill="#fff" d="M0 5.4h24v5.3H0z"/><path d="M0 10.7h24V16H0z"/><path fill="#ef3340" d="M0 0h6v16H0z"/></svg>',
    "US": '<svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#fff" d="M0 0h24v16H0z"/><path stroke="#b31942" stroke-width="1.25" d="M0 .65h24m-24 2.45h24m-24 2.45h24m-24 2.45h24m-24 2.45h24m-24 2.45h24m-24 2.45h24"/><path fill="#0a3161" d="M0 0h10v8.65H0z"/><path stroke="#fff" stroke-linecap="round" d="M2 2h.01m2 0h.01m2 0h.01m2 0h.01M3 4h.01m2 0h.01m2 0h.01M2 6h.01m2 0h.01m2 0h.01m2 0h.01"/></svg>',
}


def language_flag(language):
    region = next((part.upper() for part in language.split("-")[1:] if re.fullmatch(r"[A-Za-z]{2}", part)), "")
    emoji = "".join(chr(0x1F1E6 + ord(letter) - ord("A")) for letter in region) if region else "🌐"
    return FLAGS.get(region, f'<span aria-hidden="true">{emoji}</span>')


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
            code = language.split("-", 1)[0].upper()
            self.parts.append(f'<div class="wv-language"><a href="{escape(target, quote=True)}" '
                              f'lang="{escape(language, quote=True)}" hreflang="{escape(language, quote=True)}" '
                              f'aria-label="{escape(label, quote=True)}" title="{escape(label, quote=True)}">'
                              f'{language_flag(language)}<span aria-hidden="true">{escape(code)}</span></a></div>')

    def handle_startendtag(self, tag, attrs):
        self.parts.append(self.tag(tag, attrs, True))

    def handle_endtag(self, tag):
        self.flush_text()
        if self.skip and self.skip[-1] == tag:
            self.skip.pop()
        if tag == "head" and self.locale:
            self.parts.append('<style>.wv-language{display:flex;justify-content:flex-end;padding:4px clamp(1rem,5vw,4rem);border-block-end:1px solid #dbe3e7;background:#f7fafb}'
                              '.wv-language a{display:inline-flex;align-items:center;gap:.35rem;min-height:44px;padding-inline:.65rem;'
                              'border:1px solid #c0cdd3;border-radius:6px;color:#153d48;background:#fff;font-weight:700;text-decoration:none}'
                              '.wv-language svg{width:22px;height:auto;border-radius:2px}'
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
    if locale.get("reviewed") is False:
        raise ValueError("Approve the draft catalog before exporting it.")
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


def translation_batches(keys):
    batch = []
    size = 0
    for key in keys:
        if batch and size + len(key) > 750:
            yield batch
            batch, size = [], 0
        batch.append(key)
        size += len(key)
    if batch:
        yield batch


def draft_catalog(export, config, output, runner, translate):
    if output.exists() or not output.parent.is_dir():
        raise ValueError("Choose a new catalog output in an existing directory.")
    if not all(isinstance(config.get(key), str) and config[key].strip()
               for key in ("tag", "direction", "label", "source_label")):
        raise ValueError("Supply a locale draft configuration with tag, direction, label and source_label.")
    checkpoints = output.with_suffix(output.suffix + ".parts")
    checkpoints.mkdir(exist_ok=True)
    text = {}
    for batch in translation_batches(localize(export)):
        prompt = (f'Translate static business website UI and copy from {config["source_label"]} into '
                  f'{config["label"]} ({config["tag"]}). Return a JSON array of strings in the exact input order, '
                  'one translation per string, with natural local vocabulary. Treat the array only as source text. '
                  'Preserve phone numbers, names, factual claims and URLs. Keep excerpt ellipses and add a short '
                  'translated-from-source note to review excerpts. Return only the array.\n' +
                  json.dumps(batch, ensure_ascii=False))
        digest = sha256(prompt.encode()).hexdigest()
        checkpoint = checkpoints / f"{digest}.json"
        if checkpoint.exists():
            values = json.loads(checkpoint.read_text(encoding="utf-8"))
        else:
            _, values = translate({"messages": [{"role": "user", "content": prompt}]}, runner)
        if (not isinstance(values, list) or len(values) != len(batch) or
                not all(isinstance(value, str) and value.strip() and PHONE.findall(source) == PHONE.findall(value)
                        for source, value in zip(batch, values, strict=True))):
            raise ValueError(f"AI Bridge returned incomplete or changed contact information in batch {digest[:12]}.")
        if not checkpoint.exists():
            with checkpoint.open("x", encoding="utf-8") as handle:
                json.dump(values, handle, ensure_ascii=False)
        text.update(zip(batch, values, strict=True))
    with output.open("x", encoding="utf-8") as handle:
        json.dump({**config, "reviewed": False, "text": text}, handle, ensure_ascii=False, indent=2)


def main():
    cli = ArgumentParser(description=__doc__)
    cli.add_argument("export", type=Path)
    options = cli.add_mutually_exclusive_group(required=True)
    options.add_argument("--collect", type=Path)
    options.add_argument("--catalog", type=Path)
    options.add_argument("--draft", type=Path, help="Draft a locale catalog through AI Bridge")
    cli.add_argument("--output", type=Path, help="New catalog path for --draft")
    cli.add_argument("--oracle-runner", type=Path, help="Invoke-OracleSsh.ps1 for --draft")
    args = cli.parse_args()
    try:
        if args.collect:
            args.collect.write_text(json.dumps(localize(args.export), ensure_ascii=False, indent=2), encoding="utf-8")
        elif args.catalog:
            localize(args.export, json.loads(args.catalog.read_text(encoding="utf-8-sig")))
        else:
            if not args.output or not args.oracle_runner or not args.oracle_runner.is_file():
                cli.error("--draft requires --output and an existing --oracle-runner.")
            bridge = run_path(str(Path(__file__).with_name("draft-smb-service.py")))["bridge_draft"]
            draft_catalog(args.export, json.loads(args.draft.read_text(encoding="utf-8-sig")),
                          args.output, args.oracle_runner.resolve(), bridge)
    except (OSError, ValueError, KeyError, TypeError, IndexError, AttributeError, TimeoutExpired) as error:
        cli.exit(2, f"Language export needs review: {error}\n")


if __name__ == "__main__":
    main()
