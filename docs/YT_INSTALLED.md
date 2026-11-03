# YouTube — installed tenant administration / установленное управление

## RU
1. Владелец/администратор организации открывает **YouTube → Настройки** (`/YT/settings`). Создайте отдельный Google Cloud OAuth **Web application** для 24go.site, включите YouTube Data API v3 и зарегистрируйте точный redirect `https://www.24go.site/YT/callback`; настройте аудиторию/тестовых пользователей в Google.
2. Введите client ID и secret в защищённой форме сайта; явно разрешите только OAuth и сохраните. Поля очищаются после сохранения, секрет не возвращается API. SSH и изменение общей конфигурации не требуются. Не присылайте секреты/коды/redirect URL в чат, Git или отчёт.
3. Откройте **Аккаунты → Подключить Google**, пройдите Google consent и подтвердите callback на сайте. Наличие конфигурации не доказывает успешный consent/доставку.
4. **Каналы**, **Шаблоны**, **Очередь**, **Помощь** — отдельные действующие разделы. Мониторинг и отправка управляются независимо; форма настройки приложения их не включает. Отправка требует approved/approved_by и выбранного подключённого аккаунта. Локальное удаление аккаунта не равно отзыву Google grant; используйте явное действие отзыва/Google Connections.

## EN
1. Organization owner/admin opens **YouTube → Settings** (`/YT/settings`). Create a dedicated Google Cloud OAuth **Web application** for 24go.site, enable YouTube Data API v3, register exactly `https://www.24go.site/YT/callback`, and configure audience/test users in Google.
2. Enter client ID/secret in the protected website form, explicitly permit OAuth only, then save. Fields clear after save; API never returns the secret. No SSH or shared configuration edit is required. Never put credentials/codes/redirect URLs in chat, Git or reports.
3. Open **Accounts → Connect Google**, complete Google consent, and confirm the callback on the website. Configured is not connected or externally verified.
4. **Channels**, **Templates**, **Queue**, **Help** are implemented destinations. Monitoring and posting are independent and are not enabled by this form. Sending requires approved/approved_by plus a selected connected account. Local deletion is not Google grant revocation; use the explicit revoke action/Google Connections.

## Exact installed scope and rebuild boundary
Dashboard `sha256:fc85f555f7cedbec16ece76b55b96823a021838a4fb4a97b24376cc930089e76`, BUILD_ID `lht3SWL62Apmgt1eILKAO`; API `sha256:d5e8ab87610d90082390f067a2b955e20e6210340902c539fef84f6ac9f7054f`. Tenant clients currently unconfigured; monitoring/posting OFF. Accepted real registered JWT/PostgreSQL contracts and compiled RU/EN browser tests use synthetic provider boundaries, NOT live Google acceptance.

`verification/yt-settings/accepted-source.json` pins full accepted frontend build inputs and role-specific YT source. API modules live at `services/backend/yt*.py`; schema files at `services/backend/alembic/versions`. Worker/Beat accepted modules are separately preserved at `extensions/yt/{worker,beat}`: never copy API-only settings implementation over these roles. This export is source reconciliation, not a new deployment or whole-repository acceptance. Older non-YT backend/worker/image provenance remains outside this export.

The operational release uses the complete nine-file chain: base, seo, backend, vk-dispatch, platform, listener-capacity, portfolio-brand, yt, yt.frontend. Never redeploy the historical seven-file chain or infer that an ordinary root Compose rebuild preserves the factory entrypoint, YT mounts, role dependencies, applied schema or installed worker pins. Existing database migrations must not be downgraded; root backend startup can run Alembic. No production rebuild/migration is authorized by a source push. Use the accepted image pins plus the current private deployment chain until an independently accepted replacement exists. Secret-bearing resolved Compose/runtime files are intentionally not in Git.

Legacy `configure_oauth.py` edits shared runtime state, not a tenant client. It is maintenance-only, not the onboarding path. Tenant settings take precedence and deliberately have no shared-client fallback; running that helper does not configure the website tenant.
