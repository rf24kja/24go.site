interface Props { ru: boolean; configured: boolean; login?: boolean; authenticated: boolean; monitoring: boolean; posting: boolean; }
export default function YTOAuthSetup({ru,configured,login=false,authenticated,monitoring,posting}: Props) {
 const value=(yes:boolean)=>yes?(ru?'да':'yes'):(ru?'нет':'no');
 return <aside className="rounded border border-zinc-700 p-4 space-y-3" aria-label={ru?'Настройка OAuth YouTube':'YouTube OAuth setup'}>
 <h2>{ru?'Подключение YouTube через Google':'Connect YouTube through Google'}</h2>
 <dl className="grid gap-2">
 <div><dt>{ru?'Приложение OAuth настроено':'OAuth application configured'}</dt><dd>{value(configured)}</dd></div>
 <div><dt>{ru?'Сохранён подключённый аккаунт':'Connected account saved'}</dt><dd>{value(authenticated)} — {ru?'не проверка текущего доступа Google':'not a live Google access check'}</dd></div>
 <div><dt>{ru?'Внешний мониторинг разрешён':'External monitoring permitted'}</dt><dd>{value(monitoring)} — {ru?'нужны включённый канал, шаблон и worker':'requires an enabled channel, template and worker'}</dd></div>
 <div><dt>{ru?'Вход через Google разрешён':'Google login permitted'}</dt><dd>{value(login&&configured)} — {ru?'нужны настроенное приложение и разрешение OAuth':'requires configured application and OAuth permission'}</dd></div>
 <div><dt>{ru?'Подтверждённая отправка разрешена':'Approved sending permitted'}</dt><dd>{value(posting)} — {ru?'каждый комментарий подтверждается отдельно':'each comment requires separate approval'}</dd></div>
 </dl>
 <ol className="list-decimal pl-6 space-y-2">
 <li>{ru?'Оператор: создайте отдельный Google Cloud проект для 24go.site YouTube, включите YouTube Data API v3 и настройте Google Auth Platform (аудитория, контакты, тестовые пользователи при Testing). Не используйте Search Console или чужие приложения.':'Operator: create a dedicated Google Cloud project for 24go.site YouTube, enable YouTube Data API v3 and configure Google Auth Platform (audience, contacts and test users while Testing). Do not reuse Search Console or unrelated applications.'}</li>
 <li>{ru?'Создайте OAuth client типа Web application. Точный Authorized redirect URI:':'Create an OAuth client of type Web application. Exact Authorized redirect URI:'} <code>https://www.24go.site/YT/callback</code>. {ru?'Разрешение:':'Scope:'} <code>https://www.googleapis.com/auth/youtube.force-ssl</code>.</li>
 <li>{ru?'Владелец или администратор: откройте настройки OAuth и введите Client ID и Client secret по HTTPS. Сохраните настройки и при необходимости включите только OAuth. Мониторинг и публикация не включаются. Секреты не вводятся в чат.':'Owner or administrator: open OAuth settings and enter the Client ID and Client secret over HTTPS. Save and optionally enable OAuth only. Monitoring and posting are not enabled. Never enter secrets in chat.'} <a href="/YT/settings" className="underline">{ru?'Настройки OAuth':'OAuth settings'}</a></li>
 <li>{ru?'После настройки и разрешения внешнего провайдера владелец/администратор нажимает «Подключить Google» на странице аккаунтов, выбирает Google-аккаунт с нужным YouTube-каналом и подтверждает согласие. Возврат выполняется автоматически; коды и адрес возврата не отправляйте в чат.':'Once configuration and external provider access are enabled, an owner/admin clicks Connect Google on Accounts, chooses the Google identity owning the intended YouTube channel and consents. Return is automatic; never send authorization codes or callback URLs in chat.'}</li>
 </ol>
 <p>{ru?'Отключить — удалить локальный сохранённый доступ, а не отозвать разрешение у Google. Для полного отзыва откройте Google Connections и удалите именно приложение 24go.site YouTube. Это может отключить все его подключения для этой Google-учётной записи.':'Disconnect removes locally saved access; it does not revoke the Google grant. To revoke fully, open Google Connections and remove the dedicated 24go.site YouTube application. This can disconnect all its connections for that Google identity.'}</p>
 <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">{ru?'Управление доступом в Google':'Manage access in Google'}</a>{' · '}
 <a href="/YT/accounts">{ru?'К аккаунтам YouTube':'YouTube accounts'}</a>{' · '}
 <a href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noreferrer">Google Cloud OAuth clients</a>
 </aside>;
}
