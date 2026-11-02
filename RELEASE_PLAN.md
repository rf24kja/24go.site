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
Проверены cron и редакционная цепочка 2ноября2026: [v40 — installed Blogger diagnostics и реальные блокеры](docs/EDITORIAL_AUTOMATION_V40.md). Генератор остановился по HTTP429 до создания сегодняшней пары; основная CMS доступна, ready-очередь пуста; Blogger возвращает фактический400 invalid_grant. Наличие расписаний не закрывает W10. Требуются модельная ёмкость на прежнем маршруте и защищённое OAuth-согласие, не повтор failed canary и не paid fallback.

Установлен [v39 — sitemap/robots SEO и GEO](docs/INSTALLED_RELEASE_V39.md): реальные даты CMS, языковые XML-связи, приватные crawl-исключения и полная публичная приёмка инвентаря. Это техническая доступность, не гарантия индексации/цитирования и не закрытие автономных публикаций.

Установлен [v38 — proxy safety](docs/INSTALLED_RELEASE_V38.md): no-reset сохраняет привязки, неверные ID422, API proxy readers tenant-bound. Проверено на отдельном PostgreSQL и точном image; frontend/workers/WA не заменялись. Это следующий ограниченный W3/надёжность пакет, не завершение полного W3.

Прогресс W3: установлен [API delta v37](docs/INSTALLED_RELEASE_V37.md) — границы ссылок при квалификации и чтении связанных данных лида проверены на disposable PostgreSQL. W3 остаётся открытым для остальных object families/RBAC/RLS; это не закрытие полного пакета по одному router.

1. Freeze всех обещанных сценариев; WA campaigns/mailings не подменять single sender.
2. Права/tenant isolation на disposable PostgreSQL; CI/reproducible source.
3. Установка готового WA-v34 после scoped consent, consumer/scoring parity, billing sandbox после защищённых разрешений.
4. TG/VK/FB/MAX/WA реальные сквозные проверки на выделенных ресурсах.
5. Устойчивые autonomous articles/CMS/syndication, backup/restore, alerts и rollback.
6. Финальная RU/EN/narrow regression,72часа стабильности, noP0/P1 в согласованном объёме.

## Документация репозитория
Добавлены [English README](README.md) и [русский README](README.ru.md), реальные публичные RU/EN скриншоты, локализованные SVG-обложки и схемы архитектуры/редакционного процесса. Возможности, внешняя приёмка и неустановленный WA-кандидат разделены явно; исторический DEPLOY.md помечен как устаревший. Это документационный пакет, не изменение production и не закрытие W1–W12. Бюджет и критерии полного релиза не пересчитаны по факту оформления README.

Installed v29 и automationv31–v33 сохранены. WA-v34 отдельно в proposals, не установлен. Pending billing, live-provider и quota gates не закрываются этим документом. Полный audit является release-readiness обзором с явными непроверенными сценариями, не новым сплошным authenticated E2E/pentest.
