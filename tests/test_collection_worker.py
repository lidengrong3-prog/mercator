import subprocess
import sys
import unittest
from collections import deque
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from collection_worker import (  # noqa: E402
    CollectionWorker,
    WorkerConfigurationError,
    build_collector_command,
)
from enqueue_collection_tasks import enqueue  # noqa: E402


def task(**overrides):
    value = {
        "id": "00000000-0000-0000-0000-000000000001",
        "task_key": "test-task",
        "source_key": "cpsc",
        "collector_key": "collect_cpsc",
        "domain": "alert",
        "parameters": {},
        "attempt_count": 1,
    }
    value.update(overrides)
    return value


class FakeClient:
    def __init__(self, tasks=None, *, budget_allowed=True, policy=None):
        self.tasks = deque(tasks or [])
        self.budget_allowed = budget_allowed
        self.policy = policy or {
            "timeout_seconds": 10,
            "max_attempts": 3,
            "backoff_base_seconds": 10,
            "backoff_max_seconds": 100,
            "blocks_publication_on_failure": True,
            "metadata": {"default_estimated_cost_usd": 0.05},
        }
        self.attempts = []
        self.failures = []
        self.completed = []
        self.outcomes = []
        self.reservations = []
        self.renewals = []
        self.previous_success = None
        self.monitoring_dispatches = []
        self.monitoring_results = []
        self.heartbeats = []

    def claim_task(self, worker_id, lease_seconds):
        return self.tasks.popleft() if self.tasks else None

    def source_policy(self, source_key):
        return self.policy

    def successful_attempt(self, task_id):
        return self.previous_success

    def reserve_budget(self, source_key, request_id, request_count, estimated_cost_usd):
        self.reservations.append((source_key, request_id, request_count, estimated_cost_usd))
        return {"allowed": self.budget_allowed, "reason": "DAILY_COST_LIMIT" if not self.budget_allowed else None}

    def insert_attempt(self, row):
        self.attempts.append(row)

    def fail_task(self, task_id, worker_id, error_code, error_message, backoff_seconds, retryable):
        self.failures.append({
            "task_id": task_id, "error_code": error_code, "backoff_seconds": backoff_seconds,
            "retryable": retryable,
        })

    def complete_task(self, task_id, worker_id, result_summary):
        self.completed.append((task_id, result_summary))

    def record_source_outcome(self, source_key, success, error_code=None):
        value = {"source_key": source_key, "success": success, "error_code": error_code}
        self.outcomes.append(value)
        return value

    def renew_lease(self, task_id, worker_id, lease_seconds):
        self.renewals.append((task_id, worker_id))
        return True

    def health_check(self):
        return {"queued": 0, "leased": 0, "dead_letter": 0, "open_circuits": [], "tikhub_daily": {}}

    def heartbeat_worker(self, worker_id, status, **details):
        self.heartbeats.append((worker_id, status, details))
        return {"worker_id": worker_id, "status": status}

    def dispatch_due_monitoring_tasks(self, limit=100):
        self.monitoring_dispatches.append(limit)
        return {"enqueued": 0, "blocked": 0, "task_keys": []}

    def record_monitoring_task_result(self, monitoring_task_id, status, error=None):
        self.monitoring_results.append((monitoring_task_id, status, error))


class CollectionWorkerTests(unittest.TestCase):
    def make_worker(self, client, runner):
        return CollectionWorker(
            client,
            worker_id="test-worker",
            lease_seconds=30,
            process_runner=runner,
            random_fn=lambda: 0.5,
        )

    def test_commands_are_allowlisted_and_parameters_are_explicit(self):
        command = build_collector_command({
            "collector_key": "collect_cpsc",
            "parameters": {"from": "2024-01-01", "to": "2024-01-31", "page": 2, "per-page": 25},
        }, python_executable="python")
        self.assertEqual(command[0], "python")
        self.assertIn("--from", command)
        self.assertIn("2024-01-31", command)
        with self.assertRaises(WorkerConfigurationError):
            build_collector_command({"collector_key": "shell", "parameters": {"command": "rm -rf /"}})

    def test_tax_and_access_collectors_use_fixed_domains(self):
        tax = build_collector_command({
            "collector_key": "collect_us_taxes", "parameters": {"timeout": 45},
        }, python_executable="python")
        access = build_collector_command({
            "collector_key": "collect_us_access", "parameters": {},
        }, python_executable="python")
        self.assertIn("collect_us_regulatory.py", tax[1])
        self.assertEqual(tax[-4:], ["--domain", "tax", "--timeout", "45"])
        self.assertEqual(access[-2:], ["--domain", "access"])

    def test_tikhub_command_has_only_fixed_non_secret_parameters(self):
        command = build_collector_command({
            "collector_key": "tikhub_pilot",
            "parameters": {"run-date": "2026-09-14", "fixture": "tests/fixtures/tikhub.json", "dry-run": True},
        }, python_executable="python")
        self.assertEqual(command[0], "python")
        self.assertIn("collect_tikhub_pilot.py", command[1])
        self.assertIn("--run-date", command)
        self.assertNotIn("--api-key", command)
        with self.assertRaises(WorkerConfigurationError):
            build_collector_command({"collector_key": "tikhub_pilot", "parameters": {"fixture": "../secret.json"}})

    def test_monitoring_command_has_one_scoped_target_and_no_secret(self):
        command = build_collector_command({
            "collector_key": "tikhub_monitor",
            "parameters": {
                "monitoring-task-id": "00000000-0000-0000-0000-000000000010",
                "monitoring-type": "keyword", "keyword": "skincare",
                "market-code": "US", "platform": "tiktok-shop",
            },
        }, python_executable="python")
        self.assertIn("--monitoring", command)
        self.assertIn("--keywords-json", command)
        self.assertIn('["skincare"]', command)
        self.assertNotIn("--api-key", command)

    def test_success_is_recorded_once_and_completed(self):
        client = FakeClient()
        client.tasks.append(task())
        calls = []

        def runner(command, **kwargs):
            calls.append(command)
            return SimpleNamespace(returncode=0, stdout="ok", stderr="")

        result = self.make_worker(client, runner).run_once()
        self.assertEqual(result[0]["status"], "succeeded")
        self.assertEqual(len(calls), 1)
        self.assertEqual(len(client.attempts), 1)
        self.assertEqual(client.attempts[0]["request_id"], "collection:00000000-0000-0000-0000-000000000001:1")
        self.assertEqual(len(client.completed), 1)
        self.assertEqual(client.outcomes[0]["success"], True)

    def test_monitoring_result_is_written_after_collection_success(self):
        client = FakeClient()
        client.tasks.append(task(
            collector_key="tikhub_monitor", source_key="tikhub",
            parameters={
                "monitoring-task-id": "00000000-0000-0000-0000-000000000010",
                "monitoring-type": "keyword", "keyword": "skincare",
                "market-code": "US", "platform": "tiktok-shop",
            },
        ))
        runner = lambda command, **kwargs: SimpleNamespace(returncode=0, stdout="ok", stderr="")
        result = self.make_worker(client, runner).run_once()
        self.assertEqual(result[0]["status"], "succeeded")
        self.assertEqual(client.monitoring_results, [
            ("00000000-0000-0000-0000-000000000010", "succeeded", None)
        ])
        self.assertTrue(client.monitoring_dispatches)

    def test_nonzero_exit_uses_exponential_backoff_and_blocks_publication_for_core_source(self):
        client = FakeClient(policy={
            "timeout_seconds": 10, "backoff_base_seconds": 10, "backoff_max_seconds": 100,
            "blocks_publication_on_failure": True, "metadata": {},
        })
        client.tasks.append(task(attempt_count=2))

        def runner(command, **kwargs):
            return SimpleNamespace(returncode=7, stdout="", stderr="provider failed")

        result = self.make_worker(client, runner).run_once()
        self.assertEqual(result[0]["error_code"], "EXIT_NONZERO")
        self.assertEqual(client.failures[0]["backoff_seconds"], 20)
        self.assertTrue(result[0]["publication_blocked"])
        self.assertEqual(client.outcomes[0]["success"], False)
        self.assertEqual(client.attempts[0]["status"], "failed")

    def test_timeout_is_retryable(self):
        client = FakeClient()
        client.tasks.append(task())

        def runner(command, **kwargs):
            raise subprocess.TimeoutExpired(command, 10)

        result = self.make_worker(client, runner).run_once()
        self.assertEqual(result[0]["error_code"], "TIMEOUT")
        self.assertEqual(client.attempts[0]["status"], "timed_out")
        self.assertEqual(client.failures[0]["retryable"], True)

    def test_budget_limit_dead_letters_without_running(self):
        client = FakeClient(budget_allowed=False)
        client.tasks.append(task())
        ran = []

        def runner(command, **kwargs):
            ran.append(command)
            return SimpleNamespace(returncode=0, stdout="", stderr="")

        result = self.make_worker(client, runner).run_once()
        self.assertEqual(result[0]["status"], "dead_letter")
        self.assertEqual(client.attempts[0]["status"], "budget_blocked")
        self.assertEqual(client.failures[0]["retryable"], False)
        self.assertEqual(ran, [])

    def test_restart_recovers_prior_success_without_running_collector_again(self):
        client = FakeClient()
        client.tasks.append(task())
        client.previous_success = {"request_id": "collection:old:1", "attempt_number": 1}
        ran = []

        def runner(command, **kwargs):
            ran.append(command)
            return SimpleNamespace(returncode=0, stdout="", stderr="")

        result = self.make_worker(client, runner).run_once()
        self.assertTrue(result[0]["recovered_after_restart"])
        self.assertEqual(ran, [])
        self.assertEqual(client.reservations, [])
        self.assertEqual(client.completed[0][1]["request_id"], "collection:old:1")

    def test_two_workers_claim_different_tasks_and_health_is_readable(self):
        client = FakeClient([task(), task(id="00000000-0000-0000-0000-000000000002")])
        runner = lambda command, **kwargs: SimpleNamespace(returncode=0, stdout="", stderr="")
        first = CollectionWorker(client, worker_id="one", process_runner=runner).run_once()
        second = CollectionWorker(client, worker_id="two", process_runner=runner).run_once()
        self.assertEqual(first[0]["task_id"], "00000000-0000-0000-0000-000000000001")
        self.assertEqual(second[0]["task_id"], "00000000-0000-0000-0000-000000000002")
        self.assertEqual(CollectionWorker(client, worker_id="health").health_check()["queued"], 0)

    def test_worker_heartbeats_before_and_after_claimed_work(self):
        client = FakeClient([task()])
        result = self.make_worker(
            client,
            lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="ok", stderr=""),
        ).run_once()
        self.assertEqual(result[0]["status"], "succeeded")
        self.assertEqual([entry[1] for entry in client.heartbeats], ["busy", "ready"])
        self.assertEqual(client.heartbeats[0][2]["current_task_id"], task()["id"])

    def test_worker_keeps_polling_after_transient_claim_failure(self):
        class FlakyClient(FakeClient):
            def __init__(self):
                super().__init__()
                self.claim_calls = 0

            def claim_task(self, worker_id, lease_seconds):
                self.claim_calls += 1
                if self.claim_calls == 1:
                    raise RuntimeError("temporary database outage")
                return None

        client = FlakyClient()
        sleeps = []

        def sleep(seconds):
            sleeps.append(seconds)
            if len(sleeps) == 2:
                raise KeyboardInterrupt

        worker = CollectionWorker(
            client, worker_id="resilient-worker", poll_seconds=7,
            process_runner=lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="", stderr=""),
            sleep_fn=sleep,
        )
        with self.assertRaises(KeyboardInterrupt):
            worker.run_forever()
        self.assertEqual(client.claim_calls, 2)
        self.assertEqual(sleeps, [7, 7])
        self.assertEqual(
            [entry[1] for entry in client.heartbeats],
            ["starting", "ready", "error", "ready"],
        )
        self.assertTrue(worker.runtime_metadata["boot_id"])

    def test_enqueue_adds_publish_task_after_collection_dependencies(self):
        rows = enqueue(None, ["collect_data", "collect_cpsc"], run_id="run-1", dry_run=True)
        publish = next(row for row in rows if row["collector_key"] == "publish_formal")
        collection_rows = [row for row in rows if row["collector_key"] != "publish_formal"]
        self.assertTrue(all(row["depends_on_task_keys"] == [] for row in collection_rows))
        self.assertTrue(all(set(row) == set(rows[0]) for row in rows))
        self.assertEqual(publish["depends_on_task_keys"], [
            "run-1:collect_data", "run-1:collect_cpsc",
        ])

    def test_regulatory_collectors_are_independent_publish_dependencies(self):
        rows = enqueue(
            None, ["collect_us_taxes", "collect_us_access"],
            run_id="regulatory-1", dry_run=True,
        )
        collection_rows = [row for row in rows if row["collector_key"] != "publish_formal"]
        self.assertEqual([row["domain"] for row in collection_rows], ["tax", "access"])
        publish = next(row for row in rows if row["collector_key"] == "publish_formal")
        self.assertEqual(publish["depends_on_task_keys"], [
            "regulatory-1:collect_us_taxes", "regulatory-1:collect_us_access",
        ])


if __name__ == "__main__":
    unittest.main()
