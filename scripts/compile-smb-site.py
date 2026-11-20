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
import xml.etree.ElementTree as ET
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import build_opener, HTTPRedirectHandler, Request


SCRIPTS = Path(__file__).resolve().parent
CATALOG = run_path(str(SCRIPTS / "resolve-smb-template.py"))
STORAGE = "https://storage.codev.id/templates/"
PLACEHOLDERS = re.compile(r"\b(?:lorem ipsum|dolor sit amet|a descriptive paragraph|this is a short description|TODO|TBD)\b", re.I)
ROLES_WITH_ITEMS = {"details", "guide", "questions"}
MARK = "@@WV_HOME@@"
DNS_RESOLVERS = ("https://dns.google/resolve", "https://cloudflare-dns.com/dns-query")
SERVICE_TOPICS = ("what", "why", "included", "when", "deferral", "how", "who")
SERVICE_ICONS = {"why": "fas fa-check-circle", "included": "fas fa-list-ul", "who": "fas fa-user"}


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
    requested = prospect.get("template_id")
    require(requested is None or (isinstance(requested, str) and CATALOG["SLUG"].fullmatch(requested)),
            "An explicit template ID must be a valid catalog slug.")
    builder = prospect.get("builder") or ((templates.get(requested) or {}).get("builder") if requested else None) or "elementor"
    require(builder in ("elementor", "gutenberg"), "Use Elementor or Gutenberg explicitly.")
    decision = CATALOG["resolve_request"](route, templates, builder)
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
    if candidate.get("builder") == "elementor":
        return elementor_sources(raw, layout)
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


def elementor_sources(raw, layout):
    ns = {"wp": "http://wordpress.org/export/1.2/"}
    pages = {}
    for item in ET.fromstring(raw).findall("./channel/item"):
        if item.findtext("wp:post_type", namespaces=ns) != "page":
            continue
        for meta in item.findall("wp:postmeta", ns):
            if meta.findtext("wp:meta_key", namespaces=ns) == "_elementor_data":
                pages[item.findtext("title")] = json.loads(meta.findtext("wp:meta_value", namespaces=ns))
                break
    result = {}
    for role, mapping in layout["pages"].items():
        nodes = pages.get(mapping["source"], [])
        require(len(nodes) == len(mapping["sections"])
                and all(node.get("elType") == "container" and re.fullmatch(r"[a-f0-9]{7,8}", node.get("id", ""))
                        and node.get("elements") for node in nodes),
                f"Unexpected Elementor structure on source page {mapping['source']}.")
        sections = []
        for node in nodes:
            settings = node.get("settings") or {}
            padding = settings.get("padding") or {}
            spacing = padding.get("top")
            attrs = {"topPaddingDesktop": int(float(spacing))
                     if padding.get("unit") == "px" and str(spacing).replace(".", "", 1).isdigit() else 72}
            if (settings.get("background_image") or {}).get("url"):
                attrs["background"] = {key: value for key, value in settings.items()
                                       if key.startswith(("background_position", "background_size", "background_repeat",
                                                          "background_overlay_"))}
                overlay_color = (settings.get("__globals__") or {}).get("background_overlay_color")
                if overlay_color:
                    attrs["background"]["__globals__"] = {"background_overlay_color": overlay_color}
            sections.append((node["id"], attrs))
        result[role] = sections
    for role, index in layout.get("testimonials", {}).items():
        nodes = [pages[layout["pages"][role]["source"]][index - 1]]
        while nodes and nodes[0].get("widgetType") != "testimonial":
            nodes.extend(nodes.pop(0).get("elements", []))
        require(nodes, f"The reviewed testimonial widget is missing from {role}.")
        result[role][index - 1][1]["testimonial"] = {
            key: value for key, value in nodes[0]["settings"].items()
            if key.startswith(("content_typography_", "name_typography_", "job_typography_")) or
            key in {"testimonial_alignment", "name_text_color", "content_text_color", "job_text_color"}
        }
    feature_source = layout["service_detail"]["icon_source"]
    icon_page = pages[layout["pages"][feature_source["role"]]["source"]]
    nodes = icon_page[feature_source["section"] - 1].get("elements", [])
    found_icons = 0
    while nodes:
        found_icons += sum(node.get("widgetType") == "icon-box" for node in nodes)
        nodes = [child for node in nodes for child in node.get("elements", [])]
    require(found_icons >= len(SERVICE_ICONS), "The reviewed native icon card group is missing from the demo.")
    return result


def elementor_page(source, indices, sections, features=None, background=None, proof=None):
    elements = []
    for offset, (index, section) in enumerate(zip(indices, sections, strict=True), 1):
        source_id = source[index - 1][0] if index else "visit"
        element_id = sha256(f"{source_id}:{offset}:section".encode()).hexdigest()[:7]
        widget_id = sha256(f"{source_id}:{offset}:widget".encode()).hexdigest()[:7]
        widgets = [{"id": widget_id, "elType": "widget", "widgetType": "html", "isInner": False,
                    "settings": {"html": wrap_sections(section)}, "elements": []}]
        settings = {"content_width": "full", "css_classes": "wv-elementor-section"}
        if offset == 1 and background:
            settings.update(source[index - 1][1]["background"], background_background="classic",
                            background_image={"url": f"@@WV_IMAGE_{background}@@"},
                            css_classes="wv-elementor-section wv-demo-background")
        if features and offset == features["after"]:
            elements.append({"id": element_id, "elType": "container", "isInner": False,
                             "settings": {"content_width": "full", "css_classes": "wv-elementor-section"},
                             "elements": widgets})
            element_id = sha256(f"{source_id}:{offset}:features".encode()).hexdigest()[:7]
            widgets = [{
                "id": sha256(f"{source_id}:{offset}:{topic}".encode()).hexdigest()[:7],
                "elType": "widget", "widgetType": "icon-box", "isInner": False,
                "settings": {"title_text": escape(title), "description_text": escape(body),
                             "title_size": "h3", "position": "top", "_css_classes": f"wv-native-card wv-topic-{topic}",
                             "selected_icon": {"value": icon, "library": "fa-solid"}},
                "elements": [],
            } for topic, title, body, icon in features["cards"]]
            settings["css_classes"] += " wv-native-features"
        elements.append({"id": element_id, "elType": "container", "isInner": False,
                         "settings": settings, "elements": widgets})
        if proof and offset == proof["section"]:
            native = source[index - 1][1]["testimonial"]
            items = [{"id": sha256(f"{source_id}:{i}:testimonial".encode()).hexdigest()[:7],
                      "elType": "widget", "widgetType": "testimonial", "elements": [],
                      "settings": {**native, **review, "_css_classes": "wv-native-review"}}
                     for i, review in enumerate(proof["reviews"])]
            settings.update(css_classes="wv-elementor-section wv-testimonials", html_tag="section")
            elements[-1]["elements"].append({"id": sha256(f"{source_id}:testimonials".encode()).hexdigest()[:7],
                "elType": "container", "isInner": True,
                "settings": {"content_width": "full", "css_classes": "wv-elementor-section wv-native-features"},
                "elements": items})
    return elements


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
                       "source": evidence, "photo": item.get("photo"), "detail": item.get("detail"),
                       "guidance": item.get("guidance", []), "reviewed_draft": item.get("reviewed_draft")})
    return result


def verify_website_absence(prospect, now=None):
    check = prospect.get("website_check") or {}
    place = prospect.get("place") or {}
    website_fields = ("website", "websiteUrl", "websiteUri", "website_url")
    listed_site = any(record.get(field) for record in (prospect, place) for field in website_fields) or prospect.get("website_links")
    require(prospect.get("website_state") == "absent" and "website" in prospect and prospect["website"] is None
            and not listed_site
            and check.get("listing_website_absent") is True and check.get("official_site_found") is False,
            "Outreach requires a confirmed listing without a website and an independent official-site search.")
    verify_website_review(check, now)


def google_place_url(value):
    listing = source_url(value)
    parts = urlsplit(listing)
    require((parts.hostname == "maps.app.goo.gl" and len(parts.path.strip("/")) >= 6)
            or (parts.hostname in {"www.google.com", "maps.google.com"}
                and (parts.path.startswith("/maps/place/") or parse_qs(parts.query).get("cid"))),
            "Use the individual Google Maps listing URL.")
    return listing


def verify_website_review(check, now):
    google_place_url(copy(check, "listing_url", 12, 900))
    copy(check, "search_query", 8, 250)
    checked = datetime.fromisoformat(copy(check, "checked_at", 16, 40).replace("Z", "+00:00"))
    require(checked.tzinfo is not None, "Website check time must include a time zone.")
    age = (now or datetime.now(timezone.utc)) - checked
    require(timedelta(0) <= age <= timedelta(days=7), "Refresh the listing and official-site checks.")


def official_site_host(url):
    parts = urlsplit(url)
    host = (parts.hostname or "").encode("idna").decode("ascii")
    labels = host.split(".")
    require(parts.scheme in ("https", "http") and not parts.username and not parts.password
            and parts.port in (None, 80, 443) and len(host) <= 253 and len(labels) > 1
            and labels[-1].isalpha()
            and all(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) for label in labels),
            "Supply the official public website URL.")
    return host


def check_dns_unavailable(host):
    # Only the named DNS providers are contacted. A positive or ambiguous response fails closed.
    for resolver in DNS_RESOLVERS:
        request = Request(resolver + "?" + urlencode({"name": host, "type": "A"}),
                          headers={"Accept": "application/dns-json"})
        with build_opener(NoRedirect()).open(request, timeout=6) as response:
            result = json.loads(response.read(32_768))
        require(result.get("Status") == 3 and not result.get("Answer")
                and any(str(q.get("name", "")).rstrip(".").casefold() == host and q.get("type") == 1
                        for q in result.get("Question", [])),
                "The official domain does not have confirmed NXDOMAIN evidence from both resolvers.")


def verify_website_eligibility(prospect, now=None, probe=check_dns_unavailable):
    if prospect.get("website_state") != "unavailable":
        verify_website_absence(prospect, now)
        return
    check = prospect.get("website_check") or {}
    verify_website_review(check, now)
    require(check.get("official_site_found") is True and check.get("working_replacement_found") is False,
            "Unavailable-site outreach needs a confirmed official site and an independent replacement search.")
    host = official_site_host(copy(prospect, "website", 10, 900))
    records = (prospect, prospect.get("place") or {})
    sources = prospect.get("website_links", [])
    require(isinstance(sources, list), "Review conflicting official website links.")
    aliases = [record[field] for record in records
               for field in ("websiteUrl", "websiteUri", "website_url", "website") if record.get(field)]
    for url in sources + aliases:
        other = official_site_host(url)
        require(host.removeprefix("www.") == other.removeprefix("www."),
                "Review conflicting official website links.")
    probe(host.removeprefix("www."))
    if host.startswith("www."):
        probe(host)


def verify_outreach(prospect, now=None):
    verify_website_eligibility(prospect, now)
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


def photo_markup(photo, asset, hero=False):
    license_link = ' · ' + action(photo["license"], photo["license_label"], "credit") if photo.get("license") else ""
    loading = 'fetchpriority="high"' if hero else 'loading="lazy"'
    return (
        f'<figure class="wv-photo"><img src="@@WV_IMAGE_{asset["sha256"]}@@" '
        f'alt="{escape(photo["alt"], quote=True)}" width="{asset["width"]}" '
        f'height="{asset["height"]}" {loading}>'
        f'<figcaption>{escape(photo["caption"])} '
        f'{action(photo["source"], photo["credit"], "credit")}{license_link}</figcaption></figure>'
    )


def profile_markup(prospect):
    profile = prospect.get("business_profile")
    if profile is None:
        return "", ""
    local = prospect["locale"] == "id_ID"
    categories = {
        "hours": ("Regular hours", "Jam buka"), "special_hours": ("Special hours", "Jam khusus"),
        "accessibility": ("Accessibility", "Aksesibilitas"), "offerings": ("Offerings", "Penawaran"),
        "amenities": ("Amenities", "Fasilitas"), "planning": ("Planning", "Perencanaan"),
        "payments": ("Payments", "Pembayaran"), "parking": ("Parking", "Parkir"),
    }
    listing = google_place_url(copy(profile, "listing_url", 12, 900))
    details = profile.get("details", {})
    require(isinstance(details, dict) and details.keys() <= categories.keys(), "Unknown business profile detail group.")
    facts = []
    for key, titles in categories.items():
        rows = details.get(key, [])
        require(isinstance(rows, list) and len(rows) <= 14, "Too many business profile facts in one category.")
        if not rows:
            continue
        items = []
        for row in rows:
            statement = escape(copy(row, "text", 3, 160))
            evidence = source_url(copy(row, "source", 10, 800))
            require(evidence in prospect["sources"] and row.get("confirmed_for_export") is True,
                    "Business profile facts need a listed source and export approval.")
            items.append(f'<li>{statement}</li>')
        facts.append(f'<div><h3>{titles[local]}</h3><ul>{"".join(items)}</ul></div>')
    details_title = "Informasi kunjungan" if local else "Visiting information"
    section = f'<h2>{details_title}</h2><div class="wv-grid">{"".join(facts)}</div>' if facts else ""
    maps = profile.get("map_embed_url")
    frame = ""
    if maps:
        parts = urlsplit(source_url(maps))
        query = parse_qs(parts.query)
        require(parts.netloc == "www.google.com" and parts.path == "/maps/embed" and not parts.fragment
                and set(query) == {"pb"} and len(query["pb"]) == 1 and query["pb"][0].startswith("!")
                and len(maps) <= 2048, "Use the exact Google Maps Share → Embed a map URL.")
        frame = (f'<iframe class="wv-map" src="{escape(maps, quote=True)}" title="Google Maps" '
                 'loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>')
    visit_title = "Lokasi" if local else "Location"
    footer = (f'<footer class="wv-section wv-visit" data-wv-visit><div class="wv-inner"><h2>{visit_title}</h2>'
              f'<address>{escape(prospect["address"])}</address>'
              f'<p>{action(listing, prospect["labels"]["directions"], "secondary")}</p>{frame}</div></footer>')
    return section, footer


def video_markup(video, local):
    video_id = copy(video, "youtube_id", 11, 11)
    title = copy(video, "title", 5, 100)
    require(re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id) and video.get("publisher_confirmed") is True,
            "Use a verified business-owned YouTube video with embedding enabled.")
    return (f'<figure class="wv-film"><iframe class="wv-video" src="https://www.youtube-nocookie.com/embed/{video_id}" '
            f'title="{escape(title, quote=True)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" '
            'allow="encrypted-media; picture-in-picture" allowfullscreen></iframe><figcaption>'
            f'{escape(title)} · '
            + action("https://www.youtube.com/watch?v=" + video_id, "Tonton di YouTube" if local else "Watch on YouTube", "service-link")
            + "</figcaption></figure>")


def review_content(review, local):
    source = source_url(copy(review, "source", 10, 900))
    label = copy(review, "source_label", 3, 80)
    rating = review.get("rating")
    require(type(rating) is int and 1 <= rating <= 5, "Review ratings must be whole stars from one through five.")
    text = ""
    if review.get("origin") == "public_link":
        parts = urlsplit(source)
        require((parts.netloc == "www.google.com" and parts.path.startswith("/maps/reviews/")) or
                (parts.netloc == "maps.app.goo.gl" and len(parts.path.strip("/")) >= 6),
                "Use a direct shared Google review link.")
        require(not review.get("text") and not review.get("avatar"), "Use a verified excerpt for public link cards.")
        if "excerpt" in review:
            require(review.get("excerpt_verified") is True, "Check the excerpt against the original review.")
            excerpt = copy(review, "excerpt", 8, 180).rstrip(". …")
            text = f'<blockquote cite="{escape(source, quote=True)}">{escape(excerpt)}…</blockquote>'
            label = "Baca ulasan lengkap di Google Maps" if local else "Read full review on Google Maps"
        elif "summary" in review:
            require(review.get("summary_verified") is True, "Check the summary against the original review.")
            summary_label = "Ringkasan ulasan" if local else "Review summary"
            text = f'<p><strong>{summary_label}.</strong> {escape(copy(review, "summary", 20, 240))}</p>'
    else:
        require(review.get("origin") == "first_party" and review.get("redistribution_allowed") is True,
                "Static review text needs first-party republication approval.")
        text = f'<blockquote>{escape(copy(review, "text", 15, 1100))}</blockquote>'
    return text, action(source, label, "service-link")


def review_markup(review, accept_photo, local):
    text, link = review_content(review, local)
    name = escape(copy(review, "reviewer", 2, 100))
    rating = review["rating"]
    photo, digest = accept_photo(review["avatar"]) if review.get("avatar") else ("", None)
    rating_label = f"{rating} dari 5 bintang" if local else f"{rating} out of 5 stars"
    return (f'<article class="wv-card wv-review">{photo}<h3>{name}</h3>'
            f'<p class="wv-rating" aria-label="{rating_label}"><span aria-hidden="true">'
            f'{"★" * rating}{"☆" * (5 - rating)}</span></p>'
            f'{text}<p>{link}</p></article>', digest)


def selected_reviews(config):
    reviews = config.get("reviews", [])
    require(isinstance(reviews, list) and len(reviews) <= 8, "Supply up to eight reviewed entries.")
    require(all(isinstance(review, dict) and type(review.get("rating")) is int and 1 <= review["rating"] <= 5
                and isinstance(review.get("source"), str) for review in reviews),
            "Each review needs a source and whole stars from one through five.")
    require(len({review["source"] for review in reviews}) == len(reviews), "Select distinct original reviews.")
    return sorted(reviews, key=lambda review: review["rating"], reverse=True)[:3]


def gallery_page(config, prospect, accept_photo, service_photos):
    profile = prospect.get("business_profile") or {}
    local = prospect["locale"] == "id_ID"
    listing = google_place_url(profile["listing_url"]) if profile else None
    photos = profile.get("gallery", [])
    require(isinstance(photos, list) and len(photos) <= 5, "Supply up to five reviewed gallery images.")
    require(all(photo.get("origin") in {"owner", "owner_listing"} for photo in photos),
            "Gallery photos must show the actual business and come from an owner original.")
    images = [accept_photo(photo) for photo in photos]
    if config.get("show_service_photos") is True:
        images += service_photos
    unique_images = {}
    for markup, digest in images:
        unique_images.setdefault(digest, markup)
    images = [(markup, digest) for digest, markup in unique_images.items()]
    videos = profile.get("videos")
    if videos is None:
        videos = [profile["video"]] if profile.get("video") else []
    require(isinstance(videos, list) and len(videos) <= 4, "Supply up to four approved videos.")
    reviews = selected_reviews(config)
    cards = [review_markup(review, accept_photo, local) for review in reviews]
    require(images or videos or cards or listing, "Gallery requires a verified media or review source.")
    photo_heading, video_heading, review_heading = ("Foto", "Video", "Ulasan pelanggan") if local else ("Photos", "Videos", "Customer reviews")
    call = action("tel:" + prospect["phone"], prospect["labels"]["call"])
    jumps = []
    for available, section, title in ((images or listing, "gallery", photo_heading), (videos, "videos", video_heading),
                                      (cards or listing, "reviews", review_heading)):
        if available:
            jumps.append(action(f"#gallery-{section}", title, "secondary"))
    blocks = [("hero", f'<h1>{escape(copy(config, "heading", 8, 120))}</h1>'
                       f'<p>{escape(copy(config, "intro", 42, 400))}</p>'
                       f'<div class="wv-actions">{call}{"".join(jumps)}</div>')]
    gallery_links = []
    if images or listing:
        photos_url = google_place_url(profile.get("photos_url", listing)) if listing else None
        photo_links = (action(photos_url, "Foto dan video di Google Maps" if local else "Open listing photos and videos on Google Maps", "service-link")
                       if listing else "")
        photos_html = '<div class="wv-grid wv-gallery">' + "".join(markup for markup, _ in images) + "</div>" if images else ""
        blocks.append(("gallery", f"<h2>{photo_heading}</h2>{photos_html}" + (f"<p>{photo_links}</p>" if photo_links else "")))
        if photos_url:
            gallery_links.append(photos_url)
    if videos:
        blocks.append(("videos", f"<h2>{video_heading}</h2>" + "".join(video_markup(video, local) for video in videos)))
    if listing or cards:
        verified_reviews = ('<div class="wv-grid">' + "".join(markup for markup, _ in cards) + "</div>") if cards else ""
        provider = ""
        if listing:
            review_label = "Baca ulasan di Google Maps" if local else "Read customer reviews on Google Maps"
            reviews_url = google_place_url(profile.get("reviews_url", listing))
            provider = '<p>' + action(reviews_url, review_label, "service-link") + '</p>'
            gallery_links.append(reviews_url)
        blocks.append(("reviews", f"<h2>{review_heading}</h2>{verified_reviews}{provider}"))
    gallery_links.extend(review["source"] for review in reviews)
    return blocks, [digest for _, digest in images + cards if digest], gallery_links


def service_guidance(offering, prospect):
    rows = offering.get("guidance")
    require(isinstance(rows, list) and 1 <= len(rows) <= 6,
            f"Supply technical or local guidance evidence for {offering['title']}.")
    result = []
    for row in rows:
        source = source_url(copy(row, "source", 10, 800))
        require(source in prospect["sources"], "Service guidance source is missing from the brief.")
        result.append({"source": source, "text": copy(row, "text", 45, 420)})
    return result


def service_context(prospect, offering):
    service = {key: offering[key] for key in ("title", "summary", "description", "source")}
    service["guidance"] = service_guidance(offering, prospect)
    return {"business": copy(prospect, "name", 2, 160), "locale": prospect["locale"],
            "locality": copy(prospect, "locality", 3, 100), "address": copy(prospect, "address", 5, 250),
            "offering": service}


def service_context_digest(prospect, offering):
    return sha256(json.dumps(service_context(prospect, offering), sort_keys=True).encode("utf-8")).hexdigest()


def apply_reviewed_service_draft(prospect, offering, asset_dir):
    if not offering.get("reviewed_draft"):
        return
    draft_file = asset_dir / copy(offering, "reviewed_draft", 5, 900)
    require(draft_file.is_file() and draft_file.stat().st_size <= 32_768, "Missing or oversized service draft.")
    draft = CATALOG["read_json"](draft_file)
    require(draft.get("reviewed") is True and draft.get("service_slug") == offering["slug"]
            and draft.get("context_sha256") == service_context_digest(prospect, offering),
            "Approve the assembled service draft for this exact locality and brief context.")
    offering["detail"] = draft["detail"]


def service_detail_copy(detail, title, topics=SERVICE_TOPICS, include_faq=True):
    require(isinstance(detail, dict), f"Review expanded service content for {title}.")
    answers = {key: copy(detail, key, 110, 700) for key in topics}
    require(len({text.casefold() for text in answers.values()}) == len(answers), "Each service section needs distinct copy.")
    if not include_faq:
        return answers, []
    faqs = detail.get("faq", [])
    require(isinstance(faqs, list) and 2 <= len(faqs) <= 4, "Each service needs two to four reviewed FAQs.")
    pairs = [(copy(item, "question", 10, 130), copy(item, "answer", 45, 360)) for item in faqs]
    require(len({question.casefold() for question, _ in pairs}) == len(pairs), "Service questions must be distinct.")
    return answers, pairs


def service_page(offering, prospect, source, indices, photo_html, native_cards):
    answers, pairs = service_detail_copy(offering["detail"], offering["title"])
    guidance = service_guidance(offering, prospect)
    faq_html = "".join(f'<details><summary>{escape(question)}</summary><p>{escape(answer)}</p></details>'
                       for question, answer in pairs)
    local = prospect["locale"] == "id_ID"
    title = escape(offering["title"] + (" di " if local else " in ") + prospect["locality"])
    parent = MARK + prospect["pages"]["services"]["slug"] + "/"
    call = action("tel:" + prospect["phone"], prospect["labels"]["call"])
    index = action(parent, prospect["labels"]["services"], "secondary")
    byline = escape(prospect["name"]) + " · " + escape(prospect["address"])
    headings = ("What this service is", "Why it matters", "What can be included", "When to book",
                "What happens if you wait", "How it works", "Who needs it")
    faq_title, related_title, sources_title = "Common questions", "Related services", "Technical references"
    if local:
        headings = ("Apa layanan ini", "Mengapa penting", "Apa yang dapat dicakup", "Kapan perlu memesan",
                    "Dampak menunda layanan", "Bagaimana prosesnya", "Siapa yang membutuhkannya")
        faq_title, related_title, sources_title = "Pertanyaan umum", "Layanan terkait", "Referensi teknis"
    topic_title = dict(zip(SERVICE_TOPICS, headings, strict=True))
    cards = [(topic, topic_title[topic], answers[topic], icon) for topic, icon in SERVICE_ICONS.items()]
    def topic_markup(topic, level=2):
        return (f'<div data-wv-topic="{topic}"><h{level}>{topic_title[topic]}</h{level}>'
                f'<p>{escape(answers[topic])}</p></div>')
    feature_html = "" if native_cards else '<div class="wv-grid">' + "".join(
        f'<article class="wv-card">{topic_markup(topic, 3)}</article>' for topic in SERVICE_ICONS) + '</div>'
    links = "".join(f'<li>{action(url, urlsplit(url).hostname, "service-link")}</li>'
                    for url in dict.fromkeys(row["source"] for row in guidance))
    labels = prospect["labels"]
    related = "".join(f'<li>{action(parent + sibling["slug"] + "/", sibling["title"], "service-link")}</li>'
                      for sibling in prospect["offerings"] if sibling["slug"] != offering["slug"])
    extras = f'<h3>{related_title}</h3><ul>{related}</ul>' if related else ""
    parts = [
        f'<div><h1>{title}</h1><p class="wv-service-intro">{escape(offering["summary"])}</p>'
        f'<div class="wv-actions">{call}{index}</div></div>' + photo_html,
        topic_markup("what") + feature_html,
        topic_markup("when") + '<aside class="wv-card">' + topic_markup("deferral", 3) + '</aside>',
        topic_markup("how") + f'<details class="wv-technical"><summary>{sources_title}</summary><ul>{links}</ul></details>',
        f'<h2>{faq_title}</h2><div class="wv-grid">{faq_html}</div>',
        f'<h2>{escape(labels["service_details"])}</h2><p>{byline}</p>{call}{extras}',
    ]
    roles = ["hero", "scope", "when", "process", "questions", "callout"]
    sections = [section_html(kind, i, source[i - 1][1], body)
                for kind, i, body in zip(roles, indices, parts, strict=True)]
    return roles, sections, {"after": 2, "cards": cards} if native_cards else None


def section_html(kind, index, attrs, html):
    spacing = attrs.get("topPaddingDesktop", 72)
    spacing = min(112, max(32, spacing)) if type(spacing) is int else 72
    anchor = f' id="gallery-{kind}"' if kind in {"gallery", "videos", "reviews"} else ""
    return (f'<section class="wv-section wv-{kind}" data-wv-source-section="{index}" '
            f'style="--wv-space:{spacing}px"{anchor}><div class="wv-inner">{html}</div></section>')


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
                detail = escape(copy(offering, "summary", 42, 320))
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
    return rendered


def compile_site(input_path, manifest, cache, asset_dir=None, outreach=False):
    prospect = CATALOG["read_json"](input_path)
    if outreach:
        verify_outreach(prospect)
    templates = (CATALOG["read_json"](manifest) if manifest else json.loads(fetch("manifest.json", 2_000_000)))["templates"]
    layouts = CATALOG["read_json"](CATALOG["DATA"] / "smb-template-layouts.json")
    candidate, layout = select_template(prospect, templates, layouts)
    name = copy(prospect, "name", 2, 160)
    copy(prospect, "address", 5, 250)
    prospect["locality"] = copy(prospect, "locality", 3, 100)
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

    def accept_photo(photo, hero=False):
        asset = prepare_photo(photo, asset_dir or input_path.parent)
        assets.setdefault(asset["sha256"], asset)
        return photo_markup(photo, asset, hero), asset["sha256"]

    profile_html, visit_footer = profile_markup(prospect)
    source = source_layouts(candidate, layout, cache)
    pages = []
    seen_slugs = set()
    gallery = prospect.get("gallery")
    reviews = selected_reviews(gallery or {})
    local = prospect["locale"] == "id_ID"
    proof_reviews = []
    for review in reviews:
        content, link = review_content(review, local)
        if content:
            testimonial = {
                "testimonial_name": escape(copy(review, "reviewer", 2, 100)),
                "testimonial_job": (f'{review["rating"]} dari 5 bintang' if local else f'{review["rating"]} out of 5 stars'),
                "testimonial_content": content + f'<p>{link}</p>',
                "testimonial_image": {"url": "", "id": ""},
            }
            if review.get("avatar"):
                _, digest = accept_photo(review["avatar"])
                testimonial["testimonial_image"]["url"] = f"@@WV_IMAGE_{digest}@@"
            proof_reviews.append((review["source"], testimonial))
    business_photos = []
    if outreach and layout.get("testimonials"):
        require(proof_reviews, "Client delivery needs attributed review text or verified review summaries.")

    def render(role_source, indices, sections, features=None, background=None, proof=None):
        if visit_footer:
            sections = sections + [visit_footer]
        if candidate["builder"] == "elementor":
            return {"elementor": elementor_page(role_source, indices + ([0] if visit_footer else []), sections,
                                                features, background, proof)}
        return {"html": wrap_sections("".join(sections))}

    for role, mapping in layout["pages"].items():
        page = prospect["pages"][role]
        slug = page["slug"]
        require(CATALOG["SLUG"].fullmatch(slug) and len(slug) <= 55 and slug not in seen_slugs, "Invalid or duplicate route slug.")
        seen_slugs.add(slug)
        photo = prospect.get("photo") if role == "home" else page.get("photo")
        photo_html, digest = accept_photo(photo, hero=True) if photo else ("", None)
        if role == "home" and not photo and (video := (prospect.get("business_profile") or {}).get("video")):
            photo_html = '<div class="wv-photo">' + video_markup(video, local) + '</div>'
        authentic = photo and photo.get("origin") in {"owner", "owner_listing"}
        if outreach and layout.get("testimonials") and (role == "home" or "background" in source[role][0][1]):
            require(authentic, f"Client delivery needs a cleared business hero photo for {role}.")
        if authentic:
            business_photos.append((photo_markup(photo, assets[digest]), digest))
        background = digest if authentic and "background" in source[role][0][1] else None
        if background:
            photo_html = action(photo["source"], photo["credit"], "credit")
        indices = list(range(1, len(mapping["sections"]) + 1))
        roles = list(mapping["sections"])
        sections = render_page(role, page, roles, source[role], prospect, photo_html)
        if role == "about" and profile_html:
            idx = mapping["sections"].index("guide")
            sections[idx] = sections[idx].removesuffix("</div></section>") + profile_html + "</div></section>"
        if background:
            sections[0] = sections[0].replace("wv-section wv-hero", "wv-section wv-hero wv-hero-with-background", 1)
        proof = None
        proof_index = layout.get("testimonials", {}).get(role)
        if proof_reviews and proof_index:
            position = roles.index("callout")
            title = "Ulasan pelanggan" if local else "What customers say"
            roles.insert(position, "proof")
            indices.insert(position, proof_index)
            sections.insert(position, section_html("proof", proof_index, source[role][proof_index - 1][1],
                                                   f"<h2>{title}</h2>"))
            proof = {"section": position + 1, "reviews": [item for _, item in proof_reviews]}
        pages.append({"role": role, "slug": slug, "title": copy(page, "title", 2, 58),
                      "route": "/" if role == "home" else f"/{slug}/",
                      "source": mapping["source"], "sections": roles,
                      "indices": indices, "image_sha256": None if background else digest,
                      "hero_background_sha256": background,
                      "review_links": [url for url, _ in proof_reviews] if proof else [],
                      **render(source[role], indices, sections, background=background, proof=proof)})
    require(len({prospect["pages"][role]["sections"]["hero"]["body"].strip().casefold()
                 for role in layout["pages"]}) == len(pages), "Hero introductions must be page-specific.")
    detail = layout["service_detail"]
    source_role, indices = detail["source_role"], detail["source_sections"]
    service_base = prospect["pages"]["services"]["slug"]
    for offering in prospect["offerings"]:
        apply_reviewed_service_draft(prospect, offering, asset_dir or input_path.parent)
        photo = offering["photo"]
        photo_html, digest = accept_photo(photo, hero=True) if photo else ("", None)
        authentic = photo and photo.get("origin") in {"owner", "owner_listing"}
        if authentic:
            business_photos.append((photo_markup(photo, assets[digest]), digest))
        background = digest if authentic and "background" in source[source_role][indices[0] - 1][1] else None
        if background:
            photo_html = action(photo["source"], photo["credit"], "credit")
        roles, sections, features = service_page(offering, prospect, source[source_role], indices, photo_html,
                                                 candidate["builder"] == "elementor")
        if background:
            sections[0] = sections[0].replace("wv-section wv-hero", "wv-section wv-hero wv-hero-with-background", 1)
        pages.append({"role": "service", "slug": offering["slug"], "title": offering["title"],
                      "route": f"/{service_base}/{offering['slug']}/", "parent": "services",
                      "source": layout["pages"][source_role]["source"], "sections": roles,
                      "indices": indices, "image_sha256": None if background else digest,
                      "hero_background_sha256": background,
                      **render(source[source_role], indices, sections, features, background)})
    if gallery is not None or prospect.get("business_profile") or business_photos:
        default_title = "Galeri" if local else "Gallery"
        default_intro = ("Lihat media dan sumber ulasan yang tersedia untuk bisnis ini." if local else
                         "Explore the available media and customer review sources for this business.")
        gallery = {"slug": "gallery", "title": default_title, "heading": f"{default_title} · {prospect['locality']}",
                   "intro": default_intro, "show_service_photos": True, **(gallery or {})}
        slug = copy(gallery, "slug", 1, 55)
        require(CATALOG["SLUG"].fullmatch(slug) and slug not in seen_slugs, "Gallery needs a distinct route slug.")
        blocks, digests, gallery_links = gallery_page(gallery, prospect, accept_photo, business_photos)
        if outreach and layout.get("testimonials"):
            require((prospect.get("business_profile") or {}).get("gallery") or
                    (gallery["show_service_photos"] and business_photos),
                    "Client delivery needs cleared Gallery photos of the actual business.")
        gallery_map = layout["gallery"]
        gallery_source = source[gallery_map["source_role"]]
        indices = [gallery_map["source_sections"][role] for role, _ in blocks]
        sections = [section_html(role, index, gallery_source[index - 1][1], markup)
                    for (role, markup), index in zip(blocks, indices, strict=True)]
        pages.append({"role": "gallery", "slug": slug, "title": copy(gallery, "title", 2, 58),
                      "route": f"/{slug}/", "source": layout["pages"][gallery_map["source_role"]]["source"],
                      "sections": [role for role, _ in blocks], "indices": indices, "image_sha256": None,
                      "gallery_sha256": digests, "gallery_links": gallery_links,
                      **render(gallery_source, indices, sections)})
    accent = prospect.get("accent", "#e9b447")
    require(re.fullmatch(r"#[0-9a-fA-F]{6}", accent), "Accent must be a hex color.")
    css = (SCRIPTS / "wpwv-preview.css").read_text(encoding="utf-8")
    css = css.replace("@@WV_ACCENT@@", accent).replace("@@WV_BUTTON_TEXT@@", button_text(accent))
    return {"name": name, "tagline": tagline, "locale": prospect["locale"], "template": candidate,
            "phone": prospect["phone"], "footer": footer,
            "pages": pages, "css": css, "images": list(assets.values()),
            "map_embed_url": (prospect.get("business_profile") or {}).get("map_embed_url"),
            "profile_listing": (prospect.get("business_profile") or {}).get("listing_url")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("prospect", type=Path)
    parser.add_argument("output", type=Path, nargs="?")
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--template-cache", type=Path)
    parser.add_argument("--asset-dir", type=Path, help="Directory for relative media paths")
    checks = parser.add_mutually_exclusive_group()
    checks.add_argument("--outreach", action="store_true", help="Require recent no-website and opt-in evidence")
    checks.add_argument("--verify-website", action="store_true", help="Check no-site or unavailable-site evidence before first contact")
    args = parser.parse_args()
    if not args.verify_website and args.output is None:
        parser.error("output is required when compiling a site")
    try:
        if args.verify_website:
            prospect = CATALOG["read_json"](args.prospect)
            verify_website_eligibility(prospect)
            print(f"Website qualification passed: {prospect['website_state']}.")
            return
        result = compile_site(args.prospect, args.manifest, args.template_cache, args.asset_dir, args.outreach)
        args.output.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    except (OSError, KeyError, TypeError, ValueError, AttributeError) as exc:
        parser.exit(2, f"WebView brief needs review: {exc}\n")
    print(f"Selected {result['template']['slug']} revision {result['template']['revision']} for {len(result['pages'])} reviewed pages.")


if __name__ == "__main__":
    main()
