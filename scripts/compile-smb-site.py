"""Resolve an SMB niche and bind a sourced brief to a reviewed Starter Template."""

import argparse
import base64
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import re
from runpy import run_path
from urllib.parse import urlencode, urlsplit
from urllib.request import build_opener, HTTPRedirectHandler, Request


SCRIPTS = Path(__file__).resolve().parent
CATALOG = run_path(str(SCRIPTS / "resolve-smb-template.py"))
STORAGE = "https://storage.codev.id/templates/"
PLACEHOLDERS = re.compile(r"\b(?:lorem ipsum|dolor sit amet|a descriptive paragraph|this is a short description|TODO|TBD)\b", re.I)
ROLES_WITH_ITEMS = {"details", "guide", "questions"}
MARK = "@@WV_HOME@@"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fetch(name, limit):
    request = Request(STORAGE + name, headers={"User-Agent": "WebView template validator"})
    with build_opener(NoRedirect()).open(request, timeout=20) as response:
        data = response.read(limit + 1)
    require(len(data) <= limit, f"Bundle object exceeds its size limit: {name}")
    return data


def select_template(prospect, templates, layouts):
    known, _ = CATALOG["load_requests"]()
    category = prospect.get("category") or {}
    explicit = prospect.get("template_query")
    queries = (explicit,) if explicit is not None else (
        category.get("raw"), category.get("vertical"), prospect.get("niche"))
    route = next((known[key] for q in queries if isinstance(q, str) and
                  (key := CATALOG["normalized"](q)) in known), None)
    require(route is not None, "No catalog route for this prospect's niche.")
    decision = CATALOG["resolve_request"](route, templates)
    requested = prospect.get("template_id")
    require(requested is None or (isinstance(requested, str) and CATALOG["SLUG"].fullmatch(requested)),
            "An explicit template ID must be a valid catalog slug.")
    candidates = [item for item in decision["candidates"] if requested is None or item["slug"] == requested]
    for item in candidates:
        layout = layouts.get(item["slug"])
        if layout and all(item[key] == layout.get(key) for key in ("revision", "wxr_sha256")):
            return item, layout
    reason = decision.get("reason") or "No reviewed WebView layout matches the candidate bundle revision."
    raise ValueError(f"{decision['request']}: {reason}")


def source_layouts(candidate, layout, cache):
    slug = candidate["slug"]
    path = cache / f"{slug}.xml" if cache else None
    size = candidate["wxr_bytes"]
    require(0 < size <= 40 * 1024 * 1024, "WXR size exceeds the approved build envelope.")
    raw = path.read_bytes() if path and path.is_file() and path.stat().st_size == size else fetch(f"{slug}/wxr.xml", size)
    require(len(raw) == size and sha256(raw).hexdigest() == candidate["wxr_sha256"], "Starter WXR digest does not match the catalog.")
    pages = {}
    for item in re.finditer(rb"<item>(.*?)</item>", raw, re.S):
        body = item.group(1)
        if not re.search(rb"<wp:post_type>\s*(?:<!\[CDATA\[)?page(?:\]\]>)?\s*</wp:post_type>", body):
            continue
        title = re.search(rb"<title>(.*?)</title>", body, re.S)
        content = re.search(rb"<content:encoded>\s*<!\[CDATA\[(.*?)\]\]>\s*</content:encoded>", body, re.S)
        if title and content:
            name = title.group(1).decode().removeprefix("<![CDATA[").removesuffix("]]>")
            pages[name] = top_blocks(content.group(1).decode())
    result = {}
    for role, mapping in layout["pages"].items():
        source = pages.get(mapping["source"], [])
        require(len(source) == len(mapping["sections"]) and
                all(block == "uagb/container" for block, _ in source),
                f"Unexpected Gutenberg section structure on source page {mapping['source']}.")
        result[role] = source
    return result


def top_blocks(content):
    stack, root = [], []
    for match in re.finditer(r"<!--\s*(/?)wp:([\w/-]+)\s*([\s\S]*?)-->", content):
        closing, block, attrs = match.groups()
        if closing:
            require(stack and stack.pop() == block, "Malformed source Gutenberg blocks.")
            continue
        if not stack:
            root.append((block, json.loads(attrs.rstrip().removesuffix("/").strip() or "{}")))
        if not attrs.rstrip().endswith("/"):
            stack.append(block)
    require(not stack, "Unclosed source Gutenberg blocks.")
    return root


def copy(data, field, minimum=1, maximum=1600):
    value = data.get(field)
    require(isinstance(value, str) and minimum <= len(value.strip()) <= maximum
            and not PLACEHOLDERS.search(value) and "@@WV_" not in value,
            f"Missing, excessive, or placeholder copy in {field}.")
    return value.strip()


def source_url(value):
    parts = urlsplit(value)
    require(parts.scheme == "https" and parts.hostname and not parts.username and not parts.password,
            "Source and photo credits must use HTTPS URLs.")
    return value


def action(url, label, kind="button"):
    return f'<a class="wv-{kind}" href="{escape(url, quote=True)}">{escape(label)}</a>'


def button_text(accent):
    srgb = [int(accent[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    luminance = sum(c * w for c, w in zip(linear, (0.2126, 0.7152, 0.0722)))
    return "#000" if (luminance + 0.05) / 0.05 >= 4.5 else "#fff"


def render_page(role, page, roles, source, prospect, photo):
    phone = prospect["phone"]
    home = MARK
    services = home + prospect["pages"]["services"]["slug"] + "/"
    directions = "https://www.google.com/maps/search/?" + urlencode({
        "api": 1, "query": f"{prospect['name']}, {prospect['address']}"})
    labels = prospect["labels"]
    rendered = []
    photo_html = (
        f'<figure class="wv-photo"><img src="@@WV_IMAGE@@" alt="{escape(photo["alt"], quote=True)}" '
        f'width="{photo["width"]}" height="{photo["height"]}" fetchpriority="high">'
        f'<figcaption>{escape(photo["caption"])} '
        f'{action(photo["source"], photo["credit"], "credit")}</figcaption></figure>'
    )
    slots = page["sections"]
    require(set(slots) == set(roles), f"{role} needs the reviewed source sections: {', '.join(roles)}.")
    for index, (kind, (_, attrs)) in enumerate(zip(roles, source, strict=True), 1):
        slot = slots[kind]
        heading = escape(copy(slot, "title", 3, 100))
        body = escape(copy(slot, "body", 45 if kind == "hero" else 30, 600))
        tag = "h1" if kind == "hero" else "h2"
        text = f'<{tag}>{heading}</{tag}><p>{body}</p>'
        if kind == "hero":
            controls = action("tel:" + phone, labels["call"])
            if role == "home":
                controls += action(services, labels["services"], "secondary")
            text = f'<div>{text}<div class="wv-actions">{controls}</div></div>'
            if role == "home":
                text += photo_html
        elif kind == "services":
            cards = []
            for offering in prospect["offerings"]:
                heading = escape(copy(offering, "title", 3, 90))
                detail = escape(copy(offering, "summary" if role == "home" else "description", 42, 560))
                cards.append(f'<article class="wv-card"><h3>{heading}</h3><p>{detail}</p></article>')
            text += '<div class="wv-grid">' + "".join(cards) + "</div>"
        elif kind in ROLES_WITH_ITEMS:
            items = slot.get("items", [])
            require(2 <= len(items) <= 4, f"{role}/{kind} needs two to four useful entries.")
            cards = []
            for item in items:
                label = escape(copy(item, "title", 3, 100))
                detail = escape(copy(item, "body", 22, 360))
                if kind == "questions":
                    cards.append(f'<details><summary>{label}</summary><p>{detail}</p></details>')
                else:
                    cards.append(f'<article class="wv-card"><h3>{label}</h3><p>{detail}</p></article>')
            text += '<div class="wv-grid">' + "".join(cards) + "</div>"
        elif kind == "callout":
            text += action("tel:" + phone, labels["call"])
        elif kind == "directions":
            text += action(directions, labels["directions"])
        spacing = attrs.get("topPaddingDesktop", 72)
        spacing = min(112, max(32, spacing)) if type(spacing) is int else 72
        rendered.append(
            f'<section class="wv-section wv-{kind}" data-wv-source-section="{index}" '
            f'style="--wv-space:{spacing}px"><div class="wv-inner">{text}</div></section>'
        )
    html = '<div class="wv-preview">' + "".join(rendered) + "</div>"
    return html.replace("[", "&#91;").replace("]", "&#93;")


def compile_site(input_path, manifest, cache):
    prospect = CATALOG["read_json"](input_path)
    templates = (CATALOG["read_json"](manifest) if manifest else json.loads(fetch("manifest.json", 2_000_000)))["templates"]
    layouts = CATALOG["read_json"](CATALOG["DATA"] / "smb-template-layouts.json")
    candidate, layout = select_template(prospect, templates, layouts)
    name = copy(prospect, "name", 2, 160)
    copy(prospect, "address", 5, 250)
    tagline = copy(prospect, "tagline", 10, 160)
    footer = copy(prospect, "footer", 3, 160)
    require("[" not in footer and "]" not in footer, "Do not use WordPress shortcodes in the footer.")
    require(re.fullmatch(r"\+[1-9][0-9]{7,14}", prospect["phone"]), "Use an E.164 contact phone.")
    require(re.fullmatch(r"[a-z]{2}_[A-Z]{2}", prospect["locale"]), "Use a WordPress locale such as en_US.")
    require(3 <= len(prospect["offerings"]) <= 12, "Supply three to twelve researched service descriptions.")
    require(len(prospect["sources"]) >= 2, "Supply source URLs for the business identity and services.")
    for url in prospect["sources"]:
        source_url(url)
    for key in ("services", "call", "directions"):
        copy(prospect["labels"], key, 3, 45)
    require(set(prospect["pages"]) == set(layout["pages"]), "Brief page set differs from the reviewed template.")
    photo = prospect["photo"]
    for key in ("alt", "caption", "credit"):
        copy(photo, key, 8, 180)
    source_url(photo["source"])
    path = input_path.parent / photo["file"]
    require(path.is_file() and 0 < path.stat().st_size <= 1_000_000, "Supply one reviewed JPEG under 1 MB.")
    image = path.read_bytes()
    require(image.startswith(b"\xff\xd8\xff") and all(type(photo[k]) is int and 0 < photo[k] <= 4096
            for k in ("width", "height")), "Invalid JPEG or image dimensions.")
    source = source_layouts(candidate, layout, cache)
    pages = []
    seen_slugs = set()
    for role, mapping in layout["pages"].items():
        page = prospect["pages"][role]
        slug = page["slug"]
        require(CATALOG["SLUG"].fullmatch(slug) and len(slug) <= 55 and slug not in seen_slugs, "Invalid or duplicate route slug.")
        seen_slugs.add(slug)
        pages.append({"role": role, "slug": slug, "title": copy(page, "title", 2, 58),
                      "source": mapping["source"], "sections": mapping["sections"],
                      "html": render_page(role, page, mapping["sections"], source[role], prospect, photo)})
    require(len({prospect["pages"][role]["sections"]["hero"]["body"].strip().casefold()
                 for role in layout["pages"]}) == len(pages), "Hero introductions must be page-specific.")
    accent = prospect.get("accent", "#e9b447")
    require(re.fullmatch(r"#[0-9a-fA-F]{6}", accent), "Accent must be a hex color.")
    css = (SCRIPTS / "wpwv-preview.css").read_text(encoding="utf-8")
    css = css.replace("@@WV_ACCENT@@", accent).replace("@@WV_BUTTON_TEXT@@", button_text(accent))
    return {"name": name, "tagline": tagline, "locale": prospect["locale"], "template": candidate,
            "phone": prospect["phone"], "footer": footer,
            "pages": pages, "css": css, "image": base64.b64encode(image).decode(),
            "image_sha256": sha256(image).hexdigest(), "image_width": photo["width"],
            "image_height": photo["height"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("prospect", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--template-cache", type=Path)
    args = parser.parse_args()
    try:
        result = compile_site(args.prospect, args.manifest, args.template_cache)
        args.output.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    except (OSError, KeyError, TypeError, ValueError, AttributeError) as exc:
        parser.exit(2, f"WebView brief needs review: {exc}\n")
    print(f"Selected {result['template']['slug']} revision {result['template']['revision']} for {len(result['pages'])} reviewed pages.")


if __name__ == "__main__":
    main()
