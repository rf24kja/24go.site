# 24go.site — аудит готовности к полному релизу

Дата проверки: 30 октября 2026, Asia/Bangkok. Объект: **24go.site**, не24go.asia. Аудит read-only: production не перезапускался, платежи/социальные действия/публикации для проверки не выполнялись.

## 1. Главный вывод
Сервис уже работает и имеет значительный установленный функционал, но **полная готовность пяти платформ и ежедневная автономная доставка статей пока не доказаны**. Главный остаток — не очередная косметика: незавершённые релизные пакеты, права на реальном PostgreSQL, сквозная внешняя приёмка и эксплуатационная автономность. Процент готовности по количеству меню/тестов не рассчитывается.

Это аудит release-readiness: свежие public/runtime/scheduler наблюдения + сверка сохранённых implementation/acceptance receipts + инвентаризация поверхности. Это НЕ новый сплошной authenticated E2E, pentest, нагрузочная проверка или проверка всех реальных социальных аккаунтов. Там, где нет доказательств, состояние записано как непроверенное, а не как неисправность или успех.

## 2. Что проверено заново
- Homepage, login, RU/EN blog, robots и sitemap: HTTP200. Это не доказывает авторизованные бизнес-сценарии.
- API health: status/database/redis=ok. Неавторизованный GET `/api/v1/leads/` отклонён HTTP401; это одна отрицательная проверка, не полнота RBAC.
- Полностью выгружены RU/EN public inventories с offset0/50/100: **106 разных slug**, одинаковые наборы локалей. В sitemap245URL; обе языковые ссылки каждого опубликованного slug присутствуют, пропусков0. Это не212 разных статей и не Google-index verdict.
- Реальные image IDs frontend/API/WA-sidecar соответствуют установленному v29; listener/scanner — v24, parser — v23. WA durable-v34 в production отсутствует, как и указано в плане.
- Нативные scheduler records: Publisher, Syndicator, indexing/link monitors исполняются; последний daily run failed с429. Blogger maintenance по-прежнему error. Portfolio Kanban intake paused — конфигурация ролей не является работающей автономной командой.
- Source route allowlist содержит **61 platform-page context**: TG20,VK21,WA9,FB7,MAX4. Это не61 независимая страница и не61 пройденный пользовательский тест. Полная перечисленная матрица — SUBMENU_MATRIX.csv.

## 3. Матрица готовности

| Область | Подтверждено | Незакрытый результат |
|---|---|---|
| Public frontend/SEO | Реальный public transport и полнота localized sitemap; установленные v27/v28 исправления | Полная authenticated RU/EN/narrow регрессия, a11y/ошибки по всем обещанным сценариям |
| TG | Установленные guards/search/join/settings/monitoring исправления и сохранённые fixtures | Разрешённые connect→search→add/join→scan→lead→score→stop; кампании/рассылки только на согласованных получателях |
| VK | Groups LP и selected wall/comments, persistence/cursor/dedup, queue capacity установлены | Реальная user authorization для groups.search и отдельная live приёмка community/selected sources |
| WA | Single-recipient sender v29 установлен; новый durable guard v34 упакован и проверен | Установка с scoped interruption consent; disposition старых unknown; реальное подключение/парсинг. Меню campaigns/mailings требует отдельной проверки контракта, single sender его не заменяет |
| MAX | Onboarding, explicit subscribe, payload/rules/dedup исправлены | Разрешённый бот/диалог и реальное incoming→один lead→правильный tenant/score |
| FB | Исправления connect/start-stop/bulk установлены | Реальные session/selectors/consumer/result и Marketplace на выделенных ресурсах |
| Contacts/settings/team/admin | Есть установленная API/UI основа и scoped regression receipts | Постатейная объектная изоляция, полный export/filter/pagination и реальные consumers; shared UI не равен независимому хранению |
| RBAC/tenancy | Server viewer readonly через JWT/API-key, отдельные tenant fixtures | Негативная сквозная проверка на disposable PostgreSQL для каждого объекта. RLS проверять, если это часть принятой архитектуры; не вводить новую архитектуру ради галочки |
| Billing | Проверенный candidate v13 существует | Его защищённая упаковка/установка и sandbox checkout→webhook→subscription/cancel с сохранением tenant ownership |
| Статьи/CMS | CSV RU/EN реально принят и доставлен; bounded generation и measured review установлены | Последующая созданная пара осталась review после отказов, daily завершился429. Нужны несколько настоящих scheduled delivery, не ручной поздний ремонт |
| Синдикация/ссылки | Telegraph size fix установлен; проблемная webhook статья реально размещена штатным hourly writer, backlink проверен | Blogger authorization; раздельная проверка будущих target receipts, сроков и полного external coverage |
| Эксплуатация | Работающие контейнеры и лёгкие мониторы | Site-specific restore drill, alerts, retry/circuit-breaker, worker progress, очередь, rollback и lifecycle временных candidates |
| GitHub | v29 app delta и automation v31–v33 отправлены; WA-v34 отдельно proposals | Проверенный CI и согласованный merge/release workflow; полный worker/migration reconciliation не заявлен |

## 4. Блокеры и приоритеты
**P0 перед полной коммерческой готовностью:** завершить доказательство tenant/object isolation; финансовый контракт перед приёмом платежей; отсутствие недоказанных успешных статусов/дублей при transport ambiguity; site-specific backup/restore. Не утверждается, что свежим аудитом доказана новая эксплуатация уязвимости: часть P0 — отсутствие обязательной приёмки.

**P1 до обещания полного продукта:** WA-v34 deployment/legacy disposition; TG/VK/FB/MAX/WA live scenarios; advertised WA campaigns/mailings scope; parity scoring; устойчивые daily editorial/CMS и Blogger auth/retry; CI и окончательная UI/error regression.

**P2 после фиксации релиза:** новые эффекты, необязательные redesign и дополнительные интеграции. Не должны отодвигать рабочий релиз.

## 5. Конкретные эксплуатационные наблюдения
- Running контейнер без Docker HEALTHCHECK не является доказанно сломанным, но его readiness/progress должен подтверждаться отдельным контрактом.
- Инвентаризация нашла работающие исторические preview/candidate контейнеры. Не удалялись: ownership и прежние cleanup approvals требуют сверки. Нужен один согласованный cleanup, не indiscriminate prune.
- Работающий scanner pool не означает, что исторические jobs завершились; нужно наблюдать полезный результат/продвижение, не только active IDs.
- Ошибка Blogger повторяется; новая авторизация и защита от бессмысленных постоянных повторов — отдельный gate. Primary CMS этим автоматически не заблокирован.
- Local-only cron output не уведомляет владельца в TUI. Должны быть согласованы операторский обзор и канал критических alerts; не обещать доставку без фактической проверки канала.
- Автономность сайта/публикаций не требует массово включать портфельные команды. Нужны ограниченные accountable routines с receipts, budget/stop rules и реальным independent review.

## 6. Доказательства и пределы
Свежие локальные machine-readable snapshots: RUNTIME.json, PUBLIC_AND_SCOPE.json, AUTOMATION.json. Полный контекст allowlist: SUBMENU_MATRIX.csv. Пакеты и старые приёмки: CURRENT_RELEASE.md и management/product-readiness/FULL_RELEASE_ACCEPTANCE.md; latest task gates — RESUME_CURRENT.md. В GitHub публикуется этот обезличенный вывод, а не credentials, полный host inventory, клиентские данные или provider responses.

Аудит не закрывает внешние проверки, для которых нет разрешённых ресурсов. Не переписывает review rejection, не делает платёж, не запускает новую генерацию после429 и не считает включённый scheduler успешной публикацией.
