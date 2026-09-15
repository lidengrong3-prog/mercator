import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from bootstrap_worker_data import (  # noqa: E402
    WorkerBootstrapError,
    _normalized_relative_path,
    download_with_retry,
    latest_artifacts_by_path,
    restore_plan,
)


def artifact(path, captured_at, object_path=None):
    return {
        "bucket_id": "private-raw-data",
        "object_path": object_path or path.replace("/", "-"),
        "captured_at": captured_at,
        "metadata": {"repository_relative_path": path},
    }


class WorkerBootstrapTests(unittest.TestCase):
    def test_restore_paths_are_restricted_to_private_artifact_specs(self):
        self.assertEqual(_normalized_relative_path("data/policies.json"), "data/policies.json")
        self.assertEqual(
            _normalized_relative_path("data/private_repository_source/policies.json"),
            "data/private_repository_source/policies.json",
        )
        self.assertIsNone(_normalized_relative_path("../.env"))
        self.assertIsNone(_normalized_relative_path("data/../.env"))
        self.assertIsNone(_normalized_relative_path("data/quality_report.json"))

    def test_latest_artifact_wins_for_each_path(self):
        rows = [
            artifact("data/policies.json", "2026-09-14T00:00:00Z", "old"),
            artifact("data/policies.json", "2026-09-15T00:00:00Z", "new"),
        ]
        self.assertEqual(latest_artifacts_by_path(rows)["data/policies.json"]["object_path"], "new")

    def test_private_repository_snapshot_hydrates_public_projection_target(self):
        row = artifact(
            "data/private_repository_source/policies.json",
            "2026-09-15T00:00:00Z",
        )
        plan = restore_plan([row])
        self.assertEqual(len(plan), 1)
        self.assertIn("data/private_repository_source/policies.json", plan[0][1])
        self.assertIn("data/policies.json", plan[0][1])

    def test_transient_integrity_failure_is_retried_but_not_ignored(self):
        row = artifact("data/policies.json", "2026-09-15T00:00:00Z")
        sleeps = []
        with patch(
            "bootstrap_worker_data.download_artifact",
            side_effect=[WorkerBootstrapError("transient"), b"restored"],
        ) as download:
            payload = download_with_retry("https://example.test", "secret", row, sleep_fn=sleeps.append)
        self.assertEqual(payload, b"restored")
        self.assertEqual(download.call_count, 2)
        self.assertEqual(sleeps, [1])


if __name__ == "__main__":
    unittest.main()
