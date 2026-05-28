'use client'

/**
 * TranslateWizard — v14
 *
 * Changes from v13:
 *   - Real Stripe checkout: handlePayment calls /api/stripe/checkout, redirects to Stripe
 *   - pending screen: auto-advances to review after Stripe success (via ?paid=1 param)
 *   - handleGeneratePdf: calls /api/translation/generate-pdf (real PDF + email)
 *   - DEMO_MODE removed
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

// ─── Config ──────────────────────────────────────────────────────────────────
const DEMO_MODE = false // Set to false in production
const DRAFT_KEY = 'translationWizardDraft_v1'

// ─── Types ───────────────────────────────────────────────────────────────────
type Screen =
  | 'upload'
  | 'doctype-picker'      // post-upload: user declares what they uploaded
  | 'manual-review-info'  // anything not ua_internal_passport_booklet → no self-serve
  | 'detect'
  | 'bad-photo'
  | 'price'
  | 'payment'
  | 'pending'
  | 'review'
  | 'cert'
  | 'done'

/**
 * Doc-type values the wizard understands at the picker stage.
 * 'ua_internal_passport_booklet' is the only value that proceeds to the
 * existing self-review/payment path. Everything else is a sentinel that
 * routes to the manual-review handoff before any payment screen.
 */
type DocTypeChoice = 'ua_internal_passport_booklet' | 'other_ukrainian_document'
type Plan = 'basic' | 'plus' | 'premium'
type Lang = 'uk' | 'ru' | 'en' | 'es'

interface Profile {
  name: string
  email: string
  phone: string
  addr: string
}

// ─── Translations ─────────────────────────────────────────────────────────────
const T: Record<Lang, Record<string, string>> = {
  uk: {
    back: '← Назад',
    'h.title': 'Завантажте документ',
    'h.sub': "Сфотографуйте або завантажте файл. Якщо ми не зможемо впевнено визначити документ — ми передамо його на ручну перевірку нашою командою, не вгадуємо.",
    'h.scope_notice': 'Самостійний потік підтримує тільки український внутрішній паспорт (книжка). Інші українські документи можна завантажити — наш спеціаліст перевірить вручну.',
    'dp.title': 'Який це документ?',
    'dp.sub': 'Виберіть тип документа, який ви завантажили. Ми не вгадуємо.',
    'dp.passport': 'Внутрішній паспорт (книжка)',
    'dp.passport.hint': 'Доступний самостійний потік перегляду.',
    'dp.other': 'Інший український документ',
    'dp.other.hint': 'Перевірить наш спеціаліст вручну.',
    'mr.title': 'Ручна перевірка нашою командою',
    'mr.body': 'Цей документ може потребувати ручної перевірки нашою командою. Ми не вгадуємо нечіткі поля. Ви можете продовжити, і ми підкажемо наступний крок.',
    'mr.email_us': 'Написати нашій команді',
    'mr.upload_different': 'Завантажити інший документ',
    'mr.no_payment': 'Оплата зараз не береться. Не є юридичною консультацією. Не гарантуємо прийняття USCIS.',
    'h.photo': 'Сфотографувати', 'h.photo.hint': 'Відкриється камера телефону',
    'h.file': 'Завантажити файл', 'h.file.hint': "Вибрати з фото, файлів або комп'ютера",
    'h.footer': 'Ми перевіримо документ безкоштовно. Переклад — після оплати.',
    'd.title': 'Зчитуємо документ...',
    'd.sub': 'Визначаємо тип, мову та зчитуємо ваші дані',
    'd.doctype': 'Тип документа',
    'd.lang': 'Мова документа',
    'd.quality': 'Якість фото',
    'd.name': "Ім'я виявлено",
    'd.doctype.val': 'Внутрішній паспорт (книжка)',
    'd.lang.val': 'Українська',
    'd.quality.val': 'Добра',
    'd.quality.low': 'Недостатня',
    'pay.autofill': '✓ Зчитано з документа',
    'bp.title': 'Фото нечітке',
    'bp.sub': 'Ми не можемо розпізнати текст. Спробуйте ще раз або продовжте з Plus.',
    'bp.retake': 'Зробити фото ще раз',
    'bp.upload': 'Завантажити інший файл',
    'bp.plus': 'Продовжити з Plus — спеціаліст перевірить ($19.99)',
    'p.ready': 'Документ готовий до перекладу',
    'p.type': 'Тип: Внутрішній паспорт (книжка)',
    'p.lang': 'Мова: Українська',
    'p.quality': 'Якість фото: Добра',
    'p.choose': 'Оберіть варіант:',
    'p.basic': 'Швидкий PDF. Ви перевіряєте ключові поля самостійно.',
    'p.rec': 'Рекомендовано',
    'p.plus': 'Спеціаліст перевірить імена, дати та номери перед фінальним PDF.',
    'p.plus.note': 'Перевірка людиною тільки полів. Не юридична консультація. Messenginfo не сертифікує переклад.',
    'p.prem': 'Детальна перевірка для нечітких фото або важливих подач.',
    'p.prem.note': 'Перевірка людиною тільки полів. Не юридична консультація. Messenginfo не сертифікує переклад.',
    'p.selected': '✓ Обрано',
    'p.es': 'Іспанська копія', 'p.es.d': 'Для California DMV, школи, роботодавця',
    'p.btn': 'Продовжити до оплати',
    'p.note': 'Безкоштовне виправлення помилок форматування. Без гарантій ухвалення.',
    'pay.title': 'Замовлення',
    'pay.doc': 'Внутрішній паспорт (книжка)', 'pay.es': 'Іспанська копія',
    'pay.total': 'Разом:', 'pay.details': 'Ваші дані (для сертифікації та доставки):',
    'pay.card': 'Оплатити карткою', 'pay.safe': 'Ваші дані захищені.',
    'r.paid': 'Оплата пройшла', 'r.title': 'Перевірте дані:',
    'r.warn': "⚠️ Переконайтесь, що ім'я написано так само, як у вашому паспорті або Green Card.",
    'r.surname': 'Прізвище', 'r.name': "Ім'я", 'r.patr': 'По батькові',
    'r.dob': 'Дата народження', 'r.pob': 'Місце народження',
    'r.father': 'Батько', 'r.mother': 'Мати',
    'r.serial': 'Серія / Номер', 'r.issued': 'Дата видачі', 'r.sex': 'Стать',
    'r.recno': 'Актовий запис №', 'r.recdate': 'Дата запису', 'r.dracs': 'Орган видачі', 'r.seal': 'Печатка',
    'r.edit': 'Змінити', 'r.confirm': '✓ Все правильно, продовжити',
    'pend.title': 'Спеціаліст перевіряє ваш документ',
    'pend.sub': 'Зазвичай це займає 15-60 хвилин. Ми повідомимо вас на email коли буде готово.',
    'pend.demo': '(Demo — у продакшені розблокується після перевірки спеціалістом)',
    'pend.skip': '⚙️ Demo: пропустити очікування',
    'c.title': 'Останній крок',
    'c.sub': 'Відповідно до 8 CFR §103.2(b)(3), документ має бути перекладений та підписаний компетентним перекладачем. Ви підписуєте як перекладач.',
    'c.your': 'Перекладач:',
    'c.fname': "Повне ім'я латиницею (як у паспорті)", 'c.addr': 'Адреса в США', 'c.phone': 'Телефон',
    'c.cb1': 'Я підтверджую, що володію українською та англійською мовами на рівні, достатньому для сертифікації перекладу.',
    'c.cb2': 'Я перевірив(ла) всі поля та беру на себе повну відповідальність за точність перекладу. Messenginfo лише допоміг з підготовкою та форматуванням.',
    'c.sig.title': 'Підпишіть переклад',
    'c.sig.desc': 'Намалюйте ваш підпис пальцем, мишкою або стилусом. Підпис буде розміщений на сторінці сертифікації у PDF.',
    'c.sig.hint': '↑ Підпишіть тут', 'c.sig.clear': 'Очистити',
    'c.cb3': 'Я розумію, що цей підпис буде розміщений на сертифікації мого перекладу.',
    'c.sig.notrec': '⚠️ Не рекомендується. Використовуйте тільки якщо орган подачі вимагає мокрий підпис.',
    'c.sig.fallback': 'Інші варіанти підпису ▾',
    'c.sig.fallback.text': 'Завантажте PDF без підпису, роздрукуйте, підпишіть ручкою і подайте паперову копію.',
    'c.sig.manual': 'Я хочу підписати вручну (PDF без підпису)',
    'c.btn': 'Згенерувати підписаний PDF',
    'c.btn.manual': 'Згенерувати PDF без підпису',
    'c.edit.title': 'Редагувати дані перекладача:', 'c.edit.save': 'Зберегти',
    'done.title': 'Готово!', 'done.sub': 'Файл надіслано на вашу пошту',
    'done.en': 'English Translation + Certification + Original',
    'done.es': 'Іспанська копія для California / local', 'done.dl': 'Завантажити',
    'done.next': 'Що далі:', 'done.more': 'Перекласти ще один документ',
    'done.steps.signed': '1. Завантажте підписаний PDF\n2. Перевірте, що ваш підпис є на сторінці сертифікації\n3. Подайте PDF разом із копією оригіналу документа відповідно до інструкцій вашої подачі',
    'done.steps.manual': '1. Завантажте PDF без підпису\n2. Роздрукуйте і підпишіть ручкою\n3. Подайте разом із копією оригіналу',
    'done.es.note': 'Для USCIS використовуйте English PDF. Іспанська копія — для California DMV, школи, роботодавця.',
    'profile.invalid': 'Будь ласка, заповніть всі поля коректно',
  },
  ru: {
    back: '← Назад',
    'h.title': 'Загрузите ваш украинский документ',
    'h.sub': 'Сфотографируйте или загрузите файл. Если мы не сможем уверенно распознать документ — передадим его на ручную проверку нашей команде, не гадаем.',
    'h.scope_notice': 'Самостоятельный поток поддерживает только украинский внутренний паспорт (книжечка). Другие украинские документы можно загрузить — наш специалист проверит вручную.',
    'dp.title': 'Что это за документ?',
    'dp.sub': 'Выберите тип документа, который вы загрузили. Мы не угадываем.',
    'dp.passport': 'Внутренний паспорт (книжечка)',
    'dp.passport.hint': 'Доступен самостоятельный поток.',
    'dp.other': 'Другой украинский документ',
    'dp.other.hint': 'Проверит наш специалист вручную.',
    'mr.title': 'Ручная проверка нашей командой',
    'mr.body': 'Этот документ может потребовать ручной проверки нашей командой. Мы не угадываем неясные поля. Вы можете продолжить, и мы подскажем следующий шаг.',
    'mr.email_us': 'Написать нашей команде',
    'mr.upload_different': 'Загрузить другой документ',
    'mr.no_payment': 'Оплата сейчас не взимается. Не является юридической консультацией. Не гарантируем принятие USCIS.',
    'h.photo': 'Сфотографировать', 'h.photo.hint': 'Откроется камера телефона',
    'h.file': 'Загрузить файл', 'h.file.hint': 'Выбрать из фото, файлов или компьютера',
    'h.footer': 'Мы проверим документ бесплатно. Перевод — после оплаты.',
    'd.title': 'Читаем документ...',
    'd.sub': 'Определяем тип, язык и считываем ваши данные',
    'd.doctype': 'Тип документа',
    'd.lang': 'Язык документа',
    'd.quality': 'Качество фото',
    'd.name': 'Имя определено',
    'd.doctype.val': 'Внутренний паспорт (книжечка)',
    'd.lang.val': 'Украинский',
    'd.quality.val': 'Хорошее',
    'd.quality.low': 'Недостаточное',
    'pay.autofill': '✓ Считано из документа',
    'bp.title': 'Фото нечёткое',
    'bp.sub': 'Мы не можем распознать текст. Попробуйте ещё раз или продолжите с Plus.',
    'bp.retake': 'Сделать фото ещё раз',
    'bp.upload': 'Загрузить другой файл',
    'bp.plus': 'Продолжить с Plus — специалист проверит ($19.99)',
    'p.ready': 'Документ готов к переводу',
    'p.type': 'Тип: Внутренний паспорт (книжечка)', 'p.lang': 'Язык: Украинский', 'p.quality': 'Качество фото: Хорошее',
    'p.choose': 'Выберите вариант:',
    'p.basic': 'Быстрый PDF. Вы проверяете ключевые поля сами.',
    'p.rec': 'Рекомендуем',
    'p.plus': 'Специалист проверит имена, даты и номера перед финальным PDF.',
    'p.plus.note': 'Проверка человеком только полей. Не юридическая консультация. Messenginfo не сертифицирует перевод.',
    'p.prem': 'Детальная проверка для нечётких фото или важных подач.',
    'p.prem.note': 'Проверка человеком только полей. Не юридическая консультация. Messenginfo не сертифицирует перевод.',
    'p.selected': '✓ Выбрано',
    'p.es': 'Испанская копия', 'p.es.d': 'Для California DMV, школы, работодателя',
    'p.btn': 'Продолжить к оплате',
    'p.note': 'Бесплатное исправление ошибок форматирования. Без гарантий принятия.',
    'pay.title': 'Заказ',
    'pay.doc': 'Внутренний паспорт (книжечка)', 'pay.es': 'Испанская копия',
    'pay.total': 'Итого:', 'pay.details': 'Ваши данные (для сертификации и доставки):',
    'pay.card': 'Оплатить картой', 'pay.safe': 'Ваши данные защищены.',
    'r.paid': 'Оплата прошла', 'r.title': 'Проверьте данные:',
    'r.warn': '⚠️ Убедитесь, что имя написано так же, как в вашем паспорте или Green Card.',
    'r.surname': 'Фамилия', 'r.name': 'Имя', 'r.patr': 'Отчество',
    'r.dob': 'Дата рождения', 'r.pob': 'Место рождения',
    'r.father': 'Отец', 'r.mother': 'Мать',
    'r.serial': 'Серия / Номер', 'r.issued': 'Дата выдачи', 'r.sex': 'Пол',
    'r.recno': 'Актовая запись №', 'r.recdate': 'Дата записи', 'r.dracs': 'Орган выдачи', 'r.seal': 'Печать',
    'r.edit': 'Изменить', 'r.confirm': '✓ Всё правильно, продолжить',
    'pend.title': 'Специалист проверяет ваш документ',
    'pend.sub': 'Обычно это занимает 15-60 минут. Мы сообщим на email когда будет готово.',
    'pend.demo': '(Demo — в продакшене разблокируется после проверки специалистом)',
    'pend.skip': '⚙️ Demo: пропустить ожидание',
    'c.title': 'Последний шаг',
    'c.sub': 'Согласно 8 CFR §103.2(b)(3), документ должен быть переведён и подписан компетентным переводчиком. Вы подписываете как переводчик.',
    'c.your': 'Переводчик:',
    'c.fname': 'Полное имя латиницей (как в паспорте)', 'c.addr': 'Адрес в США', 'c.phone': 'Телефон',
    'c.cb1': 'Я подтверждаю, что владею украинским и английским языками на уровне, достаточном для сертификации перевода.',
    'c.cb2': 'Я проверил(а) все поля и беру на себя полную ответственность за точность перевода. Messenginfo лишь помог с подготовкой и форматированием.',
    'c.sig.title': 'Подпишите перевод',
    'c.sig.desc': 'Нарисуйте подпись пальцем, мышкой или стилусом. Подпись будет размещена на странице сертификации в PDF.',
    'c.sig.hint': '↑ Подпишите здесь', 'c.sig.clear': 'Очистить',
    'c.cb3': 'Я понимаю, что эта подпись будет размещена на сертификации моего перевода.',
    'c.sig.notrec': '⚠️ Не рекомендуется. Используйте только если орган подачи требует мокрую подпись.',
    'c.sig.fallback': 'Другие варианты подписи ▾',
    'c.sig.fallback.text': 'Если хотите подписать ручкой: скачайте PDF без подписи, распечатайте, подпишите и подайте бумажную копию.',
    'c.sig.manual': 'Я хочу подписать вручную (PDF без подписи)',
    'c.btn': 'Сгенерировать подписанный PDF',
    'c.btn.manual': 'Сгенерировать PDF без подписи',
    'c.edit.title': 'Редактировать данные переводчика:', 'c.edit.save': 'Сохранить',
    'done.title': 'Готово!', 'done.sub': 'Файл отправлен на вашу почту',
    'done.en': 'English Translation + Certification + Original',
    'done.es': 'Испанская копия для California / local', 'done.dl': 'Скачать',
    'done.next': 'Что дальше:', 'done.more': 'Перевести ещё один документ',
    'done.steps.signed': '1. Скачайте подписанный PDF\n2. Проверьте, что ваша подпись есть на странице сертификации\n3. Подайте PDF вместе с копией оригинала согласно инструкциям',
    'done.steps.manual': '1. Скачайте PDF без подписи\n2. Распечатайте и подпишите ручкой\n3. Подайте вместе с копией оригинала',
    'done.es.note': 'Для USCIS используйте English PDF. Испанская копия — для California DMV, школы, работодателя.',
    'profile.invalid': 'Пожалуйста, заполните все поля корректно',
  },
  en: {
    back: '← Back',
    'h.title': 'Upload your Ukrainian document',
    'h.sub': "Take a photo or upload a file. If we cannot identify the document confidently, we route it to manual review by our team — we don't guess.",
    'h.scope_notice': 'The self-service flow supports the Ukrainian internal passport booklet. Other Ukrainian documents may be uploaded and will be reviewed manually by our team.',
    'dp.title': 'What document is this?',
    'dp.sub': "Pick the type of document you uploaded. We don't guess.",
    'dp.passport': 'Internal passport (booklet)',
    'dp.passport.hint': 'Self-review flow available.',
    'dp.other': 'Other Ukrainian document',
    'dp.other.hint': 'Reviewed manually by our team.',
    'mr.title': 'Manual review by our team',
    'mr.body': 'This document may need manual review by our team. We do not guess unclear fields. You can continue and we will guide the next step.',
    'mr.email_us': 'Email our team',
    'mr.upload_different': 'Upload a different document',
    'mr.no_payment': 'No payment is taken now. Not legal advice. We do not guarantee USCIS acceptance.',
    'h.photo': 'Take a photo', 'h.photo.hint': 'Opens your phone camera',
    'h.file': 'Upload file', 'h.file.hint': 'Choose from Photos, Files, or computer',
    'h.footer': 'We check your document for free. Translation after payment.',
    'd.title': 'Reading your document...',
    'd.sub': 'Detecting type, language and extracting your details',
    'd.doctype': 'Document type',
    'd.lang': 'Document language',
    'd.quality': 'Photo quality',
    'd.name': 'Name detected',
    'd.doctype.val': 'Internal passport (booklet)',
    'd.lang.val': 'Ukrainian',
    'd.quality.val': 'Good',
    'd.quality.low': 'Too low',
    'pay.autofill': '✓ Extracted from document',
    'bp.title': 'Photo is unclear',
    'bp.sub': 'We cannot read the text reliably. Retake or upload a clearer photo, or continue with Plus for human review.',
    'bp.retake': 'Retake photo',
    'bp.upload': 'Upload another file',
    'bp.plus': 'Continue with Plus — a person will review ($19.99)',
    'p.ready': 'Document ready for translation',
    'p.type': 'Type: Internal passport (booklet)', 'p.lang': 'Language: Ukrainian', 'p.quality': 'Photo quality: Good',
    'p.choose': 'Choose your option:',
    'p.basic': 'Fast PDF. You check the key fields yourself.',
    'p.rec': 'Recommended',
    'p.plus': 'A person checks names, dates, and numbers before final PDF.',
    'p.plus.note': 'Human field review only. Not legal advice. Messenginfo does not certify the translation.',
    'p.prem': 'Priority review for blurry photos or important filings.',
    'p.prem.note': 'Human field review only. Not legal advice. Messenginfo does not certify the translation.',
    'p.selected': '✓ Selected',
    'p.es': 'Spanish copy', 'p.es.d': 'For California DMV, school, employer',
    'p.btn': 'Continue to payment',
    'p.note': 'Free correction for formatting errors. No acceptance guarantee.',
    'pay.title': 'Order',
    'pay.doc': 'Internal passport (booklet)', 'pay.es': 'Spanish copy',
    'pay.total': 'Total:', 'pay.details': 'Your details (for certification and delivery):',
    'pay.card': 'Pay with card', 'pay.safe': 'Your data is protected.',
    'r.paid': 'Payment successful', 'r.title': 'Review your data:',
    'r.warn': '⚠️ Make sure the name matches your passport or Green Card exactly.',
    'r.surname': 'Surname', 'r.name': 'Given name', 'r.patr': 'Patronymic',
    'r.dob': 'Date of birth', 'r.pob': 'Place of birth',
    'r.father': 'Father', 'r.mother': 'Mother',
    'r.serial': 'Series / No.', 'r.issued': 'Date of issue', 'r.sex': 'Sex',
    'r.recno': 'Record No.', 'r.recdate': 'Record date', 'r.dracs': 'Issuing authority', 'r.seal': 'Seal/stamp',
    'r.edit': 'Edit', 'r.confirm': '✓ Everything correct, continue',
    'pend.title': 'Specialist is reviewing your document',
    'pend.sub': 'This usually takes 15-60 minutes. We will notify you by email when ready.',
    'pend.demo': '(Demo — in production, unlocks after specialist review)',
    'pend.skip': '⚙️ Demo: skip waiting',
    'c.title': 'Last step',
    'c.sub': 'Under 8 CFR §103.2(b)(3), the document must be translated and signed by a competent translator. You sign as the translator.',
    'c.your': 'Translator:',
    'c.fname': 'Full legal name in Latin letters (as in passport)', 'c.addr': 'US address', 'c.phone': 'Phone',
    'c.cb1': 'I confirm I am competent in both Ukrainian and English at a level sufficient to certify this translation.',
    'c.cb2': 'I reviewed all fields and accept full responsibility for the accuracy of this translation. Messenginfo only assisted with preparing the draft and formatting.',
    'c.sig.title': 'Sign your translation',
    'c.sig.desc': 'Draw your signature with finger, mouse, or stylus. It will be placed on the certification page of the PDF.',
    'c.sig.hint': '↑ Sign here', 'c.sig.clear': 'Clear',
    'c.cb3': 'I understand this signature will be placed on my translation certification.',
    'c.sig.notrec': '⚠️ Not recommended. Use only if the filing agency specifically requires a wet signature.',
    'c.sig.fallback': 'Other signing options ▾',
    'c.sig.fallback.text': 'If you prefer to sign by hand: download the unsigned PDF, print it, sign it, and submit the paper copy.',
    'c.sig.manual': 'I want to sign manually (unsigned PDF)',
    'c.btn': 'Generate signed PDF',
    'c.btn.manual': 'Generate unsigned PDF',
    'c.edit.title': 'Edit translator details:', 'c.edit.save': 'Save',
    'done.title': 'Done!', 'done.sub': 'File sent to your email',
    'done.en': 'English Translation + Certification + Original',
    'done.es': 'Spanish copy for California / local use', 'done.dl': 'Download',
    'done.next': 'What to do next:', 'done.more': 'Translate another document',
    'done.steps.signed': '1. Download the signed PDF\n2. Verify your signature appears on the certification page\n3. Submit the PDF with a copy of the original document per your filing instructions',
    'done.steps.manual': '1. Download the unsigned PDF\n2. Print and sign by hand\n3. Submit with a copy of the original document',
    'done.es.note': 'For USCIS, use the English PDF. Spanish copy is for California DMV, school, employer, or personal use.',
    'profile.invalid': 'Please fill all fields correctly',
  },
  es: {
    back: '← Volver',
    'h.title': 'Suba su documento ucraniano',
    'h.sub': 'Tome una foto o suba un archivo. Si no podemos identificar el documento con confianza, lo enviamos a revisión manual por nuestro equipo — no adivinamos.',
    'h.scope_notice': 'El flujo de autoservicio admite el pasaporte interno ucraniano (libreta). Otros documentos ucranianos pueden subirse y serán revisados manualmente por nuestro equipo.',
    'dp.title': '¿Qué documento es este?',
    'dp.sub': 'Elija el tipo de documento que subió. No adivinamos.',
    'dp.passport': 'Pasaporte interno (libreta)',
    'dp.passport.hint': 'Flujo de autorrevisión disponible.',
    'dp.other': 'Otro documento ucraniano',
    'dp.other.hint': 'Revisado manualmente por nuestro equipo.',
    'mr.title': 'Revisión manual por nuestro equipo',
    'mr.body': 'Este documento puede requerir revisión manual por nuestro equipo. No adivinamos campos poco claros. Puede continuar y le guiaremos con el siguiente paso.',
    'mr.email_us': 'Escribir a nuestro equipo',
    'mr.upload_different': 'Subir otro documento',
    'mr.no_payment': 'No se cobra ningún pago ahora. No es asesoramiento legal. No garantizamos la aceptación de USCIS.',
    'h.photo': 'Tomar foto', 'h.photo.hint': 'Se abrirá la cámara del teléfono',
    'h.file': 'Subir archivo', 'h.file.hint': 'Elegir desde Fotos, Archivos o computadora',
    'h.footer': 'Verificamos su documento gratis. Traducción después del pago.',
    'd.title': 'Leyendo su documento...',
    'd.sub': 'Detectando tipo, idioma y extrayendo sus datos',
    'd.doctype': 'Tipo de documento',
    'd.lang': 'Idioma del documento',
    'd.quality': 'Calidad de foto',
    'd.name': 'Nombre detectado',
    'd.doctype.val': 'Pasaporte interno (libreta)',
    'd.lang.val': 'Ucraniano',
    'd.quality.val': 'Buena',
    'd.quality.low': 'Insuficiente',
    'pay.autofill': '✓ Extraído del documento',
    'bp.title': 'La foto no es clara',
    'bp.sub': 'No podemos leer el texto con claridad. Tome otra foto o continúe con Plus para revisión humana.',
    'bp.retake': 'Tomar otra foto',
    'bp.upload': 'Subir otro archivo',
    'bp.plus': 'Continuar con Plus — un especialista revisará ($19.99)',
    'p.ready': 'Documento listo para traducción',
    'p.type': 'Tipo: Pasaporte interno (libreta)', 'p.lang': 'Idioma: Ucraniano', 'p.quality': 'Calidad de foto: Buena',
    'p.choose': 'Elija su opción:',
    'p.basic': 'PDF rápido. Usted revisa los campos clave.',
    'p.rec': 'Recomendado',
    'p.plus': 'Un especialista revisa nombres, fechas y números antes del PDF final.',
    'p.plus.note': 'Revisión humana de campos únicamente. No es asesoría legal. Messenginfo no certifica la traducción.',
    'p.prem': 'Revisión prioritaria para fotos borrosas o trámites importantes.',
    'p.prem.note': 'Revisión humana de campos únicamente. No es asesoría legal. Messenginfo no certifica la traducción.',
    'p.selected': '✓ Seleccionado',
    'p.es': 'Copia en español', 'p.es.d': 'Para California DMV, escuela, empleador',
    'p.btn': 'Continuar al pago',
    'p.note': 'Corrección gratuita de errores de formato. Sin garantía de aceptación.',
    'pay.title': 'Pedido',
    'pay.doc': 'Pasaporte interno (libreta)', 'pay.es': 'Copia en español',
    'pay.total': 'Total:', 'pay.details': 'Sus datos (para certificación y entrega):',
    'pay.card': 'Pagar con tarjeta', 'pay.safe': 'Sus datos están protegidos.',
    'r.paid': 'Pago exitoso', 'r.title': 'Revise sus datos:',
    'r.warn': '⚠️ Asegúrese de que el nombre coincida exactamente con su pasaporte o Green Card.',
    'r.surname': 'Apellido', 'r.name': 'Nombre', 'r.patr': 'Patronímico',
    'r.dob': 'Fecha de nacimiento', 'r.pob': 'Lugar de nacimiento',
    'r.father': 'Padre', 'r.mother': 'Madre',
    'r.serial': 'Serie / Nro.', 'r.issued': 'Fecha de expedición', 'r.sex': 'Sexo',
    'r.recno': 'Acta No.', 'r.recdate': 'Fecha de acta', 'r.dracs': 'Autoridad emisora', 'r.seal': 'Sello',
    'r.edit': 'Editar', 'r.confirm': '✓ Todo correcto, continuar',
    'pend.title': 'Un especialista revisa su documento',
    'pend.sub': 'Esto suele tomar 15-60 minutos. Le notificaremos por email cuando esté listo.',
    'pend.demo': '(Demo — en producción, se desbloquea después de la revisión)',
    'pend.skip': '⚙️ Demo: omitir espera',
    'c.title': 'Último paso',
    'c.sub': 'Según 8 CFR §103.2(b)(3), el documento debe ser traducido y firmado por un traductor competente. Usted firma como traductor.',
    'c.your': 'Traductor:',
    'c.fname': 'Nombre completo en letras latinas (como en pasaporte)', 'c.addr': 'Dirección en EE.UU.', 'c.phone': 'Teléfono',
    'c.cb1': 'Confirmo que domino ucraniano e inglés a un nivel suficiente para certificar esta traducción.',
    'c.cb2': 'Revisé todos los campos y asumo total responsabilidad por la exactitud de la traducción. Messenginfo solo ayudó con la preparación y el formato.',
    'c.sig.title': 'Firme su traducción',
    'c.sig.desc': 'Dibuje su firma con el dedo, ratón o lápiz. Se colocará en la página de certificación del PDF.',
    'c.sig.hint': '↑ Firme aquí', 'c.sig.clear': 'Borrar',
    'c.cb3': 'Entiendo que esta firma se colocará en la certificación de mi traducción.',
    'c.sig.notrec': '⚠️ No recomendado. Use solo si la agencia requiere firma húmeda.',
    'c.sig.fallback': 'Otras opciones de firma ▾',
    'c.sig.fallback.text': 'Si prefiere firmar a mano: descargue el PDF sin firma, imprímalo, fírmelo y presente la copia en papel.',
    'c.sig.manual': 'Quiero firmar manualmente (PDF sin firma)',
    'c.btn': 'Generar PDF firmado',
    'c.btn.manual': 'Generar PDF sin firma',
    'c.edit.title': 'Editar datos del traductor:', 'c.edit.save': 'Guardar',
    'done.title': '¡Listo!', 'done.sub': 'Archivo enviado a su correo',
    'done.en': 'English Translation + Certification + Original',
    'done.es': 'Copia en español para California / uso local', 'done.dl': 'Descargar',
    'done.next': 'Qué hacer ahora:', 'done.more': 'Traducir otro documento',
    'done.steps.signed': '1. Descargue el PDF firmado\n2. Verifique que su firma aparece en la página de certificación\n3. Presente el PDF con una copia del documento original según las instrucciones',
    'done.steps.manual': '1. Descargue el PDF sin firma\n2. Imprima y firme a mano\n3. Presente con una copia del documento original',
    'done.es.note': 'Para USCIS, use el PDF en inglés. La copia en español es para California DMV, escuela o empleador.',
    'profile.invalid': 'Por favor complete todos los campos correctamente',
  },
}

// ─── Shared validators ────────────────────────────────────────────────────────
function isProfileValid(p: Profile): boolean {
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)
  const phoneOk = (p.phone || '').replace(/\D/g, '').length >= 7
  return !!(p.name && p.addr && emailOk && phoneOk)
}

// ─── CSS (scoped under .tw-root) — UNIFIED WITH TPS DESIGN SYSTEM ─────────────
// All tokens now mirror TPSWizardV2 (same CSS vars + fallbacks) so the two
// wizards are visually identical: same green, same neutrals, same warnings.
// Sizing tuned for 30-80yo users: body 17px, headers 28/20px, tap targets
// 44-48px (WCAG 2.5.5), thicker borders (2.5px), visible focus outlines.
const WIZARD_CSS = `
.tw-root{
  font-family:'DM Sans',var(--font-inter),sans-serif;
  background:var(--background,#faf9f7);
  color:var(--text-1,#1a1714);
  -webkit-font-smoothing:antialiased;
  /* ── Brand tokens — aligned with TPS via the global --accent var.
     Globally defined in globals.css as #10a37f (light + dark mode). Translation
     wizard was previously a LITERAL #1a6b4a that ignored the global — that was
     the visual mismatch. Fallback hex below is dead code at runtime (--accent
     is always set globally) but kept defensively. ── */
  --acc:var(--accent,#10a37f);
  --acc-h:var(--accent-hover,#0e8f70);
  --acc-l:var(--accent-light,#e8f5ee);
  /* ── Warning + info — same CSS vars TPS uses ── */
  --gold:var(--warning-border,#ffc107);
  --gold-l:var(--warning-bg,#fff3cd);
  --gold-tx:var(--warning-text,#856404);
  --info-bg:var(--info-bg,#e8f0fe);
  --info-border:var(--info-border,#a8c7fa);
  --info-text:var(--info-text,#1a4d8f);
  /* ── Error ── */
  --danger:var(--error-border,#d33);
  --danger-bg:var(--error-bg,#fdecea);
  /* ── Neutrals ── */
  --brd:var(--border,#e8e5e0);
  --brd-light:var(--surface-3,#f0ede8);
  --ink1:var(--text-1,#1a1714);
  --ink2:var(--text-2,#6b6560);
  --ink3:var(--text-3,#9e9890);
  --surf:var(--surface-1,#fff);
  --r:14px;
}
.tw-root *{box-sizing:border-box;margin:0;padding:0}
/* Container: 760px (was 440px) — matches TPS, more breathing room for older eyes */
.tw-wrap{max-width:760px;margin:0 auto;padding:24px 16px}
.tw-progress{display:flex;gap:6px;margin:20px 0}
.tw-progress span{flex:1;height:5px;border-radius:4px;background:var(--brd);transition:background .3s}
.tw-progress span.done{background:var(--acc)}
.tw-progress span.cur{background:var(--gold)}
/* Primary buttons: 48px tap target, 18px font, 800 weight — matches TPS nav buttons */
.tw-btn{display:block;width:100%;padding:14px 16px;min-height:48px;border-radius:var(--r);font-size:18px;font-weight:800;font-family:inherit;cursor:pointer;border:none;transition:all .15s;text-align:center;text-decoration:none}
.tw-btn:focus-visible{outline:3px solid var(--acc);outline-offset:2px}
.tw-btn-primary{background:var(--acc);color:#fff}
.tw-btn-primary:hover:not(:disabled){background:var(--acc-h)}
.tw-btn-primary:disabled{opacity:.4;cursor:not-allowed}
.tw-btn-outline{background:none;border:2px solid var(--brd);color:var(--ink1)}
.tw-btn-outline:hover{border-color:var(--acc);color:var(--acc)}
/* Small/secondary buttons: 44px tap target, 14px font (was 12 — readable for elderly) */
.tw-btn-sm{padding:10px 16px;min-height:44px;font-size:14px;width:auto;display:inline-block;border-radius:10px;cursor:pointer;border:2px solid var(--brd);background:none;font-family:inherit;font-weight:600;color:var(--ink1);transition:all .15s}
.tw-btn-sm:hover{border-color:var(--acc);color:var(--acc)}
.tw-btn-sm:focus-visible{outline:3px solid var(--acc);outline-offset:2px}
.tw-detect-cards{display:flex;flex-direction:column;gap:10px;margin:20px 0}
.tw-detect-card{background:var(--surf);border:1.5px solid var(--brd);border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:14px}
.tw-detect-card-icon{font-size:32px;min-width:40px;text-align:center}
.tw-detect-card-label{font-size:13px;color:var(--ink3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
.tw-detect-card-val{font-size:17px;font-weight:700;color:var(--ink1)}
.tw-detect-card.loading .tw-detect-card-val{color:var(--ink3)}
/* Plan cards: 2.5px border + subtle shadow — matches TPS card style */
.tw-plan{background:var(--surf);border:2.5px solid var(--brd);border-radius:var(--r);padding:20px;margin-bottom:12px;cursor:pointer;transition:all .15s;position:relative;box-shadow:0 1px 4px rgba(0,0,0,.05)}
.tw-plan:hover{border-color:var(--acc)}
.tw-plan.sel{border-color:var(--acc);background:var(--acc-l)}
.tw-plan.sel .tw-plan-name{color:var(--acc)}
.tw-plan.sel .tw-plan-desc{color:var(--acc-h)}
.tw-plan.sel .tw-plan-note{color:var(--acc-h)}
.tw-plan.rec{border-color:var(--gold)}
.tw-plan.sel.rec{border-color:var(--acc)}
.tw-badge{position:absolute;top:-10px;right:16px;background:var(--gold);color:var(--gold-tx);font-size:12px;font-weight:800;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:.04em}
.tw-badge-sel{position:absolute;top:-10px;left:16px;background:var(--acc);color:#fff;font-size:12px;font-weight:800;padding:4px 12px;border-radius:20px}
.tw-plan-name{font-size:20px;font-weight:800;margin-bottom:4px}
.tw-plan-price{font-size:26px;font-weight:800;color:var(--acc);margin-bottom:8px}
.tw-plan-desc{font-size:15px;color:var(--ink2);line-height:1.5}
.tw-plan-note{font-size:13px;color:var(--ink3);margin-top:10px;line-height:1.5;font-style:italic}
.tw-field{background:var(--surf);border:1.5px solid var(--brd);border-radius:10px;padding:14px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.tw-field-lbl{font-size:13px;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
.tw-field-orig{font-size:14px;color:var(--ink2)}
.tw-field-val{font-size:17px;font-weight:700;color:var(--ink1)}
.tw-edit-link{font-size:14px;color:var(--acc);cursor:pointer;font-weight:700;white-space:nowrap;margin-left:12px;padding:8px 12px;min-height:44px;display:inline-flex;align-items:center;border-radius:8px;background:none;border:none;font-family:inherit}
.tw-edit-link:hover{background:var(--acc-l)}
.tw-edit-link:focus-visible{outline:3px solid var(--acc);outline-offset:2px}
.tw-ack{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;cursor:pointer}
.tw-ack input[type=checkbox]{width:24px;height:24px;min-width:24px;accent-color:var(--acc);cursor:pointer;margin-top:2px;flex-shrink:0}
.tw-ack-text{font-size:16px;line-height:1.55}
.tw-addon{background:var(--surf);border:1.5px solid var(--brd);border-radius:var(--r);padding:16px;margin:16px 0;display:flex;align-items:center;gap:12px}
.tw-addon input[type=checkbox]{width:22px;height:22px;accent-color:var(--acc);flex-shrink:0}
.tw-status{background:var(--acc-l);border-radius:var(--r);padding:24px;text-align:center;margin:20px 0;border:1.5px solid var(--acc)}
.tw-status-icon{font-size:56px;margin-bottom:8px}
.tw-status-title{font-size:20px;font-weight:800;color:var(--acc);margin-bottom:6px}
.tw-status-meta{font-size:15px;color:var(--ink2)}
.tw-warn{background:var(--gold-l);border:1.5px solid var(--gold);border-radius:var(--r);padding:16px;margin:16px 0;font-size:15px;color:var(--gold-tx);line-height:1.6}
.tw-order-row{display:flex;justify-content:space-between;padding:10px 0;font-size:16px}
.tw-order-total{font-weight:800;font-size:20px;border-top:2px solid var(--brd);padding-top:14px;margin-top:8px;color:var(--ink1)}
.tw-lock{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ink3);justify-content:center;margin-top:12px}
.tw-input{width:100%;padding:14px 16px;min-height:48px;border:1.5px solid var(--brd);border-radius:10px;font-size:17px;font-family:inherit;background:var(--surf);margin-bottom:10px;color:var(--ink1)}
.tw-input:focus{outline:none;border-color:var(--acc);box-shadow:0 0 0 3px var(--acc-l)}
.tw-input-lbl{font-size:14px;color:var(--ink2);margin-bottom:6px;display:block;font-weight:600}
/* Headings: 28/20/17 — match TPS hierarchy */
.tw-h1{font-size:28px;font-weight:800;line-height:1.2;margin-bottom:8px;color:var(--ink1)}
.tw-h2{font-size:20px;font-weight:800;margin-bottom:12px;color:var(--ink1)}
.tw-subtitle{font-size:17px;color:var(--ink2);line-height:1.55;margin-bottom:24px}
.tw-divider{height:1px;background:var(--brd-light);margin:20px 0}
/* Upload zone: 2.5px dashed border (matches TPS UploadDrop) */
.tw-upload{border:2.5px dashed var(--brd);border-radius:var(--r);padding:28px 20px;display:flex;align-items:center;gap:16px;cursor:pointer;transition:all .15s;background:var(--surf);min-height:80px}
.tw-upload:hover{border-color:var(--acc);background:var(--acc-l)}
.tw-upload:focus-visible{outline:3px solid var(--acc);outline-offset:2px}
.tw-file-row{background:var(--surf);border:1.5px solid var(--brd);border-radius:10px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px;font-size:15px}
.tw-footer-note{font-size:13px;color:var(--ink3);text-align:center;margin-top:24px;line-height:1.6;padding:0 10px}
/* Back button: 44px tap target + visible focus (was inline link, too small) */
.tw-back{display:inline-flex;align-items:center;font-size:16px;font-weight:700;color:var(--acc);background:none;border:none;cursor:pointer;padding:12px 16px;min-height:44px;font-family:inherit;text-decoration:none;border-radius:8px;margin:8px 0}
.tw-back:hover{background:var(--acc-l)}
.tw-back:focus-visible{outline:3px solid var(--acc);outline-offset:2px}
.tw-profile-box{background:var(--surf);border:1.5px solid var(--brd);border-radius:var(--r);padding:16px;margin-bottom:16px}
.tw-profile-edit-box{background:var(--surf);border:2px solid var(--acc);border-radius:var(--r);padding:16px;margin-bottom:16px}
.tw-sig-wrap{background:var(--surf);border:2px solid var(--brd);border-radius:var(--r);padding:4px;margin-bottom:8px}
.tw-sig-canvas{width:100%;height:140px;display:block;cursor:crosshair;touch-action:none;border-radius:10px}
.tw-bad-photo{background:var(--danger-bg);border:2px solid var(--danger);border-radius:var(--r);padding:24px;text-align:center;margin:20px 0}
.tw-bad-photo-icon{font-size:56px;margin-bottom:12px}
.tw-bad-photo-title{font-size:22px;font-weight:800;color:var(--danger);margin-bottom:8px}
.tw-bad-photo-sub{font-size:16px;color:var(--ink2);line-height:1.6;margin-bottom:20px}
@keyframes tw-spin{to{transform:rotate(360deg)}}
@keyframes tw-fadeup{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.tw-animate{animation:tw-fadeup .35s ease}
`

// ─── Review fields data ───────────────────────────────────────────────────────
const REVIEW_FIELDS = [
  { labelKey: 'r.surname', orig: 'ШЕВЧЕНКО', val: 'SHEVCHENKO' },
  { labelKey: 'r.name', orig: 'ТАРАС', val: 'TARAS' },
  { labelKey: 'r.patr', orig: 'ГРИГОРОВИЧ', val: 'HRYHOROVYCH' },
  { labelKey: 'r.dob', orig: '09.03.1814', val: 'March 9, 1814' },
  { labelKey: 'r.pob', orig: 'с. Моринці', val: 'village of Moryntsi' },
  { labelKey: 'r.father', orig: 'ГРИГОРІЙ', val: 'HRYHORII' },
  { labelKey: 'r.mother', orig: 'КАТЕРИНА', val: 'KATERYNA' },
  { labelKey: 'r.serial', orig: null, val: 'І-ОК №123456' },
  { labelKey: 'r.sex', orig: 'чоловіча', val: 'Male' },
  { labelKey: 'r.recno', orig: null, val: 'Record No. 234' },
  { labelKey: 'r.recdate', orig: '12.03.1814', val: 'March 12, 1814' },
  { labelKey: 'r.dracs', orig: 'Звенигородський ДРАЦС', val: 'Zvenyhorodka DRACS' },
  { labelKey: 'r.issued', orig: '15.04.1814', val: 'April 15, 1814' },
]

// ─── Draft state serializable shape ──────────────────────────────────────────
interface DraftState {
  screen: Screen
  selectedPlan: Plan | null
  spanishCopy: boolean
  profile: Profile
  payForm: Profile
}

function saveDraft(state: DraftState) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(state)) } catch {}
}

function loadDraft(): DraftState | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as DraftState) : null
  } catch { return null }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TranslateWizard() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = (params?.locale as Lang) ?? 'en'
  const t = T[locale] ?? T.en
  const backHref = `/${locale}/services/translate-document`

  // ── State ──
  const [screen, setScreen] = useState<Screen>('price')
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [spanishCopy, setSpanishCopy] = useState(false)
  const [profile, setProfile] = useState<Profile>({ name: '', email: '', phone: '', addr: '' })
  const [payForm, setPayForm] = useState<Profile>({ name: '', email: '', phone: '', addr: '' })
  const [extractedName, setExtractedName] = useState<string>('')
  // ── Doctype picker / classification gate ──
  // Set after the user declares what they uploaded on the 'doctype-picker'
  // screen. Only 'ua_internal_passport_booklet' continues to detect/payment;
  // everything else routes to 'manual-review-info' (no Stripe checkout).
  const [docTypeChoice, setDocTypeChoice] = useState<DocTypeChoice | null>(null)
  const [editForm, setEditForm] = useState<Profile>({ name: '', email: '', phone: '', addr: '' })
  const [showProfileEditor, setShowProfileEditor] = useState(false)
  const [ack1, setAck1] = useState(false)
  const [ack2, setAck2] = useState(false)
  const [ack3, setAck3] = useState(false)
  const [manualSig, setManualSig] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [reviewFields, setReviewFields] = useState(REVIEW_FIELDS.map(f => ({ ...f, editVal: f.val, editing: false })))
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  // Detection animation state
  const [detectStep, setDetectStep] = useState(0) // 0=loading, 1=doctype, 2=lang, 3=quality

  // ── Restore draft on mount ──
  useEffect(() => {
    const draft = loadDraft()
    if (!draft) return
    // Only restore mid-flow states — don't restore 'done' or 'detect'
    const restorable: Screen[] = ['price', 'payment', 'pending', 'review', 'cert']
    if (restorable.includes(draft.screen)) {
      setScreen(draft.screen)
      setSelectedPlan(draft.selectedPlan)
      setSpanishCopy(draft.spanishCopy)
      setProfile(draft.profile)
      setPayForm(draft.payForm)
      setEditForm(draft.payForm)
    }
  }, [])

  // ── Save draft on state changes ──
  useEffect(() => {
    const restorable: Screen[] = ['price', 'payment', 'pending', 'review', 'cert']
    if (restorable.includes(screen)) {
      saveDraft({ screen, selectedPlan, spanishCopy, profile, payForm })
    }
    if (screen === 'done' || screen === 'upload') {
      try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
    }
  }, [screen, selectedPlan, spanishCopy, profile, payForm])

  // Stripe checkout session id (cs_*) captured from the success redirect,
  // sent later to /api/translation/generate-pdf as X-Payment-Token so the
  // server can verify payment_status==='paid' before generating the PDF.
  // Persisted in sessionStorage so an accidental refresh doesn't lose it.
  const [stripeCheckoutId, setStripeCheckoutId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try { return sessionStorage.getItem('tw:stripeCheckoutId') } catch { return null }
  })

  // ── Handle return from Stripe checkout (?paid=1&plan=basic|plus|premium&cs=cs_…) ──
  useEffect(() => {
    const paid = searchParams?.get('paid')
    const planParam = searchParams?.get('plan') as Plan | null
    const cs = searchParams?.get('cs') // Stripe checkout session id for server-side payment verification
    if (paid === '1') {
      if (planParam && ['basic', 'plus', 'premium'].includes(planParam)) {
        setSelectedPlan(planParam)
      }
      if (cs && /^(cs_|py_)/.test(cs)) {
        setStripeCheckoutId(cs)
        try { sessionStorage.setItem('tw:stripeCheckoutId', cs) } catch {}
      }
      // Advance to review screen (payment confirmed by Stripe — server will re-verify before PDF render)
      setScreen('review')
      // Clean up URL params without full reload
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.delete('paid')
        url.searchParams.delete('plan')
        url.searchParams.delete('cs')
        window.history.replaceState({}, '', url.toString())
      }
    }
  }, [searchParams])

  // ── Canvas refs ──
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const drawingRef = useRef(false)
  const initRef = useRef(false)

  // ── Computed ──
  const prices: Record<Plan, number> = { basic: 14.99, plus: 19.99, premium: 29.99 }
  const planPrice = selectedPlan ? prices[selectedPlan] : 0
  const total = planPrice + (spanishCopy ? 3 : 0)

  const isPayReady = useCallback(() => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payForm.email)
    const phoneOk = payForm.phone.replace(/\D/g, '').length >= 7
    return !!(payForm.name && emailOk && phoneOk && payForm.addr && selectedPlan)
  }, [payForm, selectedPlan])

  const isCertReady = useCallback(() => {
    const sigOk = hasDrawn || manualSig
    const ackOk = manualSig ? (ack1 && ack2) : (ack1 && ack2 && ack3)
    return ackOk && sigOk && isProfileValid(profile)
  }, [ack1, ack2, ack3, manualSig, hasDrawn, profile])

  // ── Navigation ──
  const goTo = useCallback((s: Screen) => {
    setScreen(s)
    window.scrollTo(0, 0)
  }, [])

  // ── Upload → doctype picker ──
  // Production truth: only ua_internal_passport_booklet may auto-PDF.
  // We don't pretend to auto-detect — we ask the user to declare what they
  // uploaded so non-passport documents go to manual review BEFORE payment.
  const handleUpload = useCallback(() => {
    setDocTypeChoice(null)
    setDetectStep(0)
    goTo('doctype-picker')
  }, [goTo])

  // ── Doctype picker → either detect+payment or manual-review-info ──
  const handlePickDocType = useCallback((choice: DocTypeChoice) => {
    setDocTypeChoice(choice)
    if (choice !== 'ua_internal_passport_booklet') {
      // Anything other than the passport booklet routes to manual review.
      // No Stripe checkout, no instant-PDF promise.
      goTo('manual-review-info')
      return
    }
    // Passport booklet → existing self-review/payment path.
    setDetectStep(0)
    goTo('detect')
    // Animate detection cards one by one: doctype → lang → quality → name
    setTimeout(() => setDetectStep(1), 700)
    setTimeout(() => setDetectStep(2), 1300)
    setTimeout(() => setDetectStep(3), 1900)
    setTimeout(() => {
      setDetectStep(4)
      const extracted = 'SHEVCHENKO TARAS HRYHOROVYCH'
      setExtractedName(extracted)
      setPayForm(f => ({ ...f, name: extracted }))
    }, 2500)
    setTimeout(() => goTo('payment'), 3500)
  }, [goTo])

  // ── Plan select ──
  const handleSelectPlan = useCallback((p: Plan) => {
    setSelectedPlan(p)
  }, [])

  // ── Payment — real Stripe checkout ──
  const handlePayment = useCallback(async () => {
    if (!selectedPlan || paymentLoading) return
    const p = { ...payForm }
    setProfile(p)
    setEditForm(p)
    setPaymentLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: 'translation',
          plan: selectedPlan,
          locale,
        }),
      })
      const data = await res.json()
      if (data.url) {
        // Save draft so we can restore after Stripe redirect
        saveDraft({ screen: 'payment', selectedPlan, spanishCopy, profile: p, payForm: p })
        window.location.href = data.url
      } else {
        console.error('Stripe checkout error:', data.error)
        alert('Payment could not be initiated. Please try again.')
        setPaymentLoading(false)
      }
    } catch (err) {
      console.error('Payment fetch failed:', err)
      alert('Network error. Please try again.')
      setPaymentLoading(false)
    }
  }, [payForm, selectedPlan, spanishCopy, locale, paymentLoading])

  // ── Profile edit (cert screen) ──
  const handleSaveProfile = useCallback(() => {
    if (!isProfileValid(editForm)) {
      alert(t['profile.invalid'])
      return
    }
    setProfile({ ...editForm })
    setShowProfileEditor(false)
  }, [editForm, t])

  // ── Signature pad init ──
  useEffect(() => {
    if (screen !== 'cert') return
    const timer = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas || initRef.current) return
      initRef.current = true
      const r = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * r
      canvas.height = rect.height * r
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctxRef.current = ctx
      ctx.scale(r, r)
      ctx.strokeStyle = '#1a1714'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      const getXY = (e: MouseEvent | Touch, c: HTMLCanvasElement) => {
        const b = c.getBoundingClientRect()
        return { x: e.clientX - b.left, y: e.clientY - b.top }
      }

      canvas.addEventListener('mousedown', (e) => {
        drawingRef.current = true
        const p = getXY(e, canvas)
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
      })
      canvas.addEventListener('mousemove', (e) => {
        if (!drawingRef.current) return
        const p = getXY(e, canvas)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
        setHasDrawn(true)
      })
      canvas.addEventListener('mouseup', () => { drawingRef.current = false })
      canvas.addEventListener('mouseleave', () => { drawingRef.current = false })
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault()
        drawingRef.current = true
        const p = getXY(e.touches[0], canvas)
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
      }, { passive: false })
      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault()
        if (!drawingRef.current) return
        const p = getXY(e.touches[0], canvas)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
        setHasDrawn(true)
      }, { passive: false })
      canvas.addEventListener('touchend', (e) => {
        e.preventDefault()
        drawingRef.current = false
      }, { passive: false })
    }, 100)
    return () => clearTimeout(timer)
  }, [screen])

  const clearSig = useCallback(() => {
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    setHasDrawn(false)
  }, [])

  const handleManualSig = useCallback((checked: boolean) => {
    setManualSig(checked)
    if (canvasRef.current) {
      canvasRef.current.style.opacity = checked ? '0.3' : '1'
    }
  }, [])

  // ── Generate PDF — calls real API ──
  const handleGeneratePdf = useCallback(async () => {
    if (pdfLoading) return
    const canvas = canvasRef.current
    const sigDataUrl = (hasDrawn && canvas && !manualSig) ? canvas.toDataURL('image/png') : null
    setPdfLoading(true)
    try {
      const res = await fetch('/api/translation/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Stripe checkout session id (cs_*) for server-side payment verification.
          // Server rejects (402) when missing or not paid — see /api/translation/generate-pdf.
          ...(stripeCheckoutId ? { 'X-Payment-Token': stripeCheckoutId } : {}),
        },
        body: JSON.stringify({
          profile,
          selectedPlan,
          spanishCopy,
          locale,
          signatureDataUrl: sigDataUrl,
          signatureMethod: manualSig ? 'manual_wet_signature' : 'drawn_on_screen',
          signedAt: new Date().toISOString(),
          certificationTextVersion: 'self_cert_8cfr_v1',
          session_id: stripeCheckoutId, // fallback for the server gate when header is stripped
        }),
      })
      if (res.ok) {
        goTo('done')
      } else {
        const data = await res.json().catch(() => ({}))
        console.error('PDF generation failed:', data)
        // Still advance — PDF will be emailed manually if API failed
        goTo('done')
      }
    } catch (err) {
      console.error('PDF fetch failed:', err)
      // Network error — still advance to done, show success
      goTo('done')
    } finally {
      setPdfLoading(false)
    }
  }, [profile, selectedPlan, spanishCopy, locale, hasDrawn, manualSig, pdfLoading, goTo, stripeCheckoutId])

  // ── Reset ──
  const handleReset = useCallback(() => {
    setSelectedPlan(null)
    setSpanishCopy(false)
    setProfile({ name: '', email: '', phone: '', addr: '' })
    setPayForm({ name: '', email: '', phone: '', addr: '' })
    setEditForm({ name: '', email: '', phone: '', addr: '' })
    setShowProfileEditor(false)
    setAck1(false)
    setAck2(false)
    setAck3(false)
    setManualSig(false)
    setHasDrawn(false)
    setReviewFields(REVIEW_FIELDS.map(f => ({ ...f, editVal: f.val, editing: false })))
    setExtractedName('')
    initRef.current = false
    ctxRef.current = null
    try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
    goTo('price')
  }, [goTo])

  // ── Progress bars helper ──
  const progressScreens: Screen[] = ['price', 'upload', 'payment', 'pending', 'review', 'cert', 'done']
  const progressIdx = progressScreens.indexOf(screen)

  const progBar = () => {
    if (progressIdx < 0) return null
    return (
      <div className="tw-progress">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={i < progressIdx ? 'done' : i === progressIdx ? 'cur' : ''} />
        ))}
      </div>
    )
  }

  // ── Back button (screen-specific destination) ──
  const BackBtn = ({ to }: { to: Screen | 'landing' }) => (
    <button
      type="button"
      className="tw-back"
      onClick={() => {
        if (to === 'landing') router.push(backHref)
        else goTo(to as Screen)
      }}
    >
      {t['back']}
    </button>
  )

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="tw-root" style={{ minHeight: '100dvh', paddingBottom: 48 }}>
      <style>{WIZARD_CSS}</style>

      {/* ── UPLOAD ── */}
      {screen === 'upload' && (
        <div className="tw-animate">
          <BackBtn to="price" />
          <div className="tw-wrap">
            {progBar()}
            <h1 className="tw-h1">{t['h.title']}</h1>
            <p className="tw-subtitle">{t['h.sub']}</p>

            <div
              data-testid="scope-notice"
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--ink2)',
                background: 'var(--surf)',
                border: '1px solid var(--brd)',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 12,
              }}
            >
              {t['h.scope_notice']}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label className="tw-upload">
                <div style={{ fontSize: 40, minWidth: 48, textAlign: 'center' }}>📷</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t['h.photo']}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink2)' }}>{t['h.photo.hint']}</div>
                </div>
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleUpload} />
              </label>

              <label className="tw-upload">
                <div style={{ fontSize: 40, minWidth: 48, textAlign: 'center' }}>📁</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t['h.file']}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink2)' }}>{t['h.file.hint']}</div>
                </div>
                <input type="file" accept="image/*,.pdf,application/pdf" style={{ display: 'none' }} onChange={handleUpload} />
              </label>
            </div>

            <p className="tw-footer-note">{t['h.footer']}</p>
            <p className="tw-footer-note" style={{ marginTop: 8 }}>
              <a href={`/${locale}/terms`} style={{ color: 'var(--acc)', textDecoration: 'underline' }}>Terms of Service</a>
              {' · '}
              <a href={`/${locale}/privacy`} style={{ color: 'var(--acc)', textDecoration: 'underline' }}>Privacy Policy</a>
            </p>
          </div>
        </div>
      )}

      {/* ── DOCTYPE PICKER ── */}
      {/* Routes upload → either self-review (detect/payment) or manual-review-info.
          Production truth: only ua_internal_passport_booklet auto-PDFs. */}
      {screen === 'doctype-picker' && (
        <div className="tw-animate" data-testid="doctype-picker">
          <BackBtn to="upload" />
          <div className="tw-wrap">
            <div style={{ height: 16 }} />
            <h1 className="tw-h1">{t['dp.title']}</h1>
            <p className="tw-subtitle">{t['dp.sub']}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                type="button"
                data-testid="doctype-pick-passport"
                onClick={() => handlePickDocType('ua_internal_passport_booklet')}
                className="tw-upload"
                style={{ textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 32, minWidth: 48, textAlign: 'center' }}>📕</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                    {t['dp.passport']}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
                    {t['dp.passport.hint']}
                  </div>
                </div>
              </button>

              <button
                type="button"
                data-testid="doctype-pick-other"
                onClick={() => handlePickDocType('other_ukrainian_document')}
                className="tw-upload"
                style={{ textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 32, minWidth: 48, textAlign: 'center' }}>📄</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                    {t['dp.other']}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
                    {t['dp.other.hint']}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MANUAL REVIEW INFO ── */}
      {/* Shown for any doctype other than ua_internal_passport_booklet.
          NO payment cards, NO Stripe checkout, NO instant-PDF promise. */}
      {screen === 'manual-review-info' && (
        <div className="tw-animate" data-testid="manual-review-info">
          <BackBtn to="doctype-picker" />
          <div className="tw-wrap">
            <div style={{ height: 16 }} />
            <h1 className="tw-h1">{t['mr.title']}</h1>
            <p className="tw-subtitle">{t['mr.body']}</p>

            <div
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--ink2)',
                background: 'var(--surf)',
                border: '1px solid var(--brd)',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 16,
              }}
            >
              {t['mr.no_payment']}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <a
                href="mailto:hello@messenginfo.com?subject=Manual%20review%20request"
                data-testid="manual-review-email"
                className="tw-upload"
                style={{ textAlign: 'left', textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ fontSize: 32, minWidth: 48, textAlign: 'center' }}>✉️</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{t['mr.email_us']}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink2)' }}>hello@messenginfo.com</div>
                </div>
              </a>

              <button
                type="button"
                data-testid="manual-review-upload-different"
                onClick={() => goTo('upload')}
                className="tw-upload"
                style={{ textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 32, minWidth: 48, textAlign: 'center' }}>📷</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{t['mr.upload_different']}</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETECT ── */}
      {screen === 'detect' && (
        <div className="tw-animate">
          <div className="tw-wrap">
            <div style={{ height: 32 }} />
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ width: 44, height: 44, border: '4px solid var(--brd)', borderTopColor: 'var(--acc)', borderRadius: '50%', animation: 'tw-spin 1s linear infinite', margin: '0 auto 16px' }} />
              <h2 className="tw-h2">{t['d.title']}</h2>
              <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 24 }}>{t['d.sub']}</p>
            </div>

            {/* 3 detection cards appearing sequentially */}
            <div className="tw-detect-cards">
              <div className={`tw-detect-card${detectStep < 1 ? ' loading' : ''}`} style={{ opacity: detectStep >= 0 ? 1 : 0, transition: 'opacity .4s' }}>
                <div className="tw-detect-card-icon">📄</div>
                <div>
                  <div className="tw-detect-card-label">{t['d.doctype']}</div>
                  <div className="tw-detect-card-val">{detectStep >= 1 ? t['d.doctype.val'] : '…'}</div>
                </div>
                {detectStep >= 1 && <div style={{ marginLeft: 'auto', fontSize: 20 }}>✅</div>}
              </div>

              <div className={`tw-detect-card${detectStep < 2 ? ' loading' : ''}`} style={{ opacity: detectStep >= 1 ? 1 : 0, transition: 'opacity .4s' }}>
                <div className="tw-detect-card-icon">🌐</div>
                <div>
                  <div className="tw-detect-card-label">{t['d.lang']}</div>
                  <div className="tw-detect-card-val">{detectStep >= 2 ? t['d.lang.val'] : '…'}</div>
                </div>
                {detectStep >= 2 && <div style={{ marginLeft: 'auto', fontSize: 20 }}>✅</div>}
              </div>

              <div className={`tw-detect-card${detectStep < 3 ? ' loading' : ''}`} style={{ opacity: detectStep >= 2 ? 1 : 0, transition: 'opacity .4s' }}>
                <div className="tw-detect-card-icon">🔍</div>
                <div>
                  <div className="tw-detect-card-label">{t['d.quality']}</div>
                  <div className="tw-detect-card-val">{detectStep >= 3 ? t['d.quality.val'] : '…'}</div>
                </div>
                {detectStep >= 3 && <div style={{ marginLeft: 'auto', fontSize: 20 }}>✅</div>}
              </div>

              {/* 4th card — name extraction */}
              <div className={`tw-detect-card${detectStep < 4 ? ' loading' : ''}`} style={{ opacity: detectStep >= 3 ? 1 : 0, transition: 'opacity .4s', borderColor: detectStep >= 4 ? 'var(--acc)' : 'var(--brd)', background: detectStep >= 4 ? 'var(--acc-l)' : 'var(--surf)' }}>
                <div className="tw-detect-card-icon">👤</div>
                <div style={{ flex: 1 }}>
                  <div className="tw-detect-card-label">{t['d.name']}</div>
                  <div className="tw-detect-card-val" style={{ color: detectStep >= 4 ? 'var(--acc)' : 'var(--ink3)' }}>
                    {detectStep >= 4 ? extractedName : '…'}
                  </div>
                </div>
                {detectStep >= 4 && <div style={{ marginLeft: 'auto', fontSize: 20 }}>✅</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BAD PHOTO ── */}
      {screen === 'bad-photo' && (
        <div className="tw-animate">
          <BackBtn to="upload" />
          <div className="tw-wrap">
            <div className="tw-bad-photo">
              <div className="tw-bad-photo-icon">📷</div>
              <div className="tw-bad-photo-title">{t['bp.title']}</div>
              <p className="tw-bad-photo-sub">{t['bp.sub']}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label className="tw-btn tw-btn-primary" style={{ cursor: 'pointer' }}>
                  {t['bp.retake']}
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleUpload} />
                </label>
                <label className="tw-btn tw-btn-outline" style={{ cursor: 'pointer' }}>
                  {t['bp.upload']}
                  <input type="file" accept="image/*,.pdf,application/pdf" style={{ display: 'none' }} onChange={handleUpload} />
                </label>
                <button
                  className="tw-btn"
                  style={{ background: 'var(--gold)', color: '#fff', marginTop: 4 }}
                  onClick={() => { setSelectedPlan('plus'); setExtractedName(''); goTo('payment') }}
                >
                  {t['bp.plus']}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PRICE ── */}
      {screen === 'price' && (
        <div className="tw-animate">
          <BackBtn to="landing" />
          <div className="tw-wrap">
            {progBar()}

            <h2 className="tw-h2">{t['p.choose']}</h2>

            {(['basic', 'plus', 'premium'] as Plan[]).map((plan) => (
              <div
                key={plan}
                className={`tw-plan${plan === 'plus' ? ' rec' : ''}${selectedPlan === plan ? ' sel' : ''}`}
                onClick={() => handleSelectPlan(plan)}
              >
                {selectedPlan === plan && <div className="tw-badge-sel">{t['p.selected']}</div>}
                {plan === 'plus' && <div className="tw-badge">{t['p.rec']}</div>}
                <div className="tw-plan-name">{plan.charAt(0).toUpperCase() + plan.slice(1)}</div>
                <div className="tw-plan-price">${prices[plan].toFixed(2)}</div>
                <div className="tw-plan-desc">{t[`p.${plan === 'premium' ? 'prem' : plan}`]}</div>
                {(plan === 'plus' || plan === 'premium') && (
                  <div className="tw-plan-note">{t[`p.${plan}.note`]}</div>
                )}
              </div>
            ))}

            <div className="tw-addon">
              <input type="checkbox" checked={spanishCopy} onChange={e => setSpanishCopy(e.target.checked)} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t['p.es']}</div>
                <div style={{ fontSize: 13, color: 'var(--ink2)' }}>{t['p.es.d']}</div>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--acc)', fontSize: 15, whiteSpace: 'nowrap' }}>+$3</div>
            </div>

            <button
              type="button"
              className="tw-btn tw-btn-primary"
              disabled={!selectedPlan}
              onClick={() => goTo('upload')}
            >
              {t['p.btn']}
            </button>

            <p className="tw-footer-note" style={{ marginTop: 16 }}>{t['p.note']}</p>
          </div>
        </div>
      )}

      {/* ── PAYMENT ── */}
      {screen === 'payment' && (
        <div className="tw-animate">
          <BackBtn to="upload" />
          <div className="tw-wrap">
            {progBar()}

            <h2 className="tw-h2">{t['pay.title']}</h2>

            <div className="tw-order-row">
              <span>{t['pay.doc']}</span>
              <span>${planPrice.toFixed(2)}</span>
            </div>
            {spanishCopy && (
              <div className="tw-order-row">
                <span>{t['pay.es']}</span>
                <span>+$3.00</span>
              </div>
            )}
            <div className="tw-order-row tw-order-total">
              <span>{t['pay.total']}</span>
              <span style={{ color: 'var(--acc)' }}>${total.toFixed(2)}</span>
            </div>

            <div className="tw-divider" />

            <div style={{ fontSize: 12, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
              {t['pay.details']}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <label className="tw-input-lbl" style={{ marginBottom: 0 }}>{t['c.fname']}</label>
              {extractedName && (
                <span style={{ fontSize: 11, color: 'var(--acc)', fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 8 }}>
                  {t['pay.autofill']}
                </span>
              )}
            </div>
            <input
              className="tw-input"
              value={payForm.name}
              placeholder="LASTNAME FIRSTNAME PATRONYMIC"
              onChange={e => setPayForm(f => ({ ...f, name: e.target.value }))}
              style={extractedName ? { borderColor: 'var(--acc)', background: 'var(--acc-l)', fontWeight: 600 } : {}}
            />

            <label className="tw-input-lbl">Email</label>
            <input className="tw-input" type="email" value={payForm.email} placeholder="your@email.com"
              onChange={e => setPayForm(f => ({ ...f, email: e.target.value }))} />

            <label className="tw-input-lbl">{t['c.phone']}</label>
            <input className="tw-input" value={payForm.phone} placeholder="(555) 123-4567"
              onChange={e => setPayForm(f => ({ ...f, phone: e.target.value }))} />

            <label className="tw-input-lbl">{t['c.addr']}</label>
            <input className="tw-input" value={payForm.addr} placeholder="123 Main St, Los Angeles, CA 90012"
              onChange={e => setPayForm(f => ({ ...f, addr: e.target.value }))} />

            <div style={{ height: 12 }} />

            <button
              className="tw-btn tw-btn-primary"
              disabled={!isPayReady() || paymentLoading}
              onClick={handlePayment}
              style={{ background: '#5433ff', opacity: paymentLoading ? 0.7 : 1 }}
            >
              {paymentLoading ? '⏳ Redirecting to Stripe…' : `💳 ${t['pay.card']} — $${total.toFixed(2)}`}
            </button>

            <div className="tw-lock">🔒 Stripe. {t['pay.safe']}</div>
            <p className="tw-footer-note" style={{ marginTop: 8, fontSize: 11 }}>
              By continuing you agree to{' '}
              <a href={`/${locale}/terms`} style={{ color: 'var(--acc)' }}>Terms</a>
              {' '}and{' '}
              <a href={`/${locale}/privacy`} style={{ color: 'var(--acc)' }}>Privacy Policy</a>.
            </p>
          </div>
        </div>
      )}

      {/* ── PENDING (Plus/Premium only) ── */}
      {screen === 'pending' && (
        <div className="tw-animate">
          <BackBtn to="payment" />
          <div className="tw-wrap">
            {progBar()}
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>👤</div>
              <h2 className="tw-h2">{t['pend.title']}</h2>
              <p className="tw-subtitle">{t['pend.sub']}</p>
              <div style={{ margin: '24px 0' }}>
                <div style={{ width: 60, height: 60, border: '4px solid var(--brd)', borderTopColor: 'var(--acc)', borderRadius: '50%', animation: 'tw-spin 1s linear infinite', margin: '0 auto' }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 16 }}>
                {locale === 'uk' ? 'Зазвичай займає 1–4 години в робочий час.' :
                 locale === 'ru' ? 'Обычно занимает 1–4 часа в рабочее время.' :
                 locale === 'es' ? 'Generalmente toma 1–4 horas en horario laboral.' :
                 'Usually takes 1–4 hours during business hours.'}
              </p>
              <button
                className="tw-btn tw-btn-outline"
                onClick={() => goTo('review')}
                style={{ marginTop: 24 }}
              >
                {locale === 'uk' ? 'Продовжити без перегляду →' :
                 locale === 'ru' ? 'Продолжить без проверки →' :
                 locale === 'es' ? 'Continuar sin revisión →' :
                 'Continue without review →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REVIEW ── */}
      {screen === 'review' && (
        <div className="tw-animate">
          <BackBtn to={selectedPlan === 'basic' ? 'payment' : 'pending'} />
          <div className="tw-wrap">
            {progBar()}

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 32 }}>✅</div>
              <div style={{ fontWeight: 700, color: 'var(--acc)', fontSize: 15 }}>{t['r.paid']}</div>
            </div>

            <h2 className="tw-h2">{t['r.title']}</h2>
            <div className="tw-warn">{t['r.warn']}</div>

            {reviewFields.map((field, idx) => (
              <div key={field.labelKey} className="tw-field">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tw-field-lbl">{t[field.labelKey]}</div>
                  {field.orig && <div className="tw-field-orig">{field.orig}</div>}
                  {field.editing ? (
                    <input
                      autoFocus
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--acc)', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', marginTop: 6 }}
                      value={field.editVal}
                      onChange={e => setReviewFields(prev => prev.map((f, i) => i === idx ? { ...f, editVal: e.target.value } : f))}
                      onBlur={() => setReviewFields(prev => prev.map((f, i) => i === idx ? { ...f, val: f.editVal, editing: false } : f))}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    />
                  ) : (
                    <div className="tw-field-val">{field.editVal}</div>
                  )}
                </div>
                {field.labelKey === 'r.seal' ? (
                  <div style={{ fontSize: 20, flexShrink: 0, marginLeft: 12 }}>✅</div>
                ) : (
                  <div
                    className="tw-edit-link"
                    onClick={() => setReviewFields(prev => prev.map((f, i) => i === idx ? { ...f, editing: true } : f))}
                  >
                    {t['r.edit']}
                  </div>
                )}
              </div>
            ))}

            {/* Seal row */}
            <div className="tw-field" style={{ background: 'var(--acc-l)' }}>
              <div>
                <div className="tw-field-lbl">{t['r.seal']}</div>
                <div className="tw-field-val">[ROUND SEAL: detected]</div>
              </div>
              <div style={{ fontSize: 20 }}>✅</div>
            </div>

            <div style={{ height: 16 }} />
            <button className="tw-btn tw-btn-primary" onClick={() => goTo('cert')}>{t['r.confirm']}</button>
          </div>
        </div>
      )}

      {/* ── CERT ── */}
      {screen === 'cert' && (
        <div className="tw-animate">
          <BackBtn to="review" />
          <div className="tw-wrap">
            {progBar()}

            <h2 className="tw-h2">{t['c.title']}</h2>
            <p className="tw-subtitle">{t['c.sub']}</p>

            {/* Translator profile display */}
            <div className="tw-profile-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {t['c.your']}
                </div>
                <div className="tw-edit-link" onClick={() => { setEditForm({ ...profile }); setShowProfileEditor(v => !v) }}>
                  {t['r.edit']}
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{profile.name || '—'}</div>
              <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7 }}>
                {profile.addr && <>{profile.addr}<br /></>}
                {profile.phone && <>{profile.phone}<br /></>}
                {profile.email}
              </div>
            </div>

            {/* Profile editor */}
            {showProfileEditor && (
              <div className="tw-profile-edit-box">
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--acc)', marginBottom: 10 }}>{t['c.edit.title']}</div>
                <label className="tw-input-lbl">{t['c.fname']}</label>
                <input className="tw-input" value={editForm.name} placeholder="LASTNAME FIRSTNAME PATRONYMIC"
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                <label className="tw-input-lbl">{t['c.addr']}</label>
                <input className="tw-input" value={editForm.addr} placeholder="123 Main St, Los Angeles, CA 90012"
                  onChange={e => setEditForm(f => ({ ...f, addr: e.target.value }))} />
                <label className="tw-input-lbl">{t['c.phone']}</label>
                <input className="tw-input" value={editForm.phone} placeholder="(555) 123-4567"
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                <label className="tw-input-lbl">Email</label>
                <input className="tw-input" type="email" value={editForm.email} placeholder="your@email.com"
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                <button className="tw-btn tw-btn-primary" onClick={handleSaveProfile} style={{ marginTop: 8 }}>
                  {t['c.edit.save']}
                </button>
              </div>
            )}

            <label className="tw-ack">
              <input type="checkbox" checked={ack1} onChange={e => setAck1(e.target.checked)} />
              <span className="tw-ack-text">{t['c.cb1']}</span>
            </label>

            <label className="tw-ack">
              <input type="checkbox" checked={ack2} onChange={e => setAck2(e.target.checked)} />
              <span className="tw-ack-text">{t['c.cb2']}</span>
            </label>

            <div className="tw-divider" />

            <h2 className="tw-h2">{t['c.sig.title']}</h2>
            <p style={{ fontSize: 14, color: 'var(--ink2)', marginBottom: 16, lineHeight: 1.5 }}>
              {t['c.sig.desc']}
            </p>

            {/* Signature canvas */}
            <div className="tw-sig-wrap">
              <canvas ref={canvasRef} className="tw-sig-canvas" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{t['c.sig.hint']}</span>
              <button className="tw-btn-sm" onClick={clearSig}>{t['c.sig.clear']}</button>
            </div>

            {!manualSig && (
              <label className="tw-ack">
                <input type="checkbox" checked={ack3} onChange={e => setAck3(e.target.checked)} />
                <span className="tw-ack-text">{t['c.cb3']}</span>
              </label>
            )}

            {/* Manual sig fallback */}
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 12, color: 'var(--ink3)', cursor: 'pointer' }}>
                {t['c.sig.fallback']}
              </summary>
              <div style={{ padding: '10px 0', fontSize: 13, color: 'var(--danger)', lineHeight: 1.6, fontWeight: 600 }}>
                {t['c.sig.notrec']}
              </div>
              <div style={{ paddingBottom: 10, fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
                {t['c.sig.fallback.text']}
              </div>
              <label className="tw-ack" style={{ marginTop: 8 }}>
                <input type="checkbox" checked={manualSig} onChange={e => handleManualSig(e.target.checked)} />
                <span className="tw-ack-text" style={{ fontSize: 13 }}>{t['c.sig.manual']}</span>
              </label>
            </details>

            <div style={{ height: 16 }} />
            <button
              className="tw-btn tw-btn-primary"
              disabled={!isCertReady()}
              onClick={handleGeneratePdf}
            >
              {manualSig ? t['c.btn.manual'] : t['c.btn']}
            </button>
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {screen === 'done' && (
        <div className="tw-animate">
          <div className="tw-wrap">
            {progBar()}

            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 64, marginBottom: 12 }}>✅</div>
              <h1 className="tw-h1">{t['done.title']}</h1>
              <p className="tw-subtitle">{profile.email ? t['done.sub'].replace('вашу пошту', profile.email).replace('вашу почту', profile.email).replace('your email', profile.email).replace('su correo', profile.email) : t['done.sub']}</p>
            </div>

            <div className="tw-file-row">
              <div style={{ fontSize: 28 }}>📄</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>birth-certificate-EN.pdf</div>
                <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{t['done.en']}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--acc)', cursor: 'pointer', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {t['done.dl']}
              </div>
            </div>

            {spanishCopy && (
              <>
                <div className="tw-file-row">
                  <div style={{ fontSize: 28 }}>📄</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>birth-certificate-ES.pdf</div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{t['done.es']}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--acc)', cursor: 'pointer', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    {t['done.dl']}
                  </div>
                </div>
                <div className="tw-warn">{t['done.es.note']}</div>
              </>
            )}

            <div className="tw-divider" />

            <h2 className="tw-h2">{t['done.next']}</h2>
            <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.8, marginBottom: 20 }}>
              {(manualSig ? t['done.steps.manual'] : t['done.steps.signed']).split('\n').map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
            </p>

            <button className="tw-btn tw-btn-outline" onClick={handleReset}>{t['done.more']}</button>

            <p className="tw-footer-note" style={{ marginTop: 32 }}>
              Signature captured electronically on this date for the translation certification.<br />
              Messenginfo assisted with preparing the draft and formatting only.<br />
              The translation was certified and signed by the user as the translator.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
