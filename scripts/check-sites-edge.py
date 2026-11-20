"""Verify the public WebView publishing fixture or compare a published site to its export."""

import argparse
import concurrent.futures
import io
from pathlib import Path
import re
import urllib.error
import urllib.request
import zipfile

HOST = "https://sites.webview.click"
SLUG = "webview-publishing-check-20261119"
PREFIX = f"/{SLUG}/"
PREVIEW_STYLE = re.compile(rb'<style id="webview-download-style">.*?</style>', re.S)
PREVIEW_DOWNLOAD = re.compile(rb'<a id="webview-download"[^>]*>.*?</a>', re.S)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def get(path, method="GET"):
    request = urllib.request.Request(HOST + path, method=method, headers={"User-Agent": "WebView deploy verification"})
    try:
        response = urllib.request.build_opener(NoRedirect()).open(request, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.headers, response.read()


def main():
    checks = {
        "/": 302,
        PREFIX.rstrip("/"): 308,
        PREFIX: 200,
        PREFIX + "site.css": 200,
        PREFIX + "about/": 200,
        PREFIX + "download": 200,
        "/webview-absent-20261119/": 404,
    }
    with concurrent.futures.ThreadPoolExecutor() as pool:
        responses = dict(zip(checks, pool.map(get, checks)))
    statuses = {url: result[0] for url, result in responses.items()}
    assert statuses == checks, statuses
    assert responses["/"][1]["Location"].rstrip("/") == "https://webview.click"
    assert responses[PREFIX.rstrip("/")][1]["Location"] == HOST + PREFIX
    assert responses[PREFIX + "site.css"][1].get_content_type() == "text/css"
    for url in (PREFIX, PREFIX + "about/"):
        html = responses[url][2]
        assert html.count(b'id="webview-download"') == 1
        assert f'href="{PREFIX}download"'.encode() in html
        assert b'aria-hidden="true"' in html and b'Download ZIP</a>' in html
        html_status, html_headers, html_body = get(url, "HEAD")
        assert html_status == 200 and not html_body and "ETag" not in html_headers
    status, headers, body = get(PREFIX + "download", "HEAD")
    assert status == 200 and not body and headers.get_content_type() == "application/zip"
    _, headers, data = responses[PREFIX + "download"]
    assert headers.get_content_type() == "application/zip"
    assert headers["Content-Disposition"] == f'attachment; filename="{SLUG}.zip"'
    files = {"index.html": PREFIX, "site.css": PREFIX + "site.css", "about/index.html": PREFIX + "about/"}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        assert archive.testzip() is None and set(archive.namelist()) == files.keys()
        for name, url in files.items():
            preview = responses[url][2]
            if name.endswith(".html"):
                preview = PREVIEW_DOWNLOAD.sub(b"", PREVIEW_STYLE.sub(b"", preview, count=1), count=1)
            assert archive.read(name) == preview, name
    print(f"Verified the live WebView preview, redirects, 404 and ZIP ({len(data)} bytes).")


def verify_published(folder, slug):
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug) or len(slug) > 63:
        raise ValueError("Invalid site name.")
    prefix = f"/{slug}/"
    files = {path.relative_to(folder).as_posix(): path for path in folder.rglob("*") if path.is_file()}
    status, headers, body = get(prefix + "download")
    if status != 200 or headers.get_content_type() != "application/zip":
        raise ValueError("The published ZIP is unavailable.")
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        if len(archive.namelist()) != len(files) or set(archive.namelist()) != files.keys():
            raise ValueError("The published ZIP file set differs from the export.")
        for name, path in files.items():
            if archive.read(name) != path.read_bytes():
                raise ValueError(f"Published ZIP bytes differ for {name}.")

    def check(item):
        name, path = item
        route = prefix + (name.removesuffix("index.html") if path.name == "index.html" else name)
        code, headers, data = get(route)
        if code != 200:
            raise ValueError(f"Published GET {route} returned {code}.")
        if name.endswith(".html"):
            if (headers.get_content_type() != "text/html" or data.count(b'id="webview-download"') != 1 or
                    f'href="{prefix}download"'.encode() not in data):
                raise ValueError(f"Published page or download link is invalid for {route}.")
            data = PREVIEW_DOWNLOAD.sub(b"", PREVIEW_STYLE.sub(b"", data, count=1), count=1)
        elif name.endswith(".css") and headers.get_content_type() != "text/css":
            raise ValueError(f"Published stylesheet has the wrong content type: {route}.")
        if data != path.read_bytes():
            raise ValueError(f"Preview bytes differ for {route}.")

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for _ in pool.map(check, files.items()):
            pass
    print(f"Verified {len(files)} live files and matching ZIP at {HOST}{prefix}")


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--export", type=Path)
    cli.add_argument("--slug")
    args = cli.parse_args()
    if bool(args.export) != bool(args.slug):
        cli.error("Supply --export and --slug together.")
    if args.export:
        try:
            verify_published(args.export, args.slug)
        except (OSError, ValueError, zipfile.BadZipFile) as exc:
            cli.exit(2, f"Published site verification failed: {exc}\n")
    else:
        main()
