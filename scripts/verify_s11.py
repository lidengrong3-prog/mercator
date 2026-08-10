import re

with open('D:/AI工具/mercator-main/index.html', encoding='utf-8') as f:
    html = f.read()

def extract_array(s, start):
    depth = 0
    instr = False
    esc = False
    for j in range(start, len(s)):
        c = s[j]
        if instr:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == "'":
                instr = False
            continue
        if c == "'":
            instr = True
        elif c == '[':
            depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0:
                return s[start:j+1]
    return None

def extract_object(s, start):
    depth = 0
    instr = False
    esc = False
    for j in range(start, len(s)):
        c = s[j]
        if instr:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == "'":
                instr = False
            continue
        if c == "'":
            instr = True
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return s[start:j+1]
    return None

p_idx = html.index('let platformsData=[') + len('let platformsData=')
parr = extract_array(html, p_idx)
pf_idx = html.index('let pfExtData={') + len('let pfExtData=')
pobj = extract_object(html, pf_idx)

names = re.findall(r"\['([^']*)'", parr)
keys = re.findall(r"'([^']+)':\{", pobj)

print("platformsData count:", len(names))
print("pfExtData keys count:", len(keys))

nameset = set(names)
keyset = set(keys)
missing = [n for n in names if n not in keyset]
extra = [k for k in keys if k not in nameset]
print("MISSING (platform name w/o pfExtData key):", missing)
print("EXTRA keys (in pfExtData, not in platformsData):", len(extra))
print("COVERAGE:", len(names) - len(missing), "/", len(names))
