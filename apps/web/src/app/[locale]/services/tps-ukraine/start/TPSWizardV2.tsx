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

/**
 * Where the wizard's review screen learned a value from. Mirrors the backend
 * TpsExtractionSource enum (apps/web/src/lib/tps/types.ts) so server and UI
 * speak the same language. UI maps these to localized human labels via
 * `t.sourceForExtraction()`.
 */
export type ExtractionSource =
  | 'ocr_mrz'
  | 'ocr_visual'
  | 'ocr_keyword'
  | 'ai_brain'
  | 'user_input'
  | 'user_corrected'
  | 'inferred'

/**
 * One field's worth of trace data. We keep this richer than a bare string
 * so the review screen can show:
 *   - the actual provenance (passport rule vs AI vs user typed)
 *   - whether the validator flagged the value for human review
 *   - which document slot the value came from (passport / I-94 / EAD)
 */
export interface FieldExtraction {
  value: string
  source: ExtractionSource
  /** True when the validator returned `requires_review` — UI shows a badge. */
  requires_review: boolean
  /** Which upload slot produced this field (passport, i94, ead, …). */
  doc_slot: string
}

interface UploadEntry {
  file: File | null
  fileName: string
  status: 'idle' | 'uploading' | 'done' | 'error'
  errorMsg?: string
  /**
   * Extracted fields keyed by canonical name (family_name, dob, …).
   * Backward-compatible with the v1 shape `Record<string, string>` —
   * the rehydration code below upgrades old entries on load.
   */
  fields?: Record<string, FieldExtraction>
  /** Brain's document_type classification, surfaced for UI warnings. */
  detected_document_type?: string | null
  /** True when Brain says the file does not match the chosen slot. */
  slot_mismatch?: boolean
  /** Length of the raw Vision OCR text — used for poor-image hints. */
  vision_text_length?: number
  /** Brain run status from the OCR endpoint diagnostics. */
  brain_status?: 'off' | 'skipped' | 'ran' | 'error'
  /** Field keys the API contract rejected for this slot. UI may surface. */
  rejected_field_keys?: string[]
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
    notFound: 'Не знайдено — введіть вручну',
    notInPassport: 'Немає в закордонному паспорті — заповніть на наступному кроці',
    reviewBadge: 'перевірте AI',
    warn: {
      slotMismatch: '⚠️ Цей файл не схожий на вибраний тип документа. Перевірте, що завантажуєте правильний документ.',
      mrzMissing: 'Не видно нижню частину паспорта з MRZ. Перезніміть документ повністю або введіть дані вручну.',
      dobMissing: 'Дата народження не знайдена. Перевірте фото або введіть вручну.',
      poorImage: 'Документ погано читається. Зробіть фото чіткіше або введіть дані вручну.',
      identityConflict: '⚠️ В одному з ваших документів інші особисті дані. Паспорт — основний джерело. Перевірте та виправте, якщо потрібно.',
    },
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
      ai: 'AI розпізнавання',
      mrz: 'Паспорт · MRZ (висока точність)',
      visual: 'Паспорт · OCR',
      user: 'Введено вручну',
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
      dl: {
        ic: '🪪',
        lb: "Driver's License або State ID (необов'язково)",
        ht: 'Допоможе автоматично заповнити адресу в США',
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
    notFound: 'Не найдено — введите вручную',
    notInPassport: 'Нет в загранпаспорте — заполните на следующем шаге',
    reviewBadge: 'проверьте AI',
    warn: {
      slotMismatch: '⚠️ Этот файл не похож на выбранный тип документа. Проверьте, что загружаете правильный документ.',
      mrzMissing: 'Не видна нижняя часть паспорта с MRZ. Переснимите документ полностью или введите данные вручную.',
      dobMissing: 'Дата рождения не найдена. Проверьте фото или введите вручную.',
      poorImage: 'Документ плохо читается. Сделайте фото чётче или введите данные вручную.',
      identityConflict: '⚠️ В одном из ваших документов другие личные данные. Паспорт — основной источник. Проверьте и при необходимости исправьте.',
    },
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
      ai: 'AI распознавание',
      mrz: 'Паспорт · MRZ (высокая точность)',
      visual: 'Паспорт · OCR',
      user: 'Введено вручную',
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
      dl: {
        ic: '🪪',
        lb: "Driver's License или State ID (необязательно)",
        ht: 'Поможет автоматически заполнить адрес в США',
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
      'If your documents are not in English (passport, birth certificate) — they need an English translation with the translator\'s certification statement (per USCIS requirements).',
    s6TranslateLink: 'Order a translation on Messenginfo →',
    s6Disclaimer:
      'Messenginfo does not file on your behalf. We are not a law firm. We do not guarantee USCIS acceptance. Verify dates at ',
    back: '← Back',
    restart: '↺ Restart',
    edit: 'Edit',
    notSet: '—',
    notFound: 'Not found — enter manually',
    notInPassport: 'Not on international passport — fill in next step',
    reviewBadge: 'review AI',
    warn: {
      slotMismatch: '⚠️ This file does not look like the selected document type. Make sure you uploaded the correct document.',
      mrzMissing: 'The bottom MRZ zone of the passport is not visible. Retake the full document or enter data manually.',
      dobMissing: 'Date of birth not found. Check the photo or enter it manually.',
      poorImage: 'The document is hard to read. Retake a sharper photo or enter the data manually.',
      identityConflict: '⚠️ One of your documents has different personal data. The passport is the authoritative source. Please review and correct if needed.',
    },
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
      ai: 'AI recognition',
      mrz: 'Passport · MRZ (high confidence)',
      visual: 'Passport · OCR',
      user: 'Entered manually',
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
      dl: {
        ic: '🪪',
        lb: "Driver's License or State ID (optional)",
        ht: 'Auto-fills your US address',
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
    notFound: 'No encontrado — escriba a mano',
    notInPassport: 'No está en el pasaporte internacional — llene en el siguiente paso',
    reviewBadge: 'revise IA',
    warn: {
      slotMismatch: '⚠️ Este archivo no parece coincidir con el tipo de documento seleccionado. Verifique que cargó el documento correcto.',
      mrzMissing: 'No se ve la zona MRZ del pasaporte. Vuelva a tomar la foto del documento completo o ingrese los datos manualmente.',
      dobMissing: 'No se encontró la fecha de nacimiento. Verifique la foto o ingrésela manualmente.',
      poorImage: 'El documento es difícil de leer. Tome una foto más nítida o ingrese los datos manualmente.',
      identityConflict: '⚠️ Uno de sus documentos tiene datos personales diferentes. El pasaporte es la fuente autoritativa. Revise y corrija si es necesario.',
    },
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
      ai: 'Reconocimiento IA',
      mrz: 'Pasaporte · MRZ (alta confianza)',
      visual: 'Pasaporte · OCR',
      user: 'Llenado a mano',
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
      dl: {
        ic: '🪪',
        lb: "Licencia de conducir o State ID (opcional)",
        ht: 'Llena automáticamente la dirección en EE. UU.',
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

// ─── Design tokens ──────────────────────────────────────────────────────────
// Brand colors (GREEN / PAY_BLUE) stay literal — TPS-green is part of the brand
// and must look identical in light + dark. All neutral surface/text/border
// tokens reference the site CSS variables defined in globals.css, so the wizard
// follows the user's theme toggle without any extra wiring.
const GREEN = '#0d5a34'
const GREEN_DARK = '#08391f'
const PAY_BLUE = '#1a73e8'
const PAY_BLUE_DARK = '#1557b0'
// Alerts keep their distinctive light-mode tints — they're rare and brief, and
// dark-mode alert tones are a separate polish pass.
const WARN_BG = '#fff3cd'
const WARN_BORDER = '#ffc107'
const WARN_TEXT = '#856404'
const INFO_BG = '#e8f0fe'
const INFO_BORDER = '#a8c7fa'
const INFO_TEXT = '#1a4d8f'
// Neutrals — bound to global CSS vars so the wizard inherits theme switches.
const PAGE_BG = 'var(--background)'
const CARD_BG = 'var(--surface-1)'
const BORDER = 'var(--border)'
const BORDER_LIGHT = 'var(--surface-3)'
const TEXT_PRIMARY = 'var(--text-1)'
const TEXT_SECONDARY = 'var(--text-2)'
const TEXT_MUTED = 'var(--text-3)'
const TEXT_HINT = 'var(--text-3)'
const TEXT_FAINT = 'var(--text-3)'

// Storage schema version. Bump whenever the contract/shape of stored
// uploads or merged fields changes. The hydration code below DISCARDS
// any persisted state that doesn't match — so old hallucinated values
// (e.g. an A-number captured under the passport slot before the API
// firewall existed) can never resurface after a code update.
const STORAGE_SCHEMA = 3
const STORAGE_KEY = 'wizard:tps-ukraine:v3:state'

// Per-slot allowed-fields lookup so the wizard re-applies the same
// firewall the API now enforces — old localStorage from a v2-era
// session may still contain forbidden fields, this strips them on read.
const SLOT_ALLOWED_FIELDS: Record<string, ReadonlySet<string>> = {
  passport: new Set([
    'family_name', 'given_name', 'middle_name', 'dob', 'sex',
    'country_of_birth', 'country_of_nationality',
    'passport_number', 'passport_country_of_issuance', 'passport_expiration_date',
  ]),
  i94: new Set([
    'i94_admission_number', 'last_entry_date', 'i94_class_of_admission',
    'status_at_last_entry',
    'passport_number', 'passport_country_of_issuance',
    'family_name', 'given_name', 'dob',
  ]),
  ead: new Set([
    'a_number', 'ead_category_on_card', 'ead_expiration_date',
    'family_name', 'given_name', 'dob', 'sex',
  ]),
  ead_old: new Set([
    'a_number', 'ead_category_on_card', 'ead_expiration_date',
    'family_name', 'given_name', 'dob', 'sex',
  ]),
  tps_notice: new Set([
    'a_number', 'family_name', 'given_name', 'dob',
    'address', 'us_address_street', 'us_address_city', 'us_address_state', 'us_address_zip',
  ]),
  photo: new Set([]),
}
// TPS Stage I price displayed on the Pay button (single source of truth
// for the UI label; the actual Stripe Price ID is set server-side).
const TPS_TIER1_PRICE_DISPLAY = '$15'

/**
 * Identity fields where the passport upload (if present) is the
 * authoritative source. Other uploads may fill these IF passport is
 * missing, but may NOT overwrite a passport value silently. Defined
 * at module scope so the mergedFields useMemo dep list stays empty
 * (React exhaustive-deps stays clean).
 */
const IDENTITY_FIELDS_AUTHORITATIVE: ReadonlySet<string> = new Set([
  'family_name', 'given_name', 'middle_name', 'dob', 'sex',
  'passport_number', 'passport_expiration_date',
  'country_of_nationality', 'country_of_birth',
])

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable bits (kept inside this file so the wizard is self-contained)
// ─────────────────────────────────────────────────────────────────────────────

function Tip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  // Close on Escape and outside-click for keyboard / mouse users.
  // Touch users tap the chip to toggle.
  useEffect(() => {
    if (!open) return
    const onDoc = () => setOpen(false)
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // Defer document handler so the opening click doesn't immediately close.
    const id = window.setTimeout(() => document.addEventListener('click', onDoc), 0)
    document.addEventListener('keydown', onEsc)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('click', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])
  return (
    <span style={{ display: 'inline-block', position: 'relative', marginLeft: 4, verticalAlign: 'middle' }}>
      <button
        type="button"
        aria-label="Подсказка"
        aria-expanded={open}
        title={text}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        style={{
          display: 'inline-flex',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: open ? GREEN : '#ddd',
          color: open ? '#fff' : '#444',
          fontSize: 12,
          fontWeight: 800,
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: 'none',
          padding: 0,
          fontFamily: 'inherit',
        }}
      >
        ?
      </button>
      {open && (
        <span
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            zIndex: 20,
            top: 'calc(100% + 6px)',
            left: -8,
            width: 260,
            maxWidth: '70vw',
            background: '#222',
            color: '#fff',
            fontSize: 13,
            fontWeight: 400,
            lineHeight: 1.45,
            padding: '10px 12px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            display: 'block',
            whiteSpace: 'normal',
          }}
        >
          {text}
        </span>
      )}
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
              fontSize: 18,
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            {o.label}
            <small
              style={{
                display: 'block',
                fontSize: 14,
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
      <div style={{ fontSize: 40, marginBottom: 4 }}>{doc.ic}</div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: ok ? GREEN : err ? '#a33' : TEXT_PRIMARY,
        }}
      >
        {doc.lb} {ok && uploadedSuffix} {uploading && '⏳'}
      </div>
      <div style={{ fontSize: 14, color: TEXT_HINT, marginTop: 3 }}>
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
  reviewBadge,
  missing,
  onEdit,
  editLabel,
}: {
  label: string
  /** Human-readable provenance e.g. "Паспорт · MRZ (высокая точность)". */
  source: string
  /** Already-formatted value (may be empty when missing). */
  value: string
  /**
   * Localized text shown next to AI-extracted values that the validator
   * flagged as requires_review. Pass null/undefined to hide the badge.
   */
  reviewBadge?: string | null
  /**
   * If true, value is rendered as a localized "not found / fill in manually"
   * hint instead of a hard dash. Source row is suppressed.
   */
  missing?: boolean
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
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 15, color: TEXT_MUTED }}>{label}</div>
        {!missing && source && (
          <div style={{ fontSize: 13, color: TEXT_HINT }}>{source}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {missing ? (
          <div
            style={{
              fontSize: 14,
              fontStyle: 'italic',
              color: TEXT_MUTED,
              textAlign: 'right',
              maxWidth: 240,
            }}
          >
            {value}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, textAlign: 'right' }}>{value}</div>
            {reviewBadge && (
              <span
                style={{
                  marginLeft: 8,
                  padding: '2px 8px',
                  background: WARN_BG,
                  color: WARN_TEXT,
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 999,
                  border: `1px solid ${WARN_BORDER}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {reviewBadge}
              </span>
            )}
          </>
        )}
        <button
          type="button"
          onClick={onEdit}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 14,
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
      <div style={{ fontSize: 15, color: TEXT_MUTED }}>
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
          fontSize: 17,
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
      <div style={{ fontSize: 15, color: TEXT_MUTED }}>
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
                fontSize: 16,
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
      <div style={{ fontSize: 18, fontWeight: 800, color: GREEN, marginBottom: 10 }}>{title}</div>
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
    fontSize: 18,
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
  //
  // CRITICAL: the storage key is intentionally locale-independent
  // (`wizard:tps-ukraine:v2:state`). When the user switches RU ↔ UK ↔ EN ↔ ES
  // via the header LanguageSwitcher, Next.js does a full route segment
  // navigation under [locale]/..., which remounts this component with fresh
  // React state. The single shared key + this restore effect rebuild every
  // answer, every OCR-extracted field, and the current step on the new
  // render so the user sees zero progress loss.
  //
  // We also rebuild `uploads` from the persisted `uploadsMeta` slice. File
  // objects can't survive a navigation (the browser won't serialize them),
  // but the OCR fields, file name, and per-doc status are all we need to
  // re-render Step 5 / Step 4 chips correctly. Re-running OCR is not needed
  // because the extracted fields are already in memory.
  useEffect(() => {
    try {
      // Schema-version guard: ANY old-schema state is discarded outright.
      // This is the single most reliable way to evict pre-firewall
      // hallucinations (e.g. an A-number captured under the passport slot
      // before the contract existed). We also defensively wipe the v1/v2
      // keys so users who had those open don't keep seeing ghosts.
      try { localStorage.removeItem('wizard:tps-ukraine:v2:state') } catch { /* */ }
      try { localStorage.removeItem('wizard:tps-ukraine:state') } catch { /* */ }
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && parsed.schema === STORAGE_SCHEMA) {
          // Rebuild uploads map from uploadsMeta — without File objects,
          // but WITH the OCR fields so Step 5 keeps the recognized values
          // after a locale switch / theme switch / refresh.
          //
          // CRITICAL: re-apply the document-slot contract during hydration.
          // The /api/tps/ocr/extract route strips forbidden fields, but
          // localStorage written before that fix may still contain them.
          // Filtering on read guarantees the UI can never resurrect a
          // pre-firewall A-number from a passport slot.
          const rebuiltUploads: Record<string, UploadEntry> = {}
          const meta = (parsed.uploadsMeta || {}) as Record<
            string,
            {
              fileName: string
              status: UploadEntry['status']
              fields?: Record<string, FieldExtraction>
            } | undefined
          >
          for (const k of Object.keys(meta)) {
            const m = meta[k]
            if (!m) continue
            const allowed = SLOT_ALLOWED_FIELDS[k]
            const cleanFields: Record<string, FieldExtraction> = {}
            if (m.fields) {
              for (const fk of Object.keys(m.fields)) {
                const fx = m.fields[fk]
                if (!fx || typeof fx.value !== 'string') continue
                // Drop any field the slot contract doesn't allow.
                if (allowed && !allowed.has(fk)) continue
                cleanFields[fk] = fx
              }
            }
            rebuiltUploads[k] = {
              file: null,
              fileName: m.fileName,
              status: m.status,
              fields: cleanFields,
            }
          }
          const {
            uploadsMeta: _uploadsMeta,
            lastStep: _lastStep,
            schema: _schema,
            ...rest
          } = parsed
          setData((d) => ({ ...d, ...rest, uploads: rebuiltUploads }))
          if (typeof parsed.lastStep === 'number') setStep(parsed.lastStep)
        }
      }
    } catch {
      /* ignore — corrupt storage just gets ignored, never crashes the wizard */
    }
    // Stripe return-from-checkout: ?paid=1 means the user just completed
    // payment on Stripe and was redirected back via the success page.
    // Jump straight to Step 6 with paid=true so the download unlocks.
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      if (sp.get('paid') === '1') {
        setData((d) => ({ ...d, paid: true }))
        setStep(6)
      }
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
        JSON.stringify({
          schema: STORAGE_SCHEMA,
          ...rest,
          lastStep: step,
          uploadsMeta: uploadsSafe,
        }),
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
    // Driver's license / state ID — OPTIONAL slot offered in every flow.
    // Slot contract (documentContracts.ts 'dl') extracts US address parts
    // and biometric demographics; identity guard still treats passport
    // as authoritative on name/DOB conflicts, so a DL typo cannot
    // overwrite a passport value.
    list.push({ id: 'dl', ...t.doc.dl })
    return list
  }, [data.type, data.ead, data.method, t])

  // ── Merged OCR fields across all uploaded docs ───────────────────────────
  // We keep the full FieldExtraction trace per key (value + source + review
  // flag + doc slot). The review screen uses this to (a) show real
  // provenance per row instead of a hardcoded "Паспорт → OCR" label, and
  // (b) badge values the AI flagged as requires_review.
  // R1B-4 identity conflict guard.
  // Identity fields (family_name / given_name / dob / sex / passport_number)
  // are AUTHORITATIVE from the passport slot. If EAD or I-94 carry the same
  // field with a DIFFERENT value, we still keep the passport value but flag
  // requires_review so the wizard surfaces a conflict banner — the user
  // must confirm before the value reaches the PDF. Same key with the
  // SAME value across uploads is fine (no conflict).
  // Set lives at module scope (declared via IDENTITY_FIELDS_AUTHORITATIVE
  // near the top of this file) so React's exhaustive-deps lint stays
  // happy without a dep on a recreated Set per render.
  const mergedFields = useMemo(() => {
    const merged: Record<string, FieldExtraction> = {}
    const conflicts: Record<string, string[]> = {}
    // Pass 1 — passport authoritative for identity fields.
    const passport = data.uploads.passport
    if (passport?.fields) {
      for (const k of Object.keys(passport.fields)) {
        const fx = passport.fields[k]
        if (fx && fx.value) merged[k] = fx
      }
    }
    // Pass 2 — any other upload fills GAPS plus detects identity conflicts.
    for (const id of Object.keys(data.uploads)) {
      if (id === 'passport') continue
      const u = data.uploads[id]
      if (!u.fields) continue
      for (const k of Object.keys(u.fields)) {
        const fx = u.fields[k]
        if (!fx || !fx.value) continue
        if (!merged[k]) {
          merged[k] = fx
          continue
        }
        // Conflict: identity field with a different value than passport
        if (
          IDENTITY_FIELDS_AUTHORITATIVE.has(k) &&
          merged[k].value.toLowerCase().trim() !== fx.value.toLowerCase().trim()
        ) {
          (conflicts[k] ||= []).push(`${id}:${fx.value}`)
          merged[k] = { ...merged[k], requires_review: true }
        }
      }
    }
    // Expose conflicts via a side-channel for the UI banner.
    ;(merged as Record<string, FieldExtraction> & { __conflicts?: typeof conflicts }).__conflicts =
      Object.keys(conflicts).length > 0 ? conflicts : undefined
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
        // Backend contract:
        //   json.module.fields[] — TpsExtractedField shape, each with
        //     `field`, `raw_value`, `normalized_value`, `extraction_source`,
        //     `review_required`. We keep the full trace per field so the
        //     review screen can show real provenance (passport MRZ vs AI
        //     fallback) and badge low-confidence extractions for the user.
        const fields: Record<string, FieldExtraction> = {}
        const modFields = Array.isArray(json?.module?.fields) ? json.module.fields : []
        for (const f of modFields) {
          if (f && typeof f.field === 'string') {
            const v =
              typeof f.normalized_value === 'string' && f.normalized_value
                ? f.normalized_value
                : typeof f.raw_value === 'string'
                  ? f.raw_value
                  : ''
            if (!v) continue
            const src: ExtractionSource =
              f.extraction_source === 'ocr_mrz' ||
              f.extraction_source === 'ocr_visual' ||
              f.extraction_source === 'ocr_keyword' ||
              f.extraction_source === 'ai_brain' ||
              f.extraction_source === 'user_input' ||
              f.extraction_source === 'user_corrected' ||
              f.extraction_source === 'inferred'
                ? (f.extraction_source as ExtractionSource)
                : 'ocr_visual'
            fields[f.field] = {
              value: v,
              source: src,
              requires_review: Boolean(f.review_required),
              doc_slot: id,
            }
          }
        }
        // Backwards-compat: older shape `{ fields: [{ name, value }] }`.
        if (Object.keys(fields).length === 0 && Array.isArray(json?.fields)) {
          for (const f of json.fields) {
            if (f && typeof f.name === 'string' && typeof f.value === 'string') {
              fields[f.name] = {
                value: f.value,
                source: 'ocr_visual',
                requires_review: false,
                doc_slot: id,
              }
            }
          }
        }
        // Capture firewall diagnostics so Step 5 can surface a wrong-slot
        // warning banner without re-querying anything.
        const slotMismatch = Boolean(json?.slot_mismatch)
        const detectedDocType = json?.detected_document_type ?? null
        const visionLen = typeof json?.vision_text_length === 'number'
          ? json.vision_text_length : undefined
        const brainStatus = typeof json?.brain_status === 'string'
          ? (json.brain_status as 'off' | 'skipped' | 'ran' | 'error')
          : undefined
        const rejectedKeys: string[] = Array.isArray(json?.rejected_fields)
          ? json.rejected_fields
              .map((r: { field?: unknown }) => r?.field)
              .filter((k: unknown): k is string => typeof k === 'string')
          : []
        setData((d) => ({
          ...d,
          uploads: {
            ...d.uploads,
            [id]: {
              file,
              fileName: file.name,
              status: 'done',
              fields,
              detected_document_type: detectedDocType,
              slot_mismatch: slotMismatch,
              vision_text_length: visionLen,
              brain_status: brainStatus,
              rejected_field_keys: rejectedKeys,
            },
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
      // Pull the value out of FieldExtraction; alias keeps the rest of this
      // builder readable (no .value sprinkled everywhere).
      const v = (k: string): string => mergedFields[k]?.value || ''
      // A-number reaches the PDF as digits only. Display can keep dashes;
      // packetBuilder will fail-soft on an invalid shape.
      const aNumberDigits = v('a_number').replace(/\D/g, '')
      const answers: Partial<TPSAnswers> = {
        family_name: v('family_name') || v('surname'),
        given_name: v('given_name') || v('first_name'),
        middle_name: v('middle_name') || v('patronymic'),
        dob: v('dob') || v('date_of_birth'),
        sex: (v('sex') === 'F' ? 'F' : 'M') as TPSAnswers['sex'],
        country_of_birth: v('country_of_birth') || 'Ukraine',
        country_of_nationality: v('country_of_nationality') || 'Ukraine',
        passport_number: v('passport_number'),
        passport_country_of_issuance: v('passport_country_of_issuance') || 'Ukraine',
        passport_expiration_date: v('passport_expiration_date'),
        a_number: aNumberDigits,
        i94_admission_number: v('i94_admission_number'),
        last_entry_date: v('last_entry_date'),
        status_at_last_entry: v('status_at_last_entry'),
        filing_path,
        wants_ead: ead,
        ead_category: ead ? (data.type === 'init' ? 'a12' : 'c19') : null,
        // 2026-05-20: fall back to OCR'd address parts when the user
        // didn't manually override. DL slot extracts us_address_*
        // into mergedFields; without these fallbacks, the I-131 Part 3
        // city/state/zip stayed empty on the PDF even when the DL was
        // uploaded.
        us_address_street: data.manual.us_address_street || v('us_address_street') || v('address'),
        us_address_city: data.manual.us_address_city || v('us_address_city') || '',
        us_address_state: data.manual.us_address_state || v('us_address_state') || '',
        us_address_zip: data.manual.us_address_zip || v('us_address_zip') || '',
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
  }, [data, mergedFields, t.packetErr])

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
        fontSize: 17,
        lineHeight: 1.6,
        minHeight: '100vh',
        fontFamily:
          '-apple-system,"Segoe UI",Roboto,Inter,sans-serif',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            textAlign: 'center',
            color: GREEN,
            marginBottom: 2,
          }}
        >
          {t.h1}
        </h1>
        <p
          style={{ textAlign: 'center', fontSize: 15, color: TEXT_SECONDARY, marginBottom: 20 }}
        >
          {t.sub}
        </p>

        {/* Progress bar + persistent restart link.
            The restart link lives above the progress bar so the user can
            wipe stale OCR / personal data from any step — critical when
            the firewall logic has evolved between sessions. */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <button
            type="button"
            onClick={() => {
              const ok = typeof window === 'undefined'
                ? true
                : window.confirm(t.restart + '?')
              if (ok) restart()
            }}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 13,
              color: TEXT_MUTED,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            {t.restart}
          </button>
        </div>
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
            <div style={{ fontSize: 14, color: TEXT_FAINT, marginBottom: 4 }}>{t.stepOf(1)}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 3 }}>{t.s1q}</div>
            <div style={{ fontSize: 15, color: TEXT_MUTED, marginBottom: 16 }}>{t.s1h}</div>
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
            <div style={{ fontSize: 14, color: TEXT_FAINT, marginBottom: 4 }}>{t.stepOf(2)}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 3 }}>{t.s2q}</div>
            <div style={{ fontSize: 15, color: TEXT_MUTED, marginBottom: 16 }}>{t.s2h}</div>
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
                  fontSize: 15,
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
            <div style={{ fontSize: 14, color: TEXT_FAINT, marginBottom: 4 }}>{t.stepOf(3)}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 3 }}>{t.s3q}</div>
            <div style={{ fontSize: 15, color: TEXT_MUTED, marginBottom: 16 }}>{t.s3h}</div>
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
            <div style={{ fontSize: 14, color: TEXT_FAINT, marginBottom: 4 }}>{t.stepOf(4)}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 3 }}>{t.s4q}</div>
            <div style={{ fontSize: 15, color: TEXT_MUTED, marginBottom: 16 }}>{t.s4h}</div>

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
            <div style={{ fontSize: 14, color: TEXT_FAINT, marginBottom: 4 }}>{t.stepOf(5)}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 3 }}>{t.s5q}</div>
            <div style={{ fontSize: 15, color: TEXT_MUTED, marginBottom: 16 }}>{t.s5h}</div>

            {/* R1A Phase 4: per-upload warning banners. Shown when the
                firewall detected the file doesn't match the slot, when a
                passport upload has no MRZ, when DOB is missing despite
                visible text, or when OCR text was suspiciously short.
                These banners do NOT block the user — they just make the
                cause of any missing/stripped field obvious to the
                30-80yo user, instead of silently dropping data. */}
            {(() => {
              const banners: React.ReactNode[] = []
              for (const slotId of Object.keys(data.uploads)) {
                const u = data.uploads[slotId]
                if (u.status !== 'done') continue
                if (u.slot_mismatch) {
                  banners.push(
                    <div key={`m-${slotId}`} style={{ background: WARN_BG, border: `1.5px solid ${WARN_BORDER}`, borderRadius: 12, padding: 12, fontSize: 14, color: WARN_TEXT, marginBottom: 12 }}>
                      {t.warn.slotMismatch} {u.fileName ? `(${u.fileName})` : ''}
                      {u.detected_document_type ? ` — detected: ${u.detected_document_type}` : ''}
                    </div>,
                  )
                }
                if (slotId === 'passport') {
                  const fieldsObj = u.fields || {}
                  const list = Object.values(fieldsObj)
                  const hasMrz = list.some((f) => f.source === 'ocr_mrz')
                  if (!hasMrz && list.length > 0) {
                    banners.push(
                      <div key={`x-${slotId}`} style={{ background: INFO_BG, border: `1.5px solid ${INFO_BORDER}`, borderRadius: 12, padding: 12, fontSize: 14, color: INFO_TEXT, marginBottom: 12 }}>
                        {t.warn.mrzMissing}
                      </div>,
                    )
                  }
                  if (!fieldsObj.dob && (u.vision_text_length ?? 0) > 50) {
                    banners.push(
                      <div key={`d-${slotId}`} style={{ background: WARN_BG, border: `1.5px solid ${WARN_BORDER}`, borderRadius: 12, padding: 12, fontSize: 14, color: WARN_TEXT, marginBottom: 12 }}>
                        {t.warn.dobMissing}
                      </div>,
                    )
                  }
                }
                if ((u.vision_text_length ?? 0) < 30) {
                  banners.push(
                    <div key={`p-${slotId}`} style={{ background: INFO_BG, border: `1.5px solid ${INFO_BORDER}`, borderRadius: 12, padding: 12, fontSize: 14, color: INFO_TEXT, marginBottom: 12 }}>
                      {t.warn.poorImage} {u.fileName ? `(${u.fileName})` : ''}
                    </div>,
                  )
                }
              }
              // R1B-4: identity conflict banner — EAD/I-94 disagreed
              // with passport on a critical identity field. Passport
              // wins (already merged), but the user sees a banner so
              // they can confirm before generating the PDF.
              const conflicts = (mergedFields as Record<string, FieldExtraction> & {
                __conflicts?: Record<string, string[]>
              }).__conflicts
              if (conflicts && Object.keys(conflicts).length > 0) {
                banners.push(
                  <div key="conflict" style={{ background: WARN_BG, border: `1.5px solid ${WARN_BORDER}`, borderRadius: 12, padding: 12, fontSize: 14, color: WARN_TEXT, marginBottom: 12 }}>
                    {t.warn.identityConflict}
                    <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                      {Object.keys(conflicts).join(', ')}
                    </div>
                  </div>,
                )
              }
              return banners
            })()}

            <Card title={t.s5OcrTitle}>
              <ReviewOcr
                t={t}
                type={data.type}
                ead={data.ead}
                mergedFields={mergedFields}
                onEdit={(key, label, current) => {
                  // Real inline edit. We deliberately use the browser
                  // native prompt() here as Round 3 — it's universally
                  // accessible (screen readers, 35-80yo touch users on
                  // older OSes) and ships without a modal dependency.
                  // The richer in-page editor is a P1 follow-up; this
                  // unblocks correction TODAY.
                  if (typeof window === 'undefined') return
                  const next = window.prompt(label, current)
                  if (next === null) return // user cancelled
                  const trimmed = next.trim()
                  if (trimmed === current.trim()) return
                  // Write the corrected value back into the FIRST upload
                  // that carried this field. Mark provenance as
                  // 'user_corrected' so the source label updates to
                  // "Введено вручную" / "Entered manually".
                  setData((d) => {
                    const next = { ...d, uploads: { ...d.uploads } }
                    let written = false
                    for (const slotId of Object.keys(next.uploads)) {
                      const u = next.uploads[slotId]
                      if (!u.fields || !u.fields[key]) continue
                      next.uploads[slotId] = {
                        ...u,
                        fields: {
                          ...u.fields,
                          [key]: {
                            value: trimmed,
                            source: 'user_corrected',
                            requires_review: false,
                            doc_slot: slotId,
                          },
                        },
                      }
                      written = true
                      break
                    }
                    // If no upload carried this field yet (user is filling
                    // in a missing value), park it under a synthetic
                    // 'manual' slot so it still flows into Step 6 merge.
                    if (!written) {
                      const slotId = 'manual'
                      const existing = next.uploads[slotId]
                      next.uploads[slotId] = {
                        file: null,
                        fileName: 'manual',
                        status: 'done',
                        fields: {
                          ...(existing?.fields ?? {}),
                          [key]: {
                            value: trimmed,
                            source: 'user_input',
                            requires_review: false,
                            doc_slot: slotId,
                          },
                        },
                      }
                    }
                    return next
                  })
                }}
              />
            </Card>

            <Card title={t.s5ManualTitle}>
              <ReviewManual
                t={t}
                type={data.type}
                ead={data.ead}
                manual={data.manual}
                mergedFields={mergedFields}
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
            <div style={{ fontSize: 14, color: TEXT_FAINT, marginBottom: 4 }}>{t.stepOf(6)}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>{t.s6q}</div>

            <Card title={t.s6PkgTitle}>
              <PackageList t={t} type={data.type} ead={data.ead} method={data.method} />
            </Card>

            {!data.paid && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  setErrMsg(null)
                  try {
                    // Reuse the locally-stored wizard id if any, else mint one.
                    let wizardId: string | null = null
                    try {
                      wizardId = localStorage.getItem('wizard:tps-ukraine:v2:id')
                      if (!wizardId) {
                        wizardId = `tps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                        localStorage.setItem('wizard:tps-ukraine:v2:id', wizardId)
                      }
                    } catch {
                      /* ignore */
                    }
                    const r = await fetch('/api/stripe/checkout', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        product: 'tps-ukraine',
                        locale,
                        session_id: wizardId,
                      }),
                    })
                    if (!r.ok) {
                      const j = await r.json().catch(() => ({}))
                      throw new Error(j?.error || `HTTP ${r.status}`)
                    }
                    const { url } = await r.json()
                    if (url) {
                      window.location.href = url
                    } else {
                      throw new Error('No checkout URL in response')
                    }
                  } catch (e) {
                    setErrMsg(e instanceof Error ? e.message : String(e))
                    setBusy(false)
                  }
                }}
                style={{
                  background: PAY_BLUE,
                  color: '#fff',
                  fontSize: 20,
                  padding: 18,
                  borderRadius: 14,
                  border: 'none',
                  width: '100%',
                  cursor: busy ? 'wait' : 'pointer',
                  fontWeight: 800,
                  marginBottom: 10,
                  fontFamily: 'inherit',
                  opacity: busy ? 0.7 : 1,
                }}
                onMouseOver={(e) => !busy && (e.currentTarget.style.background = PAY_BLUE_DARK)}
                onMouseOut={(e) => !busy && (e.currentTarget.style.background = PAY_BLUE)}
              >
                {busy ? '…' : `${t.s6Pay} — ${TPS_TIER1_PRICE_DISPLAY}`}
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
                  fontSize: 20,
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
                  fontSize: 15,
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
                fontSize: 14,
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
            fontSize: 13,
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
          fontSize: 15,
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
            fontSize: 15,
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
  mergedFields,
  onEdit,
}: {
  t: (typeof T)[LocaleKey]
  type?: FilingType
  ead?: EadChoice
  mergedFields: Record<string, FieldExtraction>
  /**
   * Called when the user clicks "Изменить" on a row. The parent owns the
   * uploads state, so it does the actual update — we just route the
   * intent up. Receives the field key, the localized label (for the
   * prompt), and the current value (to prefill).
   */
  onEdit: (key: string, label: string, currentValue: string) => void
}) {
  const init = type === 'init'
  const wantsEad = ead === 'ead'

  // Per-row expected document slot for the "Not found" hint. We use this
  // when the field hasn't been extracted, so the missing-value message
  // can be specific ("Not on international passport — fill in next step"
  // for patronymic vs the generic "Not found — enter manually" for others).
  type RowSpec = {
    key: string
    label: string
    /** Document this field is expected to come from. */
    expectedDoc: 'passport' | 'i94' | 'ead' | 'i797' | 'i797_or_ead'
    /**
     * If true, an empty value on an international passport is normal
     * (not an OCR failure) and we explain that to the user instead of
     * implying recognition broke.
     */
    notOnIntlPassportIfEmpty?: boolean
  }
  const rows: RowSpec[] = [
    { key: 'family_name', label: t.label.surname, expectedDoc: 'passport' },
    { key: 'given_name', label: t.label.given, expectedDoc: 'passport' },
    { key: 'middle_name', label: t.label.patronymic, expectedDoc: 'passport', notOnIntlPassportIfEmpty: true },
    { key: 'dob', label: t.label.dob, expectedDoc: 'passport' },
    { key: 'sex', label: t.label.sex, expectedDoc: 'passport' },
    { key: 'passport_number', label: t.label.passport_number, expectedDoc: 'passport' },
    { key: 'country_of_nationality', label: t.label.country_of_nationality, expectedDoc: 'passport' },
  ]
  if (init) {
    rows.push(
      { key: 'i94_admission_number', label: t.label.i94_admission_number, expectedDoc: 'i94' },
      { key: 'last_entry_date', label: t.label.last_entry_date, expectedDoc: 'i94' },
      { key: 'status_at_last_entry', label: t.label.status_at_last_entry, expectedDoc: 'i94' },
    )
  }
  if (!init && wantsEad) {
    rows.push(
      { key: 'a_number', label: t.label.a_number, expectedDoc: 'ead' },
      { key: 'address', label: t.label.address, expectedDoc: 'i797_or_ead' },
    )
  }
  if (!init && !wantsEad) {
    rows.push({ key: 'address', label: t.label.address, expectedDoc: 'i797' })
  }

  // Map an ExtractionSource to a human-readable provenance string. This is
  // what makes the "Паспорт → OCR" hardcoded label HONEST — when the AI
  // brain filled a gap, the row now says "AI распознавание" so the user
  // knows to double-check that value.
  const provenanceLabel = (source: ExtractionSource, fallbackDoc: RowSpec['expectedDoc']): string => {
    if (source === 'ai_brain') return t.source.ai
    if (source === 'ocr_mrz') return t.source.mrz
    if (source === 'ocr_visual' || source === 'ocr_keyword') {
      // Honor the actual doc slot when we have one — e.g. an A-number that
      // came from EAD via keyword anchor should say "EAD → OCR", not
      // generic "Passport · OCR".
      if (fallbackDoc === 'passport') return t.source.visual
      if (fallbackDoc === 'i94') return t.source.i94
      if (fallbackDoc === 'ead') return t.source.ead
      if (fallbackDoc === 'i797') return t.source.i797
      return t.source.i797_or_ead
    }
    if (source === 'user_input' || source === 'user_corrected') return t.source.user
    return t.source.visual
  }

  return (
    <>
      {rows.map((r) => {
        const fx = mergedFields[r.key]
        if (fx && fx.value) {
          return (
            <RW
              key={r.key}
              label={r.label}
              source={provenanceLabel(fx.source, r.expectedDoc)}
              value={fx.value}
              reviewBadge={fx.requires_review || fx.source === 'ai_brain' ? t.reviewBadge : null}
              onEdit={() => onEdit(r.key, r.label, fx?.value ?? '')}
              editLabel={t.edit}
            />
          )
        }
        // No value extracted. Explain why instead of a silent dash.
        const missingMsg = r.notOnIntlPassportIfEmpty ? t.notInPassport : t.notFound
        return (
          <RW
            key={r.key}
            label={r.label}
            source=""
            value={missingMsg}
            missing
            onEdit={() => onEdit(r.key, r.label, '')}
            editLabel={t.edit}
          />
        )
      })}
    </>
  )
}

function ReviewManual({
  t,
  type,
  ead,
  manual,
  mergedFields,
  onChange,
}: {
  t: (typeof T)[LocaleKey]
  type?: FilingType
  ead?: EadChoice
  manual: WizardData['manual']
  mergedFields?: Record<string, FieldExtraction>
  onChange: (patch: Partial<WizardData['manual']>) => void
}) {
  const init = type === 'init'
  const wantsEad = ead === 'ead'
  // 2026-05-20: when DL OCR populated us_address_* parts, reconstruct the
  // single-line postal address for the "Адрес в США" field so the user
  // sees the auto-filled value instead of an empty placeholder. The user
  // can still edit; on edit the value goes into manual.us_address_street
  // (the rest stays in mergedFields and the submit path falls back to
  // mergedFields for city/state/zip — see GeneratePacketBlock submit).
  const ocrAddrStreet = mergedFields?.us_address_street?.value ?? ''
  const ocrAddrCity = mergedFields?.us_address_city?.value ?? ''
  const ocrAddrState = mergedFields?.us_address_state?.value ?? ''
  const ocrAddrZip = mergedFields?.us_address_zip?.value ?? ''
  // USPS canonical format: "Street, City, ST ZIP" — comma between
  // street and city, comma between city and state, but plain space
  // between state and zip (USPS does NOT comma there). E.g.
  //   "4341 Willow Brook Ave 111, Los Angeles, CA 90029"
  const cityStateZip = ocrAddrCity && ocrAddrState
    ? `${ocrAddrCity}, ${ocrAddrState}${ocrAddrZip ? ` ${ocrAddrZip}` : ''}`
    : [ocrAddrCity, ocrAddrState, ocrAddrZip].filter(Boolean).join(' ')
  const ocrAddrJoined = [ocrAddrStreet, cityStateZip]
    .filter(Boolean)
    .join(', ')
    .trim()
  return (
    <>
      {init && (
        <FieldInput
          label={t.label.address}
          placeholder={t.placeholder.address}
          tip={t.tip.address}
          value={manual.us_address_street || ocrAddrJoined || ''}
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
            <div style={{ fontSize: 15, color: TEXT_MUTED }}>
              {t.label.ead_category}{' '}
              <Tip text={init ? t.tip.eadInit : t.tip.eadRereg} />
            </div>
            <div style={{ fontSize: 13, color: '#bbb' }}>{t.tip.eadAuto}</div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{init ? 'C19' : 'A12'}</div>
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
            fontSize: 17,
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 0,
              color: GREEN,
              fontWeight: 800,
              fontSize: 18,
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
      <div style={{ fontSize: 18, fontWeight: 800, color: GREEN, marginBottom: 10 }}>
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
                fontSize: 17,
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
            fontSize: 15,
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
