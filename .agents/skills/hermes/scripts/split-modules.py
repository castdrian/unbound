import re, os, sys
# Usage: split-modules.py <decompiled main.js> <output dir>
src = open(sys.argv[1], encoding='utf-8', errors='replace')
OUT = sys.argv[2]
buf = []
pat = re.compile(r"r\d+ = '([^']+\.(?:tsx|ts|js|jsx))';")
count = 0
pending = None
for line in src:
    buf.append(line)
    if 'fileFinishedImporting' in line:
        pending = True
        continue
    if pending:
        m = pat.search(line)
        pending = None
        if m:
            path = m.group(1).replace('../', '_up_/')
            out = os.path.join(OUT, path)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, 'w') as f: f.writelines(buf)
            buf = []
            count += 1
print(count)
