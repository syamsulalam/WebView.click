#!/usr/bin/env bash
# Sent through Invoke-OracleSsh.ps1 after the compiled site and writer are uploaded.
set -euo pipefail
umask 077
cd /tmp
run_id=$1
slug=$2
[[ "$run_id" =~ ^[0-9a-f]{32}$ && "$slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ && ${#slug} -le 63 ]]
transfer=/tmp/webview-$run_id
[[ -d "$transfer" && ! -L "$transfer" ]]
for input in "$transfer/input.json" "$transfer/wpwv-generate.php"; do
    [[ -f "$input" && ! -L "$input" ]]
done
sudo -n chgrp -- codev-wpwv "$transfer" "$transfer/input.json" "$transfer/wpwv-generate.php"
chmod 0710 "$transfer"
chmod 0640 "$transfer/input.json" "$transfer/wpwv-generate.php"

sudo -n systemd-run --quiet --pipe --wait --collect --unit="webview-build-$run_id" \
    --description="WebView static build $run_id" \
    --uid=codev-wpwv --slice=codev-workers.slice --working-directory=/tmp \
    --property=Type=exec --property=CPUQuota=100% --property=MemoryMax=512M \
    --property=TasksMax=32 --property=RuntimeMaxSec=285s --property=TimeoutStopSec=5s \
    --property=KillMode=control-group --property=OOMPolicy=kill --property=NoNewPrivileges=yes \
    /usr/bin/flock -n /home/codev-wpwv/tmp/webview-static-export.lock \
    /usr/bin/bash -s "$slug" "$transfer" >"$transfer/site.zip" <<'BASH'
set -euo pipefail
umask 077
exec 3>&1 1>&2
site=/home/codev-wpwv/htdocs/wpwv.codev.id
output=/home/codev-wpwv/static-export
slug=$1
transfer=$2
cd "$site"

wpv() { timeout --kill-after=3s 20s wp --path="$site" --url=https://wpwv.codev.id --quiet "$@"; }
wpv eval '
$p = \Simply_Static\Plugin::instance();
$o = \Simply_Static\Options::instance();
if (home_url("/") !== "https://wpwv.codev.id/" ||
    !$p->get_archive_creation_job()->is_job_done() ||
    wp_next_scheduled("wp_archive_creation_job_cron") ||
    $o->get("delivery_method") !== "local" ||
    rtrim($o->get("local_dir"), "/") !== "/home/codev-wpwv/static-export") {
    WP_CLI::error("Unexpected staging target, export configuration, or active export.");
}'

work=$(mktemp -d /home/codev-wpwv/tmp/webview-build.XXXXXXXX)
trap 'rm -rf -- "$work"' EXIT
timeout --kill-after=5s 115s wp --path="$site" --url=https://wpwv.codev.id eval-file "$transfer/wpwv-generate.php" "$transfer/input.json"
wpv eval '
foreach (get_posts(["post_type"=>"page","post_status"=>"publish","numberposts"=>-1]) as $p) {
    echo wp_parse_url(get_permalink($p), PHP_URL_PATH), PHP_EOL;
}' >"$work/routes"

# Use an empty destination so deleted pages and assets cannot carry into this ZIP.
if [[ -e "$output" ]]; then
    [[ -d "$output" && ! -L "$output" ]]
    mv -- "$output" "$work/previous-export"
fi
mkdir -- "$output"
export WEBVIEW_PREFIX="/$slug" WEBVIEW_ROUTES="$work/routes" WEBVIEW_EXPORT_ID="$work/export-id"
timeout --kill-after=5s 150s wp --path="$site" --url=https://wpwv.codev.id --quiet eval '
$p = \Simply_Static\Plugin::instance();
$o = \Simply_Static\Options::instance();
if (!$p->get_archive_creation_job()->is_job_done() || wp_next_scheduled("wp_archive_creation_job_cron")) {
    WP_CLI::error("Another Simply Static export or recovery event is active.");
}
$routes = file(getenv("WEBVIEW_ROUTES"), FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$urls = array_map(static fn($path) => home_url($path), $routes);
$o->set("destination_url_type", "relative")
  ->set("relative_path", getenv("WEBVIEW_PREFIX"))
  ->set("crawlers", [])
  ->set("additional_urls", implode("\n", $urls))
  ->save();
// Smart Crawl can enable a full wp-includes scan even with an empty crawlers option.
// Seeded pages and the asset packager already cover the required files.
add_filter("simply_static_crawlers", "__return_empty_array", PHP_INT_MAX);
// Keep all export batches in this PHP process, including shutdown continuations.
add_filter("wp_archive_creation_job_loopback_available", "__return_false", PHP_INT_MAX);
add_filter("pre_schedule_event", static fn($value, $event) =>
    $event->hook === "wp_archive_creation_job_cron" ? false : $value, PHP_INT_MAX, 2);
if (!$p->run_static_export()) {
    WP_CLI::error("Simply Static Free could not start the export.");
}
// Inline shutdown can discard PHP output buffers. Persist the ID before shutdown.
$id = $o->get("archive_deploy_id");
if (!is_string($id) || file_put_contents(getenv("WEBVIEW_EXPORT_ID"), $id) !== strlen($id)) {
    WP_CLI::error("Could not record the Simply Static export ID.");
}'
export_id=$(<"$WEBVIEW_EXPORT_ID")
[[ "$export_id" =~ ^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$ ]] || { echo 'Missing Simply Static export ID'; exit 1; }
state=$(wpv eval '
$o = \Simply_Static\Options::instance();
$messages = (array) $o->get("archive_status_messages");
echo $o->get("archive_deploy_id"), "|",
     ($o->get("archive_end_time") && isset($messages["done"]) &&
      !wp_next_scheduled("wp_archive_creation_job_cron")) ? "done" : "failed";')
[[ "$state" == "$export_id|done" ]] || { echo "Simply Static export $export_id failed or was replaced."; exit 1; }

python3 - "$output" "$work/routes" "$work/package" "$transfer/input.json" <<'PY'
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError
from urllib.parse import quote, unquote, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, build_opener
import xml.etree.ElementTree as ET

root, routes, package, receipt = map(Path, sys.argv[1:])
contract = json.loads(receipt.read_text(encoding="utf-8"))
expected = {p["route"]: p for p in contract["pages"]}
prefix = os.environ["WEBVIEW_PREFIX"] + "/"
gallery_route = next((p["route"] for p in contract["pages"] if p["role"] == "gallery"), None)
origin = "https://wpwv.codev.id"
extensions = set("css js png jpg jpeg webp avif gif svg ico woff woff2 ttf otf eot mp4 webm".split())
css_urls = re.compile(r"""url\(\s*(['"]?)([^'")]+)\1\s*\)""", re.I)
assets = set()
elementor_unneeded_runtime = re.compile(
    r'<script\b(?=[^>]*\sid=["\']elementor-(?:webpack-runtime|frontend-modules|frontend)-js(?:-before)?["\'])[^>]*>.*?</script>',
    re.I | re.S,
)

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

http = build_opener(NoRedirect())

def fetch_asset(reference, base):
    if reference.startswith("#"):
        return reference
    url = urlsplit(urljoin(base, reference))
    if url.scheme != "https" or url.netloc != "wpwv.codev.id":
        return reference
    raw = url.path.removeprefix(prefix) if url.path.startswith(prefix) else url.path.lstrip("/")
    path = Path(unquote(raw))
    extension = path.suffix[1:].lower()
    if not raw or not path.parts or path.parts[0] not in ("wp-content", "wp-includes"):
        raise SystemExit(f"Unexpected local asset route: {url.path}")
    if (extension not in extensions or any(part.startswith(".") for part in path.parts)
            or not re.fullmatch(r"[a-zA-Z0-9_./%-]+", str(path)) or "%" in str(path)):
        raise SystemExit(f"Unexpected local asset name: {url.path}")
    static_url = prefix + raw
    if url.query:
        static_url += "?" + url.query
    if url.fragment:
        static_url += "#" + url.fragment
    if path in assets:
        return static_url
    if len(assets) >= 300:
        raise SystemExit("The export exceeds the static asset limit.")
    assets.add(path)
    source = root / path
    if source.is_file() and source.resolve().is_relative_to(root):
        data = source.read_bytes()
    else:
        # Shared core/themes/plugins are symlinked. Use the public HTTP route
        # for missed static assets without changing Simply Static's path guard.
        try:
            with http.open(origin + "/" + quote(str(path), safe="/"), timeout=6) as response:
                if response.headers.get_content_type() in ("text/html", "application/json"):
                    raise SystemExit(f"Wrong content type for {path}")
                data = response.read(12 * 1024 * 1024 + 1)
        except HTTPError as exc:
            raise SystemExit(f"Cannot fetch required asset {path}: HTTP {exc.code}")
    if not data or len(data) > 12 * 1024 * 1024:
        raise SystemExit(f"Invalid static asset size: {path}")
    destination = package / path
    destination.parent.mkdir(parents=True, exist_ok=True)
    if extension == "css":
        css_base = origin + "/" + str(path)
        css = css_urls.sub(lambda m: "url(" + m[1] + fetch_asset(m[2].strip(), css_base) + m[1] + ")",
                           data.decode("utf-8-sig"))
        data = css.encode("utf-8")
    destination.write_bytes(data)
    return static_url

class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.base = origin + path
        self.emoji = False
        self.sections = []
        self.links = set()
        self.images = set()
        self.frames = set()
        self.topics = set()
        self.is_elementor = False
        self.visit_footer = False

    def handle_starttag(self, tag, attrs):
        fields = dict(attrs)
        classes = fields.get("class", "").split()
        if "elementor" in classes and fields.get("data-elementor-type") == "wp-page":
            self.is_elementor = True
        if fields.get("data-wv-topic"):
            self.topics.add(fields["data-wv-topic"])
        self.topics.update(value.removeprefix("wv-topic-") for value in classes if value.startswith("wv-topic-"))
        if tag == "footer" and "data-wv-visit" in fields:
            self.visit_footer = True
        if tag == "iframe" and fields.get("src"):
            self.frames.add(fields["src"])
        if tag == "section" and fields.get("data-wv-source-section"):
            self.sections.append((fields["data-wv-source-section"], fields.get("class", "").split()))
        if tag == "a" and fields.get("href"):
            self.links.add(fields["href"])
        if tag == "img" and fields.get("src"):
            self.images.add(urlsplit(fields["src"]).path)
        if tag == "script":
            self.emoji = fields.get("id") == "wp-emoji-settings"
        asset = fields.get("src") if tag in ("script", "img", "source", "video") else None
        if tag == "link" and fields.get("rel") in ("stylesheet", "icon", "apple-touch-icon"):
            asset = fields.get("href")
        if asset:
            self.asset(asset)
        if tag in ("img", "source") and fields.get("srcset") and not fields["srcset"].startswith("data:"):
            for variant in fields["srcset"].split(","):
                if variant.strip():
                    self.asset(variant.split()[0])

    def handle_data(self, data):
        if self.emoji and data.strip():
            for reference in json.loads(data).get("source", {}).values():
                self.asset(reference)

    def handle_endtag(self, tag):
        if tag == "script":
            self.emoji = False

    def asset(self, reference):
        url = urlsplit(reference)
        if url.netloc == "wpwv.codev.id" or (not url.netloc and url.path.startswith("/") and not url.path.startswith(prefix)):
            raise SystemExit(f"Asset missing WebView prefix: {url.path}")
        fetch_asset(reference, self.base)

paths = routes.read_text().splitlines()
if len(paths) != len(expected) or set(paths) != set(expected):
    raise SystemExit("Export routes differ from the reviewed build contract.")
for path in paths:
    if not path.startswith("/") or ".." in Path(path).parts:
        raise SystemExit("Invalid WordPress page route.")
    route = Path(unquote(path.strip("/")))
    if route.is_absolute() or ".." in route.parts:
        raise SystemExit("Invalid decoded WordPress page route.")
    page = root / route / "index.html"
    if not page.is_file() or not page.stat().st_size:
        raise SystemExit(f"Missing static page: {path}")
    html = page.read_text(encoding="utf-8")
    if contract["template"]["builder"] == "elementor":
        # These widgets render on the server and use only Elementor CSS.
        if any(widget.get("widgetType") not in {"html", "icon-box", "testimonial"} for container in expected[path]["elementor"]
               for widget in container["elements"]):
            raise SystemExit(f"Review frontend dependencies for additional Elementor widgets on {path}")
        html = elementor_unneeded_runtime.sub("", html)
    parsed = Page(path)
    parsed.feed(html)
    if contract["template"]["builder"] == "elementor" and not parsed.is_elementor:
        raise SystemExit(f"Missing Elementor frontend on {path}")
    if contract.get("profile_listing") and (not parsed.visit_footer or contract["profile_listing"] not in parsed.links):
        raise SystemExit(f"Missing exact business listing and visit footer on {path}")
    if contract.get("map_embed_url") and contract["map_embed_url"] not in parsed.frames:
        raise SystemExit(f"Missing Google Maps embed on {path}")
    roles = expected[path]["sections"]
    if len(parsed.sections) != len(roles) or any(
            number != str(index) or "wv-" + role not in classes
            for (number, classes), role, index in zip(parsed.sections, roles, expected[path]["indices"])):
        raise SystemExit(f"Export sections differ from the reviewed template on {path}")
    if "tel:" + contract["phone"] not in parsed.links:
        raise SystemExit(f"Missing verified contact action on {path}")
    if gallery_route and prefix.rstrip("/") + gallery_route not in parsed.links:
        raise SystemExit(f"Missing Gallery navigation on {path}")
    if expected[path]["role"] == "service" and parsed.topics != {"what", "why", "included", "when", "deferral", "how", "who"}:
        raise SystemExit(f"Missing service topic or icon widget on {path}")
    if not set(expected[path].get("gallery_links", [])).issubset(parsed.links):
        raise SystemExit(f"Missing source links on {path}")
    if not set(expected[path].get("review_links", [])).issubset(parsed.links):
        raise SystemExit(f"Missing testimonial sources on {path}")
    background = expected[path].get("hero_background_sha256")
    if background and not any(asset.name == f"{background}.jpg" for asset in assets):
        raise SystemExit(f"Missing demo hero background asset on {path}")
    digests = [expected[path]["image_sha256"]] + expected[path].get("gallery_sha256", [])
    if any(digest and not any(image.endswith("/" + digest + ".jpg") for image in parsed.images) for digest in digests):
        raise SystemExit(f"The exported page is missing its reviewed image: {path}")
    if expected[path]["role"] in ("home", "services"):
        for service, data in expected.items():
            if data["role"] == "service" and prefix.rstrip("/") + service not in parsed.links:
                raise SystemExit(f"Missing service link on {path}: {service}")
    if prefix not in html:
        raise SystemExit(f"Missing WebView URL prefix in {path}")
    destination = package / route / "index.html"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(html, encoding="utf-8")
sitemap = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
for path in expected:
    ET.SubElement(ET.SubElement(sitemap, "url"), "loc").text = "https://sites.webview.click" + prefix.rstrip("/") + path
ET.ElementTree(sitemap).write(package / "sitemap.xml", encoding="utf-8", xml_declaration=True)
print(f"Verified {len(paths)} exported pages and {len(assets)} referenced local assets.")
PY
cd "$work/package"
zip -q -r - . >&3
echo "Packaged Simply Static export $export_id"
BASH

unzip -tq "$transfer/site.zip" >/dev/null
