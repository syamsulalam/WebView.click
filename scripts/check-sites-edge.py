"""Verify the public WebView publishing fixture and its ZIP."""

import concurrent.futures
import io
import urllib.error
import urllib.request
import zipfile

HOST = "https://sites.webview.click"
SLUG = "webview-publishing-check-20261119"
PREFIX = f"/{SLUG}/"


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
    status, headers, body = get(PREFIX + "download", "HEAD")
    assert status == 200 and not body and headers.get_content_type() == "application/zip"
    _, headers, data = responses[PREFIX + "download"]
    assert headers.get_content_type() == "application/zip"
    assert headers["Content-Disposition"] == f'attachment; filename="{SLUG}.zip"'
    files = {"index.html": PREFIX, "site.css": PREFIX + "site.css", "about/index.html": PREFIX + "about/"}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        assert archive.testzip() is None and set(archive.namelist()) == files.keys()
        for name, url in files.items():
            assert archive.read(name) == responses[url][2], name
    print(f"Verified the live WebView preview, redirects, 404 and ZIP ({len(data)} bytes).")


if __name__ == "__main__":
    main()
