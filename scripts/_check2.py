import re
with open('D:/AI工具/mercator-main/index.html', encoding='utf-8') as f:
    html = f.read()

# find all <script>...</script> blocks that have no src
blocks = re.findall(r'<script>(.*?)</script>', html, re.S)
print("inline script blocks:", len(blocks))
combined = "\n;\n".join(blocks)
with open('D:/AI工具/mercator-main/scripts/_combined_check.js', 'w', encoding='utf-8') as f:
    f.write(combined)
print("combined length:", len(combined))
