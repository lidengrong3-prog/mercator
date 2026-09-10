import copy
import os
import sys
import unittest
from unittest.mock import patch


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from translate_regulatory_data import (  # noqa: E402
    api_config,
    mark_source_chinese,
    source_hash,
    translate_file,
    translation_is_current,
    validate_api_config,
)


class RegulatoryTranslationTests(unittest.TestCase):
    def test_api_config_reuses_deepseek_production_secrets(self):
        with patch.dict(os.environ, {
            "DEEPSEEK_API_URL": "https://api.deepseek.com",
            "DEEPSEEK_API_KEY": "test-key",
            "DEEPSEEK_MODEL": "deepseek-chat",
        }, clear=True):
            self.assertEqual(api_config(), (
                "test-key",
                "https://api.deepseek.com/chat/completions",
                "deepseek-chat",
            ))

    def test_regulatory_specific_config_takes_precedence(self):
        with patch.dict(os.environ, {
            "REGULATORY_TRANSLATION_API_URL": "https://translator.example.com/v1/chat/completions",
            "REGULATORY_TRANSLATION_API_KEY": "translation-key",
            "REGULATORY_TRANSLATION_MODEL": "translation-model",
            "DEEPSEEK_API_KEY": "deepseek-key",
        }, clear=True):
            self.assertEqual(validate_api_config(), (
                "translation-key",
                "https://translator.example.com/v1/chat/completions",
                "translation-model",
            ))

    def test_api_config_preflight_rejects_missing_key(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "API key"):
                validate_api_config()

    def test_api_config_preflight_requires_https(self):
        with patch.dict(os.environ, {
            "REGULATORY_TRANSLATION_API_URL": "http://translator.example.com/v1/chat/completions",
            "REGULATORY_TRANSLATION_API_KEY": "translation-key",
            "REGULATORY_TRANSLATION_MODEL": "translation-model",
        }, clear=True):
            with self.assertRaisesRegex(RuntimeError, "absolute HTTPS URL"):
                validate_api_config()

    def test_chinese_source_is_marked_without_overwriting_original(self):
        record = {"title": "美国进口政策", "summary": "适用于跨境商品。"}
        original = copy.deepcopy(record)
        mark_source_chinese(record, "2026-08-31T00:00:00+00:00")
        self.assertEqual(record["title"], original["title"])
        self.assertEqual(record["summary"], original["summary"])
        self.assertEqual(record["translation"]["status"], "source_zh")
        self.assertTrue(translation_is_current(record))

    def test_source_change_invalidates_translation(self):
        record = {"title": "Policy", "summary": "Original"}
        record.update({
            "title_zh": "政策", "summary_zh": "原始内容",
            "translation": {"status": "translated", "source_hash": source_hash(record)},
        })
        self.assertTrue(translation_is_current(record))
        record["summary"] = "Updated"
        self.assertFalse(translation_is_current(record))

    def test_chinese_title_and_url_summary_are_normalized_without_machine_translation(self):
        import json
        import tempfile
        from pathlib import Path

        record = {
            "title": "跨境支付平台介绍",
            "summary": "https://example.com/source?id=1",
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "policies.json"
            path.write_text(json.dumps({"items": [record]}), encoding="utf-8")
            changed, translated, pending = translate_file(
                path, require_config=False, limit=None, provider="api"
            )
            output = json.loads(path.read_text(encoding="utf-8"))["items"][0]

        self.assertEqual((changed, translated, pending), (1, 0, 0))
        self.assertEqual(output["title_zh"], record["title"])
        self.assertEqual(output["summary_zh"], f"原文链接：{record['summary']}")
        self.assertEqual(output["translation"]["provider"], "source-normalization")
        self.assertTrue(translation_is_current(output))


if __name__ == "__main__":
    unittest.main()
