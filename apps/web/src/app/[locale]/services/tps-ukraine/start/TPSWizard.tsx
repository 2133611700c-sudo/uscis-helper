'use client'

/**
 * TPSWizard — client component for /[locale]/services/tps-ukraine/start
 *
 * 5-screen guided wizard for TPS Ukraine packet preparation.
 * Does NOT reuse Re-Parole's WizardProvider/Controller (those are
 * Re-Parole-specific). This wizard is self-contained, persists answers
 * in localStorage under key 'wizard:tps-ukraine:state:v1', and never
 * touches the wizard_sessions DB table in this cycle (no Supabase calls).
 *
 * Screens:
 *   S1 SituationRouter      — initial / re_registration / unknown
 *   S2 IdentityArrival      — passport + I-94 + date entered US
 *   S3 EadFeeWaiver         — wants EAD? wants fee waiver? → online vs paper
 *   S4 EvidenceCollection   — CR/CPP checklists
 *   S5 SummaryTransferGuide — answers + USCIS transfer guide + checklist + links
 *
 * Rules:
 *   - No "we file" / "we submit" / "guaranteed" / "USCIS accepted".
 *   - Plain language. Big readable text. One main CTA per screen.
 *   - Mobile-first inline styles using existing CSS variables.
 *   - All TPS Ukraine facts verified 2026-05-10 against USCIS + Federal
 *     Register notice 2025-00771.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import GeneratePacketBlock from './GeneratePacketBlock'
import { DocumentUploadScreen } from '@/components/tps/DocumentUploadScreen'
import { SelfReviewScreen, type ReviewRow } from '@/components/tps/SelfReviewScreen'
import { OcrFieldEditModal, inputTypeForField } from '@/components/tps/OcrFieldEditModal'
import type { TpsExtractedField } from '@/lib/tps/types'
import { toWinAnsiSafe, hasCyrillic } from '@/lib/tps/transliterate'

type Locale = 'uk' | 'ru' | 'en' | 'es'

type FilingPath = 'initial' | 're_registration' | 'unknown' | 'unselected'
// undefined = user hasn't answered yet (no card highlighted)
// null      = user explicitly clicked "Не уверен"
// boolean   = explicit yes / no
type TriState = boolean | null | undefined

interface TPSAnswers {
  filing_path: FilingPath
  has_prior_tps: TriState
  has_passport: TriState
  has_i94: TriState
  date_entered_us: string
  wants_ead: TriState
  has_ead: TriState
  ead_expiration_date: string
  wants_fee_waiver: TriState
  filing_method: 'online' | 'paper' | 'unknown'
  cr_evidence: string[]
  cpp_evidence: string[]
  needs_attorney: boolean
  has_criminal_concern: TriState
}

const DEFAULTS: TPSAnswers = {
  filing_path: 'unselected',
  has_prior_tps: undefined,
  has_passport: undefined,
  has_i94: undefined,
  date_entered_us: '',
  wants_ead: undefined,
  has_ead: undefined,
  ead_expiration_date: '',
  wants_fee_waiver: undefined,
  filing_method: 'unknown',
  cr_evidence: [],
  cpp_evidence: [],
  needs_attorney: false,
  has_criminal_concern: undefined,
}

const STORAGE_KEY = 'wizard:tps-ukraine:state:v1'

// ── i18n ────────────────────────────────────────────────────────────────────

const T = {
  uk: {
    back: '← Назад',
    next: 'Далі →',
    finish: 'Готово',
    progress: (n: number, total: number) => `Крок ${n} з ${total}`,
    yes: 'Так', no: 'Ні', unsure: 'Не впевнений',

    s1Title: '1. Ви подаєте вперше чи продовжуєте?',
    s1Body: 'Якщо ви ніколи раніше не подавали TPS — оберіть «вперше». Якщо ви вже мали TPS і подаєте знову, щоб продовжити його — оберіть «продовжую».',
    s1Initial: 'Подаю вперше',
    s1Reg: 'Продовжую (вже мав TPS раніше)',
    s1Unknown: 'Не впевнений',
    s1Hint: 'Це найважливіший вибір — від нього залежать наступні кроки та форми.',
    s1OcrCta: '📷 У мене є фото документів — завантажити',
    s1OcrHint: 'Ми прочитаємо паспорт / I-94 / EAD і автоматично підставимо дані у форму.',
    s1ResumeNote: 'Ви продовжуєте попередню сесію.',
    s1RestartCta: '↺ Почати спочатку',
    ocrDone: 'Готово! Прочитано полів: {n}. Ми підставимо їх у форму на останньому кроці.',

    s2Title: '2. Документи та дата прибуття',
    s2Passport: 'У вас є дійсний паспорт?',
    s2I94: 'У вас є запис I-94 (підтвердження в\'їзду в США)?',
    s2I94Hint: 'I-94 — це електронний запис вашого в\'їзду в США, який створює прикордонна служба CBP. Перевірити та завантажити можна на сайті:',
    s2Date: 'Дата вашого останнього в\'їзду в США',
    s2DatePlaceholder: '',
    s2DateHint: 'Потрібно для перевірки безперервного проживання в США (з 16 серпня 2023 року) та безперервної фізичної присутності (з 20 жовтня 2023 року).',

    s3Title: '3. Дозвіл на роботу та зменшення оплати',
    s3Ead: 'Вам потрібен дозвіл на роботу в США?',
    s3EadHint: 'Дозвіл на роботу — це окрема картка від USCIS (форма I-765, категорія EAD). Можна подати разом з основною заявою або пізніше.',
    s3HasEad: 'У вас вже є картка EAD (дозвіл на роботу) за TPS?',
    s3EadExpiry: 'Дата на вашій картці EAD (поле «Card Expires»)',
    s3EadAutoNote: 'Деякі картки EAD з датами 19.04.2025 або 19.10.2023 автоматично продовжені до 19.04.2026. Точно перевіряйте на сторінці USCIS.',
    s3FeeWaiver: 'Бажаєте подати заяву на звільнення від державного збору USCIS?',
    s3FeeWaiverHint: 'Це заява про відсутність коштів на оплату державного збору (форма USCIS I-912). Подається ТІЛЬКИ на папері — не онлайн.',
    s3Result: 'Як подавати документи:',
    s3Paper: 'Паперова подача (бо ви просите звільнення від оплати)',
    s3Online: 'Онлайн на сайті my.uscis.gov',
    s3UnknownMethod: 'Залежить від ваших відповідей',

    s4Title: '4. Документи для підтвердження проживання',
    s4Body: 'Поставте позначку біля кожної категорії документів, які у вас є. Чим більше доказів — тим краще.',
    s4CrTitle: 'Підтвердження проживання в США (з 16.08.2023):',
    s4CppTitle: 'Підтвердження фізичної присутності в США (з 20.10.2023):',
    s4CrItems: [
      { id: 'rent', label: 'Договір оренди житла / квитанції про оплату' },
      { id: 'utility', label: 'Рахунки за комунальні послуги (світло, газ, вода)' },
      { id: 'bank', label: 'Банківські виписки' },
      { id: 'medical', label: 'Медичні документи (візити до лікаря в США)' },
      { id: 'school', label: 'Шкільні записи дітей' },
      { id: 'employer', label: 'Лист від роботодавця в США' },
      { id: 'tax', label: 'Податкові декларації (federal tax returns)' },
    ],
    s4CppItems: [
      { id: 'travel', label: 'Запис I-94 без виїздів з 20.10.2023' },
      { id: 'leases', label: 'Безперервні договори оренди' },
      { id: 'cards', label: 'Виписки з кредитних карток із покупками в США' },
      { id: 'paystubs', label: 'Розрахункові листи (paystubs) із зарплати' },
    ],

    s5Title: '5. Підсумок — що готувати',
    s5Body: 'Ось ваш пакет TPS Ukraine. Подача — завжди ваша через USCIS.',
    s5Path: 'Шлях подачі',
    s5Forms: 'Які форми',
    s5FilingMethod: 'Спосіб подачі',
    s5Evidence: 'Чек-лист доказів',
    s5Transfer: 'Куди вписати у формах USCIS',
    s5Disclaimer: 'Messenginfo не подає документи за вас. Ми не юридична фірма. Не гарантуємо ухвалення USCIS. Перевіряйте офіційні дати на сторінці USCIS TPS Ukraine.',
    s5Restart: '← Почати спочатку',
    s5Sources: 'Усі офіційні посилання →',
    s5Print: '🖨 Роздрукувати підсумок',
    s5AttorneyWarn: '⚠ Через ваші відповіді (кримінальні питання чи невпевненість) ми рекомендуємо звернутися до ліцензованого імміграційного адвоката перед подачею.',
    s5AttorneyLink: 'Знайти legal services через USCIS →',

    s6Title: '6. Готова форма для USCIS (чернетка)',
    s6Body: 'Це останній крок. Ви введете дані, ми згенеруємо PDF із вашими відповідями вже в клітинках. Ви роздрукуєте, підпишете і надішлете до USCIS самостійно.',
  },
  ru: {
    back: '← Назад',
    next: 'Дальше →',
    finish: 'Готово',
    progress: (n: number, total: number) => `Шаг ${n} из ${total}`,
    yes: 'Да', no: 'Нет', unsure: 'Не уверен',

    s1Title: '1. Вы подаёте впервые или продлеваете?',
    s1Body: 'Если вы никогда раньше не подавали TPS — выберите «впервые». Если у вас уже был TPS и вы хотите его продлить — выберите «продлеваю».',
    s1Initial: 'Подаю впервые',
    s1Reg: 'Продлеваю (TPS у меня уже был)',
    s1Unknown: 'Не уверен',
    s1Hint: 'Это самый главный выбор — от него зависят все следующие шаги и формы.',
    s1OcrCta: '📷 У меня есть фото документов — загрузить',
    s1OcrHint: 'Мы прочитаем паспорт / I-94 / EAD и автоматически подставим данные в форму.',
    s1ResumeNote: 'Вы продолжаете предыдущую сессию.',
    s1RestartCta: '↺ Начать заново',
    ocrDone: 'Готово! Прочитано полей: {n}. Подставим их в форму на последнем шаге.',

    s2Title: '2. Документы и дата прибытия',
    s2Passport: 'У вас есть действующий паспорт?',
    s2I94: 'У вас есть запись I-94 (подтверждение въезда в США)?',
    s2I94Hint: 'I-94 — это электронная запись о вашем въезде в США, которую создаёт пограничная служба CBP. Проверить и скачать можно на сайте:',
    s2Date: 'Дата вашего последнего въезда в США',
    s2DatePlaceholder: '',
    s2DateHint: 'Нужна для проверки непрерывного проживания в США (с 16 августа 2023 года) и непрерывного физического присутствия (с 20 октября 2023 года).',

    s3Title: '3. Разрешение на работу и снижение оплаты',
    s3Ead: 'Вам нужно разрешение на работу в США?',
    s3EadHint: 'Разрешение на работу — это отдельная карточка от USCIS (форма I-765, категория EAD). Можно подать вместе с основной заявой или позже.',
    s3HasEad: 'У вас уже есть карточка EAD (разрешение на работу) по TPS?',
    s3EadExpiry: 'Дата на вашей карточке EAD (поле «Card Expires»)',
    s3EadAutoNote: 'Некоторые карточки EAD с датами 19.04.2025 или 19.10.2023 автоматически продлены до 19.04.2026. Точно проверяйте на странице USCIS.',
    s3FeeWaiver: 'Хотите подать заявку на освобождение от государственной пошлины USCIS?',
    s3FeeWaiverHint: 'Это заявление о невозможности оплатить государственную пошлину (форма USCIS I-912). Подаётся ТОЛЬКО на бумаге — не онлайн.',
    s3Result: 'Как подавать документы:',
    s3Paper: 'Бумажная подача (так как вы просите освобождение от оплаты)',
    s3Online: 'Онлайн на сайте my.uscis.gov',
    s3UnknownMethod: 'Зависит от ваших ответов',

    s4Title: '4. Документы для подтверждения проживания',
    s4Body: 'Отметьте каждую категорию документов, которые у вас есть. Чем больше доказательств — тем лучше.',
    s4CrTitle: 'Подтверждение проживания в США (с 16.08.2023):',
    s4CppTitle: 'Подтверждение физического присутствия в США (с 20.10.2023):',
    s4CrItems: [
      { id: 'rent', label: 'Договор аренды жилья / квитанции об оплате' },
      { id: 'utility', label: 'Счета за коммунальные услуги (свет, газ, вода)' },
      { id: 'bank', label: 'Банковские выписки' },
      { id: 'medical', label: 'Медицинские документы (визиты к врачу в США)' },
      { id: 'school', label: 'Школьные записи детей' },
      { id: 'employer', label: 'Письмо от работодателя в США' },
      { id: 'tax', label: 'Налоговые декларации (federal tax returns)' },
    ],
    s4CppItems: [
      { id: 'travel', label: 'Запись I-94 без выездов с 20.10.2023' },
      { id: 'leases', label: 'Непрерывные договоры аренды' },
      { id: 'cards', label: 'Выписки кредитных карт с покупками в США' },
      { id: 'paystubs', label: 'Расчётные листы (paystubs) с зарплаты' },
    ],

    s5Title: '5. Итог — что готовить',
    s5Body: 'Вот ваш пакет TPS Ukraine. Подача — всегда ваша через USCIS.',
    s5Path: 'Путь подачи',
    s5Forms: 'Какие формы',
    s5FilingMethod: 'Способ подачи',
    s5Evidence: 'Чек-лист доказательств',
    s5Transfer: 'Куда вписывать в формах USCIS',
    s5Disclaimer: 'Messenginfo не подаёт документы за вас. Мы не юридическая фирма. Не гарантируем принятие USCIS. Проверяйте официальные даты на странице USCIS TPS Ukraine.',
    s5Restart: '← Начать заново',
    s5Sources: 'Все официальные ссылки →',
    s5Print: '🖨 Распечатать итог',
    s5AttorneyWarn: '⚠ Из-за ваших ответов (уголовные вопросы или неуверенность) мы рекомендуем обратиться к лицензированному иммиграционному адвокату перед подачей.',
    s5AttorneyLink: 'Найти legal services через USCIS →',

    s6Title: '6. Готовая форма для USCIS (черновик)',
    s6Body: 'Это последний шаг. Вы введёте данные, мы сгенерируем PDF с вашими ответами уже в клетках. Вы распечатаете, подпишете и отправите в USCIS самостоятельно.',
  },
  en: {
    back: '← Back',
    next: 'Next →',
    finish: 'Done',
    progress: (n: number, total: number) => `Step ${n} of ${total}`,
    yes: 'Yes', no: 'No', unsure: 'Not sure',

    s1Title: '1. Initial application or re-registration?',
    s1Body: 'If you have never filed TPS — initial. If you already had TPS and are extending — re-registration.',
    s1Initial: 'First filing (initial)',
    s1Reg: 'Extension (re-registration)',
    s1Unknown: 'Not sure',
    s1Hint: 'If unsure — we will show both paths in the summary.',
    s1OcrCta: '📷 I have photos of my documents — upload',
    s1OcrHint: 'We will read your passport / I-94 / EAD and prefill the form for you.',
    s1ResumeNote: 'You are continuing a previous session.',
    s1RestartCta: '↺ Start over',
    ocrDone: 'Done! {n} fields read. We will prefill them on the final step.',

    s2Title: '2. Identity and arrival',
    s2Passport: 'Do you have a valid passport?',
    s2I94: 'Do you have an I-94?',
    s2I94Hint: 'I-94 is the CBP electronic arrival record. Check at i94.cbp.dhs.gov.',
    s2Date: 'Date of your last entry into the US',
    s2DatePlaceholder: 'YYYY-MM-DD',
    s2DateHint: 'Needed for continuous residence (from Aug 16, 2023) and continuous physical presence (from Oct 20, 2023).',

    s3Title: '3. EAD and fee waiver',
    s3Ead: 'Do you need a work permit (EAD)?',
    s3EadHint: 'Filed as a separate Form I-765, together with I-821 or after.',
    s3HasEad: 'Do you already have a TPS EAD?',
    s3EadExpiry: 'Card Expires date on your EAD',
    s3EadAutoNote: 'The EAD auto-extension through Apr 19, 2026 (for cards with Apr 19, 2025 or Oct 19, 2023 expiry) is now expired as of May 2026. Verify current EAD validity on the official USCIS TPS Ukraine page.',
    s3FeeWaiver: 'Do you need a fee waiver (I-912)?',
    s3FeeWaiverHint: 'Form I-912 — request to waive USCIS fees. Paper filing ONLY.',
    s3Result: 'Filing method:',
    s3Paper: 'Paper filing (because fee waiver is needed)',
    s3Online: 'Online via my.uscis.gov',
    s3UnknownMethod: 'Depends on your answers',

    s4Title: '4. Evidence of residence',
    s4Body: 'Pick the categories of documents you have. The more, the better.',
    s4CrTitle: 'Continuous residence (from Aug 16, 2023):',
    s4CppTitle: 'Continuous physical presence (from Oct 20, 2023):',
    s4CrItems: [
      { id: 'rent', label: 'Lease / rent receipts' },
      { id: 'utility', label: 'Utility bills' },
      { id: 'bank', label: 'Bank statements' },
      { id: 'medical', label: 'Medical records' },
      { id: 'school', label: 'School records' },
      { id: 'employer', label: 'Employer letter' },
      { id: 'tax', label: 'Tax documents' },
    ],
    s4CppItems: [
      { id: 'travel', label: 'I-94 records with no exits since Oct 20, 2023' },
      { id: 'leases', label: 'Continuous lease agreements' },
      { id: 'cards', label: 'Credit-card statements (US transactions)' },
      { id: 'paystubs', label: 'Paystubs' },
    ],

    s5Title: '5. Summary — what to prepare',
    s5Body: 'Here is your TPS Ukraine packet. You always file through USCIS yourself.',
    s5Path: 'Filing path',
    s5Forms: 'Which forms',
    s5FilingMethod: 'Filing method',
    s5Evidence: 'Evidence checklist',
    s5Transfer: 'Transfer guide — where to enter what in USCIS forms',
    s5Disclaimer: 'Messenginfo does not file documents for you. We are not a law firm. We do not guarantee USCIS acceptance. Verify official dates on the USCIS TPS Ukraine page.',
    s5Restart: '← Start over',
    s5Sources: 'All official links →',
    s5Print: '🖨 Print summary',
    s5AttorneyWarn: '⚠ Based on your answers (criminal questions or uncertainty) we recommend consulting a licensed immigration attorney before filing.',
    s5AttorneyLink: 'Find legal services via USCIS →',

    s6Title: '6. Your USCIS forms (draft)',
    s6Body: 'This is the final step. You enter your data, we generate PDFs with your answers already in the boxes. You print, sign, and mail to USCIS yourself.',
  },
  es: {
    back: '← Volver',
    next: 'Siguiente →',
    finish: 'Listo',
    progress: (n: number, total: number) => `Paso ${n} de ${total}`,
    yes: 'Sí', no: 'No', unsure: 'No estoy seguro',

    s1Title: '1. ¿Solicitud inicial o re-registración?',
    s1Body: 'Si nunca presentó TPS — inicial. Si ya tenía TPS y lo extiende — re-registración.',
    s1Initial: 'Primera presentación (inicial)',
    s1Reg: 'Extensión (re-registración)',
    s1Unknown: 'No estoy seguro',
    s1Hint: 'Si no está seguro — mostraremos ambos caminos en el resumen.',
    s1OcrCta: '📷 Tengo fotos de mis documentos — subir',
    s1OcrHint: 'Leeremos su pasaporte / I-94 / EAD y prellenaremos el formulario.',
    s1ResumeNote: 'Está continuando una sesión anterior.',
    s1RestartCta: '↺ Empezar de nuevo',
    ocrDone: 'Listo! {n} campos leídos. Los prellenaremos en el último paso.',

    s2Title: '2. Identidad y llegada',
    s2Passport: '¿Tiene pasaporte vigente?',
    s2I94: '¿Tiene I-94?',
    s2I94Hint: 'I-94 es el registro electrónico de llegada de CBP. Verifique en i94.cbp.dhs.gov.',
    s2Date: 'Fecha de su última entrada a EE. UU.',
    s2DatePlaceholder: 'YYYY-MM-DD',
    s2DateHint: 'Necesaria para continuous residence (desde 16 ago 2023) y continuous physical presence (desde 20 oct 2023).',

    s3Title: '3. EAD y fee waiver',
    s3Ead: '¿Necesita permiso de trabajo (EAD)?',
    s3EadHint: 'Se presenta como Form I-765 separado, junto con I-821 o después.',
    s3HasEad: '¿Ya tiene un TPS EAD?',
    s3EadExpiry: 'Fecha Card Expires en su EAD',
    s3EadAutoNote: 'Algunos TPS EAD con Card Expires 19 abr 2025 o 19 oct 2023 fueron extendidos automáticamente hasta el 19 abr 2026. Verifique en la página de USCIS.',
    s3FeeWaiver: '¿Necesita fee waiver (I-912)?',
    s3FeeWaiverHint: 'Form I-912 — exención de tarifas USCIS. SOLO papel.',
    s3Result: 'Método de presentación:',
    s3Paper: 'Presentación en papel (necesita fee waiver)',
    s3Online: 'En línea por my.uscis.gov',
    s3UnknownMethod: 'Depende de sus respuestas',

    s4Title: '4. Evidencia de residencia',
    s4Body: 'Elija las categorías de documentos que tiene. Cuantas más, mejor.',
    s4CrTitle: 'Continuous residence (desde 16.08.2023):',
    s4CppTitle: 'Continuous physical presence (desde 20.10.2023):',
    s4CrItems: [
      { id: 'rent', label: 'Contrato de alquiler / recibos' },
      { id: 'utility', label: 'Facturas de servicios' },
      { id: 'bank', label: 'Estados bancarios' },
      { id: 'medical', label: 'Registros médicos' },
      { id: 'school', label: 'Registros escolares' },
      { id: 'employer', label: 'Carta del empleador' },
      { id: 'tax', label: 'Documentos fiscales' },
    ],
    s4CppItems: [
      { id: 'travel', label: 'Registros I-94 sin salidas desde 20.10.2023' },
      { id: 'leases', label: 'Contratos de alquiler continuos' },
      { id: 'cards', label: 'Estados de tarjeta de crédito (transacciones US)' },
      { id: 'paystubs', label: 'Recibos de sueldo' },
    ],

    s5Title: '5. Resumen — qué preparar',
    s5Body: 'Aquí está su paquete TPS Ucrania. Usted siempre presenta ante USCIS.',
    s5Path: 'Camino de presentación',
    s5Forms: 'Qué formularios',
    s5FilingMethod: 'Método de presentación',
    s5Evidence: 'Lista de evidencias',
    s5Transfer: 'Guía de transferencia — qué va dónde en formularios USCIS',
    s5Disclaimer: 'Messenginfo no presenta documentos por usted. No somos un bufete. No garantizamos la aceptación de USCIS. Verifique las fechas en la página USCIS TPS Ukraine.',
    s5Restart: '← Empezar de nuevo',
    s5Sources: 'Todos los enlaces oficiales →',
    s5Print: '🖨 Imprimir resumen',
    s5AttorneyWarn: '⚠ Por sus respuestas (asuntos criminales o incertidumbre) recomendamos consultar a un abogado de inmigración con licencia antes de presentar.',
    s5AttorneyLink: 'Encontrar servicios legales por USCIS →',

    s6Title: '6. Formulario listo para enviar (borrador)',
    s6Body: 'Este es el último paso. Usted ingresa sus datos, generamos un PDF con sus respuestas ya en las casillas. Usted imprime, firma y envía a USCIS.',
  },
} as const

// ── OCR review helpers ──────────────────────────────────────────────────────

/**
 * Fields whose absence should BLOCK the user from leaving the self-review
 * screen. Source: I-821 Part 1 + Part 4 "must-have" cells. EAD-specific
 * fields (a_number, ead_category_on_card, ead_expiration_date) are NOT
 * critical here — they only matter if the user is also filing I-765, and
 * the I-765 form on Step 6 has its own validation.
 */
const CRITICAL_FIELDS: ReadonlySet<string> = new Set([
  'family_name',
  'given_name',
  'dob',
  'passport_number',
  'passport_expiration_date',
])

/**
 * Localized human label for an extracted field key. Used by the
 * SelfReviewScreen rows. We intentionally keep this in TPSWizard rather
 * than in lib/tps — these are user-facing strings, not engine concerns,
 * and they need to honor the wizard's locale prop.
 */
function prettyLabel(field: string, locale: Locale): string {
  const L: Record<string, Record<Locale, string>> = {
    family_name: {
      uk: 'Прізвище', ru: 'Фамилия', en: 'Family name', es: 'Apellido',
    },
    given_name: {
      uk: 'Ім’я', ru: 'Имя', en: 'Given name', es: 'Nombre',
    },
    middle_name: {
      uk: 'По батькові', ru: 'Отчество', en: 'Middle name', es: 'Segundo nombre',
    },
    dob: {
      uk: 'Дата народження', ru: 'Дата рождения', en: 'Date of birth', es: 'Fecha de nacimiento',
    },
    sex: {
      uk: 'Стать', ru: 'Пол', en: 'Sex', es: 'Sexo',
    },
    country_of_nationality: {
      uk: 'Громадянство', ru: 'Гражданство', en: 'Nationality', es: 'Nacionalidad',
    },
    country_of_birth: {
      uk: 'Країна народження', ru: 'Страна рождения', en: 'Country of birth', es: 'País de nacimiento',
    },
    passport_number: {
      uk: 'Номер паспорта', ru: 'Номер паспорта', en: 'Passport number', es: 'Número de pasaporte',
    },
    passport_country_of_issuance: {
      uk: 'Країна видачі паспорта', ru: 'Страна выдачи паспорта', en: 'Passport country of issuance', es: 'País emisor del pasaporte',
    },
    passport_expiration_date: {
      uk: 'Паспорт дійсний до', ru: 'Паспорт действителен до', en: 'Passport expiration', es: 'Vencimiento del pasaporte',
    },
    i94_admission_number: {
      uk: 'Номер I-94', ru: 'Номер I-94', en: 'I-94 admission number', es: 'Número de admisión I-94',
    },
    i94_class_of_admission: {
      uk: 'Клас в’їзду (I-94)', ru: 'Класс въезда (I-94)', en: 'Class of admission (I-94)', es: 'Clase de admisión (I-94)',
    },
    last_entry_date: {
      uk: 'Дата останнього в’їзду', ru: 'Дата последнего въезда', en: 'Last entry date', es: 'Fecha del último ingreso',
    },
    i94_admit_until: {
      uk: 'I-94 дійсний до', ru: 'I-94 действителен до', en: 'I-94 admit until', es: 'I-94 válido hasta',
    },
    a_number: {
      uk: 'A-номер (на EAD)', ru: 'A-номер (на EAD)', en: 'A-Number (from EAD)', es: 'A-Number (de EAD)',
    },
    ead_category_on_card: {
      uk: 'Категорія EAD', ru: 'Категория EAD', en: 'EAD category', es: 'Categoría EAD',
    },
    ead_expiration_date: {
      uk: 'EAD дійсний до', ru: 'EAD действителен до', en: 'EAD expiration', es: 'Vencimiento del EAD',
    },
  }
  return L[field]?.[locale] ?? field
}

/**
 * Human description of WHICH document a field came from. Used to populate
 * the SelfReviewScreen `source` label so the user sees "Фамилия из паспорта"
 * rather than "Фамилия из doc_passport_1234".
 *
 * Heuristic: source_document_id values from DocumentUploadScreen start
 * with the slot name. If we can't infer cleanly, return the raw id —
 * that's still better than nothing, and the user is unlikely to see this
 * code path because slots are tagged on upload.
 */
function docKindLabel(documentId: string, locale: Locale): string {
  const id = (documentId || '').toLowerCase()
  if (id.includes('passport')) {
    return locale === 'uk' ? 'паспорта' : locale === 'ru' ? 'паспорта' : locale === 'es' ? 'pasaporte' : 'passport'
  }
  if (id.includes('i94') || id.includes('i_94') || id.includes('i-94')) {
    return 'I-94'
  }
  if (id.includes('ead')) {
    return 'EAD'
  }
  return documentId
}

// ── component ───────────────────────────────────────────────────────────────

// Wizard length increased to 6: Step 6 is the dedicated "Заполнить
// готовый PDF" screen. Per UX audit, having the prefill form auto-expanded
// inside Step 5 felt "appeared unexpectedly". Splitting it into its own
// step gives it proper signposting via the progress bar and lets the user
// review the summary first, then explicitly opt into the form filling.
const TOTAL_SCREENS = 6

interface Props {
  locale: string
}

export default function TPSWizard({ locale: rawLocale }: Props) {
  const locale = (['uk', 'ru', 'en', 'es'].includes(rawLocale) ? rawLocale : 'en') as Locale
  const t = T[locale]
  const sourcesHref = `/${locale}/services/tps-ukraine/sources`
  const backHref = `/${locale}/services/tps-ukraine`

  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState<TPSAnswers>(DEFAULTS)
  const [hydrated, setHydrated] = useState(false)

  // OCR mini-flow state. Lives alongside the wizard rather than inside its
  // step machine so we never break existing localStorage migrations. When
  // user clicks the "I have document photos" CTA on Step 1 we switch the
  // page into 'ocr_upload' → 'ocr_review' → resume wizard at Step 1 with
  // extracted fields cached for GeneratePacketBlock to consume.
  const [ocrPhase, setOcrPhase] = useState<'wizard' | 'ocr_upload' | 'ocr_review'>('wizard')
  const [ocrFields, setOcrFields] = useState<TpsExtractedField[]>([])
  const [ocrAnyManualReview, setOcrAnyManualReview] = useState<boolean>(false)
  // Which extracted-field key is currently being edited in the inline
  // modal. null = no edit dialog open. Driving this from TPSWizard (not
  // SelfReviewScreen) keeps SelfReviewScreen reusable across services.
  const [editingField, setEditingField] = useState<string | null>(null)

  // hydrate from localStorage
  // Per UX audit: a returning user was being dropped onto step 5 because
  // localStorage persisted the last step. That looked like a bug ("the
  // wizard skipped my questions"). Fix: on a fresh page load we ALWAYS
  // reset to step 1 by default. To resume mid-flow the URL must carry
  // `?continue=1` (set by internal "Resume" CTAs). Answers themselves
  // still rehydrate so the user doesn't have to re-type everything.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { step?: number; answers?: TPSAnswers }
        const shouldContinue =
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('continue') === '1'
        if (
          shouldContinue &&
          typeof parsed.step === 'number' &&
          parsed.step >= 1 &&
          parsed.step <= TOTAL_SCREENS
        ) {
          setStep(parsed.step)
        } else {
          setStep(1)
        }
        if (parsed.answers && typeof parsed.answers === 'object') {
          setAnswers({ ...DEFAULTS, ...parsed.answers })
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [])

  // persist on change
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, answers }))
    } catch {
      /* ignore */
    }
  }, [step, answers, hydrated])

  const update = useCallback((patch: Partial<TPSAnswers>) => {
    setAnswers((prev) => ({ ...prev, ...patch }))
  }, [])

  const filingMethod = useMemo<TPSAnswers['filing_method']>(() => {
    if (answers.wants_fee_waiver === true) return 'paper'
    if (answers.wants_fee_waiver === false) return 'online'
    return 'unknown'
  }, [answers.wants_fee_waiver])

  const needsAttorney = useMemo(
    () =>
      answers.has_criminal_concern === true ||
      (answers.filing_path === 'unknown' && step >= TOTAL_SCREENS),
    [answers.has_criminal_concern, answers.filing_path, step],
  )

  const next = () => setStep((s) => Math.min(TOTAL_SCREENS, s + 1))
  const back = () => setStep((s) => Math.max(1, s - 1))
  const restart = () => {
    setAnswers(DEFAULTS)
    setStep(1)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  // ── shared button styles ──
  const primaryBtn: React.CSSProperties = {
    display: 'block',
    width: '100%',
    height: 52,
    lineHeight: '52px',
    textAlign: 'center',
    background: 'var(--success)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 800,
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 3px 14px rgba(22,163,74,0.30)',
  }
  const secondaryBtn: React.CSSProperties = {
    display: 'inline-block',
    padding: '10px 14px',
    background: 'var(--surface-2)',
    color: 'var(--text-1)',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 10,
    border: '1px solid var(--border)',
    cursor: 'pointer',
  }
  const choiceCard = (selected: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '14px 16px',
    border: selected ? '2px solid var(--success)' : '1px solid var(--border)',
    background: selected ? 'var(--success-bg, #dcfce7)' : 'var(--surface)',
    color: 'var(--text-1)',
    fontSize: 15,
    fontWeight: 600,
    borderRadius: 12,
    cursor: 'pointer',
    marginBottom: 10,
  })

  // True when the user is mid-flow with previously-saved answers — they
  // hydrated from localStorage. We surface a small "↺ Start over" pill
  // so a returning user can deliberately reset instead of having their
  // last answers silently carry over. Per UX audit: the wizard now
  // defaults to Step 1 on fresh loads, but Step 1 doesn't show the
  // user that any prior answers are still loaded — until they click an
  // answer and notice another card highlighted. The pill closes that gap.
  const hasPriorState =
    answers.filing_path !== 'unselected' ||
    answers.has_passport !== undefined ||
    answers.has_i94 !== undefined ||
    answers.wants_ead !== undefined ||
    ocrFields.length > 0

  // ── screens ──
  function ScreenS1() {
    return (
      <div>
        {hasPriorState && (
          <div
            data-testid="tps-resume-banner"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              marginBottom: 14,
              background: 'var(--info-bg, #dbeafe)',
              color: 'var(--info-text, #1e3a8a)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            <span style={{ flex: 1 }}>{t.s1ResumeNote}</span>
            <button
              type="button"
              data-testid="tps-restart-cta"
              onClick={restart}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-1)',
                cursor: 'pointer',
              }}
            >
              {t.s1RestartCta}
            </button>
          </div>
        )}

        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginBottom: 8 }}>{t.s1Title}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.5 }}>{t.s1Body}</p>
        <button
          type="button"
          data-testid="s1-path-initial"
          style={choiceCard(answers.filing_path === 'initial')}
          onClick={() => update({ filing_path: 'initial', has_prior_tps: false })}
        >
          {t.s1Initial}
        </button>
        <button
          type="button"
          data-testid="s1-path-reregistration"
          style={choiceCard(answers.filing_path === 're_registration')}
          onClick={() => update({ filing_path: 're_registration', has_prior_tps: true })}
        >
          {t.s1Reg}
        </button>
        <button
          type="button"
          data-testid="s1-path-unknown"
          style={choiceCard(answers.filing_path === 'unknown')}
          onClick={() => update({ filing_path: 'unknown', has_prior_tps: null })}
        >
          {t.s1Unknown}
        </button>

        {/* OCR escape hatch — placed AFTER the path choice so the user
            answers the most-important question first (initial vs. re-
            registration drives every later screen). The CTA is intentionally
            understated: it's a faster path for users with photos, not a
            replacement for the wizard. We do NOT block on path being chosen
            because document fields are independent of filing path. */}
        <button
          type="button"
          data-testid="tps-ocr-cta"
          onClick={() => setOcrPhase('ocr_upload')}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 16px',
            marginTop: 18,
            background: 'var(--surface-2)',
            color: 'var(--text-1)',
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 12,
            border: '1px dashed var(--primary)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {t.s1OcrCta}
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, marginBottom: 6 }}>{t.s1OcrHint}</p>

        {ocrFields.length > 0 && (
          <p
            data-testid="tps-ocr-done-banner"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: ocrAnyManualReview ? 'var(--warning-text, #92400e)' : 'var(--success)',
              background: ocrAnyManualReview ? 'var(--warning-bg, #fef3c7)' : 'var(--success-bg, #dcfce7)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '10px 12px',
              marginTop: 8,
              marginBottom: 6,
            }}
          >
            {t.ocrDone.replace('{n}', String(ocrFields.length))}
          </p>
        )}

        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>{t.s1Hint}</p>
      </div>
    )
  }

  function ScreenS2() {
    return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginBottom: 16 }}>{t.s2Title}</h2>

        <Yn label={t.s2Passport} value={answers.has_passport} onChange={(v) => update({ has_passport: v })} t={t} />
        <Yn label={t.s2I94} value={answers.has_i94} onChange={(v) => update({ has_i94: v })} t={t} />
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
          {t.s2I94Hint} <a href="https://i94.cbp.dhs.gov/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>i94.cbp.dhs.gov ↗</a>
        </p>

        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>{t.s2Date}</label>
        <input
          type="date"
          value={answers.date_entered_us}
          onChange={(e) => update({ date_entered_us: e.target.value })}
          style={{
            width: '100%',
            padding: '12px 14px',
            fontSize: 16,
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: 'var(--surface)',
            color: 'var(--text-1)',
            marginBottom: 6,
          }}
        />
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.s2DateHint}</p>
      </div>
    )
  }

  function ScreenS3() {
    return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginBottom: 16 }}>{t.s3Title}</h2>

        <Yn label={t.s3Ead} value={answers.wants_ead} onChange={(v) => update({ wants_ead: v })} t={t} />
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>{t.s3EadHint}</p>

        {answers.wants_ead === true && (
          <>
            <Yn label={t.s3HasEad} value={answers.has_ead} onChange={(v) => update({ has_ead: v })} t={t} />
            {answers.has_ead === true && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>{t.s3EadExpiry}</label>
                <input
                  type="date"
                  value={answers.ead_expiration_date}
                  onChange={(e) => update({ ead_expiration_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: 16,
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    background: 'var(--surface)',
                    color: 'var(--text-1)',
                    marginBottom: 6,
                  }}
                />
                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.s3EadAutoNote}</p>
              </div>
            )}
          </>
        )}

        <Yn label={t.s3FeeWaiver} value={answers.wants_fee_waiver} onChange={(v) => update({ wants_fee_waiver: v })} t={t} />
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>{t.s3FeeWaiverHint}</p>

        <div style={{ marginTop: 8, padding: 12, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4 }}>{t.s3Result}</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
            {filingMethod === 'paper' ? t.s3Paper : filingMethod === 'online' ? t.s3Online : t.s3UnknownMethod}
          </p>
        </div>
      </div>
    )
  }

  function ScreenS4() {
    const toggleCr = (id: string) => {
      const set = new Set(answers.cr_evidence)
      set.has(id) ? set.delete(id) : set.add(id)
      update({ cr_evidence: Array.from(set) })
    }
    const toggleCpp = (id: string) => {
      const set = new Set(answers.cpp_evidence)
      set.has(id) ? set.delete(id) : set.add(id)
      update({ cpp_evidence: Array.from(set) })
    }
    return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginBottom: 8 }}>{t.s4Title}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 18, lineHeight: 1.5 }}>{t.s4Body}</p>

        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 10 }}>{t.s4CrTitle}</h3>
        {t.s4CrItems.map((it) => (
          <Check key={it.id} label={it.label} checked={answers.cr_evidence.includes(it.id)} onToggle={() => toggleCr(it.id)} />
        ))}

        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginTop: 18, marginBottom: 10 }}>{t.s4CppTitle}</h3>
        {t.s4CppItems.map((it) => (
          <Check key={it.id} label={it.label} checked={answers.cpp_evidence.includes(it.id)} onToggle={() => toggleCpp(it.id)} />
        ))}
      </div>
    )
  }

  function ScreenS5() {
    const formsNeeded: string[] = ['I-821 (TPS application)']
    if (answers.wants_ead === true) formsNeeded.push('I-765 (work permit / EAD)')
    if (answers.wants_fee_waiver === true) formsNeeded.push('I-912 (fee waiver — paper only)')

    const pathLabel = answers.filing_path === 'initial'
      ? (locale === 'uk' ? 'Перша подача (initial TPS)' : locale === 'ru' ? 'Первая подача (initial TPS)' : locale === 'es' ? 'Primera presentación (TPS inicial)' : 'Initial TPS application')
      : answers.filing_path === 're_registration'
      ? (locale === 'uk' ? 'Re-registration (продовження TPS)' : locale === 'ru' ? 'Re-registration (продление TPS)' : locale === 'es' ? 'Re-registración (extensión de TPS)' : 'TPS re-registration')
      : (locale === 'uk' ? 'Не визначено — звертайтесь до офіційних інструкцій USCIS' : locale === 'ru' ? 'Не определено — обратитесь к официальным инструкциям USCIS' : locale === 'es' ? 'No determinado — consulte instrucciones oficiales de USCIS' : 'Undetermined — consult official USCIS instructions')

    const methodLabel = filingMethod === 'paper' ? t.s3Paper : filingMethod === 'online' ? t.s3Online : t.s3UnknownMethod

    const evidenceList = [
      ...answers.cr_evidence.map(id => t.s4CrItems.find(x => x.id === id)?.label).filter(Boolean) as string[],
      ...answers.cpp_evidence.map(id => t.s4CppItems.find(x => x.id === id)?.label).filter(Boolean) as string[],
    ]

    const transferGuide = [
      { form: 'I-821', parts: locale === 'uk'
          ? 'Частина 1 — особисті дані · Частина 2 — країна (Україна) · Частина 3 — вид подання (вперше або продовження) · Частина 4 — в\'їзди та фізична присутність · Частина 5 — останні поїздки'
          : locale === 'ru'
          ? 'Часть 1 — личные данные · Часть 2 — страна (Украина) · Часть 3 — вид подачи (впервые или продление) · Часть 4 — въезды и физическое присутствие · Часть 5 — последние поездки'
          : locale === 'es'
          ? 'Parte 1 — datos personales · Parte 2 — país (Ucrania) · Parte 3 — tipo de solicitud (inicial o renovación) · Parte 4 — entradas y presencia física · Parte 5 — viajes recientes'
          : 'Part 1 — personal data · Part 2 — country (Ukraine) · Part 3 — filing type (initial or re-registration) · Part 4 — entries and physical presence · Part 5 — recent travel',
        url: 'https://www.uscis.gov/i-821',
      },
    ]
    if (answers.wants_ead === true) {
      transferGuide.push({
        form: 'I-765',
        parts: locale === 'uk'
          ? 'Код категорії дозволу на роботу: (c)(19) поки заявка TPS на розгляді; (a)(12) після затвердження TPS. Точно — на сторінці USCIS.'
          : locale === 'ru'
          ? 'Код категории разрешения на работу: (c)(19) пока заявка TPS на рассмотрении; (a)(12) после одобрения TPS. Точно — на странице USCIS.'
          : locale === 'es'
          ? 'Código de categoría del permiso de trabajo: (c)(19) mientras la solicitud TPS está pendiente; (a)(12) después de la aprobación. Confirme en la página de USCIS.'
          : 'Work permit category code: (c)(19) while the TPS application is pending; (a)(12) after TPS is granted. Confirm USCIS instructions.',
        url: 'https://www.uscis.gov/i-765',
      })
    }
    if (answers.wants_fee_waiver === true) {
      transferGuide.push({
        form: 'I-912',
        parts: locale === 'uk'
          ? 'Тільки разом з паперовою заявою. Уважно прочитайте критерії на сторінці USCIS.'
          : locale === 'ru'
          ? 'Только вместе с бумажной заявкой. Внимательно прочитайте критерии на странице USCIS.'
          : locale === 'es'
          ? 'Solo con presentación en papel. Lea cuidadosamente los criterios en la página USCIS.'
          : 'Paper filing only. Read eligibility criteria carefully on the USCIS page.',
        url: 'https://www.uscis.gov/i-912',
      })
    }

    return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginBottom: 8 }}>{t.s5Title}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 18, lineHeight: 1.5 }}>{t.s5Body}</p>

        <SummaryRow label={t.s5Path} value={pathLabel} />
        <SummaryRow label={t.s5Forms} value={formsNeeded.join(' · ')} />
        <SummaryRow label={t.s5FilingMethod} value={methodLabel} />

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>{t.s5Evidence}</p>
          {evidenceList.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{locale === 'uk' ? 'Нічого не обрано' : locale === 'ru' ? 'Ничего не выбрано' : locale === 'es' ? 'Nada seleccionado' : 'Nothing selected'}</p>
          ) : (
            <ul style={{ paddingLeft: 18, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
              {evidenceList.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          )}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10 }}>{t.s5Transfer}</p>
          {transferGuide.map((tg) => (
            <div key={tg.form} style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{tg.form}</p>
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginTop: 2 }}>{tg.parts}</p>
              <a href={tg.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>{tg.url.replace('https://', '')} ↗</a>
            </div>
          ))}
        </div>

        {needsAttorney && (
          <div style={{ background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t.s5AttorneyWarn}</p>
            <a href="https://www.uscis.gov/avoid-scams/find-legal-services" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>{t.s5AttorneyLink}</a>
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 16 }}>{t.s5Disclaimer}</p>

        <a href={sourcesHref} style={{ ...secondaryBtn, display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 10 }}>
          {t.s5Sources}
        </a>
        <button type="button" onClick={() => typeof window !== 'undefined' && window.print()} style={{ ...secondaryBtn, display: 'block', width: '100%', textAlign: 'center', marginBottom: 10 }}>
          {t.s5Print}
        </button>
        <button type="button" onClick={restart} style={{ ...secondaryBtn, display: 'block', width: '100%', textAlign: 'center', marginBottom: 10 }}>
          {t.s5Restart}
        </button>
      </div>
    )
  }

  function ScreenS6() {
    return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginBottom: 10 }}>
          {t.s6Title}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 18, lineHeight: 1.5 }}>
          {t.s6Body}
        </p>
        {/* GeneratePacketBlock collects the remaining personal fields and
            POSTs to /api/tps/generate-packet to download a ZIP with
            prefilled I-821 (+I-765 if wants_ead). DRAFT watermark + XFA
            strip handled server-side. Promoted from "expanded panel on
            S5" to dedicated step per UX audit. */}
        <GeneratePacketBlock
          locale={locale}
          filingPath={answers.filing_path}
          wantsEad={answers.wants_ead}
          preExtracted={ocrFields}
        />
      </div>
    )
  }

  // ── OCR phase short-circuits ───────────────────────────────────────────────
  // When the user is in the document-upload or self-review phase we render
  // a focused fullscreen flow instead of the wizard. This keeps the OCR UX
  // simple — one job per screen — and avoids interleaving "your data is
  // being read" with the unrelated step-2 yes/no questions.
  if (ocrPhase === 'ocr_upload') {
    return (
      <DocumentUploadScreen
        locale={locale}
        onComplete={(result) => {
          setOcrFields(result.fields)
          setOcrAnyManualReview(result.anyManualReview)
          setOcrPhase('ocr_review')
        }}
        onBack={() => setOcrPhase('wizard')}
        onSkipAll={() => setOcrPhase('wizard')}
      />
    )
  }
  if (ocrPhase === 'ocr_review') {
    const rows: ReviewRow[] = ocrFields.map((f) => {
      const valueStr = f.normalized_value == null ? '' : String(f.normalized_value)
      // Latin preview: only meaningful for Cyrillic-containing string fields
      // (names, place of birth). USCIS forms render WinAnsi → user must see
      // the exact Latin spelling we will write into the PDF before they
      // press Next. If the value is already Latin (passport_number, dob,
      // I-94 number, phone), latinPreview === value and the chip is hidden.
      const latinPreview = valueStr && hasCyrillic(valueStr)
        ? toWinAnsiSafe(valueStr)
        : undefined
      return {
        key: f.field,
        label: prettyLabel(f.field, locale),
        value: f.normalized_value,
        critical: CRITICAL_FIELDS.has(f.field),
        confidenceLow: f.review_required,
        confidenceHint: f.review_required
          ? (locale === 'uk' ? 'погано видно — перевірте'
            : locale === 'ru' ? 'плохо видно — проверьте'
            : locale === 'es' ? 'baja calidad — verifique'
            : 'low confidence — verify')
          : undefined,
        source: f.source_document_id ? `${
          locale === 'uk' ? 'з'
          : locale === 'ru' ? 'из'
          : locale === 'es' ? 'de'
          : 'from'
        } ${docKindLabel(f.source_document_id, locale)}` : undefined,
        latinPreview,
      }
    })
    const reviewTitle = locale === 'uk' ? 'Важливі дані для форми'
      : locale === 'ru' ? 'Важные данные для формы'
      : locale === 'es' ? 'Datos importantes para el formulario'
      : 'Key fields for the form'

    return (
      <>
        <SelfReviewScreen
          locale={locale}
          groupTitle={reviewTitle}
          rows={rows}
          onEdit={(rowKey) => setEditingField(rowKey)}
          onBack={() => setOcrPhase('ocr_upload')}
          onNext={() => setOcrPhase('wizard')}
        />
        {/* Inline edit modal — replaces the old window.prompt() that was
            painful on mobile. Picks the right input control by field
            type (date / sex / text). Saving flips extraction_source to
            'user_corrected' so the provenance contract is preserved. */}
        <OcrFieldEditModal
          field={editingField}
          label={editingField ? prettyLabel(editingField, locale) : ''}
          value={
            editingField
              ? (ocrFields.find((f) => f.field === editingField)?.normalized_value?.toString() ?? '')
              : ''
          }
          inputType={editingField ? inputTypeForField(editingField) : 'text'}
          locale={locale}
          onClose={() => setEditingField(null)}
          onSave={(next) => {
            if (!editingField) return
            setOcrFields((prev) =>
              prev.map((f) =>
                f.field === editingField
                  ? {
                      ...f,
                      normalized_value: next,
                      raw_value: next,
                      extraction_source: 'user_corrected',
                      review_required: next === '',
                    }
                  : f,
              ),
            )
            setEditingField(null)
          }}
        />
      </>
    )
  }

  // ── render ──
  return (
    <main data-testid="tps-wizard" style={{ minHeight: '100dvh', background: 'var(--background)', padding: '0 0 48px' }}>
      <section style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 20px 12px' }}>
        <a href={backHref} style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>{t.back}</a>
        {/* progress bar */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          {Array.from({ length: TOTAL_SCREENS }).map((_, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 4,
                background: i + 1 < step ? 'var(--success)' : i + 1 === step ? 'var(--primary)' : 'var(--border)',
              }}
            />
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>{t.progress(step, TOTAL_SCREENS)}</p>
      </section>

      <section style={{ padding: '18px 20px 0' }}>
        {step === 1 && <ScreenS1 />}
        {step === 2 && <ScreenS2 />}
        {step === 3 && <ScreenS3 />}
        {step === 4 && <ScreenS4 />}
        {step === 5 && <ScreenS5 />}
        {step === 6 && <ScreenS6 />}
      </section>

      {step < TOTAL_SCREENS && (
        <section style={{ padding: '20px 20px 0', display: 'flex', gap: 10 }}>
          {step > 1 && (
            <button type="button" data-testid="wizard-back" onClick={back} style={{ ...secondaryBtn, flex: 1, textAlign: 'center' }}>
              {t.back}
            </button>
          )}
          {/* Step 1 must be answered before the user can advance — the
              initial/re-registration choice drives every later screen, so
              a default-skip would route into the wrong service. Other
              screens have softer answers and can be advanced even if
              partially filled. */}
          {(() => {
            const blocked = step === 1 && answers.filing_path === 'unselected'
            return (
              <button
                type="button"
                data-testid="wizard-next"
                onClick={blocked ? undefined : next}
                disabled={blocked}
                aria-disabled={blocked}
                style={{
                  ...primaryBtn,
                  flex: step > 1 ? 2 : 1,
                  opacity: blocked ? 0.45 : 1,
                  cursor: blocked ? 'not-allowed' : 'pointer',
                  background: blocked ? 'var(--surface-2)' : primaryBtn.background,
                  color: blocked ? 'var(--text-3)' : primaryBtn.color,
                  boxShadow: blocked ? 'none' : primaryBtn.boxShadow,
                }}
              >
                {t.next}
              </button>
            )
          })()}
        </section>
      )}
    </main>
  )
}

// ── tiny presentational helpers (local to this client component) ───────────

function Yn({
  label,
  value,
  onChange,
  t,
}: {
  label: string
  value: boolean | null | undefined
  onChange: (v: boolean | null) => void
  t: { yes: string; no: string; unsure: string }
}) {
  // A button is highlighted ONLY when the user has explicitly clicked it.
  // value === undefined means "not yet answered" — no card highlighted, so the
  // user must actively pick one. This fixes the prior bug where "Не уверен"
  // appeared selected by default.
  const isMatch = (v: boolean | null) => value !== undefined && value === v
  const card = (v: boolean | null) => ({
    flex: 1,
    padding: '10px 8px',
    textAlign: 'center' as const,
    fontSize: 13,
    fontWeight: 700,
    color: isMatch(v) ? '#fff' : 'var(--text-1)',
    background: isMatch(v) ? 'var(--success)' : 'var(--surface)',
    border: isMatch(v) ? '2px solid var(--success)' : '1px solid var(--border)',
    borderRadius: 10,
    cursor: 'pointer',
  })
  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>{label}</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button type="button" style={card(true)} onClick={() => onChange(true)}>{t.yes}</button>
        <button type="button" style={card(false)} onClick={() => onChange(false)}>{t.no}</button>
        <button type="button" style={card(null)} onClick={() => onChange(null)}>{t.unsure}</button>
      </div>
    </div>
  )
}

function Check({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <label
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: '11px 12px',
        marginBottom: 8,
        background: checked ? 'var(--success-bg, #dcfce7)' : 'var(--surface)',
        border: checked ? '2px solid var(--success)' : '1px solid var(--border)',
        borderRadius: 10,
        cursor: 'pointer',
      }}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
      <span style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 600 }}>{label}</span>
    </label>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.45 }}>{value}</p>
    </div>
  )
}
