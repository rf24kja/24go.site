# 24go.site — план завершения полного сервиса

Актуальный аудит:30октября2026. Разработка не объявлена завершённой по успешному HTTP200, числу меню или fixtures.

- [Полный аудит готовности](docs/RELEASE_READINESS_AUDIT.md)
- [Подробный план:12пакетов, зависимости и критерии выхода](docs/RELEASE_COMPLETION_PLAN.md)
- [Матрица61platform-page context](docs/release/SUBMENU_MATRIX.csv)
- [Машиночитаемая оценка](docs/release/ESTIMATE.json)

## Когда закончим
Базовые пакеты82–164engineering hours. С учётом20–40часов scope-risk на advertised/unwired workflows и20%резерва —122.4–244.8часа, **16–31рабочий день**, ориентировочно **4–7рабочих недель** при обеспеченных ресурсах. В конце требуется минимум72часа стабильности и несколько настоящих плановых суточных доставок.

Это оценка одного release owner при8focused hours/day, не гарантированная календарная дата. Квота модели, OAuth, maintenance/billing approvals и тестовые social resources пока не обеспечены полностью; время ожидания в бюджет не включено. После freeze объёма фиксируется уточнённый старт/forecast, новые необязательные функции уходят за релиз.

## Критический путь
1. Freeze всех обещанных сценариев; WA campaigns/mailings не подменять single sender.
2. Права/tenant isolation на disposable PostgreSQL; CI/reproducible source.
3. Установка готового WA-v34 после scoped consent, consumer/scoring parity, billing sandbox после защищённых разрешений.
4. TG/VK/FB/MAX/WA реальные сквозные проверки на выделенных ресурсах.
5. Устойчивые autonomous articles/CMS/syndication, backup/restore, alerts и rollback.
6. Финальная RU/EN/narrow regression,72часа стабильности, noP0/P1 в согласованном объёме.

Installed v29 и automationv31–v33 сохранены. WA-v34 отдельно в proposals, не установлен. Pending billing, live-provider и quota gates не закрываются этим документом. Полный audit является release-readiness обзором с явными непроверенными сценариями, не новым сплошным authenticated E2E/pentest.
