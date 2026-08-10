# -*- coding: utf-8 -*-
import io
PATH = r"D:\AI工具\mercator-main\index.html"
s = io.open(PATH, encoding="utf-8").read()
repls = [("mercatorProfile", "jayProfile"), ("mercatorAuthHeaders", "jayAuthHeaders")]
for a, b in repls:
    n = s.count(a)
    s = s.replace(a, b)
    print("replaced %-22s -> %-16s x%d" % (a, b, n))
io.open(PATH, "w", encoding="utf-8").write(s)
leftover = s.count("Mercator") + s.count("MERCATOR") + s.count("mercator")
print("LEFT OVER brand tokens:", leftover)
