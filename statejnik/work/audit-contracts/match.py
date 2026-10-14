import re

fe = open('C:/Code/GeneratorAD/statejnik/work/audit-contracts/frontend-calls.md', encoding='utf-8', errors='replace').read()
be = open('C:/Code/GeneratorAD/statejnik/work/audit-contracts/backend-routes.md', encoding='utf-8', errors='replace').read()

def norm_path(p):
    # /api/v1/wa/qr/${accountId} -> /api/v1/wa/qr/{x}; :id -> {x}; {account_id} -> {x}
    p = re.sub(r'\$\{[^}]+\}', '{x}', p)
    p = re.sub(r'\{[^}]+\}', '{x}', p)
    p = re.sub(r':[A-Za-z_]+', '{x}', p)
    return p.rstrip('/')

def parse_rows(text):
    out = []
    methods = ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')
    for ln in text.splitlines():
        ln = ln.strip()
        if not ln.startswith('|'):
            continue
        cells = [c.strip() for c in ln.strip('|').split('|')]
        # frontend tables: caller | method | path | params
        # backend tables: method | path | handler | auth
        if len(cells) >= 4 and cells[1].upper() in methods:
            method, path, caller = cells[1].upper(), cells[2], cells[0][:60]
        elif len(cells) >= 3 and cells[0].upper() in methods:
            method, path, caller = cells[0].upper(), cells[1], cells[2][:60]
        else:
            continue
        path = path.split()[0].replace('`', '')
        if not path.startswith('/'):
            continue
        out.append((method, norm_path(path), caller))
    return out

fecalls = parse_rows(fe)
beroutes = parse_rows(be)
print('parsed fe:', len(fecalls), 'be:', len(beroutes))

beset = {(m, p) for m, p, _ in beroutes}
orphans = [(m, p, c) for m, p, c in fecalls if (m, p) not in beset]
print('=== FRONTEND CALLS WITH NO BACKEND MATCH:', len(orphans), '===')
for m, p, c in orphans:
    print(f'{m} {p}  <- {c}')

# reverse: backend routes never called (normalize both sides already)
fecalled = {(m, p) for m, p, _ in fecalls}
dead = [(m, p, c) for m, p, c in beroutes if (m, p) not in fecalled]
print('=== BACKEND ROUTES WITH NO FRONTEND CALLER:', len(dead), '===')
for m, p, c in dead[:60]:
    print(f'{m} {p}  <- {c}')
