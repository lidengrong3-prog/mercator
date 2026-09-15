import copy
import json
import os
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import backfill_history as backfill  # noqa: E402


class HistoryBackfillTests(unittest.TestCase):
    def test_month_and_year_windows_are_inclusive(self):
        self.assertEqual(
            backfill.build_windows("2020-01-15", "2020-03-02"),
            [(date(2020, 1, 15), date(2020, 1, 31)),
             (date(2020, 2, 1), date(2020, 2, 29)),
             (date(2020, 3, 1), date(2020, 3, 2))],
        )
        self.assertEqual(
            backfill.build_windows("2020-06-01", "2021-02-01", "year"),
            [(date(2020, 6, 1), date(2020, 12, 31)), (date(2021, 1, 1), date(2021, 2, 1))],
        )

    def test_federal_register_params_and_cursor(self):
        calls = []

        def transport(url, params):
            calls.append((url, params))
            return {"results": [{"document_number": "2020-1", "title": "Policy", "publication_date": "2020-01-03"}], "next_page_url": "next", "total_pages": 2}

        rows, cursor = backfill.fetch_federal_register(
            (date(2020, 1, 1), date(2020, 1, 31)), page=2, per_page=50, transport=transport
        )
        self.assertEqual(rows[0]["document_number"], "2020-1")
        self.assertEqual(calls[0][1]["filter[publication_date][gte]"], "2020-01-01")
        self.assertEqual(calls[0][1]["filter[publication_date][lte]"], "2020-01-31")
        self.assertEqual(calls[0][1]["page"], 2)
        self.assertEqual(cursor["total_pages"], 2)
        self.assertEqual(cursor["page"], 3)

    def test_cpsc_params_and_stable_revision_evidence(self):
        calls = []

        def transport(url, params):
            calls.append(params)
            return [{"RecallNumber": "23-001", "Title": "Updated", "RecallDate": "2020-01-04", "Description": "new"}]

        rows = backfill.fetch_cpsc((date(2020, 1, 1), date(2020, 1, 31)), transport=transport)
        normalized = backfill.normalize_cpsc_record(rows[0], "2020-02-01T00:00:00+00:00")
        self.assertEqual(calls[0]["RecallDateStart"], "2020-01-01")
        self.assertEqual(calls[0]["RecallDateEnd"], "2020-01-31")
        self.assertEqual(normalized["source_record_id"], "23-001")
        self.assertEqual(normalized["payload"]["revision_key"], "23-001")
        self.assertEqual(len(normalized["evidence_hash"]), 64)

    def test_validation_rejects_out_of_window_and_missing_dates(self):
        valid = backfill.normalize_federal_record({"document_number": "1", "title": "A", "publication_date": "2020-01-02"})
        missing = copy.deepcopy(valid)
        missing["published_at"] = None
        missing["effective_from"] = None
        outside = copy.deepcopy(valid)
        outside["published_at"] = "2019-12-01"
        accepted, rejected = backfill.validate_batch_records([valid, missing, outside], (date(2020, 1, 1), date(2020, 1, 31)))
        self.assertEqual(len(accepted), 1)
        self.assertEqual(len(rejected), 2)

    def test_missing_ranges_merge_and_dry_run_does_not_need_credentials(self):
        merged = backfill.merge_missing_ranges(
            [{"from": "2020-01-01", "to": "2020-01-10"}], (date(2020, 1, 11), date(2020, 1, 20))
        )
        self.assertEqual(merged, [{"from": "2020-01-01", "to": "2020-01-20"}])
        self.assertEqual(
            backfill.subtract_range(merged, (date(2020, 1, 5), date(2020, 1, 10))),
            [{"from": "2020-01-01", "to": "2020-01-04"}, {"from": "2020-01-11", "to": "2020-01-20"}],
        )
        result = backfill.BackfillRunner("federal-register", "2020-01-01", "2020-01-31", dry_run=True).run()
        self.assertTrue(result["dry_run"])
        self.assertEqual(len(result["batches"]), 1)

    def test_runner_retries_only_incomplete_batch_and_persists_formal_publication(self):
        class FakeStore:
            def __init__(self):
                self.rows = {}

            def request(self, method, table, query=None, data=None, prefer=None):
                if method == "POST" and table in {"history_backfill_jobs", "history_backfill_batches"}:
                    row = data[0].copy()
                    self.rows.setdefault(table, []).append(row)
                    return [row]
                return None

            def find_one(self, table, query):
                rows = self.rows.get(table, [])
                for row in rows:
                    if all(str(row.get(key)) == str(value).replace("eq.", "", 1) for key, value in query.items() if key != "limit"):
                        return row
                return None

            def list_rows(self, table, query):
                return self.rows.get(table, [])

            def insert(self, table, rows, conflict="id"):
                self.rows.setdefault(table, []).extend(copy.deepcopy(rows))
                return len(rows)

            def upsert(self, table, rows, conflict="id"):
                bucket = self.rows.setdefault(table, [])
                for row in rows:
                    old = next((item for item in bucket if item.get("id") == row.get("id")), None)
                    if old:
                        old.update(copy.deepcopy(row))
                    else:
                        bucket.append(copy.deepcopy(row))
                return len(rows)

            def patch(self, table, row_id, values):
                row = next(item for item in self.rows.setdefault(table, []) if item.get("id") == row_id)
                row.update(copy.deepcopy(values))

        calls = []

        def transport(url, params):
            calls.append(params)
            return {"results": [{"document_number": "2020-1", "title": "Policy", "publication_date": "2020-01-03"}]}

        store = FakeStore()
        first = backfill.BackfillRunner("federal-register", "2020-01-01", "2020-01-31", store=store, transport=transport).run()
        second = backfill.BackfillRunner("federal-register", "2020-01-01", "2020-01-31", store=store, transport=transport).run()
        self.assertEqual(first["status"], "completed")
        self.assertEqual(second["status"], "completed")
        self.assertEqual(len(calls), 1, "a completed page must not be fetched again on resume")
        self.assertEqual(len(store.rows["history_backfill_batches"]), 1)
        self.assertEqual(store.rows["history_backfill_batches"][0]["status"], "succeeded")
        self.assertEqual(len(store.rows["formal_publications"]), 1)
        self.assertEqual(len(store.rows["history_backfill_checkpoints"]), 1)


if __name__ == "__main__":
    unittest.main()
