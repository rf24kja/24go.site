import re

ru = open('C:/Code/GeneratorAD/statejnik/work/vk-tovarnye-rekomendatsii-2026/draft-ru.md', encoding='utf-8').read().strip()
en = open('C:/Code/GeneratorAD/statejnik/work/vk-tovarnye-rekomendatsii-2026/draft-en.md', encoding='utf-8').read().strip()
ru = re.sub(r'^# .+\n+', '', ru, count=1)
en = re.sub(r'^# .+\n+', '', en, count=1)
assert 'TRIPLEQ' not in ru
open('C:/Code/GeneratorAD/statejnik/work/vk-tovarnye-rekomendatsii-2026/final-ru.md', 'w', encoding='utf-8').write(ru)
open('C:/Code/GeneratorAD/statejnik/work/vk-tovarnye-rekomendatsii-2026/final-en.md', 'w', encoding='utf-8').write(en)
print('RU chars:', len(ru), '| EN chars:', len(en))
print('RU head:', ru[:80].replace(chr(10), ' '))
print('EN head:', en[:80].replace(chr(10), ' '))
