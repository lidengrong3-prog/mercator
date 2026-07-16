#!/usr/bin/env python3
"""Modify index.html to add 31 new countries to countryFullData and cn2CountryExt."""
import json, os, re

WORKDIR = '/app/data/所有对话/主对话/mercator_rework'

# Read the new data
with open(os.path.join(WORKDIR, 'data', 'countries_new.json'), 'r', encoding='utf-8') as f:
    new_data = json.load(f)

CFD = new_data['countryFullData']
EXT = new_data['cn2CountryExt']

# Read index.html
with open(os.path.join(WORKDIR, 'index.html'), 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# Find key line numbers
cfd_start = None
cfd_end = None
ext_start = None
ext_end = None
hotkeys_line = None

for i, line in enumerate(lines):
    if 'let countryFullData={' in line:
        cfd_start = i
    if 'var cn2CountryExt = {' in line:
        ext_start = i
    if 'var hotKeys = [' in line:
        hotkeys_line = i

# Find the end of countryFullData - it ends with "};\n" before cn2CountryExt
# The countryFullData object ends just before cn2CountryExt starts
# Looking at the structure: countryFullData is one long line (4207), cn2CountryExt starts at 4217
# Actually the countryFullData object ends with "},};" pattern

# Let me find the exact end of countryFullData
# It should be the line that has "}," right before "var cn2CountryExt"
for i in range(ext_start - 1, cfd_start, -1):
    stripped = lines[i].strip()
    if stripped.startswith('};') or stripped == '};':
        cfd_end = i
        break

print(f"CFD start: {cfd_start}, CFD end: {cfd_end}")
print(f"EXT start: {ext_start}")
print(f"Hotkeys line: {hotkeys_line}")

# Find end of cn2CountryExt
for i in range(ext_start + 1, len(lines)):
    stripped = lines[i].strip()
    if stripped == '};':
        ext_end = i
        break

print(f"EXT end: {ext_end}")

# Now let me understand the structure better
# countryFullData is essentially one very long line (line 4207 = index 4206)
# cn2CountryExt starts at line 4217 (index 4216)
# Let me check what's between cfd_start and ext_start
print(f"\nLine at cfd_start: {lines[cfd_start][:100]}...")
print(f"Line before ext_start: {lines[ext_start-1][:100]}...")

# The countryFullData is likely all on one line. Let me check
cfd_content = ''
for i in range(cfd_start, ext_start):
    cfd_content += lines[i]

# Check if it's all one line or multi-line
print(f"\nCFD content length: {len(cfd_content)}")
print(f"CFD content last 200 chars: ...{cfd_content[-200:]}")

# The countryFullData ends with "},};" at the very end
# We need to insert new countries before the final "};\n"
# Find the position of the last "};" in the CFD content

# Strategy: 
# 1. Split the CFD line at the last "},}" before "};\n"
# 2. Insert new countries between existing data and the closing

# For countryFullData (all on one line):
cfd_line_content = cfd_content.rstrip()
# Remove trailing semicolon and newline
if cfd_line_content.endswith(';'):
    cfd_line_content = cfd_line_content[:-1]
# The last character should be '}'
# We need to add ",new_countries" before the final '}'
# Actually, let me look at the exact ending
print(f"\nCFD last 50 chars: '{cfd_line_content[-50:]}'")

# The CFD line ends with "...},};" 
# We need to find the last "}," which separates the last country from the closing "}"
# Then insert our new data there

# Let's find where to insert in the CFD line
# It should end with "}};" or "},};"
# Looking at the structure, each country ends with "}}" then there's a "}" for the whole object

# Actually, the format is: let countryFullData={id:{...},us:{...},...,vn:{...}};
# So we need to add before the final "}"

# Convert Python dict to JS string
def py_to_js_val(v):
    """Convert Python value to JS literal."""
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, str):
        s = v.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n')
        return f"'{s}'"
    if isinstance(v, list):
        if len(v) == 0:
            return '[]'
        if all(isinstance(x, (str, int, float)) for x in v):
            items = [py_to_js_val(x) for x in v]
            return '[' + ','.join(items) + ']'
        items = [py_to_js_val(x) for x in v]
        return '[' + ','.join(items) + ']'
    if isinstance(v, dict):
        if len(v) == 0:
            return '{}'
        parts = []
        for k, val in v.items():
            parts.append(f'{k}:{py_to_js_val(val)}')
        return '{' + ','.join(parts) + '}'
    return str(v)

# Generate new CFD entries
new_cfd_parts = []
for key in sorted(CFD.keys()):
    new_cfd_parts.append(f",{key}:{py_to_js_val(CFD[key])}")
new_cfd_str = ''.join(new_cfd_parts)

# Generate new EXT entries  
new_ext_parts = []
for key in sorted(EXT.keys()):
    new_ext_parts.append(f",\n  {key}: {py_to_js_val(EXT[key])}")
new_ext_str = ''.join(new_ext_parts)

# Now modify the HTML
# 1. For countryFullData: insert before the closing "}" of the object
# The CFD is one long line ending with "}};"
# We need to find the last "}" and insert before it

# Find the exact position in the CFD content where to insert
# The CFD ends with the vn country data, then "}};\n"
# We need to insert after the last country's closing "}," and before the object's closing "}"

# Let me find the right spot
# The structure is: ...vn:{...}};
# We want: ...vn:{...},gb:{...},...};

# Find the position of the closing of the countryFullData object
# It should be at the very end of cfd_content
# The pattern is: the vn data ends, then there's "},};" or just "}};"

# Let me search for the pattern
cfd_text = ''.join(lines[cfd_start:ext_start])
# Find last "}}" which closes the whole object
# The text ends with something like "...}};\n" 
# We want to insert before the last "}"

# Find the position just before the final "};"
# Actually looking at the original grep output:
# Line 4207 contains ALL of countryFullData in one line
# It ends with "...}};\n"
# The very end is: "},};" where the first } closes vn, the second } closes the object, ; ends the statement

# Let me verify by looking at the ending
last_20 = cfd_text.rstrip()[-20:]
print(f"\nCFD text last 20: '{last_20}'")

# The pattern at the end should be "...}};" or "...},};"
# We want to insert new countries before the last "};"
# Find the last "};" and insert before the "}"

# Better approach: find the last occurrence of "}}" and insert before the second "}"
# Or: find "}," which ends the last country entry

# Let's use a regex to find the end of the last country entry
# The last country (vn) data ends with a "}}" pattern
# followed by either ",}" (closing object) or just "}" 

# Simple approach: find "},};" at the end and replace with ",NEW_DATA};"
# or find "}};" at the end and replace with ",NEW_DATA};"

# Check what the actual ending is
if cfd_text.rstrip().endswith(',}};'):
    # Pattern: ...vn:{...},}
    insert_point = cfd_text.rstrip().rfind(',}};')
    new_cfd_text = cfd_text.rstrip()[:insert_point] + new_cfd_str + ',};'
elif cfd_text.rstrip().endswith('}};'):
    insert_point = cfd_text.rstrip().rfind('}};')
    new_cfd_text = cfd_text.rstrip()[:insert_point] + new_cfd_str + '};'
else:
    # Try to find the last "};" pattern
    print("WARNING: Unexpected ending pattern")
    print(f"Last 100 chars: '{cfd_text.rstrip()[-100:]}'")
    # Fallback: insert before the very last "};"
    insert_point = cfd_text.rstrip().rfind('};')
    new_cfd_text = cfd_text.rstrip()[:insert_point] + new_cfd_str + '};'

# 2. For cn2CountryExt: insert before the closing "}" of the object
# EXT is multi-line. Find the line with just "};\n" which closes it

# Build the new EXT content to insert
# The ext_end line has "};", insert before it
new_ext_lines = []
for key in sorted(EXT.keys()):
    new_ext_lines.append(f"  {key}: {py_to_js_val(EXT[key])},")

# Now construct the final file
new_lines = []

# Copy everything before the CFD line
for i in range(cfd_start):
    new_lines.append(lines[i])

# Add the modified CFD line
new_lines.append(new_cfd_text + '\n')

# Copy the EXT lines, inserting new entries before the closing "};\n"
for i in range(ext_start, ext_end):
    new_lines.append(lines[i])

# Add new EXT entries
for entry in new_ext_lines:
    new_lines.append(entry + '\n')

# Add the closing "};\n" for EXT
new_lines.append(lines[ext_end])

# Copy everything after EXT end
for i in range(ext_end + 1, len(lines)):
    new_lines.append(lines[i])

# 3. Update hotKeys array
# Find and replace the hotKeys line
final_content = ''.join(new_lines)

# Build new hotKeys with all 39 countries
all_keys = ['id','us','jp','br','sa','th','my','vn'] + sorted(CFD.keys())
new_hotkeys = f"  var hotKeys = {json.dumps(all_keys)};\n"
final_content = re.sub(r'  var hotKeys = \[.*?\];\n', new_hotkeys, final_content)

# Write the modified file
with open(os.path.join(WORKDIR, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(final_content)

print(f"\nDone! Modified index.html with {len(CFD)} new countries")
print(f"Total countries now: {len(all_keys)}")
print(f"Hotkeys updated to: {all_keys}")
