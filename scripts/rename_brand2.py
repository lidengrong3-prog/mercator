# -*- coding: utf-8 -*-
"""Pass 2: rename remaining internal identifiers / storage keys / demo email."""
import io
PATH = r"D:\AI工具\mercator-main\index.html"
s = io.open(PATH, encoding="utf-8").read()

repls = [
    ("mercatorFetchMarketData", "jayFetchMarketData"),
    ("mercatorLogout", "jayLogout"),
    ("mercator_", "jay_"),            # localStorage keys
    ("mercator.com", "jayguanhai.com"),
]
for a, b in repls:
    n = s.count(a)
    s = s.replace(a, b)
    print("replaced %-24s -> %-16s x%d" % (a, b, n))

io.open(PATH, "w", encoding="utf-8").write(s)
leftover = s.count("Mercator") + s.count("MERCATOR") + s.count("mercator")
print("LEFT OVER brand tokens:", leftover)
print("jayFetchMarketData x", s.count("jayFetchMarketData"))
print("jayLogout x", s.count("jayLogout"))
