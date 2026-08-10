#!/usr/bin/env python3
"""Fix broken onclick attributes with nested single quotes."""
import re, subprocess

with open('index.html', 'r', encoding='utf-8') as f:
    s = f.read()

# In the file, the JS string uses \\' to represent a literal single quote in HTML.
# Pattern: onclick=\\' ... \\' where ... contains nested \\' 
# Fix: change the outer \\' to \\" (so browser sees double-quoted attribute)

# Use regex: find onclick=\x27 (where \x27 is the actual \' in file)
# Actually in the file, backslash+quote is two chars: \ and '
# Let me work with the raw content

fixed = 0

# Find all onclick= followed by backslash+singlequote
pattern = re.compile(r'onclick=\\\'')
for m in pattern.finditer(s):
    start = m.start()
    attr_content_start = m.end()  # position after onclick=\'
    
    # Find the closing \' for this attribute
    # Look for \' followed by > or space (end of attribute)
    rest = s[attr_content_start:]
    
    # Find all \' positions in rest
    closes = [i for i in range(len(rest)-1) if rest[i] == '\\' and rest[i+1] == "'"]
    
    if not closes:
        continue
    
    # The first \' that is followed by > or space is the closing delimiter
    end_in_rest = None
    for ci in closes:
        after = rest[ci+2:ci+3]  # char after the closing \'
        if after in ('>', ' ', '\n', '\t') or ci + 2 >= len(rest):
            end_in_rest = ci
            break
    
    if end_in_rest is None:
        continue
    
    # Extract attribute value
    attr_value = rest[:end_in_rest]
    
    # Check for nested \\' in the value
    nested = False
    i = 0
    while i < len(attr_value) - 1:
        if attr_value[i] == '\\' and attr_value[i+1] == "'":
            # Check if this is at the very end (which would be the closing delimiter)
            if i + 2 < len(attr_value):
                nested = True
                break
        i += 1
    
    if nested:
        # Fix: replace outer \\' with \\"
        # Old: onclick=\'VALUE\' 
        # New: onclick=\"VALUE\" (but also unescape inner \\' to just ' since inside double quotes they don't need escaping)
        
        # Actually, keep inner \\' as-is - they work fine inside double-quoted HTML attributes
        # Just change the outer delimiters
        
        old_span = s[start:start + 10 + end_in_rest + 2]  # onclick=\' + value + \'
        new_span = 'onclick=\\"' + attr_value + '\\"'
        
        s = s[:start] + new_span + s[start + len(old_span):]
        fixed += 1
        
        # Show what was fixed (first 100 chars)
        preview = old_span[:100].replace('\n', '\\n')
        print(f"Fixed #{fixed} at pos {start}: {preview}...")
        
        # Adjust: since we modified s, the regex iterator is invalidated
        # Need to re-scan from after this fix
        # But re.finditer on modified string... let's just restart the loop
        # Actually this won't work with finditer on a changing string
        # Let me use a different approach: collect all fixes first, then apply in reverse order

# The above approach won't work because we're modifying s during iteration.
# Let me redo with a collect-then-apply approach.

# Re-read file
with open('index.html', 'r', encoding='utf-8') as f:
    s = f.read()

fixes = []  # list of (start, end, replacement)

pos = 0
while pos < len(s):
    idx = s.find("onclick=\\'", pos)
    if idx < 0:
        break
    
    attr_start = idx + 10  # after "onclick=\\'"
    
    # Find closing \\' 
    search_from = attr_start
    end_idx = None
    while search_from < len(s) - 1:
        if s[search_from] == '\\' and s[search_from + 1] == "'":
            # Check what follows
            after_char = s[search_from + 2] if search_from + 2 < len(s) else ''
            if after_char in ('>', ' ', '\n', '\t', '/') or search_from + 2 >= len(s):
                end_idx = search_from
                break
        search_from += 1
    
    if end_idx is None:
        pos = idx + 1
        continue
    
    attr_value = s[attr_start:end_idx]
    
    # Check for nested \\' 
    has_nested = False
    i = 0
    while i < len(attr_value) - 1:
        if attr_value[i] == '\\' and attr_value[i+1] == "'":
            # Make sure it's not at the very end position
            remaining = attr_value[i+2:]
            if remaining:  # there's content after this \\'
                has_nested = True
                break
        i += 1
    
    if has_nested:
        # Collect this fix
        old_end = end_idx + 2  # include the closing \\'
        old_text = s[idx:old_end]
        # New: use double quotes for outer, keep inner as-is
        new_text = 'onclick=\\"' + attr_value + '\\"'
        fixes.append((idx, old_end, new_text))
        print(f"Found broken onclick at {idx}: {old_text[:80]}...")
    
    pos = end_idx + 2

print(f"\nFound {len(fixes)} broken onclick attributes")

# Apply fixes in reverse order to preserve positions
for start, end, replacement in reversed(fixes):
    s = s[:start] + replacement + s[end:]

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(s)

# Verify JS syntax
import re as re2
scripts = re2.findall(r'<script[^>]*>(.*?)</script>', s, re.DOTALL)
with open('/tmp/verify.js', 'w', encoding='utf-8') as f:
    f.write(scripts[0])
result = subprocess.run(['node', '--check', '/tmp/verify.js'], capture_output=True, text=True)
if result.returncode == 0:
    print("JS syntax: PASS ✅")
else:
    print(f"JS syntax: FAIL ❌\n{result.stderr[:500]}")
