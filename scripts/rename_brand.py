# -*- coding: utf-8 -*-
"""Rename brand Mercator -> JAY观海 across index.html.
User-facing strings + internal identifiers unified for consistency.
"""
import io

PATH = r"D:\AI工具\mercator-main\index.html"
s = io.open(PATH, encoding="utf-8").read()

repls = [
    # internal constants (must run before generic 'Mercator' replace)
    ("MERCATOR_SUPABASE_URL", "JAY_SUPABASE_URL"),
    ("MERCATOR_SUPABASE_KEY", "JAY_SUPABASE_KEY"),
    ("MERCATOR_API_URL", "JAY_API_URL"),
    ("MERCATOR_ANON_KEY", "JAY_ANON_KEY"),
    # functions / vars
    ("initMercatorAuth", "initJayAuth"),
    ("checkMercatorSession", "checkJaySession"),
    ("loadMercatorProfile", "loadJayProfile"),
    ("mercatorUser", "jayUser"),
    # user-facing brand text
    ("Mercator", "JAY观海"),
]

for a, b in repls:
    n = s.count(a)
    s = s.replace(a, b)
    print("replaced %-22s -> %-10s x%d" % (a, b, n))

# targeted title + subtitle
s = s.replace("<title>Mercator - 跨境市场监控</title>",
              "<title>JAY观海 - 全球跨境电商情报</title>")
s = s.replace("<small>MARKET INTELLIGENCE</small>",
              "<small>全球电商情报</small>")

io.open(PATH, "w", encoding="utf-8").write(s)

# verify no leftover brand
leftover = s.count("Mercator") + s.count("MERCATOR") + s.count("mercator")
print("LEFT OVER brand tokens:", leftover)
print("contains JAY观海 x", s.count("JAY观海"))
print("contains JAY_SUPABASE_URL x", s.count("JAY_SUPABASE_URL"))
