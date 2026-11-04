"use client";
import Link from '@/components/PlatformLink';
import {useI18n} from '@/lib/i18n';
export function CampaignWorkspaceNav({active}:{active:'campaigns'|'mailings'}) {
 const {lang}=useI18n();
 return <section className="mb-6 space-y-2" aria-label={lang==='ru'?'Кампании и рассылки':'Campaigns & mailings'}>
  <h1 className="text-xl font-semibold">{lang==='ru'?'Кампании и рассылки':'Campaigns & mailings'}</h1>
  <nav className="flex flex-wrap gap-2" aria-label={lang==='ru'?'Режим кампании':'Campaign mode'}>
   <Link href="/campaigns" aria-current={active==='campaigns'?'page':undefined} className="rounded-lg border border-zinc-700 px-3 py-2">{lang==='ru'?'Публикации в группах':'Group posts'}</Link>
   <Link href="/mailings" aria-current={active==='mailings'?'page':undefined} className="rounded-lg border border-zinc-700 px-3 py-2">{lang==='ru'?'Личные сообщения':'Direct messages'}</Link>
  </nav>
  <p className="text-sm text-zinc-400">{lang==='ru'?'Публикации и личные сообщения — разные режимы. Доступность отправки зависит от платформы и подключённого аккаунта; сохранение или очередь не подтверждают доставку.':'Posts and direct messages are separate modes. Sending depends on platform support and the connected account; saved or queued does not mean delivered.'}</p>
 </section>;
}
