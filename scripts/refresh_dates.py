# -*- coding: utf-8 -*-
"""T3: refresh stale 2024/2025 dates in demo data to 2026 (keep month-day where sensible)."""
import io, re
PATH = r"D:\AI工具\mercator-main\index.html"
s = io.open(PATH, encoding="utf-8").read()
before_2024 = s.count("2024-")
before_2025 = s.count("2025-")

# 1) specific full-date bumps (audit log / sync label / settings date inputs)
spec = {
    "2024-01-15": "2026-07-19",
    "2024-01-14": "2026-07-18",
    "2024-01-13": "2026-07-17",
    "2024-01-12": "2026-07-16",
    "2024-01-11": "2026-07-15",
    "2024-01-10": "2026-07-14",
    "2024-01-08": "2026-07-12",
    "2024-01-05": "2026-07-09",
    "2024-01-02": "2026-07-06",
    "2024-12-01": "2026-06-01",   # before effectiveDate regex
    "2024-08": "2026-07",         # Brazil Remessa Conforme note
    "2024-12更新": "2026-07更新",
    "2025-Q2": "2026-Q2",
    "2025-01生效": "2026-01生效",
    "2025-07-13": "2026-07-13",   # content tracking timestamps
}
for a, b in spec.items():
    n = s.count(a)
    s = s.replace(a, b)
    if n: print("spec %-14s -> %-12s x%d" % (a, b, n))

# 2) rules effectiveDate 2024/2025 -> 2026 (keep mm-dd)
s2 = re.sub(r"effectiveDate:'2024-(\d\d-\d\d)'", r"effectiveDate:'2026-\1'", s)
n4 = s.count("effectiveDate:'2024-") - s2.count("effectiveDate:'2024-")
s = s2
s2 = re.sub(r"effectiveDate:'2025-(\d\d-\d\d)'", r"effectiveDate:'2026-\1'", s)
n5 = s.count("effectiveDate:'2025-") - s2.count("effectiveDate:'2025-")
s = s2
print("effectiveDate 2024->2026 x%d, 2025->2026 x%d" % (n4, n5))

io.open(PATH, "w", encoding="utf-8").write(s)
after_2024 = s.count("2024-")
after_2025 = s.count("2025-")
print("2024- count: %d -> %d" % (before_2024, after_2024))
print("2025- count: %d -> %d (remaining should be '2025-2026年' ranges)" % (before_2025, after_2025))
