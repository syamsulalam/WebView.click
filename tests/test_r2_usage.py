from datetime import datetime, timezone
from pathlib import Path
from runpy import run_path
import unittest


tool = run_path(str(Path(__file__).resolve().parents[1] / "scripts" / "check-r2-usage.py"))


class R2UsageTest(unittest.TestCase):
    def test_standard_allowance_excludes_other_storage_classes(self):
        def operation(action, count, storage_class="Standard"):
            return {"dimensions": {"actionType": action, "storageClass": storage_class}, "sum": {"requests": count}}

        def storage(day, size, storage_class="Standard"):
            return {"dimensions": {"date": day, "storageClass": storage_class},
                    "max": {"payloadSize": size, "metadataSize": 0}}

        data = {"operations": [
            operation("PutObject", 32), operation("GetObject", 40), operation("DeleteObjects", 5),
            operation("GetObject", 9, "InfrequentAccess"), operation("UnmappedAction", 3),
        ], "storage": [
            storage("2026-11-01", 3_000_000_000), storage("2026-11-01", 900_000_000),
            storage("2026-11-02", 900_000_000, "InfrequentAccess"),
        ]}
        start = datetime(2026, 11, 1, tzinfo=timezone.utc)
        end = datetime(2026, 11, 3, tzinfo=timezone.utc)
        report = tool["summarize"](data, start, end)
        self.assertEqual(report["standard_estimate"], {"storage_gb_month": 0.13, "class_a": 32, "class_b": 40})
        self.assertEqual(report["estimated_remaining"]["class_b"], 9_999_960)
        self.assertEqual(report["storage_completed_utc_days_observed"], 1)
        self.assertEqual(report["storage_completed_utc_days_in_window"], 2)
        self.assertEqual(report["non_standard_requests"], 9)
        self.assertEqual(report["unclassified_standard_operations"], {"UnmappedAction": 3})
        with self.assertRaisesRegex(ValueError, "query limit"):
            tool["summarize"]({**data, "storage": [{}] * tool["LIMIT"]}, start, end)
