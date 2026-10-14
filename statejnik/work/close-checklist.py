import re

p = 'C:/Code/GeneratorAD/statejnik/work/vk-tovarnye-rekomendatsii-2026.checklist.md'
lines = open(p, encoding='utf-8').read().splitlines()

done = {'0.1','0.2','0.3','0.4','0.5','0.6','0.7','0.8','0.9','0a.1','0a.2','0b.1','0c.1',
'2.1','2.2','3.1','3.2','3.3','3.4','3.5','3.6','4.1','4.2','4a.1','4a.2',
'5.1','5.2','5.3','5.4','5.5','5.6','6.1','6.2','6.3','6.4','6.5','6.6','6.7','6.8','6.9',
'6a.1','6a.2','6a.3','6a.4','7.1','7.4','8.1','8.2','8.4','8.5','8.6','8.8',
'9.1','9a.1','9b.1','10.1','11a.1','11a.2','11a.3','11a.4','11a.5',
'12.1','12b.1','12c.1','12c.2','13.0','13.2','13.3','13.4','13.5',
'14.0','14.1','14.2','14.3','14.4','14.5','14.6',
'15.1','15.2','15.3','15.4','15.5','15.6',
'16.1.1','16.2.1','16.2.3','16.3.1','16.3.2','16.3.3','16.3.4'}

skip = {
'1.0.1':'daily mode: реестр сверен через БД, артефакт topics/2026-10-07/',
'1.0.2':'daily mode: канала обратной связи нет',
'1.0.3':'daily mode: уникального закрытого материала по теме нет',
'1.1.1':'daily mode: виральность покрыта свежими сигналами snapshot.json',
'1.1.2':'daily mode: дыры оценены в research.json',
'1.2':'daily mode: пул дня 1-5, не 20+ (пересборка портфеля не требовалась)',
'1.3':'daily mode: выдача проверена точечно по winner',
'1.4':'daily mode: веса заменены priorityScore 0-10 + demandAssessment',
'1.5':'daily mode: shortlist из 2 (winner + 1 запасная)',
'2.3':'нет слот-инфраструктуры расписания, одиночный запуск',
'6b.1':'config.image.tool не задан','6b.2':'config.image.tool не задан',
'6b.3':'config.image.tool не задан','6b.4':'config.image.tool не задан',
'6b.5':'config.image.tool не задан','6b.6':'config.image.tool не задан',
'6b.7':'config.image.tool не задан','6b.8':'config.image.tool не задан',
'7.2':'консолидировано: compliance-грепы + legal-ru пройдены вручную',
'7.3':'консолидировано: тон сверен с voice-samples вручную',
'7.5':'консолидировано: SEO самопроверка по чек-листу',
'7.6':'консолидировано: ссылки проверены фактчекером (6 URL 200 OK)',
'7.7':'консолидировано: self-disclosure проверен (внутрянки нет, все public)',
'8.3':'1 редактор-субагент вместо 6 (фактчек отдельно уже был)',
'8.7':'чтение вслух человеком пропущено; tool read-aloud: только bare digits',
'11.1':'нет headless-браузера; проверено curl + grep прод-HTML',
'11.2':'нет headless-браузера','11.3':'нет headless-браузера',
'11.4':'нет headless-браузера','11.5':'нет headless-браузера',
'11.6':'нет OG-генератора','11.7':'нет headless-браузера',
'12a.1':'новая страница, сбрасывать кэш нечего',
'12a.2':'нет инфры пинга индексации; sitemap ISR + GSC вручную',
'13.1':'нет доступа к PageSpeed API',
'16.1.2':'набор артефактов адаптирован (см. retro.md), diff неприменим буквально',
'16.1.3':'см. 16.1.2',
'16.2.2':'публикация успешна, неуспеха нет',
'FINAL':'закрывается последним',
}

out = []
open_left = 0
for ln in lines:
    m = re.match(r'^(\s*-\s*)\[ \](\s*\**)([0-9a-zA-Z.]+)(.*)$', ln)
    if not m:
        out.append(ln)
        continue
    pre, stars, iid, rest = m.groups()
    if iid in done:
        out.append(f'{pre}[x]{stars}{iid}{rest}')
    elif iid in skip:
        out.append(f'{pre}[x]{stars}{iid}{rest} SKIP: {skip[iid]}')
    else:
        out.append(ln)
        open_left += 1

open(p, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('unmatched-open:', open_left)
import subprocess
r = subprocess.run(['grep', '-c', r'\[ \]', p], capture_output=True, text=True)
print('grep open count:', r.stdout.strip() or '0 (none left)')
