import re
import shutil
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from validate_migration_chain import (  # noqa: E402
    FOUNDATION_MIGRATION,
    MigrationChainError,
    validate_migration_chain,
)
from scripts import release_preflight  # noqa: E402


class DatabaseRebuildTests(unittest.TestCase):
    def test_full_migration_chain_contains_every_legacy_bootstrap_object(self):
        report = validate_migration_chain()
        self.assertGreaterEqual(report["migration_count"], 22)
        self.assertEqual(report["index_strategies_covered"], 7)
        self.assertEqual(report["legacy_tables_covered"], [
            "feedback",
            "generated_reports",
            "market_data",
            "monitored_shops",
            "profiles",
            "query_history",
            "reports",
            "user_activity",
            "user_preferences",
            "user_watchlist",
            "watchlist_items",
        ])

    def test_foundation_precedes_profile_foreign_keys(self):
        files = sorted((ROOT / "supabase" / "migrations").glob("*.sql"))
        self.assertEqual(files[0].name, FOUNDATION_MIGRATION)
        foundation = files[0].read_text(encoding="utf-8")
        self.assertRegex(foundation, r"CREATE TABLE IF NOT EXISTS public\.profiles")
        self.assertRegex(foundation, r"CREATE TABLE IF NOT EXISTS public\.market_data")
        self.assertRegex(foundation, r"CREATE TABLE IF NOT EXISTS public\.monitored_shops")
        self.assertRegex(foundation, r"REVOKE ALL ON public\.profiles[\s\S]*FROM anon, authenticated")
        self.assertRegex(foundation, r"CREATE TRIGGER on_auth_user_created[\s\S]*public\.handle_new_user")
        self.assertRegex(foundation, r"CREATE POLICY market_data_select_all[\s\S]*TO anon, authenticated")

    def test_production_preflight_enforces_rebuild_audit(self):
        expected_head = sorted((ROOT / "supabase" / "migrations").glob("*.sql"))[-1].stem
        self.assertEqual(
            release_preflight.validate_migrations(),
            expected_head,
        )

    def test_dependency_audit_rejects_a_table_used_before_creation(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            migration_dir = Path(temp_dir)
            for source in (ROOT / "supabase" / "migrations").glob("*.sql"):
                shutil.copy2(source, migration_dir / source.name)
            foundation_path = migration_dir / FOUNDATION_MIGRATION
            foundation_path.write_text(
                foundation_path.read_text(encoding="utf-8")
                + "\nALTER TABLE public.missing ENABLE ROW LEVEL SECURITY;\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(MigrationChainError, "references tables before creation"):
                validate_migration_chain(migration_dir)

    def test_documentation_no_longer_requires_manual_bootstrap_sql(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        setup = (ROOT / "supabase" / "SETUP_GUIDE.md").read_text(encoding="utf-8")
        self.assertIsNone(re.search(r"For a fresh project, apply.{0,160}schema\.sql", readme, re.IGNORECASE))
        self.assertNotIn("新项目按以下顺序在 Supabase SQL Editor 中各执行一次", setup)
        self.assertIn("npx supabase db reset", setup)

    def test_isolated_rehearsal_covers_fresh_and_incremental_paths(self):
        workflow = (ROOT / ".github" / "workflows" / "production-readiness.yml").read_text(
            encoding="utf-8"
        )
        script = (ROOT / "scripts" / "run_database_rehearsal.sh").read_text(encoding="utf-8")
        assertions = (ROOT / "scripts" / "database_rehearsal_assertions.sql").read_text(
            encoding="utf-8"
        )
        migration_count = len(list((ROOT / "supabase" / "migrations").glob("*.sql")))

        self.assertEqual(migration_count, 49)
        self.assertIn("migration-rehearsal", workflow)
        self.assertIn("if: inputs.action == 'migration-rehearsal'", workflow)
        self.assertIn('EXPECTED_MIGRATION_COUNT: \'49\'', workflow)
        self.assertIn('supabase db reset --local --no-seed', script)
        self.assertIn('--version "$previous_version"', script)
        self.assertIn('supabase migration up --local', script)
        self.assertIn('existing market data preservation', script)
        self.assertIn("public.collection_worker_instances", assertions)
        self.assertIn("has_function_privilege", assertions)


if __name__ == "__main__":
    unittest.main()
