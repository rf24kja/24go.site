# 24go.site — конечный план завершения после аудита v35

Основание: AUDIT.md от30октября2026 и свежие runtime/public/scheduler snapshots. Это один конечный backlog; новые необязательные улучшения идут после релиза. Источник расчёта — ESTIMATE.json. Плановые бюджеты ниже являются инженерной оценкой, не измеренным временем и не обещанием доступности провайдеров.

## 1. Когда считаем сервис доделанным

**Текущий работающий релиз** — действующий сайт и принятые ограниченные workflows. Он не равен доказанной полной готовности.

**Контролируемый MVP/пилот** — только явно выбранные и реально принятые сценарии, без обещания незакрытых billing/platform функций. Это возможный отдельный выпуск, а не автоматическое исключение обещанных функций. Ограниченный объём должен быть явно согласован; скрывать неработающие обещания ради зелёного статуса нельзя.

**Полный релиз** — все сценарии зафиксированного объёма для пяти платформ, shared modules, billing и автономных публикаций имеют: installed version → observable result → отрицательные права/tenant проверки → error/retry contract → RU/EN/narrow acceptance → rollback. Нет открытых P0/P1 внутри обещанного объёма. Внешнее ограничение можно исключить из продукта только отдельным решением владельца, не односторонним unavailable-текстом.

## 2. Оценка времени и условия

- Базовые12пакетов: **82–164 focused engineering hours**, приблизительно11–21рабочий день при8часах работы одного release owner в день.
- Дополнительный заранее видимый scope-risk: **20–40часов** на advertised WA campaigns/mailings и иные подтверждённые unwired promises, если W1 подтвердит их обязательность/реализуемость. Это резерв на известную неопределённость, не разрешение расширять продукт.
- Полный плановый бюджет с этим риском и20%резервом: **122.4–244.8часа**, или **16–31рабочий день**. Практический календарный ориентир: **4–7рабочих недель**, затем/в конце минимум72часа стабильности с ежедневными доказательствами.
- Условия оценки: доступна рабочая модельная ёмкость, предоставлены тестовые ресурсы/защищённые разрешения, нет нового несогласованного функционала. Ожидание quota reset, OAuth consent, approvals и social resources НЕ входит в инженерные часы и не имеет честной верхней границы сейчас.
- Если выясняется несовместимое ограничение внешней платформы или требование нового официального канала, это отдельное scope decision с новой оценкой; не обещать технически/политически недоступное.
- После W1 — одна уточнённая baseline оценка и выбранный календарный старт. Затем бюджет/остаток пересчитываются по закрытым gate, а не при каждом новом пожелании. Параллелизм может сократить календарь, но не предполагается автоматически и не покупается без разрешения.

**Следовательно, гарантированной даты полного окончания пока нет.** Ориентир16–31рабочий день применим от доступного ресурсами старта. Раньше называть точный день означало бы скрыть реальные внешние зависимости.

## 3. Рабочие пакеты

**SEO/GEO пакет установлен:** [v39](INSTALLED_RELEASE_V39.md), frontend+API, sitemap/robots и public readback. Закрыта данная техническая crawlability-доработка; W10 daily generation/review/CMS и внешний индекс/citations этим не объявлены принятыми.

**Следующий установленный пакет:** [v38 — proxy safety](INSTALLED_RELEASE_V38.md). Сохранение существующих no-reset назначений, корректные counters/UUID422 и API proxy-reader tenant checks проверены на PostgreSQL и exact image. Полный W3, concurrent allocation и worker/provider acceptance этим не закрыты.

**Прогресс после v35:** [API v37 установлен](INSTALLED_RELEASE_V37.md). Квалификация и связанные target-данные лида получили tenant/platform guards; реальные HTTP/auth/ORM-контракты прошли на disposable PostgreSQL16 и точном image. W3 закрыт только в этой ограниченной части; остальные семьи объектов, concurrent ownership/RLS и полная матрица остаются открытыми. Бюджет не пересчитан без полноценного учёта оставшихся gates.

| ID | Пакет / приоритет | Бюджет,ч | Проверяемый выход | Зависимости |
|---|---|---:|---|---|
| W1 | Freeze объёма и всех submenu, P0 | 2–4 | Для61platform-page context: обещание→UI→API→consumer→storage→receipt; общий shared сценарий не дублировать. Утвердить WA campaigns/mailings, автоответы/прочие спорные promises. Финальный список исключений только по решению владельца | Доступная source/runtime evidence; без social writes |
| W2 | GitHub/CI/reproducibility, P1 | 4–8 | Installed/candidate чётко разделены; portable tests; полный scope accepted sources/migrations/workers; реальные CI checks по точному commit; merge только разрешённым workflow | W1; GitHub access/CI capability |
| W3 | Object ownership/RBAC/PostgreSQL, P0 | 8–16 | Disposable PostgreSQL,2tenant×roles; прямые HTTP/APIkey/objectID обходы запрещены для accounts/groups/leads/jobs/contacts/settings/team/admin; productionDB не трогать. RLS — если предусмотрен архитектурой | W1; реальные schema и registered routes |
| W4 | Scoring/ingestion parity, P1 | 6–12 | Одинаковые fixtures проходят все реальные consumer images; keywords/rules/AI overlays не теряются; incoming lead имеет верный tenant/platform/source/dedup. Только отсутствующий delta выпускается | W3; scoped worker maintenance при необходимости |
| W5 | Billing, P0 перед оплатами | 8–16 | Разрешённая упаковкаv13→exact image→install; sandbox checkout/webhook/subscription/cancel, подписи/idempotence/ownership; нет mock success и ложной отмены | Отдельный pending approval, sandbox; никаких реальных списаний |
| W6 | WA durable-v34, P1 | 2–4 | Переиспользовать готовый image, подтвердить legacy unknown disposition, sidecar-only install с прежним session mount; hashes/health/auth/unchanged siblings verified | Явное socket-interruption consent; unanswered prompt не согласие |
| W7 | TG/VK E2E, P1 | 8–16 | Connect/search/add-or-join/monitor→lead→score→contacts/export→stop; отдельно community и selected sources; campaign/mailings на разрешённых recipients; ошибки не empty-success | W3/W4 и выделенные ресурсы; VK search user authorization |
| W8 | FB E2E/Marketplace, P1 | 12–24 | Session→start→actualscan→lead→stop, Marketplace result, selectors/timeouts/unknown; восстановление после сбоя без fake success | W3/W4; разрешённые FB profile/group/Marketplace |
| W9 | MAX/WA E2E, P1 | 8–16 | MAX explicit webhook и один incoming lead при retry; WA connect/group parsing и разрешённый single send: accepted≠delivered; tenant и secret lifecycle | W3/W4/W6 и защищённые test resources |
| W10 | Автономные статьи/синдикация, P1 | 8–16 | Research/dedup/одна пара в день→реальный независимый review→actualpreview/browser→admission→CMS→exact API/body/archive/sitemap. Раздельный per-target syndication, auth/backoff/circuit-breaker и quota stop без paid fallback | Modelcapacity, nativeCMS, Blogger human OAuth при включённом target |
| W11 | Эксплуатация, P0/P1 | 8–16 | Именно24go.site backup+isolated restore; queueprogress, scoped rollback, health/readiness, privacy/log retention, наблюдаемые failures/alerts и ownership cleanup previews | W3; approvals на затрагиваемые ресурсы; не считать24go.asia backup доказательством |
| W12 | Финальный release acceptance, P0 | 8–16 | Согласованная матрица ролей/платформ/ошибок/RUEN/narrow; все promises covered, noP0/P1, exact commit/image receipts и72часа стабильности | W2–W11; passive observation дополнительно к инженерным часам |

Одна строка не закрывается количеством unit tests. Реальная внешняя приёмка привязывается к actor, разрешённому ресурсу, действию и receipt. Секреты не передаются в чат/отчёт/GitHub.

## 4. Критический путь и конечные этапы

1. **Freeze:** W1, подтвердить ресурсные зависимости и baseline календаря. Не разработка нового списка пожеланий.
2. **Основа:** W3 плюс разрешённый W6. Параллельно независимые W2/W10 без повторного canary после429 и без изменения провайдера.
3. **Consumers и бизнес:** W4, W5 после approvals, затем W7/W8/W9 на разрешённых ресурсах. Внешняя недоступность одного канала не останавливает независимые пакеты.
4. **Эксплуатация:** W11, фиксированный regression set и W12. Развёртывание одним владельцем на сервис; не несколько builders/deployers одновременно.
5. **Наблюдение:** минимум72часа на финальных кодовых версиях; закрыть накопленные failures, не переписывать их в ok.

Работа с UX/описаниями идёт внутри соответствующего пакета. Исторически принятые v27/v28/v29/v31–v33 не разрабатываются заново. Готовыйv34 не собирается повторно без изменения inputs.

## 5. Строгая приёмка автономности

- Не менее3последовательных плановых суточных циклов с настоящей independently accepted RU/EN публикацией и точным public readback; поздний ручной ремонт не засчитывается scheduled success.
- Review reject остаётся законным запретом публикации, не автоматически переименовывается в transport failure. До набора успешных циклов утверждение «ежедневно автономно публикуется» не принято.
- Daily claims/continuous lock/pending≤3/новых пар≤1 в день соблюдены; crash/unknown не порождает дубликат или второй slug.
- CMS transaction/reconciliation и platform checkpoints исключают слепой повтор неопределённой записи. Syndicator соблюдает publication-age window, не creation date.
- Quota/auth failure останавливает затронутый этап с явным blocker; нет бесконечного model retry, paid fallback или ложного scheduler ok. Независимые этапы продолжаются безопасно.
- Критическая ошибка наблюдаема оператором; согласованный канал alert проверен реальной доставкой, если включён. Local cron stdout не равен уведомлению в TUI.
- Модели/редактор/верификатор и exact-version/raw-response evidence сохранены. Числовые показатели и Google-index status не придумываются.

## 6. Что зависит от владельца/внешних систем

Единый список — OWNER_INPUTS.md: выделенные TG/VK/FB/MAX/WA ресурсы и разрешённые действия, WA interruption/legacy disposition, billing package approval+sandbox, Blogger OAuth consent, доступная модельная ёмкость без самовольного расширения расходов. Для critical alerts нужен согласованный канал; не подключать Telegram автоматически под обещание «автономности».

Не запрашивать пароли/токены/cookies/коды в чате. Не повторять unanswered maintenance prompt автоматически. Массовое включение портфельного intake запрещено под site-only scope. Сайт может быть автономен через ограниченные jobs без постоянно исполняющихся платных «директоров».

## 7. Контроль, чтобы релиз не стал бесконечным

Для каждой задачи хранить: ID/приоритет, владелец, состояние(candidate/packaged/installed/live-accepted/blocked), actual spent, remaining estimate, dependency, критерий выхода, receipt и GitHub commit. Hermes отвечает за реализацию/проверку/пакет/план; владелец — только защищённые решения и ресурсы. Специалисты назначаются лишь на доступном разрешённом маршруте, не по факту наличия профиля.

После каждого принятого пакета обновлять local plan и GitHub. Не открывать новый большой аудит вместо выпуска. НовыйP2 переносить за release freeze; новыйP0 явно занимает место в budget. Финальный отчёт содержит закрытые acceptance gates, незакрытые зависимости и изменённый forecast — не число тестов как процент готовности.
