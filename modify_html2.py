#!/usr/bin/env python3
"""Modify index.html - countryFullData is all on one line."""
import json, os, re

WORKDIR = '/app/data/所有对话/主对话/mercator_rework'

with open(os.path.join(WORKDIR, 'data', 'countries_new.json'), 'r', encoding='utf-8') as f:
    new_data = json.load(f)

CFD = new_data['countryFullData']
EXT = new_data['cn2CountryExt']

with open(os.path.join(WORKDIR, 'index.html'), 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# Find key lines
cfd_line_idx = None
ext_start_idx = None
ext_end_idx = None
hotkeys_idx = None

for i, line in enumerate(lines):
    if 'let countryFullData={' in line:
        cfd_line_idx = i
    if 'var cn2CountryExt = {' in line:
        ext_start_idx = i
    if 'var hotKeys = [' in line:
        hotkeys_idx = i

print(f"CFD line: {cfd_line_idx}")
print(f"EXT start: {ext_start_idx}")
print(f"Hotkeys: {hotkeys_idx}")

# Find EXT end (line with just "};")
for i in range(ext_start_idx + 1, len(lines)):
    if lines[i].strip() == '};':
        ext_end_idx = i
        break
print(f"EXT end: {ext_end_idx}")

# === Convert Python to JS ===
def py_to_js(v):
    if v is None: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return str(v)
    if isinstance(v, str):
        s = v.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n')
        return f"'{s}'"
    if isinstance(v, list):
        if not v: return '[]'
        return '[' + ','.join(py_to_js(x) for x in v) + ']'
    if isinstance(v, dict):
        if not v: return '{}'
        return '{' + ','.join(f'{k}:{py_to_js(val)}' for k, val in v.items()) + '}'
    return str(v)

# === 1. Modify countryFullData line (all on one line) ===
cfd_line = lines[cfd_line_idx]
cfd_stripped = cfd_line.rstrip('\n')
print(f"CFD line last 30 chars: '{cfd_stripped[-30:]}'")

# Find the last "};" 
last_semi = cfd_stripped.rfind('};')
if last_semi == -1:
    print("ERROR: Cannot find '};' in CFD line")
    exit(1)

# Build new entries
new_cfd_entries = ''
for key in sorted(CFD.keys()):
    new_cfd_entries += f",{key}:{py_to_js(CFD[key])}"

# Insert before the closing "};"
new_cfd_line = cfd_stripped[:last_semi] + new_cfd_entries + '};\n'
lines[cfd_line_idx] = new_cfd_line
print(f"CFD line modified, new length: {len(new_cfd_line)}")

# === 2. Insert new entries into cn2CountryExt ===
new_ext_lines = []
for key in sorted(EXT.keys()):
    new_ext_lines.append(f"  {key}: {py_to_js(EXT[key])},\n")

# Insert before the closing "};\n"
for i, line in enumerate(new_ext_lines):
    lines.insert(ext_end_idx + i, line)

print(f"Inserted {len(new_ext_lines)} EXT entries")

# === 3. Update hotKeys ===
all_keys = ['id','us','jp','br','sa','th','my','vn'] + sorted(CFD.keys())
new_hotkeys_str = f"  var hotKeys = {json.dumps(all_keys)};\n"
lines[hotkeys_idx] = new_hotkeys_str
print(f"Updated hotKeys with {len(all_keys)} countries")

# === Write the file ===
with open(os.path.join(WORKDIR, 'index.html'), 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Done! index.html modified successfully")
