"""Resolve an SMB niche and bind a sourced brief to a reviewed Starter Template."""

import argparse
import base64
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import re
from runpy import run_path
import unicodedata
from urllib.parse import parse_qs, urlencode, urlsplit
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
    place = prospect.get("place") or {}
    explicit = prospect.get("template_query")
    queries = (explicit,) if explicit is not None else (
        category.get("raw"), place.get("primaryType"), category.get("vertical"), prospect.get("niche"))
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


def plan_services(prospect):
    offerings = prospect.get("offerings")
    if offerings is None:
        offerings = (prospect.get("place") or {}).get("services")
    require(isinstance(offerings, list) and 1 <= len(offerings) <= 12,
            "Supply one to twelve confirmed offerings from the business or its listing.")
    result = []
    slugs = set()
    for item in offerings:
        title = copy(item, "title", 3, 58)
        slug = item.get("slug")
        if slug is None:
            ascii_title = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
            slug = re.sub(r"[^a-z0-9]+", "-", ascii_title.lower()).strip("-")[:54].rstrip("-")
        require(isinstance(slug, str) and CATALOG["SLUG"].fullmatch(slug) and len(slug) <= 55 and slug not in slugs,
                "Service slugs must be unique and valid. Supply a slug when the title cannot be transliterated.")
        slugs.add(slug)
        evidence = source_url(copy(item, "source", 10, 800))
        require(evidence in prospect["sources"], "Each service source must be listed in the brief.")
        summary = copy(item, "summary", 42, 320)
        description = copy(item, "description", 100, 560)
        require(summary.casefold() != description.casefold(), "A service detail needs its own copy.")
        result.append({"title": title, "slug": slug, "summary": summary, "description": description,
                       "source": evidence, "photo": item.get("photo")})
    return result


def verify_website_absence(prospect, now=None):
    check = prospect.get("website_check") or {}
    place = prospect.get("place") or {}
    website_fields = ("website", "websiteUrl", "websiteUri", "website_url")
    listed_site = any(record.get(field) for record in (prospect, place) for field in website_fields)
    require(prospect.get("website_state") == "absent" and "website" in prospect and prospect["website"] is None
            and not listed_site
            and check.get("listing_website_absent") is True and check.get("official_site_found") is False,
            "Outreach requires a confirmed listing without a website and an independent official-site search.")
    listing = source_url(copy(check, "listing_url", 12, 900))
    parts = urlsplit(listing)
    require((parts.hostname == "maps.app.goo.gl" and len(parts.path.strip("/")) >= 6)
            or (parts.hostname in {"www.google.com", "maps.google.com"}
                and (parts.path.startswith("/maps/place/") or parse_qs(parts.query).get("cid"))),
            "Use the individual Google Maps listing URL.")
    copy(check, "search_query", 8, 250)
    checked = datetime.fromisoformat(copy(check, "checked_at", 16, 40).replace("Z", "+00:00"))
    require(checked.tzinfo is not None, "Website check time must include a time zone.")
    age = (now or datetime.now(timezone.utc)) - checked
    require(timedelta(0) <= age <= timedelta(days=7), "Refresh the listing and official-site checks.")


def verify_outreach(prospect, now=None):
    verify_website_absence(prospect, now)
    require((prospect.get("outreach") or {}).get("affirmative_reply") is True,
            "Publishing a prospect preview requires an affirmative reply.")


def prepare_photo(photo, asset_dir):
    require(photo.get("origin") in {"owner", "owner_listing", "licensed_illustration", "gpt_image_26_flare"}
            and photo.get("redistribution_allowed") is True,
            "Use an owner original, a licensed illustration, or a reviewed Flare image cleared for redistribution.")
    for key in ("alt", "caption", "credit"):
        copy(photo, key, 8, 180)
    source_url(photo["source"])
    if photo["origin"] == "owner_listing":
        copy(photo, "permission_record", 8, 250)
    if photo.get("license"):
        source_url(photo["license"])
    path = asset_dir / photo["file"]
    require(path.is_file() and 0 < path.stat().st_size <= 1_000_000, "Supply a reviewed JPEG under 1 MB.")
    image = path.read_bytes()
    require(image.startswith(b"\xff\xd8\xff") and all(type(photo[k]) is int and 0 < photo[k] <= 4096
            for k in ("width", "height")), "Invalid JPEG or image dimensions.")
    digest = sha256(image).hexdigest()
    if photo["origin"] == "gpt_image_26_flare":
        provenance = CATALOG["read_json"](asset_dir / photo["provenance"])
        require(provenance.get("model") == "gpt-image-2.6-flare" and provenance.get("status") == "success"
                and provenance.get("jpeg_sha256") == digest and
                re.fullmatch(r"[0-9a-f]{64}", provenance.get("reference_sha256", "")) and
                photo.get("visual_reviewed") is True and
                "illustration" in photo["caption"].casefold(),
                "Flare assets need a verified model/reference receipt and an illustration caption.")
    return {"sha256": digest, "image": base64.b64encode(image).decode(), "width": photo["width"], "height": photo["height"]}


def photo_markup(photo, asset):
    license_link = ' · ' + action(photo["license"], photo["license_label"], "credit") if photo.get("license") else ""
    return (
        f'<figure class="wv-photo"><img src="@@WV_IMAGE_{asset["sha256"]}@@" '
        f'alt="{escape(photo["alt"], quote=True)}" width="{asset["width"]}" '
        f'height="{asset["height"]}">'
        f'<figcaption>{escape(photo["caption"])} '
        f'{action(photo["source"], photo["credit"], "credit")}{license_link}</figcaption></figure>'
    )


def service_page(offering, prospect, source, indices, photo_html):
    title = escape(offering["title"])
    parent = MARK + prospect["pages"]["services"]["slug"] + "/"
    call = action("tel:" + prospect["phone"], prospect["labels"]["call"])
    index = action(parent, prospect["labels"]["services"], "secondary")
    byline = escape(prospect["name"]) + " · " + escape(prospect["address"])
    parts = [
        f'<div><h1>{title}</h1><p>{escape(offering["summary"])}</p><div class="wv-actions">{call}{index}</div></div>' + photo_html,
        f'<h2>{escape(prospect["labels"]["service_details"])}</h2><p>{escape(offering["description"])}</p>',
        f'<h2>{title}</h2><p>{byline}</p>{call}',
    ]
    roles = ["hero", "guide", "callout"]
    sections = "".join(section_html(kind, i, source[i - 1][1], body)
                       for kind, i, body in zip(roles, indices, parts, strict=True))
    return roles, wrap_sections(sections)


def section_html(kind, index, attrs, html):
    spacing = attrs.get("topPaddingDesktop", 72)
    spacing = min(112, max(32, spacing)) if type(spacing) is int else 72
    return (f'<section class="wv-section wv-{kind}" data-wv-source-section="{index}" '
            f'style="--wv-space:{spacing}px"><div class="wv-inner">{html}</div></section>')


def wrap_sections(sections):
    return ('<div class="wv-preview">' + sections + "</div>").replace("[", "&#91;").replace("]", "&#93;")


def render_page(role, page, roles, source, prospect, photo_html):
    phone = prospect["phone"]
    home = MARK
    services = home + prospect["pages"]["services"]["slug"] + "/"
    directions = "https://www.google.com/maps/search/?" + urlencode({
        "api": 1, "query": f"{prospect['name']}, {prospect['address']}"})
    labels = prospect["labels"]
    rendered = []
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
            text += photo_html
        elif kind == "services":
            cards = []
            for offering in prospect["offerings"]:
                detail = escape(copy(offering, "summary" if role == "home" else "description", 42, 560))
                link = action(services + offering["slug"] + "/", offering["title"], "service-link")
                cards.append(f'<article class="wv-card"><h3>{link}</h3><p>{detail}</p></article>')
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
        rendered.append(section_html(kind, index, attrs, text))
    return wrap_sections("".join(rendered))


def compile_site(input_path, manifest, cache, asset_dir=None, outreach=False):
    prospect = CATALOG["read_json"](input_path)
    if outreach:
        verify_outreach(prospect)
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
    require(len(prospect["sources"]) >= 2, "Supply source URLs for the business identity and services.")
    for url in prospect["sources"]:
        source_url(url)
    for key in ("services", "call", "directions", "service_details"):
        copy(prospect["labels"], key, 3, 45)
    require(set(prospect["pages"]) == set(layout["pages"]), "Brief page set differs from the reviewed template.")
    prospect["offerings"] = plan_services(prospect)
    assets = {}

    def accept_photo(photo):
        asset = prepare_photo(photo, asset_dir or input_path.parent)
        require(asset["sha256"] not in assets, "Select a distinct photo for each occupied image slot.")
        assets[asset["sha256"]] = asset
        return photo_markup(photo, asset), asset["sha256"]

    hero_photo, hero_digest = accept_photo(prospect["photo"])
    source = source_layouts(candidate, layout, cache)
    pages = []
    seen_slugs = set()
    for role, mapping in layout["pages"].items():
        page = prospect["pages"][role]
        slug = page["slug"]
        require(CATALOG["SLUG"].fullmatch(slug) and len(slug) <= 55 and slug not in seen_slugs, "Invalid or duplicate route slug.")
        seen_slugs.add(slug)
        if role == "home":
            photo_html, digest = hero_photo, hero_digest
        elif page.get("photo"):
            photo_html, digest = accept_photo(page["photo"])
        else:
            photo_html, digest = "", None
        pages.append({"role": role, "slug": slug, "title": copy(page, "title", 2, 58),
                      "route": "/" if role == "home" else f"/{slug}/",
                      "source": mapping["source"], "sections": mapping["sections"],
                      "indices": list(range(1, len(mapping["sections"]) + 1)),
                      "image_sha256": digest,
                      "html": render_page(role, page, mapping["sections"], source[role], prospect, photo_html)})
    require(len({prospect["pages"][role]["sections"]["hero"]["body"].strip().casefold()
                 for role in layout["pages"]}) == len(pages), "Hero introductions must be page-specific.")
    detail = layout["service_detail"]
    source_role, indices = detail["source_role"], detail["source_sections"]
    service_base = prospect["pages"]["services"]["slug"]
    for offering in prospect["offerings"]:
        photo_html, digest = accept_photo(offering["photo"]) if offering["photo"] else ("", None)
        roles, html = service_page(offering, prospect, source[source_role], indices, photo_html)
        pages.append({"role": "service", "slug": offering["slug"], "title": offering["title"],
                      "route": f"/{service_base}/{offering['slug']}/", "parent": "services",
                      "source": layout["pages"][source_role]["source"], "sections": roles,
                      "indices": indices, "image_sha256": digest, "html": html})
    accent = prospect.get("accent", "#e9b447")
    require(re.fullmatch(r"#[0-9a-fA-F]{6}", accent), "Accent must be a hex color.")
    css = (SCRIPTS / "wpwv-preview.css").read_text(encoding="utf-8")
    css = css.replace("@@WV_ACCENT@@", accent).replace("@@WV_BUTTON_TEXT@@", button_text(accent))
    return {"name": name, "tagline": tagline, "locale": prospect["locale"], "template": candidate,
            "phone": prospect["phone"], "footer": footer,
            "pages": pages, "css": css, "images": list(assets.values())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("prospect", type=Path)
    parser.add_argument("output", type=Path, nargs="?")
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--template-cache", type=Path)
    parser.add_argument("--asset-dir", type=Path, help="Directory for relative media paths")
    checks = parser.add_mutually_exclusive_group()
    checks.add_argument("--outreach", action="store_true", help="Require recent no-website and opt-in evidence")
    checks.add_argument("--verify-website", action="store_true", help="Check website evidence before first contact")
    args = parser.parse_args()
    if not args.verify_website and args.output is None:
        parser.error("output is required when compiling a site")
    try:
        if args.verify_website:
            verify_website_absence(CATALOG["read_json"](args.prospect))
            print("Recent listing and official-site checks record no website.")
            return
        result = compile_site(args.prospect, args.manifest, args.template_cache, args.asset_dir, args.outreach)
        args.output.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    except (OSError, KeyError, TypeError, ValueError, AttributeError) as exc:
        parser.exit(2, f"WebView brief needs review: {exc}\n")
    print(f"Selected {result['template']['slug']} revision {result['template']['revision']} for {len(result['pages'])} reviewed pages.")


if __name__ == "__main__":
    main()
