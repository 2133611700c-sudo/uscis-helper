/**
 * /[locale]/services/tps-ukraine
 *
 * TPS Ukraine landing — Re-Parole parity (server component, inline T,
 * zero-JS FAQ via <details>/<summary>).
 *
 * VERIFIED 2026-05-10 from official USCIS sources:
 *   - TPS Ukraine extended for 18 months, from Apr 20, 2025 through Oct 19, 2026.
 *     (Federal Register notice 2025-00771, published 2025-01-17.)
 *   - 60-day re-registration window: Jan 17, 2025 – Mar 18, 2025.
 *   - Certain EADs auto-extended through Apr 19, 2026
 *     (EADs with Card Expires of Apr 19, 2025 or Oct 19, 2023).
 *   - Forms involved:
 *       I-821  — Application for Temporary Protected Status
 *       I-765  — Application for Employment Authorization (EAD)
 *       I-912  — Request for Fee Waiver (paper filing only)
 *       I-131  — Advance Parole (optional, for travel)
 *   - Source: uscis.gov/humanitarian/temporary-protected-status/TPS-Ukraine
 *
 * RULE: Messenginfo prepares the answers + evidence checklist + transfer
 * guide. User files with USCIS themselves through my.uscis.gov or by mail.
 * Messenginfo does NOT file on the user's behalf. No legal advice. No
 * guarantee of approval. No "USCIS accepted" wording.
 */

import type { Metadata } from 'next'

interface Props {
  params: Promise<{ locale: string }>
}

const T = {
  uk: {
    metaTitle: 'TPS для України — Messenginfo',
    metaDesc: 'Підготуйте всю інформацію для подання TPS Ukraine (Form I-821, I-765, I-912). Ви подаєте самостійно через USCIS. Ми не юридична фірма.',
    badge: 'TPS Україна — продовжено до 19 жовтня 2026',
    title: 'TPS для України',
    subtitle: 'Допоможемо підготувати всю інформацію для подання та заповнення TPS у USCIS — крок за кроком.',
    ctaMain: 'Почати підготовку TPS →',
    legalOne: 'Не юридична фірма · Ви подаєте до USCIS самостійно · Тільки для довідки',
    trustPills: ['✔ Безпечно', '✔ Зрозуміло', '✔ Без реєстрації', '✔ Ви подаєте'],
    trustCards: [
      { icon: '🔒', title: 'Безпечно', desc: 'Ваші дані не передаються третім особам.' },
      { icon: '📋', title: 'Чек-лист', desc: 'Готовий список документів і відповідей.' },
      { icon: '✅', title: 'Без реєстрації', desc: 'Жодного акаунту — просто дайте відповіді.' },
      { icon: '🇺🇸', title: 'Ви подаєте', desc: 'Ми готуємо. Ви подаєте через USCIS.' },
    ],
    howTitle: 'Як це працює',
    howSteps: [
      { num: '1', title: 'Дайте відповіді', desc: 'Майстер задасть прості питання: початкове TPS чи re-registration, чи потрібна EAD, чи зменшення збору (I-912).' },
      { num: '2', title: 'Отримайте інструкцію', desc: 'Список потрібних документів, інструкція що куди вписати у форми I-821 / I-765 / I-912, посилання на офіційні поля USCIS.' },
      { num: '3', title: 'Подайте до USCIS', desc: 'Заповніть та подайте через my.uscis.gov онлайн або поштою. Ми не подаємо за вас.' },
    ],
    ctaStatus: '🔍 Перевірити статус TPS →',
    ctaTranslate: '📄 Перекласти документ →',
    priceTitle: 'Вартість підготовки',
    priceService: 'Наша комісія за підготовку',
    priceServiceDesc: 'Збір даних, чек-лист документів, заповнені форми для USCIS',
    priceRows: [
      { label: '1 людина', price: '$15' },
      { label: '2 людини', price: '$25', save: 'економія $5' },
      { label: '3 людини', price: '$35', save: 'економія $10' },
      { label: "4+ (сім'я)", price: '$45', save: 'економія $15', highlight: true },
    ],
    priceUSCIS: 'Держмито USCIS',
    priceUSCISDesc: 'Залежить від форм та права на fee waiver (I-912). Перевірте на',
    priceUSCISLink: 'uscis.gov/feecalculator',
    priceUSCISVal: 'див. калькулятор',
    entries: [
      {
        key: 'status',
        icon: '🔍',
        title: 'Статус TPS Україна',
        desc: 'Поточний статус програми, актуальні дати, оновлення USCIS і Federal Register.',
        cta: 'Відкрити →',
      },
      {
        key: 'translate',
        icon: '📄',
        title: 'Перекласти документ для USCIS',
        desc: 'Документи не англійською? Підготуйте чернетку перекладу.',
        cta: 'Перекласти →',
      },
      {
        key: 'sources',
        icon: '🔗',
        title: 'Офіційні ресурси TPS',
        desc: 'Сторінки USCIS про TPS Ukraine, форми I-821 / I-765 / I-912, fee calculator, my.uscis.gov.',
        cta: 'Відкрити →',
      },
    ],
    faqTitle: 'Питання та відповіді',
    faqs: [
      {
        q: 'Чи це юридична консультація?',
        a: 'Ні. Messenginfo — сервіс підготовки документів. Ми не є юридичною фірмою і не надаємо юридичних порад. Якщо ваша ситуація складна — зверніться до ліцензованого імміграційного адвоката.',
      },
      {
        q: 'Чи Messenginfo подає TPS за мене?',
        a: 'Ні. Ми готуємо відповіді, чек-лист і інструкції що куди вписати. Подаєте ви самостійно — онлайн через my.uscis.gov або поштою.',
      },
      {
        q: 'TPS Україна досі активний?',
        a: 'Так. TPS для України було продовжено на 18 місяців — з 20 квітня 2025 по 19 жовтня 2026 року (Federal Register notice 2025-00771). Деталі і офіційні дати — на сторінці USCIS TPS Ukraine.',
      },
      {
        q: 'Що означає re-registration?',
        a: 'Якщо у вас вже є TPS, вам потрібно повторно зареєструватися щоб зберегти статус. Вікно повторної реєстрації для поточного продовження: 17 січня – 18 березня 2025 року. Уточнюйте на сторінці USCIS — терміни можуть оновлюватись.',
      },
      {
        q: 'Як отримати дозвіл на роботу (EAD)?',
        a: 'Подайте Form I-765 разом з Form I-821. Деякі попередньо видані TPS EAD автоматично продовжені до 19 квітня 2026 року — перевірте дату Card Expires на вашій картці на сторінці USCIS.',
      },
      {
        q: 'Що таке fee waiver / I-912?',
        a: 'Form I-912 дозволяє запросити звільнення від держмита USCIS за певних умов. Подається лише разом з паперовою заявою (не онлайн). Не всі мають право — критерії на uscis.gov/i-912.',
      },
    ],
    footer: 'TPS Ukraine продовжено до 19 жовтня 2026 · uscis.gov/humanitarian/temporary-protected-status/TPS-Ukraine · Messenginfo не подає документи від вашого імені',
  },
  ru: {
    metaTitle: 'TPS для Украины — Messenginfo',
    metaDesc: 'Подготовьте всю информацию для подачи TPS Ukraine (Form I-821, I-765, I-912). Вы подаёте сами через USCIS. Мы не юридическая фирма.',
    badge: 'TPS Украина — продлено до 19 октября 2026',
    title: 'TPS для Украины',
    subtitle: 'Поможем подготовить всю информацию для подачи и заполнения TPS в USCIS — шаг за шагом.',
    ctaMain: 'Начать подготовку TPS →',
    legalOne: 'Не юридическая фирма · Вы подаёте в USCIS самостоятельно · Только для справки',
    trustPills: ['✔ Безопасно', '✔ Понятно', '✔ Без регистрации', '✔ Вы подаёте'],
    trustCards: [
      { icon: '🔒', title: 'Безопасно', desc: 'Ваши данные не передаются третьим лицам.' },
      { icon: '📋', title: 'Чек-лист', desc: 'Готовый список документов и ответов.' },
      { icon: '✅', title: 'Без регистрации', desc: 'Никакого аккаунта — просто ответьте на вопросы.' },
      { icon: '🇺🇸', title: 'Вы подаёте', desc: 'Мы готовим. Вы подаёте через USCIS.' },
    ],
    howTitle: 'Как это работает',
    howSteps: [
      { num: '1', title: 'Ответьте на вопросы', desc: 'Мастер задаст простые вопросы: первичный TPS или re-registration, нужна ли EAD, нужен ли fee waiver (I-912).' },
      { num: '2', title: 'Получите инструкцию', desc: 'Список нужных документов, инструкция что куда вписывать в I-821 / I-765 / I-912, ссылки на официальные поля USCIS.' },
      { num: '3', title: 'Подайте в USCIS', desc: 'Заполните и подайте через my.uscis.gov онлайн или почтой. Мы не подаём за вас.' },
    ],
    ctaStatus: '🔍 Проверить статус TPS →',
    ctaTranslate: '📄 Перевести документ →',
    priceTitle: 'Стоимость подготовки',
    priceService: 'Наша комиссия за подготовку',
    priceServiceDesc: 'Сбор данных, чек-лист документов, заполненные формы для USCIS',
    priceRows: [
      { label: '1 человек', price: '$15' },
      { label: '2 человека', price: '$25', save: 'экономия $5' },
      { label: '3 человека', price: '$35', save: 'экономия $10' },
      { label: '4+ (семья)', price: '$45', save: 'экономия $15', highlight: true },
    ],
    priceUSCIS: 'Госпошлина USCIS',
    priceUSCISDesc: 'Зависит от форм и права на fee waiver (I-912). Проверьте на',
    priceUSCISLink: 'uscis.gov/feecalculator',
    priceUSCISVal: 'см. калькулятор',
    entries: [
      {
        key: 'status',
        icon: '🔍',
        title: 'Статус TPS Украина',
        desc: 'Текущий статус программы, актуальные даты, обновления USCIS и Federal Register.',
        cta: 'Открыть →',
      },
      {
        key: 'translate',
        icon: '📄',
        title: 'Перевести документ для USCIS',
        desc: 'Документы не на английском? Подготовьте черновик перевода.',
        cta: 'Перевести →',
      },
      {
        key: 'sources',
        icon: '🔗',
        title: 'Официальные ресурсы TPS',
        desc: 'Страницы USCIS о TPS Ukraine, формы I-821 / I-765 / I-912, fee calculator, my.uscis.gov.',
        cta: 'Открыть →',
      },
    ],
    faqTitle: 'Вопросы и ответы',
    faqs: [
      {
        q: 'Это юридическая консультация?',
        a: 'Нет. Messenginfo — сервис подготовки документов. Мы не юридическая фирма и не предоставляем юридических советов. Если ваша ситуация сложная — обратитесь к лицензированному иммиграционному адвокату.',
      },
      {
        q: 'Messenginfo подаёт TPS за меня?',
        a: 'Нет. Мы готовим ответы, чек-лист и инструкции что куда вписывать. Подаёте вы сами — онлайн через my.uscis.gov или почтой.',
      },
      {
        q: 'TPS Украина ещё действует?',
        a: 'Да. TPS для Украины было продлено на 18 месяцев — с 20 апреля 2025 по 19 октября 2026 года (Federal Register notice 2025-00771). Детали и официальные даты — на странице USCIS TPS Ukraine.',
      },
      {
        q: 'Что значит re-registration?',
        a: 'Если у вас уже есть TPS, нужно повторно зарегистрироваться чтобы сохранить статус. Окно повторной регистрации для текущего продления: 17 января – 18 марта 2025 года. Уточняйте на странице USCIS — сроки могут обновляться.',
      },
      {
        q: 'Как получить разрешение на работу (EAD)?',
        a: 'Подайте Form I-765 вместе с Form I-821. Некоторые ранее выданные TPS EAD автоматически продлены до 19 апреля 2026 — проверьте дату Card Expires на вашей карте на странице USCIS.',
      },
      {
        q: 'Что такое fee waiver / I-912?',
        a: 'Form I-912 позволяет запросить освобождение от госпошлины USCIS при определённых условиях. Подаётся только с бумажной заявкой (не онлайн). Не у всех есть право — критерии на uscis.gov/i-912.',
      },
    ],
    footer: 'TPS Ukraine продлено до 19 октября 2026 · uscis.gov/humanitarian/temporary-protected-status/TPS-Ukraine · Messenginfo не подаёт документы от вашего имени',
  },
  en: {
    metaTitle: 'TPS for Ukraine — Messenginfo',
    metaDesc: 'Prepare all the information needed for filing TPS Ukraine (Form I-821, I-765, I-912). You file with USCIS yourself. We are not a law firm.',
    badge: 'TPS Ukraine — extended through Oct 19, 2026',
    title: 'TPS for Ukraine',
    subtitle: 'We help you prepare all the information you need to file TPS with USCIS — step by step.',
    ctaMain: 'Start TPS preparation →',
    legalOne: 'Not a law firm · You file with USCIS yourself · For guidance only',
    trustPills: ['✔ Secure', '✔ Clear', '✔ No account', '✔ You file'],
    trustCards: [
      { icon: '🔒', title: 'Secure', desc: 'Your data is not shared with third parties.' },
      { icon: '📋', title: 'Checklist', desc: 'A ready list of documents and answers.' },
      { icon: '✅', title: 'No account', desc: 'No sign-up required — just answer the questions.' },
      { icon: '🇺🇸', title: 'You file', desc: 'We prepare. You file through USCIS.' },
    ],
    howTitle: 'How it works',
    howSteps: [
      { num: '1', title: 'Answer questions', desc: 'The wizard asks plain questions: initial TPS vs re-registration, whether you need an EAD, whether you need a fee waiver (I-912).' },
      { num: '2', title: 'Get your instructions', desc: 'Evidence checklist, instructions for what to enter in I-821 / I-765 / I-912, links to the official USCIS fields.' },
      { num: '3', title: 'File with USCIS', desc: 'Submit through my.uscis.gov online or by mail. We do not file on your behalf.' },
    ],
    ctaStatus: '🔍 Check TPS status →',
    ctaTranslate: '📄 Translate a document →',
    priceTitle: 'Preparation pricing',
    priceService: 'Our preparation fee',
    priceServiceDesc: 'Data collection, document checklist, prefilled USCIS forms',
    priceRows: [
      { label: '1 person', price: '$15' },
      { label: '2 people', price: '$25', save: 'save $5' },
      { label: '3 people', price: '$35', save: 'save $10' },
      { label: '4+ (family)', price: '$45', save: 'save $15', highlight: true },
    ],
    priceUSCIS: 'USCIS government fee',
    priceUSCISDesc: 'Depends on forms and eligibility for a fee waiver (I-912). Verify at',
    priceUSCISLink: 'uscis.gov/feecalculator',
    priceUSCISVal: 'see calculator',
    entries: [
      {
        key: 'status',
        icon: '🔍',
        title: 'TPS Ukraine status',
        desc: 'Current program status, key dates, USCIS and Federal Register updates.',
        cta: 'Open →',
      },
      {
        key: 'translate',
        icon: '📄',
        title: 'Translate a document for USCIS',
        desc: 'Documents not in English? Prepare a translation draft.',
        cta: 'Translate →',
      },
      {
        key: 'sources',
        icon: '🔗',
        title: 'Official TPS resources',
        desc: 'USCIS TPS Ukraine pages, Forms I-821 / I-765 / I-912, fee calculator, my.uscis.gov.',
        cta: 'Open →',
      },
    ],
    faqTitle: 'Frequently asked questions',
    faqs: [
      {
        q: 'Is this legal advice?',
        a: 'No. Messenginfo is a document-preparation service. We are not a law firm and do not provide legal advice. If your situation is complex, consult a licensed immigration attorney.',
      },
      {
        q: 'Does Messenginfo file TPS for me?',
        a: 'No. We prepare answers, the checklist, and transfer instructions. You file yourself — online through my.uscis.gov or by mail.',
      },
      {
        q: 'Is TPS Ukraine still in effect?',
        a: 'Yes. TPS for Ukraine was extended for 18 months — from Apr 20, 2025 through Oct 19, 2026 (Federal Register notice 2025-00771). For details and official dates, see the USCIS TPS Ukraine page.',
      },
      {
        q: 'What is re-registration?',
        a: 'If you already have TPS, you must re-register to keep it. The re-registration window for the current extension: Jan 17 – Mar 18, 2025. Confirm on the USCIS page — windows can change.',
      },
      {
        q: 'How do I get a work permit (EAD)?',
        a: 'File Form I-765 together with Form I-821. Some previously issued TPS EADs were automatically extended through Apr 19, 2026 — check the Card Expires date on your card and the USCIS page.',
      },
      {
        q: 'What is a fee waiver / I-912?',
        a: 'Form I-912 lets you request a USCIS fee waiver under certain conditions. It can only be filed with a paper application (not online). Not everyone is eligible — see criteria at uscis.gov/i-912.',
      },
    ],
    footer: 'TPS Ukraine extended through Oct 19, 2026 · uscis.gov/humanitarian/temporary-protected-status/TPS-Ukraine · Messenginfo does not file on your behalf',
  },
  es: {
    metaTitle: 'TPS para Ucrania — Messenginfo',
    metaDesc: 'Prepare toda la información para presentar TPS Ucrania (Form I-821, I-765, I-912). Usted presenta ante USCIS. No somos un bufete.',
    badge: 'TPS Ucrania — extendido hasta 19 oct 2026',
    title: 'TPS para Ucrania',
    subtitle: 'Le ayudamos a preparar toda la información para presentar TPS ante USCIS — paso a paso.',
    ctaMain: 'Comenzar preparación TPS →',
    legalOne: 'No es bufete · Usted presenta ante USCIS · Solo orientativo',
    trustPills: ['✔ Seguro', '✔ Claro', '✔ Sin registro', '✔ Usted presenta'],
    trustCards: [
      { icon: '🔒', title: 'Seguro', desc: 'Sus datos no se comparten con terceros.' },
      { icon: '📋', title: 'Lista', desc: 'Lista lista de documentos y respuestas.' },
      { icon: '✅', title: 'Sin registro', desc: 'No necesita cuenta — solo responda las preguntas.' },
      { icon: '🇺🇸', title: 'Usted presenta', desc: 'Nosotros preparamos. Usted presenta ante USCIS.' },
    ],
    howTitle: 'Cómo funciona',
    howSteps: [
      { num: '1', title: 'Responda preguntas', desc: 'El asistente hace preguntas simples: TPS inicial o re-registración, si necesita EAD, si necesita fee waiver (I-912).' },
      { num: '2', title: 'Obtenga instrucciones', desc: 'Lista de evidencias, instrucciones de qué poner en I-821 / I-765 / I-912, enlaces a los campos oficiales de USCIS.' },
      { num: '3', title: 'Presente ante USCIS', desc: 'Envíe por my.uscis.gov en línea o por correo. Nosotros no presentamos por usted.' },
    ],
    ctaStatus: '🔍 Verificar estado TPS →',
    ctaTranslate: '📄 Traducir documento →',
    priceTitle: 'Precio de preparación',
    priceService: 'Nuestra tarifa de preparación',
    priceServiceDesc: 'Respuestas, lista y guía de transferencia para TPS',
    priceRows: [
      { label: '1 persona', price: '$15' },
      { label: '2 personas', price: '$25', save: 'ahorra $5' },
      { label: '3 personas', price: '$35', save: 'ahorra $10' },
      { label: '4+ (familia)', price: '$45', save: 'ahorra $15', highlight: true },
    ],
    priceUSCIS: 'Tarifa gubernamental USCIS',
    priceUSCISDesc: 'Depende de los formularios y de la elegibilidad para fee waiver (I-912). Verifique en',
    priceUSCISLink: 'uscis.gov/feecalculator',
    priceUSCISVal: 'ver calculadora',
    entries: [
      {
        key: 'status',
        icon: '🔍',
        title: 'Estado TPS Ucrania',
        desc: 'Estado actual del programa, fechas clave, actualizaciones de USCIS y Federal Register.',
        cta: 'Abrir →',
      },
      {
        key: 'translate',
        icon: '📄',
        title: 'Traducir documento para USCIS',
        desc: '¿Documentos no están en inglés? Prepare un borrador de traducción.',
        cta: 'Traducir →',
      },
      {
        key: 'sources',
        icon: '🔗',
        title: 'Recursos oficiales TPS',
        desc: 'Páginas USCIS sobre TPS Ucrania, formularios I-821 / I-765 / I-912, fee calculator, my.uscis.gov.',
        cta: 'Abrir →',
      },
    ],
    faqTitle: 'Preguntas frecuentes',
    faqs: [
      {
        q: '¿Es esto asesoramiento legal?',
        a: 'No. Messenginfo es un servicio de preparación de documentos. No somos un bufete y no brindamos asesoramiento legal. Si su situación es compleja, consulte a un abogado de inmigración con licencia.',
      },
      {
        q: '¿Messenginfo presenta TPS por mí?',
        a: 'No. Preparamos respuestas, lista de evidencias e instrucciones. Usted presenta por su cuenta — en línea por my.uscis.gov o por correo.',
      },
      {
        q: '¿TPS Ucrania sigue vigente?',
        a: 'Sí. TPS para Ucrania fue extendido por 18 meses — del 20 de abril de 2025 al 19 de octubre de 2026 (Federal Register notice 2025-00771). Detalles y fechas oficiales en la página de USCIS TPS Ukraine.',
      },
      {
        q: '¿Qué significa re-registración?',
        a: 'Si ya tiene TPS, debe re-registrarse para mantenerlo. Ventana de re-registración para la extensión actual: 17 enero – 18 marzo 2025. Confirme en la página de USCIS — las ventanas pueden cambiar.',
      },
      {
        q: '¿Cómo obtengo permiso de trabajo (EAD)?',
        a: 'Presente el Form I-765 junto con el Form I-821. Algunos EAD TPS emitidos antes fueron extendidos automáticamente hasta el 19 de abril de 2026 — verifique la fecha Card Expires en su tarjeta y en la página de USCIS.',
      },
      {
        q: '¿Qué es fee waiver / I-912?',
        a: 'El Form I-912 permite solicitar la exención de tarifas de USCIS bajo ciertas condiciones. Solo se puede presentar con una solicitud en papel (no en línea). No todos son elegibles — criterios en uscis.gov/i-912.',
      },
    ],
    footer: 'TPS Ucrania extendido hasta el 19 oct 2026 · uscis.gov/humanitarian/temporary-protected-status/TPS-Ukraine · Messenginfo no presenta en su nombre',
  },
} as const

type Locale = keyof typeof T

function getHref(entryKey: string, locale: string): string {
  if (entryKey === 'status') return `/${locale}/services/tps-status`
  if (entryKey === 'translate') return `/${locale}/services/translate-document`
  if (entryKey === 'sources') return `/${locale}/services/tps-ukraine/sources`
  return '#'
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = T[(locale as Locale)] ?? T.en
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    metadataBase: new URL('https://messenginfo.com'),
    alternates: {
      canonical: `https://messenginfo.com/${locale}/services/tps-ukraine`,
      languages: Object.fromEntries(
        (['uk', 'ru', 'en', 'es'] as Locale[]).map((l) => [
          l,
          `https://messenginfo.com/${l}/services/tps-ukraine`,
        ]),
      ),
    },
  }
}

export default async function TpsUkraineLandingPage({ params }: Props) {
  const { locale } = await params
  const t = T[(locale as Locale)] ?? T.en
  const wizardHref = `/${locale}/services/tps-ukraine/start`

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--background)', padding: '0 0 48px' }}>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '24px 20px 20px',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '99px',
            background: 'var(--info-bg)',
            color: 'var(--info-text)',
            marginBottom: '10px',
          }}
        >
          {t.badge}
        </span>

        <h1
          style={{
            fontSize: '34px',
            fontWeight: 800,
            lineHeight: 1.15,
            color: 'var(--text-1)',
            marginBottom: '8px',
          }}
        >
          {t.title}
        </h1>

        <p
          style={{
            fontSize: '16px',
            fontWeight: 500,
            color: 'var(--primary)',
            marginBottom: '18px',
            lineHeight: 1.4,
          }}
        >
          {t.subtitle}
        </p>

        <a
          href={wizardHref}
          style={{
            display: 'block',
            width: '100%',
            padding: '0',
            height: '56px',
            lineHeight: '56px',
            textAlign: 'center',
            borderRadius: '14px',
            fontSize: '17px',
            fontWeight: 800,
            color: '#fff',
            background: 'var(--success)',
            textDecoration: 'none',
            boxShadow: '0 3px 14px rgba(22,163,74,0.30)',
            letterSpacing: '0.01em',
            marginBottom: '10px',
          }}
        >
          {t.ctaMain}
        </a>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <a
            href={`/${locale}/services/tps-status`}
            style={{
              flex: 1,
              display: 'block',
              padding: '11px 8px',
              textAlign: 'center',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-1)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
              lineHeight: 1.3,
            }}
          >
            {t.ctaStatus}
          </a>
          <a
            href={`/${locale}/services/translate-document`}
            style={{
              flex: 1,
              display: 'block',
              padding: '11px 8px',
              textAlign: 'center',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-1)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
              lineHeight: 1.3,
            }}
          >
            {t.ctaTranslate}
          </a>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            justifyContent: 'center',
            marginBottom: '10px',
          }}
        >
          {t.trustPills.map((pill) => (
            <span
              key={pill}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--success-text, #166534)',
                background: 'var(--success-bg, #dcfce7)',
                padding: '3px 9px',
                borderRadius: '99px',
              }}
            >
              {pill}
            </span>
          ))}
        </div>

        <p
          style={{
            fontSize: '11px',
            color: 'var(--text-3)',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          {t.legalOne}
        </p>
      </section>

      {/* ── Trust cards 2×2 ──────────────────────────────────────── */}
      <section style={{ padding: '16px 20px 0' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
          }}
        >
          {t.trustCards.map((card) => (
            <div
              key={card.title}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '14px 12px',
              }}
            >
              <div style={{ fontSize: '22px', marginBottom: '6px', lineHeight: 1 }}>{card.icon}</div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '4px' }}>
                {card.title}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.4 }}>
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────── */}
      <section style={{ padding: '16px 20px 0' }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {t.howTitle}
            </p>
          </div>
          {t.howSteps.map((step, idx) => (
            <div
              key={step.num}
              style={{
                display: 'flex',
                gap: '12px',
                padding: '14px',
                borderBottom: idx < t.howSteps.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {step.num}
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '3px' }}>
                  {step.title}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.4 }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Price block ─────────────────────────────────────────── */}
      <section style={{ padding: '16px 20px 0' }}>
        <div
          style={{
            border: '1.5px solid var(--border-strong)',
            borderRadius: '14px',
            background: 'var(--surface)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '8px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {t.priceTitle}
            </p>
          </div>

          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '12px 14px 8px' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)' }}>{t.priceService}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>{t.priceServiceDesc}</p>
            </div>
            {(t.priceRows as ReadonlyArray<{ label: string; price: string; save?: string; highlight?: boolean }>).map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 14px',
                  background: row.highlight ? 'var(--success-bg, #dcfce7)' : 'transparent',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{row.label}</span>
                  {row.save && (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--success-text, #166534)', background: 'var(--success-bg, #dcfce7)', padding: '1px 6px', borderRadius: '99px' }}>
                      {row.save}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '16px', fontWeight: 800, color: row.highlight ? 'var(--success)' : 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                  {row.price}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)' }}>{t.priceUSCIS}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                {t.priceUSCISDesc}{' '}
                <a
                  href="https://www.uscis.gov/feecalculator"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', fontWeight: 600 }}
                >
                  {t.priceUSCISLink}
                </a>
              </p>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: '8px' }}>
              {t.priceUSCISVal}
            </span>
          </div>
        </div>
      </section>

      {/* ── Secondary entry cards ──────────────────────────────── */}
      <section style={{ padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {t.entries.map((entry) => (
            <a
              key={entry.key}
              href={getHref(entry.key, locale)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                borderRadius: '12px',
                padding: '14px 16px',
                textDecoration: 'none',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '24px', lineHeight: 1, flexShrink: 0 }}>{entry.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '2px' }}>
                  {entry.title}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.4 }}>
                  {entry.desc}
                </p>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                {entry.cta}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section style={{ padding: '16px 20px 0' }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {t.faqTitle}
            </p>
          </div>
          {t.faqs.map((faq, idx) => (
            <details
              key={faq.q}
              style={{
                borderBottom: idx < t.faqs.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <summary
                style={{
                  padding: '13px 14px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-1)',
                  cursor: 'pointer',
                  listStyle: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>{faq.q}</span>
                <span
                  style={{
                    fontSize: '18px',
                    color: 'var(--text-3)',
                    flexShrink: 0,
                    lineHeight: 1,
                    fontWeight: 300,
                  }}
                >
                  +
                </span>
              </summary>
              <p
                style={{
                  padding: '0 14px 14px',
                  fontSize: '13px',
                  color: 'var(--text-2)',
                  lineHeight: 1.55,
                  marginTop: '-2px',
                }}
              >
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <section style={{ padding: '16px 20px 0' }}>
        <p style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 }}>
          <a
            href="https://www.uscis.gov/humanitarian/temporary-protected-status/temporary-protected-status-designated-country-ukraine"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-3)' }}
          >
            {t.footer}
          </a>
        </p>
      </section>
    </main>
  )
}
