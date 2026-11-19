"""Look up WebView staging candidates against a Companion manifest snapshot."""

import argparse
import json
import re
import sys
from pathlib import Path


DATA = Path(__file__).resolve().parents[1] / "data"
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
SHA256 = re.compile(r"[0-9a-f]{64}")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def normalized(text):
    return " ".join(re.findall(r"[^\W_]+", text.casefold()))


def load_requests():
    config = read_json(DATA / "smb-template-routes.json")
    known = {}
    requests = {}

    def add(name, row, terms, outreach_tier):
        entry = {**row, "request": name, "outreach_tier": outreach_tier}
        requests[name] = entry
        for term in (name, *row.get("aliases", []), *terms):
            key = normalized(term)
            previous = known.setdefault(key, entry)
            if previous is not entry:
                raise ValueError(f"Ambiguous catalog lookup: {term}")

    for tier in read_json(DATA / "smb_niches.json")["tiers"]:
        outreach_tier = tier["tier"].split(":", 1)[0]
        for niche in tier["niches"]:
            name = niche if isinstance(niche, str) else niche["name"]
            terms = () if isinstance(niche, str) else niche.get("sample_keywords", {}).values()
            add(name, config["niches"][name], terms, outreach_tier)
    if set(requests) != set(config["niches"]):
        raise ValueError("Niche routes and the outreach niche list differ.")
    for name, row in config["other_requests"].items():
        add(name, row, (), None)
    return known, requests


def resolve_entry(slug, templates, builder="elementor"):
    entry = templates.get(slug)
    if not entry:
        return {"slug": slug, "reason": "Exact template ID is absent from the Companion manifest."}
    wxr = entry.get("file_hashes", {}).get("wxr.xml") or {}
    digest = wxr.get("sha256") or ""
    if not (
        entry.get("slug") == slug
        and entry.get("builder") == builder
        and entry.get("readiness") == "qualified"
        and entry.get("static_export_supported") is True
        and entry.get("revision")
        and type(wxr.get("size")) is int
        and wxr["size"] > 0
        and SHA256.fullmatch(digest)
    ):
        return {"slug": slug, "reason": f"A qualified {builder} static export and pinned WXR are required."}
    return {
        "slug": slug,
        "builder": builder,
        "revision": entry["revision"],
        "demo_url": entry.get("domain"),
        "wxr_bytes": wxr["size"],
        "wxr_sha256": digest,
    }


def resolve_request(row, templates, builder="elementor"):
    key = "elementor_candidates" if builder == "elementor" else "candidates"
    entries = [resolve_entry(slug, templates, builder) for slug in row.get(key, [])]
    candidates = [entry for entry in entries if "reason" not in entry]
    rejected = [entry for entry in entries if "reason" in entry]
    decision = {
        "request": row["request"],
        "status": "candidate" if candidates else "needs_review",
        "outreach_tier": row["outreach_tier"],
        "candidates": candidates,
    }
    if rejected:
        decision["rejected"] = rejected
    if row.get("note"):
        decision["note"] = row["note"]
    if not candidates:
        decision["reason"] = row.get("reason", "No configured template meets the manifest requirements.")
    return decision


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--builder", choices=("elementor", "gutenberg"), default="elementor")
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--query", help="A niche, listed market search term, or category alias")
    action.add_argument("--template-id", help="Look up an exact ID without substitution")
    action.add_argument("--audit", action="store_true", help="List all supported requests and explicit gaps")
    args = parser.parse_args()

    try:
        templates = read_json(args.manifest)["templates"]
        known, requests = load_requests()
        if args.audit:
            result = [resolve_request(row, templates, args.builder) for row in requests.values()]
        elif args.template_id is not None:
            if not SLUG.fullmatch(args.template_id):
                parser.error("Template IDs use lowercase letters, digits and single hyphens.")
            entry = resolve_entry(args.template_id, templates, args.builder)
            result = {"status": "needs_review" if "reason" in entry else "candidate", **entry}
        else:
            result = resolve_request(known.get(normalized(args.query)) or {
                "request": args.query,
                "outreach_tier": None,
                "reason": "Unknown request. Select a known niche or add a reviewed catalog route.",
            }, templates, args.builder)
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
        parser.exit(1, f"Catalog lookup failed: {exc}\n")

    print(json.dumps(result, indent=2))
    if args.audit:
        return 1 if any(row.get("rejected") for row in result) else 0
    return 0 if result["status"] == "candidate" else 2


if __name__ == "__main__":
    sys.exit(main())
