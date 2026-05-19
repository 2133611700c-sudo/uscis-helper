'use client'

/**
 * TPS Wizard V2 — 1:1 port of /uploads/tps_prototype_v4.html into React.
 *
 * Keeps the site Header / LanguageSwitcher / MobileBottomBar untouched.
 * Replaces only the inner wizard surface that lives under
 * /[locale]/services/tps-ukraine/start.
 *
 * 6 steps:
 *   1. Type      — Initial Registration vs Re-Registration
 *   2. Method    — Online (my.uscis.gov) vs Paper, with fee-waiver warning
 *   3. EAD       — concurrent I-765 yes/no
 *   4. Upload    — conditional doc set based on (type, ead, method)
 *   5. Review    — OCR'd fields list + manual fields + tooltips
 *   6. Result    — package list + Pay button + Download ZIP + instructions
 *
 * Backend reuse (NO new API contracts):
 *   - POST /api/tps/ocr/extract            — per-file Google Vision + brain
 *   - POST /api/tps/generate-packet        — assembles I-821 + I-765 + README ZIP
 *
 * State: local React state, persisted to localStorage under
 *   'wizard:tps-ukraine:v2:state' (no Supabase, no cross-device sync).
 *
 * i18n: inline T dict (uk/ru/en/es) — same pattern as the legacy TPSWizard.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TPSAnswers } from '@/lib/tps/answers'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type FilingType = 'init' | 'rereg'
type Method = 'online' | 'paper'
type EadChoice = 'ead' | 'noead'

interface UploadEntry {
  file: File | null
  fileName: string
  status: 'idle' | 'uploading' | 'done' | 'error'
  errorMsg?: string
  /** Merged OCR fields keyed by canonical field name (family_name, given_name, …). */
  fields?: Record<string, string>
}

interface WizardData {
  type?: FilingType
  method?: Method
  ead?: EadChoice
  /** Map of docId → upload state. */
  uploads: Record<string, UploadEntry>
  /** Manual fields the user types (overrides OCR). */
  manual: {
    us_address_street?: string
    us_address_city?: string
    us_address_state?: string
    us_address_zip?: string
    daytime_phone?: string
    email?: string
    marital_status?: TPSAnswers['marital_status']
    ssn?: string
  }
  paid: boolean
  packetReady: boolean
}

interface Props {
  locale: string
}

// ─────────────────────────────────────────────────────────────────────────────
// i18n
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  uk: {
    h1: '🇺🇦 TPS для України',
    sub: 'Ми генеруємо форми USCIS — ви подаєте самостійно',
    stepOf: (n: number) => `Крок ${n} з 6`,
    s1q: 'Ви подаєте вперше чи продовжуєте?',
    s1h: 'Якщо раніше ніколи не мали TPS — «Вперше»',
    s1Init: 'Вперше',
    s1InitSub: 'Initial Registration',
    s1Rereg: 'Продовження',
    s1RregSub: 'Re-Registration',
    s2q: 'Як ви плануєте подавати в USCIS?',
    s2h: 'Ми підготуємо пакет під обраний спосіб',
    s2Online: 'Онлайн',
    s2OnlineSub: 'Через myUSCIS',
    s2Paper: 'Поштою',
    s2PaperSub: 'Paper filing',
    s2FwWarn: '⚠️ Якщо потрібен fee waiver (I-912) — оберіть «Поштою». Онлайн fee waiver неможливий.',
    s3q: 'Вам потрібен дозвіл на роботу (EAD)?',
    s3h: 'Рекомендується подавати I-765 одразу з I-821 — так швидше',
    s3Yes: 'Так',
    s3YesSub: 'Додати I-765',
    s3No: 'Ні',
    s3NoSub: 'Тільки TPS',
    s4q: 'Завантажте документи',
    s4h: 'Ми розпізнаємо дані і автоматично заповнимо форми USCIS',
    s4Recognize: 'Розпізнати документи →',
    s4NoPassport: 'Немає закордонного паспорта?',
    s4NoPassportBody:
      'Якщо у вас немає закордонного паспорта, USCIS може прийняти інший документ, що підтверджує особу та громадянство:',
    s4Alt1: 'Внутрішній паспорт-книжечка',
    s4Alt2: 'Українська ID-карта',
    s4Alt3: 'Свідоцтво про народження + документ з фото',
    s4AltSuffix: 'з сертифікованим перекладом на англійську',
    s4AltSuffixBirth: '',
    s4AltWarn:
      '⚠️ Будь-який документ не англійською мовою повинен мати повний англійський переклад із сертифікацією перекладача.',
    s4AltLink: '📝 Замовити переклад на Messenginfo →',
    s4AltNote:
      "Зверніть увагу: внутрішній паспорт підтверджує особу, але не підтверджує в'їзд в США. I-94 потрібен окремо.",
    s5q: 'Перевірте дані',
    s5h: 'Натисніть «Змінити» якщо щось неправильно',
    s5OcrTitle: '📋 Розпізнані дані',
    s5ManualTitle: '✏️ Заповніть вручну',
    s5Generate: 'Згенерувати пакет →',
    s6q: 'Ваш пакет готовий',
    s6PkgTitle: '📦 Що ви отримуєте',
    s6Pay: '💳 Оплатити',
    s6Download: '⬇ Завантажити пакет (ZIP)',
    s6InstrTitle: '📌 Як подати в USCIS',
    s6TranslateNote:
      'Якщо ваші документи не англійською мовою (паспорт, свідоцтво про народження) — вони потребують сертифікованого перекладу.',
    s6TranslateLink: 'Замовити переклад на Messenginfo →',
    s6Disclaimer:
      'Messenginfo не подає документи за вас. Ми не юридична фірма. Не гарантуємо прийняття USCIS. Перевіряйте дати на ',
    back: '← Назад',
    restart: '↺ Спочатку',
    edit: 'Змінити',
    notSet: '—',
    label: {
      surname: 'Прізвище / Surname',
      given: "Ім'я / Given Name",
      patronymic: 'По батькові / Patronymic',
      dob: 'Дата народження',
      sex: 'Стать',
      passport_number: 'Номер паспорта',
      country_of_nationality: 'Громадянство',
      i94_admission_number: 'I-94 Admission Number',
      last_entry_date: "Дата в'їзду в США",
      status_at_last_entry: "Статус при в'їзді",
      a_number: 'A-Number',
      address: 'Адреса в США',
      phone: 'Телефон',
      email: 'Email',
      marital: 'Сімейний стан',
      ssn: 'SSN',
      ead_category: 'Категорія EAD',
    },
    source: {
      passport: 'Паспорт → OCR',
      i94: 'I-94 → OCR',
      ead: 'EAD → OCR',
      i797: 'I-797 → OCR',
      i797_or_ead: 'I-797 / EAD → OCR',
    },
    placeholder: {
      address: 'Street, Apt, City, State, ZIP',
      ssn: 'Якщо є',
    },
    tip: {
      address: 'Part 4 форми I-821 — ваша поточна фізична адреса проживання в США',
      phone: 'Part 8 I-821 — контактний телефон',
      email: 'Part 8 I-821 — контактний email',
      marital: 'Part 2, Item 9 форми I-821. Оберіть ваш поточний статус.',
      ssn: "Part 2, Item 10 — необов'язково, але рекомендується якщо є",
      eadInit:
        'C19 — ваша заявка TPS ще на розгляді (pending). Після одобрення категорія зміниться на A12.',
      eadRereg: 'A12 — ваш TPS вже одобрений. Це правильна категорія для продовження.',
      eadAuto: 'Встановлюється автоматично',
    },
    marital: {
      single: 'Single',
      married: 'Married',
      divorced: 'Divorced',
      widowed: 'Widowed',
      annulled: 'Annulled',
      other: 'Other',
    },
    doc: {
      passportInit: {
        ic: '🛂',
        lb: 'Закордонний паспорт',
        ht: 'Усі сторінки, включно з парольним штампом. Може бути прострочений.',
      },
      i94: {
        ic: '📄',
        lb: 'I-94',
        ht: "Роздруківка з i94.cbp.dhs.gov — підтвердження в'їзду в США",
      },
      tps_notice: {
        ic: '📬',
        lb: 'TPS Approval Notice або Receipt Notice',
        ht: 'I-797 або лист від USCIS. Ми витягнемо адресу та A-Number автоматично.',
      },
      passportRereg: {
        ic: '🛂',
        lb: 'Закордонний паспорт',
        ht: 'Для підтвердження особи при запиті EAD',
      },
      ead_old: {
        ic: '💳',
        lb: 'Попередній EAD',
        ht: 'Передня і задня сторона',
      },
      i94Rereg: {
        ic: '📄',
        lb: 'I-94',
        ht: 'Копія актуальної записи',
      },
      photo: {
        ic: '📸',
        lb: '2 фото 2×2 дюйми',
        ht: 'Кольорові, passport-style, зроблені за останні 30 днів',
      },
    },
    uploadedSuffix: '✓ завантажено',
    package: {
      i821: (init: boolean) =>
        `Заповнена Form I-821 (PDF)${init ? ' — Initial Registration' : ' — Re-Registration'}`,
      i765: (init: boolean) => `Заповнена Form I-765 (PDF) — категорія ${init ? 'C19' : 'A12'}`,
      checklist: 'Чек-лист документів під ваш сценарій',
      instr: (paper: boolean) => `Покрокова інструкція подачі ${paper ? 'поштою' : 'онлайн'}`,
    },
    instrOnline: [
      'Увійдіть на <b>my.uscis.gov</b>',
      'Оберіть «File a form online» → I-821',
      (init: boolean) => `Оберіть «${init ? 'Initial application' : 'Re-registration'}» в Part 1`,
      'Перенесіть дані з наших PDF у онлайн-форму',
      'Завантажте скани документів (PDF/JPEG)',
      'Оплатіть онлайн через Pay.gov',
      'Receipt Number — миттєво в кабінеті',
    ],
    instrPaper: [
      'Роздрукуйте наші заповнені PDF',
      '<b>Підпишіть від руки</b> — друкований/цифровий підпис може стати причиною відмови',
      'Порядок в конверті: форми → оплата → документи',
      'Скріпки — так. Степлер — ні',
      'Адреса Lockbox: див. на uscis.gov',
      'Receipt Number — поштою через 2-4 тижні',
    ],
    instrPaperEadPhoto: 'Вкладіть 2 кольорових фото 2×2 дюйми (за останні 30 днів)',
    ocrErr: 'Помилка розпізнавання. Спробуйте ще раз.',
    packetErr: 'Не вдалося згенерувати пакет. Спробуйте ще раз.',
    translateHref: '/uk/services/translate-document',
  },
  ru: {
    h1: '🇺🇦 TPS для Украины',
    sub: 'Мы генерируем формы USCIS — вы подаёте сами',
    stepOf: (n: number) => `Шаг ${n} из 6`,
    s1q: 'Вы подаёте впервые или продлеваете?',
    s1h: 'Если раньше не было TPS — «Впервые»',
    s1Init: 'Впервые',
    s1InitSub: 'Initial Registration',
    s1Rereg: 'Продление',
    s1RregSub: 'Re-Registration',
    s2q: 'Как вы планируете подавать в USCIS?',
    s2h: 'Мы подготовим пакет под выбранный способ',
    s2Online: 'Онлайн',
    s2OnlineSub: 'Через myUSCIS',
    s2Paper: 'Почтой',
    s2PaperSub: 'Paper filing',
    s2FwWarn:
      '⚠️ Если нужен fee waiver (I-912) — выберите «Почтой». Онлайн fee waiver невозможен.',
    s3q: 'Вам нужно разрешение на работу (EAD)?',
    s3h: 'Рекомендуется подавать I-765 сразу с I-821 — так быстрее',
    s3Yes: 'Да',
    s3YesSub: 'Добавить I-765',
    s3No: 'Нет',
    s3NoSub: 'Только TPS',
    s4q: 'Загрузите документы',
    s4h: 'Мы распознаем данные и автоматически заполним формы USCIS',
    s4Recognize: 'Распознать документы →',
    s4NoPassport: 'Нет загранпаспорта?',
    s4NoPassportBody:
      'Если у вас нет загранпаспорта, USCIS может принять другой документ, подтверждающий личность и гражданство:',
    s4Alt1: 'Внутренний паспорт-книжка',
    s4Alt2: 'Украинская ID-карта',
    s4Alt3: 'Свидетельство о рождении + документ с фото',
    s4AltSuffix: 'с сертифицированным переводом на английский',
    s4AltSuffixBirth: '',
    s4AltWarn:
      '⚠️ Любой документ не на английском должен иметь полный английский перевод с сертификацией переводчика.',
    s4AltLink: '📝 Заказать перевод на Messenginfo →',
    s4AltNote:
      'Обратите внимание: внутренний паспорт подтверждает личность, но не подтверждает въезд в США. I-94 нужен отдельно.',
    s5q: 'Проверьте данные',
    s5h: 'Нажмите «Изменить» если что-то неправильно',
    s5OcrTitle: '📋 Распознанные данные',
    s5ManualTitle: '✏️ Заполните вручную',
    s5Generate: 'Сгенерировать пакет →',
    s6q: 'Ваш пакет готов',
    s6PkgTitle: '📦 Что вы получаете',
    s6Pay: '💳 Оплатить',
    s6Download: '⬇ Скачать пакет (ZIP)',
    s6InstrTitle: '📌 Как подать в USCIS',
    s6TranslateNote:
      'Если ваши документы не на английском (паспорт, свидетельство о рождении) — нужен сертифицированный перевод.',
    s6TranslateLink: 'Заказать перевод на Messenginfo →',
    s6Disclaimer:
      'Messenginfo не подаёт документы за вас. Мы не юридическая фирма. Не гарантируем приём USCIS. Проверяйте даты на ',
    back: '← Назад',
    restart: '↺ С начала',
    edit: 'Изменить',
    notSet: '—',
    label: {
      surname: 'Фамилия / Surname',
      given: 'Имя / Given Name',
      patronymic: 'Отчество / Patronymic',
      dob: 'Дата рождения',
      sex: 'Пол',
      passport_number: 'Номер паспорта',
      country_of_nationality: 'Гражданство',
      i94_admission_number: 'I-94 Admission Number',
      last_entry_date: 'Дата въезда в США',
      status_at_last_entry: 'Статус при въезде',
      a_number: 'A-Number',
      address: 'Адрес в США',
      phone: 'Телефон',
      email: 'Email',
      marital: 'Семейное положение',
      ssn: 'SSN',
      ead_category: 'Категория EAD',
    },
    source: {
      passport: 'Паспорт → OCR',
      i94: 'I-94 → OCR',
      ead: 'EAD → OCR',
      i797: 'I-797 → OCR',
      i797_or_ead: 'I-797 / EAD → OCR',
    },
    placeholder: {
      address: 'Street, Apt, City, State, ZIP',
      ssn: 'Если есть',
    },
    tip: {
      address: 'Part 4 формы I-821 — ваш фактический адрес проживания в США',
      phone: 'Part 8 I-821 — контактный телефон',
      email: 'Part 8 I-821 — контактный email',
      marital: 'Part 2, Item 9 формы I-821. Выберите ваш текущий статус.',
      ssn: 'Part 2, Item 10 — необязательно, но рекомендуется если есть',
      eadInit:
        'C19 — ваша заявка TPS ещё на рассмотрении (pending). После одобрения категория сменится на A12.',
      eadRereg: 'A12 — ваш TPS уже одобрен. Это правильная категория для продления.',
      eadAuto: 'Устанавливается автоматически',
    },
    marital: {
      single: 'Single',
      married: 'Married',
      divorced: 'Divorced',
      widowed: 'Widowed',
      annulled: 'Annulled',
      other: 'Other',
    },
    doc: {
      passportInit: {
        ic: '🛂',
        lb: 'Загранпаспорт',
        ht: 'Все страницы, включая штамп парола. Может быть просрочен.',
      },
      i94: {
        ic: '📄',
        lb: 'I-94',
        ht: 'Распечатка с i94.cbp.dhs.gov — подтверждение въезда в США',
      },
      tps_notice: {
        ic: '📬',
        lb: 'TPS Approval Notice или Receipt Notice',
        ht: 'I-797 или письмо от USCIS. Мы извлечём адрес и A-Number автоматически.',
      },
      passportRereg: {
        ic: '🛂',
        lb: 'Загранпаспорт',
        ht: 'Для подтверждения личности при запросе EAD',
      },
      ead_old: {
        ic: '💳',
        lb: 'Предыдущий EAD',
        ht: 'Лицевая и обратная сторона',
      },
      i94Rereg: {
        ic: '📄',
        lb: 'I-94',
        ht: 'Копия актуальной записи',
      },
      photo: {
        ic: '📸',
        lb: '2 фото 2×2 дюйма',
        ht: 'Цветные, passport-style, сделаны за последние 30 дней',
      },
    },
    uploadedSuffix: '✓ загружено',
    package: {
      i821: (init: boolean) =>
        `Заполненная Form I-821 (PDF)${init ? ' — Initial Registration' : ' — Re-Registration'}`,
      i765: (init: boolean) => `Заполненная Form I-765 (PDF) — категория ${init ? 'C19' : 'A12'}`,
      checklist: 'Чек-лист документов под ваш сценарий',
      instr: (paper: boolean) => `Пошаговая инструкция подачи ${paper ? 'почтой' : 'онлайн'}`,
    },
    instrOnline: [
      'Войдите на <b>my.uscis.gov</b>',
      'Выберите «File a form online» → I-821',
      (init: boolean) => `Выберите «${init ? 'Initial application' : 'Re-registration'}» в Part 1`,
      'Перенесите данные из наших PDF в онлайн-форму',
      'Загрузите сканы документов (PDF/JPEG)',
      'Оплатите онлайн через Pay.gov',
      'Receipt Number — мгновенно в кабинете',
    ],
    instrPaper: [
      'Распечатайте наши заполненные PDF',
      '<b>Подпишите от руки</b> — печатный/цифровой подпис может стать причиной отказа',
      'Порядок в конверте: формы → оплата → документы',
      'Скрепки — да. Степлер — нет',
      'Адрес Lockbox: см. на uscis.gov',
      'Receipt Number — почтой через 2-4 недели',
    ],
    instrPaperEadPhoto: 'Вложите 2 цветных фото 2×2 дюйма (за последние 30 дней)',
    ocrErr: 'Ошибка распознавания. Попробуйте ещё раз.',
    packetErr: 'Не удалось сгенерировать пакет. Попробуйте ещё раз.',
    translateHref: '/ru/services/translate-document',
  },
  en: {
    h1: '🇺🇦 TPS for Ukraine',
    sub: 'We generate USCIS forms — you file yourself',
    stepOf: (n: number) => `Step ${n} of 6`,
    s1q: 'Filing for the first time or re-registering?',
    s1h: 'Pick «First time» if you have never had TPS before',
    s1Init: 'First time',
    s1InitSub: 'Initial Registration',
    s1Rereg: 'Re-Registration',
    s1RregSub: 'Re-Registration',
    s2q: 'How do you plan to file with USCIS?',
    s2h: 'We will prepare the packet for your chosen method',
    s2Online: 'Online',
    s2OnlineSub: 'Via myUSCIS',
    s2Paper: 'By mail',
    s2PaperSub: 'Paper filing',
    s2FwWarn: '⚠️ If you need a fee waiver (I-912) — choose «By mail». Fee waiver is not available online.',
    s3q: 'Do you need work authorization (EAD)?',
    s3h: 'It is recommended to file I-765 together with I-821 — it is faster',
    s3Yes: 'Yes',
    s3YesSub: 'Add I-765',
    s3No: 'No',
    s3NoSub: 'TPS only',
    s4q: 'Upload your documents',
    s4h: 'We extract the data and auto-fill USCIS forms',
    s4Recognize: 'Recognize documents →',
    s4NoPassport: 'No international passport?',
    s4NoPassportBody:
      'If you don\'t have an international passport, USCIS may accept another document confirming identity and nationality:',
    s4Alt1: 'Internal passport booklet',
    s4Alt2: 'Ukrainian ID card',
    s4Alt3: 'Birth certificate + photo ID',
    s4AltSuffix: 'with a certified English translation',
    s4AltSuffixBirth: '',
    s4AltWarn:
      '⚠️ Any non-English document must include a full English translation with a translator\'s certification.',
    s4AltLink: '📝 Order a translation on Messenginfo →',
    s4AltNote:
      'Note: the internal passport proves identity but does NOT prove US entry. I-94 is required separately.',
    s5q: 'Review the data',
    s5h: 'Tap «Edit» if something is wrong',
    s5OcrTitle: '📋 Extracted data',
    s5ManualTitle: '✏️ Fill in manually',
    s5Generate: 'Generate packet →',
    s6q: 'Your packet is ready',
    s6PkgTitle: '📦 What you get',
    s6Pay: '💳 Pay',
    s6Download: '⬇ Download packet (ZIP)',
    s6InstrTitle: '📌 How to file with USCIS',
    s6TranslateNote:
      'If your documents are not in English (passport, birth certificate) — they need a certified translation.',
    s6TranslateLink: 'Order a translation on Messenginfo →',
    s6Disclaimer:
      'Messenginfo does not file on your behalf. We are not a law firm. We do not guarantee USCIS acceptance. Verify dates at ',
    back: '← Back',
    restart: '↺ Restart',
    edit: 'Edit',
    notSet: '—',
    label: {
      surname: 'Surname / Family name',
      given: 'Given name',
      patronymic: 'Patronymic',
      dob: 'Date of birth',
      sex: 'Sex',
      passport_number: 'Passport number',
      country_of_nationality: 'Nationality',
      i94_admission_number: 'I-94 Admission Number',
      last_entry_date: 'US entry date',
      status_at_last_entry: 'Status at entry',
      a_number: 'A-Number',
      address: 'US address',
      phone: 'Phone',
      email: 'Email',
      marital: 'Marital status',
      ssn: 'SSN',
      ead_category: 'EAD category',
    },
    source: {
      passport: 'Passport → OCR',
      i94: 'I-94 → OCR',
      ead: 'EAD → OCR',
      i797: 'I-797 → OCR',
      i797_or_ead: 'I-797 / EAD → OCR',
    },
    placeholder: {
      address: 'Street, Apt, City, State, ZIP',
      ssn: 'Optional',
    },
    tip: {
      address: 'Part 4 of I-821 — your current physical US address',
      phone: 'Part 8 I-821 — contact phone',
      email: 'Part 8 I-821 — contact email',
      marital: 'Part 2, Item 9 of I-821. Choose your current status.',
      ssn: 'Part 2, Item 10 — optional, recommended if you have one',
      eadInit:
        'C19 — your TPS application is still pending. After approval the category changes to A12.',
      eadRereg: 'A12 — your TPS is already approved. This is the correct category for re-registration.',
      eadAuto: 'Set automatically',
    },
    marital: {
      single: 'Single',
      married: 'Married',
      divorced: 'Divorced',
      widowed: 'Widowed',
      annulled: 'Annulled',
      other: 'Other',
    },
    doc: {
      passportInit: {
        ic: '🛂',
        lb: 'International passport',
        ht: 'All pages including the parole stamp. May be expired.',
      },
      i94: {
        ic: '📄',
        lb: 'I-94',
        ht: 'Printout from i94.cbp.dhs.gov — proof of US entry',
      },
      tps_notice: {
        ic: '📬',
        lb: 'TPS Approval Notice or Receipt Notice',
        ht: 'I-797 or USCIS letter. We will extract address and A-Number automatically.',
      },
      passportRereg: {
        ic: '🛂',
        lb: 'International passport',
        ht: 'For identity verification when requesting EAD',
      },
      ead_old: {
        ic: '💳',
        lb: 'Previous EAD',
        ht: 'Front and back',
      },
      i94Rereg: {
        ic: '📄',
        lb: 'I-94',
        ht: 'Copy of the current record',
      },
      photo: {
        ic: '📸',
        lb: '2 photos 2×2 inches',
        ht: 'Color, passport-style, taken in the last 30 days',
      },
    },
    uploadedSuffix: '✓ uploaded',
    package: {
      i821: (init: boolean) =>
        `Filled Form I-821 (PDF)${init ? ' — Initial Registration' : ' — Re-Registration'}`,
      i765: (init: boolean) => `Filled Form I-765 (PDF) — category ${init ? 'C19' : 'A12'}`,
      checklist: 'Document checklist for your scenario',
      instr: (paper: boolean) => `Step-by-step filing guide (${paper ? 'by mail' : 'online'})`,
    },
    instrOnline: [
      'Sign in at <b>my.uscis.gov</b>',
      'Choose «File a form online» → I-821',
      (init: boolean) => `Pick «${init ? 'Initial application' : 'Re-registration'}» in Part 1`,
      'Transfer the data from our PDFs into the online form',
      'Upload document scans (PDF/JPEG)',
      'Pay online via Pay.gov',
      'Receipt Number — instantly in your account',
    ],
    instrPaper: [
      'Print our filled PDFs',
      '<b>Sign by hand</b> — printed/digital signature may cause denial',
      'Envelope order: forms → payment → documents',
      'Paper clips — yes. Stapler — no',
      'Lockbox address: see uscis.gov',
      'Receipt Number — by mail in 2-4 weeks',
    ],
    instrPaperEadPhoto: 'Include 2 color photos 2×2 inches (taken in the last 30 days)',
    ocrErr: 'OCR failed. Please try again.',
    packetErr: 'Could not generate the packet. Please try again.',
    translateHref: '/en/services/translate-document',
  },
  es: {
    h1: '🇺🇦 TPS para Ucrania',
    sub: 'Generamos los formularios de USCIS — usted los presenta',
    stepOf: (n: number) => `Paso ${n} de 6`,
    s1q: '¿Presenta por primera vez o re-registra?',
    s1h: 'Si nunca ha tenido TPS — «Por primera vez»',
    s1Init: 'Por primera vez',
    s1InitSub: 'Initial Registration',
    s1Rereg: 'Re-registración',
    s1RregSub: 'Re-Registration',
    s2q: '¿Cómo planea presentar a USCIS?',
    s2h: 'Prepararemos el paquete según el método elegido',
    s2Online: 'En línea',
    s2OnlineSub: 'Vía myUSCIS',
    s2Paper: 'Por correo',
    s2PaperSub: 'Paper filing',
    s2FwWarn:
      '⚠️ Si necesita exención de tarifa (I-912) — elija «Por correo». La exención en línea no es posible.',
    s3q: '¿Necesita autorización de trabajo (EAD)?',
    s3h: 'Se recomienda presentar I-765 junto con I-821 — es más rápido',
    s3Yes: 'Sí',
    s3YesSub: 'Agregar I-765',
    s3No: 'No',
    s3NoSub: 'Solo TPS',
    s4q: 'Cargue sus documentos',
    s4h: 'Extraemos los datos y rellenamos los formularios de USCIS',
    s4Recognize: 'Reconocer documentos →',
    s4NoPassport: '¿No tiene pasaporte internacional?',
    s4NoPassportBody:
      'Si no tiene pasaporte internacional, USCIS puede aceptar otro documento que confirme identidad y nacionalidad:',
    s4Alt1: 'Pasaporte interno (libreta)',
    s4Alt2: 'Tarjeta de identidad ucraniana',
    s4Alt3: 'Acta de nacimiento + documento con foto',
    s4AltSuffix: 'con traducción certificada al inglés',
    s4AltSuffixBirth: '',
    s4AltWarn:
      '⚠️ Cualquier documento que no esté en inglés debe incluir traducción al inglés completa con certificación del traductor.',
    s4AltLink: '📝 Pedir traducción en Messenginfo →',
    s4AltNote:
      'Nota: el pasaporte interno confirma identidad pero NO confirma entrada a EE. UU. I-94 se requiere por separado.',
    s5q: 'Revise los datos',
    s5h: 'Toque «Editar» si algo está mal',
    s5OcrTitle: '📋 Datos extraídos',
    s5ManualTitle: '✏️ Llene manualmente',
    s5Generate: 'Generar paquete →',
    s6q: 'Su paquete está listo',
    s6PkgTitle: '📦 Lo que recibe',
    s6Pay: '💳 Pagar',
    s6Download: '⬇ Descargar paquete (ZIP)',
    s6InstrTitle: '📌 Cómo presentar a USCIS',
    s6TranslateNote:
      'Si sus documentos no están en inglés (pasaporte, acta de nacimiento) — necesitan traducción certificada.',
    s6TranslateLink: 'Pedir traducción en Messenginfo →',
    s6Disclaimer:
      'Messenginfo no presenta documentos por usted. No somos un bufete. No garantizamos aceptación de USCIS. Verifique fechas en ',
    back: '← Atrás',
    restart: '↺ Reiniciar',
    edit: 'Editar',
    notSet: '—',
    label: {
      surname: 'Apellido / Surname',
      given: 'Nombre / Given Name',
      patronymic: 'Patronímico',
      dob: 'Fecha de nacimiento',
      sex: 'Sexo',
      passport_number: 'Número de pasaporte',
      country_of_nationality: 'Nacionalidad',
      i94_admission_number: 'Número I-94 Admission',
      last_entry_date: 'Fecha de entrada a EE.UU.',
      status_at_last_entry: 'Estatus al entrar',
      a_number: 'A-Number',
      address: 'Dirección en EE.UU.',
      phone: 'Teléfono',
      email: 'Email',
      marital: 'Estado civil',
      ssn: 'SSN',
      ead_category: 'Categoría EAD',
    },
    source: {
      passport: 'Pasaporte → OCR',
      i94: 'I-94 → OCR',
      ead: 'EAD → OCR',
      i797: 'I-797 → OCR',
      i797_or_ead: 'I-797 / EAD → OCR',
    },
    placeholder: {
      address: 'Calle, Apt, Ciudad, Estado, ZIP',
      ssn: 'Opcional',
    },
    tip: {
      address: 'Parte 4 del I-821 — su dirección física actual en EE.UU.',
      phone: 'Parte 8 I-821 — teléfono de contacto',
      email: 'Parte 8 I-821 — email de contacto',
      marital: 'Parte 2, Ítem 9 del I-821. Elija su estado actual.',
      ssn: 'Parte 2, Ítem 10 — opcional, recomendado si lo tiene',
      eadInit:
        'C19 — su solicitud TPS está pendiente. Tras la aprobación la categoría cambia a A12.',
      eadRereg: 'A12 — su TPS ya está aprobado. Esta es la categoría correcta para re-registración.',
      eadAuto: 'Se establece automáticamente',
    },
    marital: {
      single: 'Single',
      married: 'Married',
      divorced: 'Divorced',
      widowed: 'Widowed',
      annulled: 'Annulled',
      other: 'Other',
    },
    doc: {
      passportInit: {
        ic: '🛂',
        lb: 'Pasaporte internacional',
        ht: 'Todas las páginas incluido el sello de parole. Puede estar vencido.',
      },
      i94: {
        ic: '📄',
        lb: 'I-94',
        ht: 'Impresión de i94.cbp.dhs.gov — prueba de entrada a EE.UU.',
      },
      tps_notice: {
        ic: '📬',
        lb: 'TPS Approval Notice o Receipt Notice',
        ht: 'I-797 o carta de USCIS. Extraeremos dirección y A-Number automáticamente.',
      },
      passportRereg: {
        ic: '🛂',
        lb: 'Pasaporte internacional',
        ht: 'Para verificar identidad al solicitar EAD',
      },
      ead_old: {
        ic: '💳',
        lb: 'EAD anterior',
        ht: 'Anverso y reverso',
      },
      i94Rereg: {
        ic: '📄',
        lb: 'I-94',
        ht: 'Copia del registro actual',
      },
      photo: {
        ic: '📸',
        lb: '2 fotos 2×2 pulgadas',
        ht: 'Color, estilo pasaporte, tomadas en los últimos 30 días',
      },
    },
    uploadedSuffix: '✓ cargado',
    package: {
      i821: (init: boolean) =>
        `Formulario I-821 rellenado (PDF)${init ? ' — Initial Registration' : ' — Re-Registration'}`,
      i765: (init: boolean) => `Formulario I-765 rellenado (PDF) — categoría ${init ? 'C19' : 'A12'}`,
      checklist: 'Lista de verificación de documentos para su caso',
      instr: (paper: boolean) => `Guía paso a paso de presentación (${paper ? 'por correo' : 'en línea'})`,
    },
    instrOnline: [
      'Inicie sesión en <b>my.uscis.gov</b>',
      'Elija «File a form online» → I-821',
      (init: boolean) => `Seleccione «${init ? 'Initial application' : 'Re-registration'}» en Part 1`,
      'Transfiera los datos de nuestros PDF al formulario en línea',
      'Cargue escaneos de documentos (PDF/JPEG)',
      'Pague en línea vía Pay.gov',
      'Receipt Number — al instante en su cuenta',
    ],
    instrPaper: [
      'Imprima nuestros PDF rellenados',
      '<b>Firme a mano</b> — firma impresa/digital puede causar denegación',
      'Orden en el sobre: formularios → pago → documentos',
      'Clips — sí. Grapadora — no',
      'Dirección Lockbox: vea uscis.gov',
      'Receipt Number — por correo en 2-4 semanas',
    ],
    instrPaperEadPhoto: 'Incluya 2 fotos a color 2×2 pulgadas (tomadas en los últimos 30 días)',
    ocrErr: 'OCR falló. Intente de nuevo.',
    packetErr: 'No se pudo generar el paquete. Intente de nuevo.',
    translateHref: '/es/services/translate-document',
  },
} as const

type LocaleKey = keyof typeof T

// ─────────────────────────────────────────────────────────────────────────────
// Constants (mirror prototype tokens 1:1)
// ─────────────────────────────────────────────────────────────────────────────

const GREEN = '#0d5a34'
const GREEN_DARK = '#08391f'
const PAY_BLUE = '#1a73e8'
const PAY_BLUE_DARK = '#1557b0'
const WARN_BG = '#fff3cd'
const WARN_BORDER = '#ffc107'
const WARN_TEXT = '#856404'
const INFO_BG = '#e8f0fe'
const INFO_BORDER = '#a8c7fa'
const INFO_TEXT = '#1a4d8f'
const PAGE_BG = '#f4f5f7'
const CARD_BG = '#fff'
const BORDER = '#ddd'
const BORDER_LIGHT = '#f0f0f0'
const TEXT_PRIMARY = '#111'
const TEXT_SECONDARY = '#666'
const TEXT_MUTED = '#777'
const TEXT_HINT = '#999'
const TEXT_FAINT = '#aaa'

const STORAGE_KEY = 'wizard:tps-ukraine:v2:state'

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable bits (kept inside this file so the wizard is self-contained)
// ─────────────────────────────────────────────────────────────────────────────

function Tip({ text }: { text: string }) {
  return (
    <span
      title={text}
      style={{
        display: 'inline-flex',
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#ddd',
        color: '#666',
        fontSize: 10,
        fontWeight: 800,
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'help',
        marginLeft: 4,
      }}
    >
      ?
    </span>
  )
}

function OptionPair({
  options,
  value,
  onPick,
}: {
  options: Array<{ id: string; label: string; sub: string }>
  value?: string
  onPick: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
      {options.map((o) => {
        const active = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            style={{
              flex: 1,
              padding: '16px 8px',
              border: `2.5px solid ${active ? GREEN : BORDER}`,
              borderRadius: 14,
              background: active ? GREEN : CARD_BG,
              color: active ? '#fff' : '#222',
              cursor: 'pointer',
              textAlign: 'center',
              transition: '.15s',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            {o.label}
            <small
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 400,
                marginTop: 3,
                opacity: 0.7,
              }}
            >
              {o.sub}
            </small>
          </button>
        )
      })}
    </div>
  )
}

interface DocDef {
  id: string
  ic: string
  lb: string
  ht: string
}

function UploadDrop({
  doc,
  entry,
  onPick,
  uploadedSuffix,
}: {
  doc: DocDef
  entry?: UploadEntry
  onPick: (id: string, file: File) => void
  uploadedSuffix: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const ok = entry?.status === 'done'
  const uploading = entry?.status === 'uploading'
  const err = entry?.status === 'error'
  return (
    <div
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      style={{
        border: `2.5px ${ok ? 'solid' : 'dashed'} ${ok ? GREEN : err ? '#d33' : '#ccc'}`,
        borderRadius: 14,
        padding: 20,
        textAlign: 'center',
        cursor: 'pointer',
        transition: '.2s',
        marginBottom: 10,
        background: ok ? '#e6f4ea' : err ? '#fdecea' : CARD_BG,
        opacity: uploading ? 0.7 : 1,
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 4 }}>{doc.ic}</div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: ok ? GREEN : err ? '#a33' : TEXT_PRIMARY,
        }}
      >
        {doc.lb} {ok && uploadedSuffix} {uploading && '⏳'}
      </div>
      <div style={{ fontSize: 11, color: TEXT_HINT, marginTop: 3 }}>
        {err ? entry?.errorMsg : doc.ht}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(doc.id, f)
        }}
      />
    </div>
  )
}

function RW({
  label,
  source,
  value,
  onEdit,
  editLabel,
}: {
  label: string
  source: string
  value: string
  onEdit: () => void
  editLabel: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: `1px solid ${BORDER_LIGHT}`,
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: TEXT_MUTED }}>{label}</div>
        <div style={{ fontSize: 10, color: '#bbb' }}>{source}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, textAlign: 'right' }}>{value}</div>
        <button
          type="button"
          onClick={onEdit}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 11,
            color: GREEN,
            cursor: 'pointer',
            marginLeft: 8,
            textDecoration: 'underline',
            fontFamily: 'inherit',
          }}
        >
          {editLabel}
        </button>
      </div>
    </div>
  )
}

function FieldInput({
  label,
  placeholder,
  tip,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  tip: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{ fontSize: 12, color: TEXT_MUTED }}>
        {label} <Tip text={tip} />
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: `1.5px solid ${BORDER}`,
          borderRadius: 10,
          fontSize: 14,
          margin: '4px 0 10px',
          fontFamily: 'inherit',
        }}
      />
    </div>
  )
}

function SingleSelect({
  label,
  tip,
  options,
  value,
  onPick,
}: {
  label: string
  tip: string
  options: Array<{ id: string; label: string }>
  value?: string
  onPick: (id: string) => void
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: TEXT_MUTED }}>
        {label} <Tip text={tip} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0 12px' }}>
        {options.map((o) => {
          const active = value === o.id
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onPick(o.id)}
              style={{
                padding: '8px 14px',
                border: `1.5px solid ${active ? GREEN : BORDER}`,
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                background: active ? GREEN : CARD_BG,
                color: active ? '#fff' : TEXT_PRIMARY,
                transition: '.15s',
                fontFamily: 'inherit',
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: CARD_BG,
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,.05)',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, color: GREEN, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function Nav({
  back,
  next,
  backLabel,
  nextLabel,
}: {
  back?: () => void
  next?: () => void
  backLabel: string
  nextLabel?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
      {back && (
        <button
          type="button"
          onClick={back}
          style={navBtn(false)}
        >
          {backLabel}
        </button>
      )}
      {next && nextLabel && (
        <button
          type="button"
          onClick={next}
          style={navBtn(true)}
        >
          {nextLabel}
        </button>
      )}
    </div>
  )
}

function navBtn(forward: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: 16,
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'center',
    background: forward ? GREEN : '#eee',
    color: forward ? '#fff' : '#555',
    fontFamily: 'inherit',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main wizard
// ─────────────────────────────────────────────────────────────────────────────

export default function TPSWizardV2({ locale }: Props) {
  const t = (T[locale as LocaleKey] ?? T.uk)

  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>({
    uploads: {},
    manual: {},
    paid: false,
    packetReady: false,
  })
  const [busy, setBusy] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  // ── Persist to localStorage (without File objects) ───────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        setData((d) => ({ ...d, ...parsed, uploads: {} }))
        if (typeof parsed.lastStep === 'number') setStep(parsed.lastStep)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      const { uploads, ...rest } = data
      // Strip File objects but keep fields for redisplay
      const uploadsSafe: Record<string, Pick<UploadEntry, 'fileName' | 'status' | 'fields'>> = {}
      for (const k of Object.keys(uploads)) {
        const u = uploads[k]
        uploadsSafe[k] = { fileName: u.fileName, status: u.status, fields: u.fields }
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...rest, lastStep: step, uploadsMeta: uploadsSafe }),
      )
    } catch {
      /* ignore */
    }
  }, [data, step])

  // ── Required doc list per (type, ead, method) ────────────────────────────
  const docs: DocDef[] = useMemo(() => {
    const list: DocDef[] = []
    const init = data.type === 'init'
    const ead = data.ead === 'ead'
    const paper = data.method === 'paper'
    if (init) {
      list.push({ id: 'passport', ...t.doc.passportInit })
      list.push({ id: 'i94', ...t.doc.i94 })
    } else {
      list.push({ id: 'tps_notice', ...t.doc.tps_notice })
      if (ead) {
        list.push({ id: 'passport', ...t.doc.passportRereg })
        list.push({ id: 'ead_old', ...t.doc.ead_old })
        list.push({ id: 'i94', ...t.doc.i94Rereg })
        if (paper) list.push({ id: 'photo', ...t.doc.photo })
      }
    }
    return list
  }, [data.type, data.ead, data.method, t])

  // ── Merged OCR fields across all uploaded docs ───────────────────────────
  const mergedOcr = useMemo(() => {
    const merged: Record<string, string> = {}
    for (const id of Object.keys(data.uploads)) {
      const u = data.uploads[id]
      if (!u.fields) continue
      for (const k of Object.keys(u.fields)) {
        if (!merged[k] && u.fields[k]) merged[k] = u.fields[k]
      }
    }
    return merged
  }, [data.uploads])

  // ── Step transitions ─────────────────────────────────────────────────────
  const goto = useCallback((n: number) => {
    setStep(n)
    setErrMsg(null)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // ── Upload + OCR ─────────────────────────────────────────────────────────
  const handleUpload = useCallback(
    async (id: string, file: File) => {
      setData((d) => ({
        ...d,
        uploads: {
          ...d.uploads,
          [id]: { file, fileName: file.name, status: 'uploading' },
        },
      }))
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('docHint', id)
        const r = await fetch('/api/tps/ocr/extract', { method: 'POST', body: fd })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const json = await r.json()
        const fields: Record<string, string> = {}
        const arr = Array.isArray(json?.fields) ? json.fields : []
        for (const f of arr) {
          if (f && typeof f.name === 'string' && typeof f.value === 'string') {
            fields[f.name] = f.value
          }
        }
        setData((d) => ({
          ...d,
          uploads: {
            ...d.uploads,
            [id]: { file, fileName: file.name, status: 'done', fields },
          },
        }))
      } catch (e) {
        setData((d) => ({
          ...d,
          uploads: {
            ...d.uploads,
            [id]: {
              file,
              fileName: file.name,
              status: 'error',
              errorMsg: t.ocrErr,
            },
          },
        }))
      }
    },
    [t.ocrErr],
  )

  // ── Generate packet (Step 6 after Pay) ───────────────────────────────────
  const handleGenerate = useCallback(async () => {
    setBusy(true)
    setErrMsg(null)
    try {
      const filing_path = data.type === 'init' ? 'initial' : 're_registration'
      const ead = data.ead === 'ead'
      const answers: Partial<TPSAnswers> = {
        family_name: mergedOcr.family_name || mergedOcr.surname || '',
        given_name: mergedOcr.given_name || mergedOcr.first_name || '',
        middle_name: mergedOcr.middle_name || mergedOcr.patronymic || '',
        dob: mergedOcr.dob || mergedOcr.date_of_birth || '',
        sex: (mergedOcr.sex === 'F' ? 'F' : 'M') as TPSAnswers['sex'],
        country_of_birth: mergedOcr.country_of_birth || 'Ukraine',
        country_of_nationality: mergedOcr.country_of_nationality || 'Ukraine',
        passport_number: mergedOcr.passport_number || '',
        passport_country_of_issuance: mergedOcr.passport_country_of_issuance || 'Ukraine',
        passport_expiration_date: mergedOcr.passport_expiration_date || '',
        a_number: mergedOcr.a_number || '',
        i94_admission_number: mergedOcr.i94_admission_number || '',
        last_entry_date: mergedOcr.last_entry_date || '',
        status_at_last_entry: mergedOcr.status_at_last_entry || '',
        filing_path,
        wants_ead: ead,
        ead_category: ead ? (data.type === 'init' ? 'a12' : 'c19') : null,
        us_address_street: data.manual.us_address_street || mergedOcr.address || '',
        us_address_city: data.manual.us_address_city || '',
        us_address_state: data.manual.us_address_state || '',
        us_address_zip: data.manual.us_address_zip || '',
        mailing_same_as_physical: true,
        daytime_phone: data.manual.daytime_phone || '',
        email: data.manual.email || '',
        marital_status: data.manual.marital_status,
        ssn: data.manual.ssn,
        part7_reviewed: true,
        has_criminal_concern: false,
        has_prior_tps_denial: false,
        left_us_without_advance_parole: false,
      }
      const r = await fetch('/api/tps/generate-packet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'tps-packet.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErrMsg(t.packetErr)
    } finally {
      setBusy(false)
    }
  }, [data, mergedOcr, t.packetErr])

  // ── Restart helper ───────────────────────────────────────────────────────
  const restart = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    setData({ uploads: {}, manual: {}, paid: false, packetReady: false })
    setStep(1)
  }, [])

  // ── Layout ───────────────────────────────────────────────────────────────
  return (
    <main
      style={{
        background: PAGE_BG,
        color: TEXT_PRIMARY,
        fontSize: 14,
        lineHeight: 1.6,
        minHeight: '100vh',
        fontFamily:
          '-apple-system,"Segoe UI",Roboto,Inter,sans-serif',
      }}
    >
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            textAlign: 'center',
            color: GREEN,
            marginBottom: 2,
          }}
        >
          {t.h1}
        </h1>
        <p
          style={{ textAlign: 'center', fontSize: 12, color: TEXT_SECONDARY, marginBottom: 20 }}
        >
          {t.sub}
        </p>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <span
              key={i}
              style={{
                flex: 1,
                height: 5,
                background: i <= step ? GREEN : '#e2e5ea',
                borderRadius: 3,
                transition: '.3s',
              }}
            />
          ))}
        </div>

        {/* STEP 1 — type */}
        {step === 1 && (
          <section>
            <div style={{ fontSize: 11, color: TEXT_FAINT, marginBottom: 4 }}>{t.stepOf(1)}</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 3 }}>{t.s1q}</div>
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 16 }}>{t.s1h}</div>
            <OptionPair
              value={data.type}
              onPick={(id) => {
                setData((d) => ({ ...d, type: id as FilingType }))
                goto(2)
              }}
              options={[
                { id: 'init', label: t.s1Init, sub: t.s1InitSub },
                { id: 'rereg', label: t.s1Rereg, sub: t.s1RregSub },
              ]}
            />
          </section>
        )}

        {/* STEP 2 — method */}
        {step === 2 && (
          <section>
            <div style={{ fontSize: 11, color: TEXT_FAINT, marginBottom: 4 }}>{t.stepOf(2)}</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 3 }}>{t.s2q}</div>
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 16 }}>{t.s2h}</div>
            <OptionPair
              value={data.method}
              onPick={(id) => {
                setData((d) => ({ ...d, method: id as Method }))
                goto(3)
              }}
              options={[
                { id: 'online', label: t.s2Online, sub: t.s2OnlineSub },
                { id: 'paper', label: t.s2Paper, sub: t.s2PaperSub },
              ]}
            />
            {data.method === 'online' && (
              <div
                style={{
                  background: WARN_BG,
                  border: `1.5px solid ${WARN_BORDER}`,
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 12,
                  color: WARN_TEXT,
                  marginBottom: 12,
                }}
              >
                {t.s2FwWarn}
              </div>
            )}
            <Nav back={() => goto(1)} backLabel={t.back} />
          </section>
        )}

        {/* STEP 3 — EAD */}
        {step === 3 && (
          <section>
            <div style={{ fontSize: 11, color: TEXT_FAINT, marginBottom: 4 }}>{t.stepOf(3)}</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 3 }}>{t.s3q}</div>
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 16 }}>{t.s3h}</div>
            <OptionPair
              value={data.ead}
              onPick={(id) => {
                setData((d) => ({ ...d, ead: id as EadChoice }))
                goto(4)
              }}
              options={[
                { id: 'ead', label: t.s3Yes, sub: t.s3YesSub },
                { id: 'noead', label: t.s3No, sub: t.s3NoSub },
              ]}
            />
            <Nav back={() => goto(2)} backLabel={t.back} />
          </section>
        )}

        {/* STEP 4 — uploads */}
        {step === 4 && (
          <section>
            <div style={{ fontSize: 11, color: TEXT_FAINT, marginBottom: 4 }}>{t.stepOf(4)}</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 3 }}>{t.s4q}</div>
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 16 }}>{t.s4h}</div>

            {docs.map((d) => (
              <UploadDrop
                key={d.id}
                doc={d}
                entry={data.uploads[d.id]}
                onPick={handleUpload}
                uploadedSuffix={t.uploadedSuffix}
              />
            ))}

            <NoPassportBlock t={t} />

            <Nav
              back={() => goto(3)}
              next={() => goto(5)}
              backLabel={t.back}
              nextLabel={t.s4Recognize}
            />
          </section>
        )}

        {/* STEP 5 — review */}
        {step === 5 && (
          <section>
            <div style={{ fontSize: 11, color: TEXT_FAINT, marginBottom: 4 }}>{t.stepOf(5)}</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 3 }}>{t.s5q}</div>
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 16 }}>{t.s5h}</div>

            <Card title={t.s5OcrTitle}>
              <ReviewOcr t={t} type={data.type} ead={data.ead} mergedOcr={mergedOcr} />
            </Card>

            <Card title={t.s5ManualTitle}>
              <ReviewManual
                t={t}
                type={data.type}
                ead={data.ead}
                manual={data.manual}
                onChange={(patch) =>
                  setData((d) => ({ ...d, manual: { ...d.manual, ...patch } }))
                }
              />
            </Card>

            <Nav
              back={() => goto(4)}
              next={() => goto(6)}
              backLabel={t.back}
              nextLabel={t.s5Generate}
            />
          </section>
        )}

        {/* STEP 6 — result */}
        {step === 6 && (
          <section>
            <div style={{ fontSize: 11, color: TEXT_FAINT, marginBottom: 4 }}>{t.stepOf(6)}</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{t.s6q}</div>

            <Card title={t.s6PkgTitle}>
              <PackageList t={t} type={data.type} ead={data.ead} method={data.method} />
            </Card>

            {!data.paid && (
              <button
                type="button"
                onClick={() => setData((d) => ({ ...d, paid: true }))}
                style={{
                  background: PAY_BLUE,
                  color: '#fff',
                  fontSize: 17,
                  padding: 18,
                  borderRadius: 14,
                  border: 'none',
                  width: '100%',
                  cursor: 'pointer',
                  fontWeight: 800,
                  marginBottom: 10,
                  fontFamily: 'inherit',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = PAY_BLUE_DARK)}
                onMouseOut={(e) => (e.currentTarget.style.background = PAY_BLUE)}
              >
                {t.s6Pay}
              </button>
            )}

            {data.paid && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={busy}
                style={{
                  background: GREEN,
                  color: '#fff',
                  fontSize: 17,
                  padding: 18,
                  borderRadius: 14,
                  border: 'none',
                  width: '100%',
                  cursor: busy ? 'wait' : 'pointer',
                  fontWeight: 800,
                  marginBottom: 10,
                  opacity: busy ? 0.7 : 1,
                  fontFamily: 'inherit',
                }}
                onMouseOver={(e) =>
                  !busy && (e.currentTarget.style.background = GREEN_DARK)
                }
                onMouseOut={(e) =>
                  !busy && (e.currentTarget.style.background = GREEN)
                }
              >
                {busy ? '…' : t.s6Download}
              </button>
            )}

            {errMsg && (
              <div
                style={{
                  background: '#fdecea',
                  border: '1.5px solid #d33',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 12,
                  color: '#a33',
                  marginBottom: 12,
                }}
              >
                {errMsg}
              </div>
            )}

            <InstructionsCard
              t={t}
              type={data.type}
              ead={data.ead}
              method={data.method}
            />

            <div
              style={{
                textAlign: 'center',
                fontSize: 11,
                color: TEXT_HINT,
                marginTop: 14,
                padding: 12,
                background: '#fafafa',
                borderRadius: 12,
              }}
            >
              {t.s6Disclaimer}
              <a
                href="https://www.uscis.gov/humanitarian/temporary-protected-status/TPS-Ukraine"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: GREEN, fontWeight: 700 }}
              >
                uscis.gov/TPS-Ukraine
              </a>
            </div>

            <Nav
              back={() => goto(5)}
              next={restart}
              backLabel={t.back}
              nextLabel={t.restart}
            />
          </section>
        )}

        <div
          style={{
            textAlign: 'center',
            marginTop: 16,
            fontSize: 10,
            color: TEXT_FAINT,
          }}
        >
          <a href="https://www.uscis.gov/i-821" target="_blank" rel="noopener noreferrer" style={{ color: GREEN }}>
            uscis.gov/i-821
          </a>
          {' · '}
          <a href="https://www.uscis.gov/i-765" target="_blank" rel="noopener noreferrer" style={{ color: GREEN }}>
            uscis.gov/i-765
          </a>
          {' · '}
          <a
            href="https://www.uscis.gov/humanitarian/temporary-protected-status/TPS-Ukraine"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: GREEN }}
          >
            TPS Ukraine
          </a>
        </div>
      </div>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function NoPassportBlock({ t }: { t: (typeof T)[LocaleKey] }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'none',
          border: 'none',
          fontSize: 12,
          color: GREEN,
          cursor: 'pointer',
          textDecoration: 'underline',
          marginTop: 6,
          fontFamily: 'inherit',
        }}
      >
        {t.s4NoPassport}
      </button>
      {open && (
        <div
          style={{
            background: INFO_BG,
            border: `1.5px solid ${INFO_BORDER}`,
            borderRadius: 12,
            padding: 12,
            fontSize: 12,
            color: INFO_TEXT,
            marginTop: 8,
          }}
        >
          {t.s4NoPassportBody}
          <br />
          <br />
          • <b>{t.s4Alt1}</b> {t.s4AltSuffix}
          <br />
          • <b>{t.s4Alt2}</b> {t.s4AltSuffix}
          <br />
          • <b>{t.s4Alt3}</b>
          <br />
          <br />
          {t.s4AltWarn}
          <br />
          <br />
          <a href={t.translateHref} style={{ color: GREEN, fontWeight: 700 }}>
            {t.s4AltLink}
          </a>
          <br />
          <br />
          <small>{t.s4AltNote}</small>
        </div>
      )}
    </div>
  )
}

function ReviewOcr({
  t,
  type,
  ead,
  mergedOcr,
}: {
  t: (typeof T)[LocaleKey]
  type?: FilingType
  ead?: EadChoice
  mergedOcr: Record<string, string>
}) {
  const init = type === 'init'
  const wantsEad = ead === 'ead'
  const rows: Array<{ key: string; label: string; source: string }> = [
    { key: 'family_name', label: t.label.surname, source: t.source.passport },
    { key: 'given_name', label: t.label.given, source: t.source.passport },
    { key: 'middle_name', label: t.label.patronymic, source: t.source.passport },
    { key: 'dob', label: t.label.dob, source: t.source.passport },
    { key: 'sex', label: t.label.sex, source: t.source.passport },
    { key: 'passport_number', label: t.label.passport_number, source: t.source.passport },
    { key: 'country_of_nationality', label: t.label.country_of_nationality, source: t.source.passport },
  ]
  if (init) {
    rows.push(
      { key: 'i94_admission_number', label: t.label.i94_admission_number, source: t.source.i94 },
      { key: 'last_entry_date', label: t.label.last_entry_date, source: t.source.i94 },
      { key: 'status_at_last_entry', label: t.label.status_at_last_entry, source: t.source.i94 },
    )
  }
  if (!init && wantsEad) {
    rows.push(
      { key: 'a_number', label: t.label.a_number, source: t.source.ead },
      { key: 'address', label: t.label.address, source: t.source.i797_or_ead },
    )
  }
  if (!init && !wantsEad) {
    rows.push({ key: 'address', label: t.label.address, source: t.source.i797 })
  }
  return (
    <>
      {rows.map((r) => (
        <RW
          key={r.key}
          label={r.label}
          source={r.source}
          value={mergedOcr[r.key] || t.notSet}
          onEdit={() => alert(`Edit: ${r.label}`)}
          editLabel={t.edit}
        />
      ))}
    </>
  )
}

function ReviewManual({
  t,
  type,
  ead,
  manual,
  onChange,
}: {
  t: (typeof T)[LocaleKey]
  type?: FilingType
  ead?: EadChoice
  manual: WizardData['manual']
  onChange: (patch: Partial<WizardData['manual']>) => void
}) {
  const init = type === 'init'
  const wantsEad = ead === 'ead'
  return (
    <>
      {init && (
        <FieldInput
          label={t.label.address}
          placeholder={t.placeholder.address}
          tip={t.tip.address}
          value={manual.us_address_street || ''}
          onChange={(v) => onChange({ us_address_street: v })}
        />
      )}
      <FieldInput
        label={t.label.phone}
        placeholder={t.label.phone}
        tip={t.tip.phone}
        value={manual.daytime_phone || ''}
        onChange={(v) => onChange({ daytime_phone: v })}
      />
      <FieldInput
        label={t.label.email}
        placeholder={t.label.email}
        tip={t.tip.email}
        value={manual.email || ''}
        onChange={(v) => onChange({ email: v })}
      />
      <SingleSelect
        label={t.label.marital}
        tip={t.tip.marital}
        options={[
          { id: 'single', label: t.marital.single },
          { id: 'married', label: t.marital.married },
          { id: 'divorced', label: t.marital.divorced },
          { id: 'widowed', label: t.marital.widowed },
          { id: 'annulled', label: t.marital.annulled },
          { id: 'other', label: t.marital.other },
        ]}
        value={manual.marital_status}
        onPick={(id) => onChange({ marital_status: id as TPSAnswers['marital_status'] })}
      />
      {init && (
        <FieldInput
          label={t.label.ssn}
          placeholder={t.placeholder.ssn}
          tip={t.tip.ssn}
          value={manual.ssn || ''}
          onChange={(v) => onChange({ ssn: v })}
        />
      )}
      {wantsEad && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0',
            borderBottom: `1px solid ${BORDER_LIGHT}`,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: TEXT_MUTED }}>
              {t.label.ead_category}{' '}
              <Tip text={init ? t.tip.eadInit : t.tip.eadRereg} />
            </div>
            <div style={{ fontSize: 10, color: '#bbb' }}>{t.tip.eadAuto}</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{init ? 'C19' : 'A12'}</div>
        </div>
      )}
    </>
  )
}

function PackageList({
  t,
  type,
  ead,
  method,
}: {
  t: (typeof T)[LocaleKey]
  type?: FilingType
  ead?: EadChoice
  method?: Method
}) {
  const init = type === 'init'
  const wantsEad = ead === 'ead'
  const paper = method === 'paper'
  const items: string[] = []
  items.push(t.package.i821(init))
  if (wantsEad) items.push(t.package.i765(init))
  items.push(t.package.checklist)
  items.push(t.package.instr(paper))
  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {items.map((it, idx) => (
        <li
          key={idx}
          style={{
            padding: '6px 0 6px 26px',
            position: 'relative',
            fontSize: 14,
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 0,
              color: GREEN,
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            ✓
          </span>
          {it}
        </li>
      ))}
    </ul>
  )
}

function InstructionsCard({
  t,
  type,
  ead,
  method,
}: {
  t: (typeof T)[LocaleKey]
  type?: FilingType
  ead?: EadChoice
  method?: Method
}) {
  const init = type === 'init'
  const paper = method === 'paper'
  const wantsEad = ead === 'ead'

  const lines: ReadonlyArray<string | ((init: boolean) => string)> = paper
    ? [
        t.instrPaper[0],
        t.instrPaper[1],
        ...(wantsEad ? [t.instrPaperEadPhoto] : []),
        t.instrPaper[2],
        t.instrPaper[3],
        t.instrPaper[4],
        t.instrPaper[5],
      ]
    : t.instrOnline

  return (
    <div
      style={{
        background: CARD_BG,
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,.05)',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, color: GREEN, marginBottom: 10 }}>
        {t.s6InstrTitle}
      </div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {lines.map((line, idx) => {
          const html = typeof line === 'function' ? line(init) : line
          return (
            <li
              key={idx}
              style={{
                padding: '6px 0 6px 26px',
                position: 'relative',
                fontSize: 14,
              }}
              dangerouslySetInnerHTML={{
                __html: `<span style="position:absolute;left:0;color:${GREEN};font-weight:800;font-size:15px">✓</span>${html}`,
              }}
            />
          )
        })}
      </ul>
      {init && (
        <div
          style={{
            background: INFO_BG,
            border: `1.5px solid ${INFO_BORDER}`,
            borderRadius: 12,
            padding: 12,
            fontSize: 12,
            color: INFO_TEXT,
            marginTop: 12,
          }}
        >
          📝 {t.s6TranslateNote}
          <br />
          <a href={t.translateHref} style={{ color: GREEN, fontWeight: 700 }}>
            <b>{t.s6TranslateLink}</b>
          </a>
        </div>
      )}
    </div>
  )
}
