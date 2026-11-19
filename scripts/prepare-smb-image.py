"""Prepare one reference-guided GPT-Image-2.6 Flare illustration for WebView."""

import argparse
import base64
from hashlib import sha256
import json
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener


MODEL = "gpt-image-2.6-flare"
ENDPOINT = "https://api.openai.com/v1/images/edits"
KEY = "OPENAI_WEBVIEW_ILLUSTRATION_API_KEY"
LIMIT = 1_000_000


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def make_request(source, subject, style):
    prompt = (
        f"Create one realistic editorial illustration for a website about {subject}. "
        f"Use Image 1 as a photography style reference: {style}. "
        "Carry over lighting, color temperature, lens feel, framing, and contrast. "
        "Create a distinct generic scene. Do not copy identifiable people, premises, signage, logos, "
        "license plates or vehicles from the reference or add any text. Do not imply that this depicts "
        "the business, its equipment, or a customer's job."
    )
    return {
        "model": MODEL,
        "images": [{"image_url": "data:image/jpeg;base64," + base64.b64encode(source).decode("ascii")}],
        "prompt": prompt,
        "size": "1536x1024",
        "quality": "medium",
        "output_format": "jpeg",
        "output_compression": 82,
        "n": 1,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--reference-rights-confirmed", action="store_true")
    parser.add_argument("--subject", required=True)
    parser.add_argument("--style", required=True)
    parser.add_argument("--job-dir", type=Path, required=True, help="New path for one immutable image attempt")
    parser.add_argument("--execute", action="store_true", help="Make one billed API call")
    args = parser.parse_args()
    if not args.reference_rights_confirmed or not args.reference.is_file():
        parser.error("Supply a reference JPEG cleared for processing.")
    if not 0 < args.reference.stat().st_size <= LIMIT or args.job_dir.exists():
        parser.error("Use a reference JPEG under 1 MB and a fresh job directory.")
    if not all(5 <= len(value.strip()) <= 500 for value in (args.subject, args.style)):
        parser.error("Supply a bounded subject and photography brief.")
    reference = args.reference.read_bytes()
    if not reference.startswith(b"\xff\xd8\xff"):
        parser.error("The reference must be a JPEG.")
    body = make_request(reference, args.subject, args.style)
    result = {"model": MODEL, "reference_sha256": sha256(reference).hexdigest(),
              "prompt_sha256": sha256(body["prompt"].encode()).hexdigest(),
              "size": body["size"], "quality": body["quality"], "endpoint": ENDPOINT}
    if not args.execute:
        print(json.dumps({**result, "status": "dry_run"}))
        return
    key = os.environ.get(KEY, "")
    if not key.startswith("sk-"):
        parser.error(f"{KEY} must be supplied by the WebView API project's secret store.")

    args.job_dir.mkdir(mode=0o700)
    status = 0
    try:
        request = Request(ENDPOINT, data=json.dumps(body).encode(), headers={
            "Authorization": "Bearer " + key, "Content-Type": "application/json",
        })
        with build_opener(NoRedirect()).open(request, timeout=150) as response:
            result["request_id"] = response.headers.get("x-request-id")
            payload = json.loads(response.read(2 * LIMIT))
        image = base64.b64decode(payload["data"][0]["b64_json"], validate=True)
        if not image.startswith(b"\xff\xd8\xff") or len(image) > LIMIT:
            raise ValueError("Provider output exceeds the JPEG export contract.")
        if payload.get("model", MODEL) != MODEL:
            raise ValueError("Provider reported a different model.")
        (args.job_dir / "illustration.jpg").write_bytes(image)
        result.update(status="success", jpeg_sha256=sha256(image).hexdigest(), bytes=len(image))
    except (OSError, ValueError, KeyError, IndexError, TypeError) as exc:
        result.update(status="failed", error=type(exc).__name__)
        if isinstance(exc, HTTPError):
            result["http_status"] = exc.code
            exc.close()
        status = 1
    (args.job_dir / "receipt.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))
    return status


if __name__ == "__main__":
    raise SystemExit(main())
