"""Contract, poison, and installed-layout tests for API Handler Tests workflow."""
from __future__ import annotations

import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml


HERE = pathlib.Path(__file__).resolve()
SOURCE_ROOT = HERE.parents[1]
CANONICAL = SOURCE_ROOT / "canonical" / "api-handler-tests.yml"
INSTALLED = HERE.parents[1] / "workflows" / "api-handlers-tests.yml"
WORKFLOW = CANONICAL if CANONICAL.is_file() else INSTALLED
PINS = {
    "actions/checkout": "11d5960a326750d5838078e36cf38b85af677262",
    "pnpm/action-setup": "f40ffcd9367d9f12939873eb1018b921a783ffaa",
    "actions/setup-node": "49933ea5288caeca8642d1e84afbd3f7d6820020",
}


def _document(text: str) -> dict:
    parsed = yaml.safe_load(text)
    if not isinstance(parsed, dict):
        raise AssertionError("workflow must be a mapping")
    return parsed


def validate(text: str) -> None:
    doc = _document(text)
    trigger = doc.get("on", doc.get(True))
    if doc.get("name") != "API Handler Tests" or trigger != {"workflow_dispatch": None}:
        raise AssertionError("workflow name/trigger mismatch")
    if doc.get("permissions") != {"contents": "read"}:
        raise AssertionError("permissions mismatch")
    jobs = doc.get("jobs")
    if not isinstance(jobs, dict) or set(jobs) != {"api-handlers"}:
        raise AssertionError("job mismatch")
    job = jobs["api-handlers"]
    if job.get("runs-on") != "ubuntu-latest" or job.get("timeout-minutes") != 10:
        raise AssertionError("runner/timeout mismatch")
    steps = job.get("steps")
    if not isinstance(steps, list) or len(steps) != 5:
        raise AssertionError("step count mismatch")
    if steps[0].get("uses") != f"actions/checkout@{PINS['actions/checkout']}" or steps[0].get("with", {}).get("persist-credentials") is not False:
        raise AssertionError("checkout mismatch")
    if steps[1].get("uses") != f"pnpm/action-setup@{PINS['pnpm/action-setup']}" or steps[1].get("with") != {"version": "10.34.1", "run_install": False}:
        raise AssertionError("pnpm setup mismatch")
    if steps[2].get("uses") != f"actions/setup-node@{PINS['actions/setup-node']}" or steps[2].get("with") != {"node-version": 22, "cache": "pnpm", "cache-dependency-path": "pnpm-lock.yaml"}:
        raise AssertionError("node setup mismatch")
    if steps[3].get("run") != "pnpm install --frozen-lockfile" or steps[4].get("run") != "pnpm run test:api-handlers":
        raise AssertionError("command mismatch")
    forbidden = re.compile(r"(?i)(\bnpm\b|\byarn\b|\bnpx\b|secrets\.|contents:\s*write|git\s+(commit|push)|schedule:|^\s*push:|pull_request:|uses:\s*[^\s@]+@(v\d|main|master|latest)\b)", re.MULTILINE)
    if forbidden.search(text):
        raise AssertionError("forbidden operation or mutable reference")


class ApiHandlerWorkflowTests(unittest.TestCase):
    def test_contract(self):
        validate(WORKFLOW.read_text(encoding="utf-8"))

    def test_poison_fixtures_rejected(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        poisons = [
            source.replace("pnpm install --frozen-lockfile", "npm install", 1),
            source.replace("actions/checkout@11d5960a326750d5838078e36cf38b85af677262", "actions/checkout@v4", 1),
            source.replace("workflow_dispatch:", "push:", 1),
            source.replace("contents: read", "contents: write", 1),
            source.replace("timeout-minutes: 10\n", "", 1),
            source.replace("pnpm run test:api-handlers", "pnpm run test:api-handlers\n      - run: echo extra", 1),
        ]
        for poison in poisons:
            with self.assertRaises(Exception):
                validate(poison)

    def test_installed_layout_executes_without_source_tree(self):
        if os.environ.get("API_HANDLER_INSTALLED_CHILD"):
            self.skipTest("installed child validates its own contract only")
        with tempfile.TemporaryDirectory() as td:
            root = pathlib.Path(td)
            workflow = root / ".github" / "workflows" / "api-handlers-tests.yml"
            script = root / ".github" / "scripts" / "test_api_handler_tests_workflow.py"
            workflow.parent.mkdir(parents=True)
            script.parent.mkdir(parents=True)
            shutil.copy2(WORKFLOW, workflow)
            shutil.copy2(HERE, script)
            env = os.environ.copy()
            env.pop("PYTHONPATH", None)
            env["API_HANDLER_INSTALLED_CHILD"] = "1"
            result = subprocess.run([sys.executable, "-B", str(script)], cwd=root, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("installed_api_handler_tests_contract: PASS", result.stdout)
            self.assertNotIn(str(SOURCE_ROOT), result.stdout)


if __name__ == "__main__":
    unittest.main(exit=False)
    print("installed_api_handler_tests_contract: PASS")
