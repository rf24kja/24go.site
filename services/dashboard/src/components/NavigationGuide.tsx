"use client";
import {useI18n} from '@/lib/i18n';
import {usePlatform} from '@/lib/platform';
import {useAuth} from '@/lib/auth';
import Link from '@/components/PlatformLink';
export function NavigationGuide(){
 const {lang}=useI18n();const {platform}=usePlatform();const {auth}=useAuth();
 if(platform==='telegram'||platform==='vkontakte')return <section className="mb-6 rounded-xl border border-zinc-800 p-4 space-y-3" aria-label={lang==='ru'?'Навигация':'Navigation'}>
  <h2 className="font-semibold">{lang==='ru'?`Навигация ${platform==='telegram'?'Telegram':'VK'}`:`${platform==='telegram'?'Telegram':'VK'} navigation`}</h2>
  <ul className="space-y-2 text-sm text-zinc-400">
   <li><Link href="/leads" className="text-emerald-400">{lang==='ru'?'Лиды → Список / Правила':'Leads → List / Rules'}</Link>{lang==='ru'?' — правила независимы для выбранного сервиса.':' — rules are scoped independently to the selected service.'}</li>
   <li><Link href="/targets" className="text-emerald-400">{lang==='ru'?'Группы → Поиск / Мониторинг':'Groups → Search / Monitoring'}</Link>{lang==='ru'?' — найденный или сохранённый кандидат не означает включённый мониторинг. Мониторинг запускается отдельно.':' — a found or saved candidate is not enabled monitoring. Start monitoring separately.'}</li>
   <li><Link href="/accounts" className="text-emerald-400">{lang==='ru'?'Аккаунты → Аккаунты / Прокси':'Accounts → Accounts / Proxies'}</Link>{lang==='ru'?' — пул прокси общий для команды; назначение аккаунту выполняется отдельно.':' — the proxy pool is shared across the tenant; account assignment is separate.'}</li>
   <li><Link href="/campaigns" className="text-emerald-400">{lang==='ru'?'Кампании и рассылки':'Campaigns & mailings'}</Link>{lang==='ru'?' — публикации и личные сообщения используют разные действия. Очередь не подтверждает доставку.':' — group posts and direct messages use distinct actions. A queue entry is not confirmed delivery.'}</li>
   <li><Link href="/settings" className="text-emerald-400">{lang==='ru'?'Настройки → Настройки / Диагностика':'Settings → Settings / Diagnostics'}</Link>{lang==='ru'?' — параметры выбранной платформы; профиль и безопасность относятся к аккаунту. Оплата общая.':' — selected-platform configuration; profile and security belong to your user account. Billing is shared.'}</li>
  </ul>
  {auth.user?.email==='rf24krsk@gmail.com'&&<p className="text-sm text-zinc-400">{lang==='ru'?'Команда, аудит и управление блогом — внутри Owner Dashboard рядом с логотипом.':'Team, Audit and Blog management are inside Owner Dashboard next to the logo.'}</p>}
 </section>;
 if(!['telegram','vkontakte','whatsapp'].includes(platform))return null;
 return <section className="mb-6 rounded-xl border border-zinc-800 p-4 space-y-3" aria-label={lang==='ru'?'Навигация':'Navigation'}>
  <h2 className="font-semibold">{lang==='ru'?'Коротко о навигации':'Navigation at a glance'}</h2>
  <ol className="list-decimal pl-5 space-y-2 text-sm text-zinc-400">
   <li>{lang==='ru'?'Выберите платформу, затем подключите аккаунт в «Аккаунтах».':'Choose a platform, then connect an account in Accounts.'}</li>
   <li><Link href="/campaigns" className="text-emerald-400">{lang==='ru'?'Кампании и рассылки':'Campaigns & mailings'}</Link>{lang==='ru'?' — одно рабочее место с режимами «Публикации в группах» и «Личные сообщения». Режимы используют разные механизмы; доступность отправки зависит от платформы.':' is one workspace with Group posts and Direct messages modes. These use distinct mechanisms; sending availability depends on the platform.'}</li>
   <li>{lang==='ru'?'Настройки относятся к выбранной платформе; профиль и безопасность — к вашему аккаунту. Сохранение настроек или очередь не подтверждают внешнюю доставку.':'Settings apply to the selected platform; profile and security apply to your account. Saved settings or a queued item do not confirm external delivery.'}</li>
  </ol>
  {auth.user?.email==='rf24krsk@gmail.com'&&platform!=='whatsapp'&&<p className="text-sm text-zinc-400">{lang==='ru'?'Owner Dashboard и Команда — сверху рядом с логотипом. Журнал аудита и Команда также находятся внутри Owner Dashboard. Доступ только rf24krsk@gmail.com.':'Owner Dashboard and Team are next to the logo. Audit logs and Team are also inside Owner Dashboard. Only rf24krsk@gmail.com has access.'}</p>}
 </section>;
}
