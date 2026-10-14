# DRAFT RU

# Лента VK оценивает, купишь ли ты: разбираем товарные рекомендации

## Что случилось: два анонса за неделю

Коротко: 29 сентября команда AI VK описала отдельный контур товарных рекомендаций в ленте. А 6 октября VK подвела итоги года шопсов с Ozon - 9,5 млн выкупленных заказов. Лента больше не просто показывает посты - она предсказывает покупку.

Мы каждый день смотрим на VK как на канал лидов. Впервые платформа открыто сказала, что именно оптимизирует. Разбираем, что это меняет для тех, кто продаёт через сообщества.

## Как устроен товарный контур ленты

Коротко: внутри ленты работает отдельная модель. Она оценивает вероятность заказа, а не лайки. Заказ важнее всего, дальше - переход к партнёру. Лайки и просмотры весят сильно меньше.

Человек может лайкнуть пост про кроссовки и никогда их не купить. Поэтому товарные публикации вывели в отдельный домен: свои кандидаты, своё логирование, своя модель. Нерелевантные показы и негатив штрафуются.

Сложное место - холодный старт. Заказов мало, модели не на чем учиться. VK подняла логирование товарного домена с 2% до 100%, выборка выросла в 15 раз [ПРОВЕРИТЬ: рост логирования с 2% до 100% - это рост в 50 раз, а рост выборки заявлен в 15 раз; сверить оба числа с первоисточником]. Пока заказов не хватало, модель учили на частых сигналах: раскрытие текста поста и позитив.

Цифры приводит сама платформа, за март-август 2026: сквозная конверсия из показа в заказ выросла на 53%, заказов стало в 43,2 раза больше, переходов к партнёру - в 55,3 раза, показов товарных постов - в 28,3 раза. Первым партнёром выступил Ozon. Это данные VK про свой контур. К своему сообществу применяйте их с поправкой, прямых обещаний тут нет.

## Что это меняет для продавца

Коротко: охват перестаёт быть главной цифрой. Смотрите на стоимость заявки и долю заявок, дошедших до оплаты.

Пост с охватом в десять раз меньше, но с заказами, бьёт вирусный пост без заказов. К началу сентября число товарных публикаций добралось примерно до 5 тысяч в сутки. Конкуренция за товарное место в ленте растёт. Заходить лучше сейчас, пока окно открыто.

Подробнее про сдвиг охватов между платформами мы писали в разборе [VK против Telegram для B2B](https://www.24go.site/blog/vkontakte-vs-telegram-for-russian-b2b?locale=ru) - там цифры дневной активности обеих площадок.

Если возитесь с ручным поиском лидов по сообществам, гляньте [бесплатные инструменты 24GO](https://www.24go.site/tools) - анализатор групп и ROI-калькулятор экономят пару часов ручной работы. Дальше - про карточки.

## Карточка товара, которую лента поймёт

Коротко: один пост - один товар. В тексте цена, наличие и сроки, на фото сам товар. Первые строки называют товар сразу.

VK называет раскрытие текста одним из стартовых сигналов. Поэтому первые строки решают: там товар и повод читать дальше. Что проверить перед публикацией:

1. Один пост - один товар, не витрина из десяти позиций.
2. Цена, наличие, срок и условия - в тексте, а не только на картинке.
3. На фото сам товар, а не абстрактный баннер.
4. Один понятный следующий шаг: написать в сообщения, перейти в карточку, оформить заказ.

## Учёт заявок по источникам

Коротко: у каждой точки входа своя метка, заявку записывайте с источником в момент обращения.

Пост, реклама, сообщения сообщества, карточка товара - четыре разных источника. Смешивать их в одну кучу нельзя. Иначе вы не узнаете, что именно привезло заказ: лента, блогер или таргет. Как свести сайт, телефон и мессенджеры в одно окно, мы показывали на примере [интеграции Telegram-лидов с Bitrix24](https://www.24go.site/blog/telegram-lidy-v-bitrix24-instruktsiya?locale=ru) - механика та же: источник пишется в момент обращения. В конце месяца его уже не восстановить.

## Шопсы у блогеров через AdBlogger

Коротко: товары можно встраивать в посты блогеров с оплатой за выкупленный заказ. За год - 700 тысяч шопсов и 45 млрд просмотров.

Схема такая: продавец создаёт задание в кабинете Ozon, товары появляются в каталоге VK AdBlogger, автор ставит товар в пост и получает деньги за каждую купленную единицу. Лучше всего продавались товары для дома, бытовая химия, косметика и зоотовары. Средний пост за год дал около 13 заказов - рабочий ориентир для первой проверки.

## Как перехватывать спрос мониторингом

Коротко: пока все смотрят в ленту, спрос виден ещё и в обсуждениях сообществ. Мы читаем их автоматически.

Лента решает, что показать. Но люди каждый день пишут в сообществах прямым текстом: спрашивают цены, наличие, сроки, жалуются на конкурентов. Это намерение купить в чистом виде. От алгоритма ранжирования оно не зависит.

Мы в 24GO мониторим такие сообщества круглосуточно: сообщение с intent'ом падает менеджеру за минуту с пометкой источника. Как настроить такой мониторинг с нуля, разбирали в [настройке парсинга ВКонтакте](https://www.24go.site/blog/nastroyka-parsinga-vkontakte?locale=ru).

## Грабли: 5 ошибок продавцов

Коротко: почти все сливают бюджет в одних и тех же пяти местах.

| Ошибка | Почему бьёт |
|---|---|
| Пост-витрина из 10 товаров | Модель не понимает, что ранжировать |
| Цена только на картинке | Текст без цены не даёт сигнал |
| Нет следующего шага | Заявке некуда прийти |
| Заявки без источников | Непонятно, что масштабировать |
| Ставка только на охват | Охват не равен заказам |

## Частые вопросы

**Как попасть в товарный контур?**
Условий допуска для малого бизнеса VK не раскрыла. Рабочий вариант: приведите в порядок карточки и сравните заявки из Маркета и из постов за месяц.

**Шопсы подходят B2B?**
Механика заточена под товары с корзиной. Для услуг работает связка: пост с оффером + заявка в сообщения + учёт источника.

**Лента меняется - что делать?**
Механика принадлежит платформе. Веса и квоты поменяют без спроса. Поэтому стройте учёт заявок и мониторинг обсуждений - эти активы от алгоритма не зависят.

## Источники

- [Habr, AI VK: товарные рекомендации](https://habr.com/ru/companies/vk/articles/1088034/)
- [Lenta: 9,5 млн заказов через шопсы](https://lenta.ru/news/2026/10/06/raskryto-kolichestvo-zakazov-polzovateley-vkontakte-cherez-shopsy/)
- [РИА: итоги года шопсов](https://ria.ru/20261006/vkontakte-2122580064.html)
- [VK: шопсы для продавцов](https://ads.vk.com/insights/shopsy-vkontakte-dlya-prodavcov)
- [AdBlogger: авторам](https://adblogger.vk.ru/for-authors)
- [Разбор намерения купить в ленте](https://chimitdorzhi.tech/blog/vk-namerenie-kupit-lenta-reklama-malyy-biznes-2026/)

Полная картина по товарному направлению VK - за один заход: попробуйте [бесплатные инструменты 24GO](https://www.24go.site/tools) - триал 3 дня, дальше решите сами.

---

# DRAFT EN

# VK Ranks Products by Purchase Intent: What Sellers Should Do

## What happened: two announcements in a week

Short version: on September 29 the VK AI team described a separate product-recommendation track inside the feed, and on October 6 VK summed up a year of Ozon shops - 9.5 million redeemed orders. The feed no longer just shows posts, it predicts purchases.

We watch VK as a lead channel every day, and this is the first time the platform openly said what it optimizes for. Here is what it changes for community sellers.

## How the product track works

Short version: a separate model scores the probability of an order, not likes. Orders rank highest, then partner clicks, likes and views far below.

A person can like sneakers and never buy them, so product posts were moved into their own domain with separate candidates, logging and ranking model. Irrelevant shows and negative reactions get penalized.

The interesting part is the cold start problem. Orders are rare, so the model had little to learn from. VK raised logging of the product domain from 2% to 100%, growing the training sample 15 times. While orders were scarce, the model learned on frequent signals: expanding post text and positive reactions.

The platform cites its own numbers for March-August 2026: show-to-order conversion up 53%, orders up 43.2 times, partner clicks up 55.3 times, product post shows up 28.3 times. Ozon was the first partner. Read these as platform data about its own track, not a promise for your community.

## What it changes for sellers

Short version: reach stops being the headline metric. Watch cost per lead and the share of leads that reach payment.

A post with ten times less reach but real orders beats a viral post with none. By early September product publications hit roughly 5 thousand a day - competition for product slots grows, better to enter while the window is open.

We covered the reach shift across platforms in [VK vs Telegram for B2B](https://www.24go.site/blog/vkontakte-vs-telegram-for-russian-b2b?locale=en) - with daily activity numbers for both.

On numbers: if you do manual lead search across communities, check [24GO free tools](https://www.24go.site/tools) - the group analyzer and ROI calculator save a couple of manual hours. Now - the cards.

## Product cards the feed understands

Short version: one post, one product. Price, availability and terms in the text, the product itself in the photo. First lines name the product right away.

VK calls text expansion one of the starter signals, so the first lines decide: product plus a reason to keep reading. Checklist before publishing:

1. One post, one product - not a ten-item showcase.
2. Price, availability, terms in the text, not only on the image.
3. The product itself in the photo, not an abstract banner.
4. One clear next step: message the community, open the card, place the order.

## Track lead sources

Short version: every entry point gets its own label, record the source at the moment of contact.

Posts, ads, community messages, product cards are four different sources - never mix them into one pile. Otherwise you will never learn what brought the order: feed, blogger or targeting. We showed how to merge site, phone and messengers into one window using [Telegram leads to Bitrix24](https://www.24go.site/blog/telegram-lidy-v-bitrix24-instruktsiya?locale=en) - same mechanics: source recorded at contact time, not recalled at month end.

## Blogger shops via AdBlogger

Short version: products go inside blogger posts with pay per redeemed order. One year produced 700 thousand shops and 45 billion views.

Sellers create tasks in the Ozon cabinet, products appear in the VK AdBlogger catalog, authors place them into posts and earn per purchased unit. Home goods, household chemistry, cosmetics and pet products sold best. The average post delivered about 13 orders last year - a working benchmark for a first test.

## Catching demand with monitoring

Short version: while everyone watches the feed, demand is also visible in community discussions. We read them automatically.

The feed decides what to show. But people write in communities every day in plain text: asking prices, availability, terms, complaining about competitors. That is purchase intent in pure form, independent of ranking algorithms.

At 24GO we monitor such communities around the clock: an intent message reaches a manager within a minute, tagged with its source. Setting up monitoring from scratch is covered in our [VKontakte parsing setup](https://www.24go.site/blog/nastroyka-parsinga-vkontakte?locale=en).

## Mistakes: 5 ways sellers burn budget

Short version: almost everyone loses money in the same five spots.

| Mistake | Why it hurts |
|---|---|
| Ten-product showcase post | The model cannot tell what to rank |
| Price only on the image | Text without price gives no signal |
| No next step | The lead has nowhere to go |
| Leads without sources | Impossible to know what to scale |
| Betting on reach alone | Reach does not equal orders |

## FAQ

**How do I get into the product track?**
VK disclosed no entry terms for small business. Practical move: fix your cards and compare Market vs post leads over a month.

**Do shops work for B2B?**
The mechanics fit basket goods. For services use: offer post + message lead + source tracking.

**The feed keeps changing - what to do?**
The mechanics belong to the platform, weights change without asking. So build lead tracking and discussion monitoring - assets independent of any algorithm.

## Sources

- [Habr, VK AI: product recommendations](https://habr.com/ru/companies/vk/articles/1088034/)
- [Lenta: 9.5M orders via shops](https://lenta.ru/news/2026/10/06/raskryto-kolichestvo-zakazov-polzovateley-vkontakte-cherez-shopsy/)
- [RIA: year of shops results](https://ria.ru/20261006/vkontakte-2122580064.html)
- [VK: shops for sellers](https://ads.vk.com/insights/shopsy-vkontakte-dlya-prodavcov)
- [AdBlogger: for authors](https://adblogger.vk.ru/for-authors)
- [Purchase-intent feed breakdown](https://chimitdorzhi.tech/blog/vk-namerenie-kupit-lenta-reklama-malyy-biznes-2026/)

The full VK commerce picture in one go: try [24GO free tools](https://www.24go.site/tools) - 3-day trial, then decide for yourself.
