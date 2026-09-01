import copy
import os
import sys
import unittest


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from translate_regulatory_data import (  # noqa: E402
    mark_source_chinese,
    source_hash,
    translation_is_current,
)


class RegulatoryTranslationTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
