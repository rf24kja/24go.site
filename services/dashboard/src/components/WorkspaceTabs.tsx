"use client";
import Link from '@/components/PlatformLink';
import {usePathname} from 'next/navigation';
import {usePlatform} from '@/lib/platform';
import {useI18n} from '@/lib/i18n';
const groups = [
 {pages:['leads','lead-rules'],en:['List','Rules'],ru:['Список','Правила'],enNote:'Rules apply only to the selected service.',ruNote:'Правила применяются только к выбранному сервису.'},
 {pages:['targets','groups'],en:['Search','Monitoring'],ru:['Поиск','Мониторинг'],enNote:'Found and saved candidates are separate from monitored groups. Saving does not start monitoring.',ruNote:'Найденные и сохранённые кандидаты отличаются от групп мониторинга. Сохранение не запускает мониторинг.'},
 {pages:['accounts','proxies'],en:['Accounts','Proxies'],ru:['Аккаунты','Прокси'],enNote:'Shared tenant proxy pool. Assignments to accounts are separate.',ruNote:'Общий пул прокси команды. Назначения аккаунтам выполняются отдельно.'},
 {pages:['settings','health'],en:['Settings','Diagnostics'],ru:['Настройки','Диагностика'],enNote:'Diagnostics is read-only; saved configuration is not proof of provider connectivity.',ruNote:'Диагностика — проверка состояния. Сохранённые параметры не подтверждают подключение к провайдеру.'},
];
export function WorkspaceTabs(){
 const pathname=usePathname();const {platform}=usePlatform();const {lang}=useI18n();
 if(platform!=='telegram' && platform!=='vkontakte')return null;
 const page=pathname.replace(/^\/(?:TG|VK)\//,'').split('/')[0];
 const group=groups.find(g=>g.pages.includes(page));if(!group)return null;
 return <section className="mb-6 min-w-0 space-y-3" aria-label={lang==='ru'?'Разделы рабочего пространства':'Workspace sections'}>
  <nav aria-label={lang==='ru'?'Вкладки раздела':'Section tabs'} className="flex flex-wrap gap-2">
   {group.pages.map((p,i)=><Link key={p} href={'/'+p} aria-current={p===page?'page':undefined} className={'min-h-[44px] rounded-lg border px-4 py-3 text-sm '+(p===page?'border-emerald-500 bg-emerald-500/10 text-emerald-300':'border-zinc-700 text-zinc-400 hover:text-zinc-100')}>{(lang==='ru'?group.ru:group.en)[i]}</Link>)}
  </nav>
  <p className="text-sm text-zinc-400 break-words">{lang==='ru'?group.ruNote:group.enNote}</p>
 </section>;
}
