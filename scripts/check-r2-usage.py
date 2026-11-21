"""Read month-to-date R2 free-tier estimates from Cloudflare Analytics."""

import argparse
from collections import Counter
from datetime import date, datetime, timezone
import json
import os
from pathlib import Path
import re
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener


ACCOUNT = "5076c806dec2b4df072e537f1a09500c"
LIMIT = 10_000
ALLOWANCE = {"storage_gb_month": 10, "class_a": 1_000_000, "class_b": 10_000_000}
CLASS_A = set("""ListBuckets PutBucket ListObjects PutObject CopyObject CompleteMultipartUpload
CreateMultipartUpload LifecycleStorageTierTransition ListMultipartUploads UploadPart UploadPartCopy
ListParts PutBucketEncryption PutBucketCors PutBucketLifecycleConfiguration""".split())
CLASS_B = set("""HeadBucket HeadObject GetObject UsageSummary GetBucketEncryption GetBucketLocation
GetBucketCors GetBucketLifecycleConfiguration""".split())
FREE = set("DeleteObject DeleteObjects DeleteBucket AbortMultipartUpload".split())
QUERY = """
query R2FreeTier($account: string!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: {accountTag: $account}) {
      operations: r2OperationsAdaptiveGroups(limit: 10000, filter: {datetime_geq: $start, datetime_lt: $end}) {
        sum { requests }
        dimensions { actionType storageClass }
      }
      storage: r2StorageAdaptiveGroups(limit: 10000, filter: {datetime_geq: $start, datetime_lt: $end}) {
        max { payloadSize metadataSize }
        dimensions { date bucketName storageClass }
      }
    }
  }
}
"""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def summarize(data, start, end):
    operations, storage = data["operations"], data["storage"]
    if max(len(operations), len(storage)) >= LIMIT:
        raise ValueError("Cloudflare returned the query limit. A shorter reporting window is required.")

    counts = Counter()
    unknown = Counter()
    for row in operations:
        dims = row["dimensions"]
        action = dims["actionType"]
        count = row["sum"]["requests"]
        if dims["storageClass"] != "Standard":
            counts["non_standard_requests"] += count
        elif action in CLASS_A:
            counts["class_a"] += count
        elif action in CLASS_B:
            counts["class_b"] += count
        elif action not in FREE:
            unknown[action] += count

    daily = Counter()
    non_standard = Counter()
    for row in storage:
        day = date.fromisoformat(row["dimensions"]["date"])
        size = row["max"]["payloadSize"] + row["max"]["metadataSize"]
        target = daily if row["dimensions"]["storageClass"] == "Standard" else non_standard
        target[day] += size
    used = {
        "storage_gb_month": sum(daily.values()) / (30 * 10**9),
        "class_a": counts["class_a"],
        "class_b": counts["class_b"],
    }
    latest = max(daily, default=None)
    expected_days = (end.date() - start.date()).days
    completed_samples = sum(start.date() <= day < end.date() for day in daily)
    return {
        "source": "Cloudflare GraphQL Analytics estimate, not invoice data",
        "utc_from": start.isoformat(), "utc_to": end.isoformat(),
        "standard_estimate": used,
        "standard_monthly_allowance": ALLOWANCE,
        "estimated_remaining": {key: max(0, cap - used[key]) for key, cap in ALLOWANCE.items()},
        "storage_completed_utc_days_observed": completed_samples,
        "storage_completed_utc_days_in_window": expected_days,
        "latest_standard_storage_day": latest.isoformat() if latest else None,
        "latest_standard_daily_peak_bytes": daily[latest] if latest else None,
        "non_standard_observed_gb_month": sum(non_standard.values()) / (30 * 10**9),
        "non_standard_requests": counts["non_standard_requests"],
        "unclassified_standard_operations": dict(sorted(unknown.items())),
        "dashboard": "https://dash.cloudflare.com/?to=/:account/billing/billable-usage",
    }


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--profile", default="webview", help="Existing cf CLI OAuth profile")
    cli.add_argument("--account", default=ACCOUNT, help="Cloudflare account ID")
    args = cli.parse_args()
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]*", args.profile) or not re.fullmatch(r"[a-f0-9]{32}", args.account):
        cli.error("Supply a valid cf profile name and 32-character account ID.")
    config = (Path(os.environ["APPDATA"]) / "xdg.config" if os.environ.get("APPDATA")
              else Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")))
    profile = config / "cloudflare" / "config" / (args.profile + ".json")
    end = datetime.now(timezone.utc).replace(microsecond=0)
    start = end.replace(day=1, hour=0, minute=0, second=0)
    try:
        auth = json.loads(profile.read_text(encoding="utf-8-sig"))
        token = auth["oauth_token"]
        if not isinstance(token, str) or not token:
            raise ValueError("Missing cf OAuth session.")
        variables = {"account": args.account, "start": start.isoformat(), "end": end.isoformat()}
        req = Request("https://api.cloudflare.com/client/v4/graphql",
                      data=json.dumps({"query": QUERY, "variables": variables}).encode(),
                      headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        with build_opener(NoRedirect()).open(req, timeout=20) as response:
            result = json.load(response)
        if result.get("errors") or len(accounts := result["data"]["viewer"]["accounts"]) != 1:
            cli.exit(1, "R2 analytics unavailable. Check the cf profile's account and analytics access.\n")
        print(json.dumps({"account": args.account, "profile": args.profile,
                          **summarize(accounts[0], start, end)}, indent=2))
    except HTTPError as error:
        cli.exit(1, f"R2 analytics returned HTTP {error.code}. Check cf profile login and account access.\n")
    except (OSError, KeyError, TypeError, ValueError):
        cli.exit(1, "Could not read a complete R2 report. Check the cf profile and Cloudflare Analytics.\n")


if __name__ == "__main__":
    main()
