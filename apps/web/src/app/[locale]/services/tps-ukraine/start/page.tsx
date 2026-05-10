/**
 * /[locale]/services/tps-ukraine/start
 *
 * TPS Ukraine guided preparation page.
 *
 * This is a static, server-rendered guided page (not the full wizard
 * yet). It walks the user through every section they need before going
 * to USCIS, in plain language: situation check, EAD/work permit choice,
 * fee waiver (I-912) path, identity & arrival, continuous-residence
 * evidence, criminal-ineligibility warning, evidence checklist, and a
 * transfer guide that tells the user exactly which USCIS form section
 * each answer belongs to.
 *
 * No payment is taken here. No filing happens here.
 *
 * VERIFIED 2026-05-10:
 *   - TPS Ukraine extension: Apr 20, 2025 – Oct 19, 2026 (FR 2025-00771)
 *   - Re-registration window: Jan 17 – Mar 18, 2025
 *   - Auto-EAD extension: through Apr 19, 2026 (specific Card Expires dates)
 *   - Forms: I-821 (TPS), I-765 (EAD), I-912 (fee waiver, paper only),
 *            I-131 (advance parole, optional travel)
 */

import type { Metadata } from 'next'

interface Props {
  params: Promise<{ locale: string }>
}

const T = {
  uk: {
    metaTitle: 'TPS Україна — підготовка пакета | Messenginfo',
    metaDesc: 'Покрокова підготовка пакета TPS Ukraine: situation router, форми I-821/I-765/I-912, чек-лист доказів, інструкція що куди вписати в USCIS. Ви подаєте самі.',
    badge: 'Підготовка TPS',
    title: 'Підготовка пакета TPS Україна',
    intro: 'Дайте відповіді на питання нижче — ми зберемо для вас чек-лист доказів та інструкцію, що саме вписати у форми USCIS. Подача завжди ваша.',
    backTitle: '← Назад до TPS',
    sections: [
      {
        h: '1. Це початкова заявка чи re-registration?',
        body: 'Якщо ви вперше подаєте на TPS — це initial application. Якщо у вас вже був TPS і ви хочете зберегти статус — це re-registration. Поточне вікно re-registration: 17 січня — 18 березня 2025 р. (для продовження до 19 жовтня 2026 р.). Точні актуальні дати — на сторінці USCIS TPS Ukraine.',
        cta: { label: 'Сторінка USCIS TPS Ukraine →', href: 'https://www.uscis.gov/humanitarian/temporary-protected-status/temporary-protected-status-designated-country-ukraine' },
      },
      {
        h: '2. Чи потрібний дозвіл на роботу (EAD)?',
        body: 'EAD — це окрема форма I-765, її подають разом з I-821 або після. Деякі вже видані TPS-EAD автоматично продовжені до 19 квітня 2026 р. — перевірте дату Card Expires на вашій картці на сторінці USCIS.',
        cta: { label: 'Form I-765 (EAD) на USCIS →', href: 'https://www.uscis.gov/i-765' },
      },
      {
        h: '3. Чи потрібен fee waiver (I-912)?',
        body: 'Form I-912 — це запит на звільнення від держмита USCIS. Подається ЛИШЕ з паперовою заявою (не онлайн). Не всі підходять — критерії на uscis.gov/i-912. Якщо ви не потребуєте fee waiver, можна подавати онлайн через my.uscis.gov.',
        cta: { label: 'Form I-912 на USCIS →', href: 'https://www.uscis.gov/i-912' },
      },
      {
        h: '4. Особа та дата прибуття в США',
        body: 'Підготуйте паспорт, I-94 (історія в’їздів — i94.cbp.dhs.gov), будь-які попередні USCIS-документи (EAD, попередній I-821 / I-797). Дата вашого прибуття в США потрібна для розділу about continuous residence.',
        cta: { label: 'Перевірити I-94 →', href: 'https://i94.cbp.dhs.gov/' },
      },
      {
        h: '5. Continuous residence — докази',
        body: 'TPS вимагає підтвердження того, що ви безперервно перебували в США від встановленої дати. Це можуть бути: рахунки за оренду/комунальні, банківські виписки, медичні документи, шкільні записи, документи від роботодавця. Збирайте чим більше тим краще — мінімум на кожен квартал.',
        cta: { label: 'USCIS-роз’яснення TPS →', href: 'https://www.uscis.gov/humanitarian/temporary-protected-status' },
      },
      {
        h: '6. Кримінальна історія (попередження простою мовою)',
        body: 'Деякі кримінальні засудження можуть позбавити права на TPS. Якщо у вас є будь-які кримінальні справи у США або за кордоном — НЕ заповнюйте форму самостійно. Зверніться до ліцензованого імміграційного адвоката. Ми не можемо консультувати з юридичних питань.',
        cta: { label: 'Знайти адвоката (USCIS) →', href: 'https://www.uscis.gov/avoid-scams/find-legal-services' },
      },
      {
        h: '7. Чек-лист документів',
        body: 'Стандартний пакет TPS Ukraine: паспорт (копія), фото на формат паспорта (для EAD), I-94, докази continuous residence, докази continuous physical presence (CPP) з 16 серпня 2023 р., будь-які попередні USCIS-документи, поштовий конверт чи інструкція для онлайн-подачі.',
        cta: { label: 'Що треба USCIS (загальна сторінка TPS) →', href: 'https://www.uscis.gov/humanitarian/temporary-protected-status' },
      },
      {
        h: '8. Що куди вписати в USCIS-форму (transfer guide)',
        body: 'Form I-821: Part 1 — ваші особисті дані; Part 2 — країна (Ukraine); Part 3 — eligibility (initial / re-registration); Part 4 — про в’їзди та фізичну присутність; Part 5 — про останні поїздки. Form I-765: Eligibility category — (c)(19) для TPS-pending, (a)(12) для TPS-granted. Точні поля та інструкції — на сторінці кожної форми на USCIS.',
        cta: { label: 'Form I-821 (TPS) на USCIS →', href: 'https://www.uscis.gov/i-821' },
      },
      {
        h: '9. Подача через my.uscis.gov',
        body: 'TPS Ukraine з I-765 можна подати онлайн через my.uscis.gov. Якщо вам потрібен fee waiver — тільки папером. Зберігайте ваш receipt-number (IOE/WAC/LIN) — за ним перевіряється статус справи.',
        cta: { label: 'Перейти на my.uscis.gov →', href: 'https://my.uscis.gov/' },
      },
      {
        h: '10. Коли звернутися по допомогу',
        body: 'Звертайтесь до ліцензованого імміграційного адвоката, якщо: у вас є кримінальні питання, попередні відмови USCIS, складна історія в’їздів/виїздів, або ви не впевнені у відповідях. Messenginfo не подає від вашого імені і не є юридичною фірмою.',
        cta: { label: 'Знайти legal services через USCIS →', href: 'https://www.uscis.gov/avoid-scams/find-legal-services' },
      },
    ],
    disclaimer: 'Messenginfo не подає документи за вас. Ми не є юридичною фірмою. USCIS може запросити додаткові докази або відмовити. Перевіряйте офіційні дати на сторінці USCIS TPS Ukraine.',
    sourcesCta: 'Усі офіційні посилання →',
  },
  ru: {
    metaTitle: 'TPS Украина — подготовка пакета | Messenginfo',
    metaDesc: 'Пошаговая подготовка пакета TPS Ukraine: situation router, формы I-821/I-765/I-912, чек-лист доказательств, инструкция что куда вписать в USCIS. Подаёте сами.',
    badge: 'Подготовка TPS',
    title: 'Подготовка пакета TPS Украина',
    intro: 'Ответьте на вопросы ниже — мы соберём для вас чек-лист доказательств и инструкцию что именно вписывать в формы USCIS. Подача всегда ваша.',
    backTitle: '← Назад к TPS',
    sections: [
      {
        h: '1. Это первичная заявка или re-registration?',
        body: 'Если подаёте на TPS впервые — это initial application. Если у вас уже был TPS и хотите сохранить статус — это re-registration. Текущее окно re-registration: 17 января — 18 марта 2025 г. (для продления до 19 октября 2026 г.). Актуальные точные даты — на странице USCIS TPS Ukraine.',
        cta: { label: 'Страница USCIS TPS Ukraine →', href: 'https://www.uscis.gov/humanitarian/temporary-protected-status/temporary-protected-status-designated-country-ukraine' },
      },
      {
        h: '2. Нужно ли разрешение на работу (EAD)?',
        body: 'EAD — это отдельная форма I-765, подаётся вместе с I-821 или после. Некоторые ранее выданные TPS-EAD автоматически продлены до 19 апреля 2026 г. — проверьте Card Expires на вашей карточке на странице USCIS.',
        cta: { label: 'Form I-765 (EAD) на USCIS →', href: 'https://www.uscis.gov/i-765' },
      },
      {
        h: '3. Нужен ли fee waiver (I-912)?',
        body: 'Form I-912 — запрос на освобождение от госпошлины USCIS. Подаётся ТОЛЬКО с бумажной заявкой (не онлайн). Не все подходят — критерии на uscis.gov/i-912. Если fee waiver не нужен — можно подавать онлайн через my.uscis.gov.',
        cta: { label: 'Form I-912 на USCIS →', href: 'https://www.uscis.gov/i-912' },
      },
      {
        h: '4. Личность и дата прибытия в США',
        body: 'Подготовьте паспорт, I-94 (история въездов — i94.cbp.dhs.gov), любые предыдущие USCIS-документы (EAD, предыдущий I-821 / I-797). Дата прибытия в США нужна для раздела о continuous residence.',
        cta: { label: 'Проверить I-94 →', href: 'https://i94.cbp.dhs.gov/' },
      },
      {
        h: '5. Continuous residence — доказательства',
        body: 'TPS требует подтверждения непрерывного проживания в США с установленной даты. Подходят: счета за аренду/коммуналку, банковские выписки, медицинские документы, школьные записи, документы от работодателя. Собирайте чем больше, тем лучше — минимум на каждый квартал.',
        cta: { label: 'USCIS-разъяснение TPS →', href: 'https://www.uscis.gov/humanitarian/temporary-protected-status' },
      },
      {
        h: '6. Уголовная история (предупреждение простыми словами)',
        body: 'Некоторые уголовные обвинения могут лишить права на TPS. Если у вас есть любые уголовные дела в США или за рубежом — НЕ заполняйте форму сами. Обратитесь к лицензированному иммиграционному адвокату. Мы не консультируем по юридическим вопросам.',
        cta: { label: 'Найти адвоката (USCIS) →', href: 'https://www.uscis.gov/avoid-scams/find-legal-services' },
      },
      {
        h: '7. Чек-лист документов',
        body: 'Стандартный пакет TPS Ukraine: паспорт (копия), фото для EAD, I-94, доказательства continuous residence, доказательства continuous physical presence (CPP) с 16 августа 2023 г., предыдущие USCIS-документы, конверт почтовый или инструкция для онлайн-подачи.',
        cta: { label: 'Что нужно USCIS (общая страница TPS) →', href: 'https://www.uscis.gov/humanitarian/temporary-protected-status' },
      },
      {
        h: '8. Что куда вписать в USCIS-форму (transfer guide)',
        body: 'Form I-821: Part 1 — личные данные; Part 2 — страна (Ukraine); Part 3 — eligibility (initial / re-registration); Part 4 — въезды и физическое присутствие; Part 5 — последние поездки. Form I-765: Eligibility category — (c)(19) для TPS-pending, (a)(12) для TPS-granted. Точные поля и инструкции — на странице каждой формы на USCIS.',
        cta: { label: 'Form I-821 (TPS) на USCIS →', href: 'https://www.uscis.gov/i-821' },
      },
      {
        h: '9. Подача через my.uscis.gov',
        body: 'TPS Ukraine с I-765 можно подать онлайн через my.uscis.gov. Если нужен fee waiver — только бумагой. Сохраните ваш receipt-number (IOE/WAC/LIN) — по нему проверяется статус дела.',
        cta: { label: 'Перейти на my.uscis.gov →', href: 'https://my.uscis.gov/' },
      },
      {
        h: '10. Когда обращаться за помощью',
        body: 'Обращайтесь к лицензированному иммиграционному адвокату, если: есть уголовные вопросы, предыдущие отказы USCIS, сложная история въездов/выездов, или вы не уверены в ответах. Messenginfo не подаёт от вашего имени и не является юридической фирмой.',
        cta: { label: 'Найти legal services через USCIS →', href: 'https://www.uscis.gov/avoid-scams/find-legal-services' },
      },
    ],
    disclaimer: 'Messenginfo не подаёт документы за вас. Мы не юридическая фирма. USCIS может запросить дополнительные доказательства или отказать. Проверяйте официальные даты на странице USCIS TPS Ukraine.',
    sourcesCta: 'Все официальные ссылки →',
  },
  en: {
    metaTitle: 'TPS Ukraine — packet preparation | Messenginfo',
    metaDesc: 'Step-by-step TPS Ukraine packet preparation: situation router, Forms I-821/I-765/I-912, evidence checklist, USCIS transfer guide. You file yourself.',
    badge: 'TPS preparation',
    title: 'TPS Ukraine packet preparation',
    intro: 'Answer the questions below — we will assemble an evidence checklist and a guide for exactly what to enter into the USCIS forms. You always file yourself.',
    backTitle: '← Back to TPS',
    sections: [
      {
        h: '1. Initial application or re-registration?',
        body: 'If you are filing for TPS for the first time — this is an initial application. If you already have TPS and want to keep it — this is a re-registration. The current re-registration window: Jan 17 – Mar 18, 2025 (for the extension through Oct 19, 2026). Confirm the latest dates on the USCIS TPS Ukraine page.',
        cta: { label: 'USCIS TPS Ukraine page →', href: 'https://www.uscis.gov/humanitarian/temporary-protected-status/temporary-protected-status-designated-country-ukraine' },
      },
      {
        h: '2. Do you need a work permit (EAD)?',
        body: 'EAD is a separate Form I-765, filed together with I-821 or after. Some previously issued TPS EADs are automatically extended through Apr 19, 2026 — check the Card Expires date on your card and on the USCIS page.',
        cta: { label: 'Form I-765 (EAD) at USCIS →', href: 'https://www.uscis.gov/i-765' },
      },
      {
        h: '3. Do you need a fee waiver (I-912)?',
        body: 'Form I-912 is a request to waive USCIS fees. It can ONLY be filed with a paper application (not online). Not everyone qualifies — see criteria at uscis.gov/i-912. If you do not need a fee waiver, you can file online via my.uscis.gov.',
        cta: { label: 'Form I-912 at USCIS →', href: 'https://www.uscis.gov/i-912' },
      },
      {
        h: '4. Identity and arrival date in the US',
        body: 'Prepare your passport, I-94 (travel history — i94.cbp.dhs.gov), any prior USCIS documents (EAD, previous I-821 / I-797). Your US arrival date is needed for the continuous-residence section.',
        cta: { label: 'Check I-94 →', href: 'https://i94.cbp.dhs.gov/' },
      },
      {
        h: '5. Continuous residence — evidence',
        body: 'TPS requires evidence that you have continuously resided in the US since the qualifying date. Acceptable evidence includes: rent/utility bills, bank statements, medical records, school records, employer letters. Collect as much as you can — at minimum one per quarter.',
        cta: { label: 'USCIS TPS overview →', href: 'https://www.uscis.gov/humanitarian/temporary-protected-status' },
      },
      {
        h: '6. Criminal history (plain-language warning)',
        body: 'Some criminal convictions can make you ineligible for TPS. If you have any criminal case in the US or abroad — DO NOT fill out the form yourself. Consult a licensed immigration attorney. We cannot give legal advice.',
        cta: { label: 'Find legal services (USCIS) →', href: 'https://www.uscis.gov/avoid-scams/find-legal-services' },
      },
      {
        h: '7. Document checklist',
        body: 'Standard TPS Ukraine packet: passport (copy), passport-style photo (for EAD), I-94, continuous-residence evidence, continuous physical presence (CPP) evidence from Aug 16, 2023, any prior USCIS documents, mailing envelope or online filing instructions.',
        cta: { label: 'What USCIS needs (TPS overview) →', href: 'https://www.uscis.gov/humanitarian/temporary-protected-status' },
      },
      {
        h: '8. Transfer guide — what goes where in the USCIS form',
        body: 'Form I-821: Part 1 — your personal data; Part 2 — country (Ukraine); Part 3 — eligibility (initial / re-registration); Part 4 — entries and physical presence; Part 5 — recent travel. Form I-765: Eligibility category — (c)(19) for TPS-pending, (a)(12) for TPS-granted. Exact fields and instructions — on each form page at USCIS.',
        cta: { label: 'Form I-821 (TPS) at USCIS →', href: 'https://www.uscis.gov/i-821' },
      },
      {
        h: '9. Filing through my.uscis.gov',
        body: 'TPS Ukraine with I-765 can be filed online through my.uscis.gov. If you need a fee waiver — paper only. Save your receipt number (IOE/WAC/LIN) — it is what you use to check case status.',
        cta: { label: 'Go to my.uscis.gov →', href: 'https://my.uscis.gov/' },
      },
      {
        h: '10. When to ask for help',
        body: 'Consult a licensed immigration attorney if you have criminal questions, prior USCIS denials, complex entry/exit history, or are unsure about answers. Messenginfo does not file on your behalf and is not a law firm.',
        cta: { label: 'Find legal services via USCIS →', href: 'https://www.uscis.gov/avoid-scams/find-legal-services' },
      },
    ],
    disclaimer: 'Messenginfo does not file documents for you. We are not a law firm. USCIS may request more evidence or deny the application. Verify the latest dates on the USCIS TPS Ukraine page.',
    sourcesCta: 'All official links →',
  },
  es: {
    metaTitle: 'TPS Ucrania — preparación del paquete | Messenginfo',
    metaDesc: 'Preparación paso a paso del paquete TPS Ucrania: situation router, Forms I-821/I-765/I-912, lista de evidencias, guía de transferencia USCIS. Usted presenta.',
    badge: 'Preparación TPS',
    title: 'Preparación del paquete TPS Ucrania',
    intro: 'Responda las preguntas a continuación — armaremos una lista de evidencias y una guía con qué poner exactamente en los formularios de USCIS. Usted siempre presenta.',
    backTitle: '← Volver a TPS',
    sections: [
      {
        h: '1. ¿Solicitud inicial o re-registración?',
        body: 'Si presenta TPS por primera vez — es una solicitud inicial. Si ya tiene TPS y quiere mantenerlo — es re-registración. Ventana actual de re-registración: 17 enero – 18 marzo 2025 (para la extensión hasta el 19 octubre 2026). Confirme las fechas más recientes en la página USCIS TPS Ukraine.',
        cta: { label: 'Página USCIS TPS Ukraine →', href: 'https://www.uscis.gov/humanitarian/temporary-protected-status/temporary-protected-status-designated-country-ukraine' },
      },
      {
        h: '2. ¿Necesita permiso de trabajo (EAD)?',
        body: 'EAD es un Form I-765 separado, se presenta junto con I-821 o después. Algunos EAD TPS emitidos antes fueron extendidos automáticamente hasta el 19 abril 2026 — verifique la fecha Card Expires en su tarjeta y en la página de USCIS.',
        cta: { label: 'Form I-765 (EAD) en USCIS →', href: 'https://www.uscis.gov/i-765' },
      },
      {
        h: '3. ¿Necesita fee waiver (I-912)?',
        body: 'Form I-912 es una solicitud para eximir tarifas de USCIS. SOLO se puede presentar con solicitud en papel (no en línea). No todos califican — criterios en uscis.gov/i-912. Si no necesita fee waiver, puede presentar en línea por my.uscis.gov.',
        cta: { label: 'Form I-912 en USCIS →', href: 'https://www.uscis.gov/i-912' },
      },
      {
        h: '4. Identidad y fecha de llegada a EE. UU.',
        body: 'Prepare su pasaporte, I-94 (historial de viajes — i94.cbp.dhs.gov), cualquier documento previo de USCIS (EAD, I-821 / I-797 anteriores). La fecha de llegada a EE. UU. se necesita para la sección de continuous residence.',
        cta: { label: 'Verificar I-94 →', href: 'https://i94.cbp.dhs.gov/' },
      },
      {
        h: '5. Continuous residence — evidencias',
        body: 'TPS requiere evidencia de residencia continua en EE. UU. desde la fecha calificada. Sirven: facturas de alquiler/servicios, estados bancarios, registros médicos, registros escolares, cartas de empleador. Recopile lo más posible — al menos una por trimestre.',
        cta: { label: 'Resumen TPS de USCIS →', href: 'https://www.uscis.gov/humanitarian/temporary-protected-status' },
      },
      {
        h: '6. Historial criminal (advertencia en lenguaje sencillo)',
        body: 'Algunas condenas criminales pueden descalificarle para TPS. Si tiene cualquier caso criminal en EE. UU. o en el extranjero — NO complete el formulario por su cuenta. Consulte a un abogado de inmigración con licencia. No podemos dar asesoramiento legal.',
        cta: { label: 'Encontrar servicios legales (USCIS) →', href: 'https://www.uscis.gov/avoid-scams/find-legal-services' },
      },
      {
        h: '7. Lista de documentos',
        body: 'Paquete estándar TPS Ucrania: pasaporte (copia), foto tipo pasaporte (para EAD), I-94, evidencia de continuous residence, evidencia de continuous physical presence (CPP) desde el 16 agosto 2023, documentos previos de USCIS, sobre postal o instrucciones para presentación en línea.',
        cta: { label: 'Qué necesita USCIS (TPS overview) →', href: 'https://www.uscis.gov/humanitarian/temporary-protected-status' },
      },
      {
        h: '8. Guía de transferencia — qué va dónde en el formulario USCIS',
        body: 'Form I-821: Part 1 — datos personales; Part 2 — país (Ucrania); Part 3 — eligibility (inicial / re-registración); Part 4 — entradas y presencia física; Part 5 — viajes recientes. Form I-765: Eligibility category — (c)(19) para TPS-pendiente, (a)(12) para TPS-aprobado. Campos exactos e instrucciones — en la página de cada formulario en USCIS.',
        cta: { label: 'Form I-821 (TPS) en USCIS →', href: 'https://www.uscis.gov/i-821' },
      },
      {
        h: '9. Presentación por my.uscis.gov',
        body: 'TPS Ucrania con I-765 puede presentarse en línea por my.uscis.gov. Si necesita fee waiver — solo en papel. Guarde su número de recibo (IOE/WAC/LIN) — con él se verifica el estado del caso.',
        cta: { label: 'Ir a my.uscis.gov →', href: 'https://my.uscis.gov/' },
      },
      {
        h: '10. Cuándo pedir ayuda',
        body: 'Consulte a un abogado de inmigración con licencia si: tiene asuntos criminales, denegaciones previas de USCIS, historial complejo de entradas/salidas, o no está seguro de las respuestas. Messenginfo no presenta en su nombre y no es un bufete.',
        cta: { label: 'Encontrar servicios legales por USCIS →', href: 'https://www.uscis.gov/avoid-scams/find-legal-services' },
      },
    ],
    disclaimer: 'Messenginfo no presenta documentos por usted. No somos un bufete. USCIS puede solicitar más evidencias o denegar la solicitud. Verifique las fechas más recientes en la página USCIS TPS Ukraine.',
    sourcesCta: 'Todos los enlaces oficiales →',
  },
} as const

type Locale = keyof typeof T

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = T[(locale as Locale)] ?? T.en
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    metadataBase: new URL('https://messenginfo.com'),
    robots: { index: false, follow: false },
    alternates: {
      canonical: `https://messenginfo.com/${locale}/services/tps-ukraine/start`,
    },
  }
}

export default async function TpsUkraineStartPage({ params }: Props) {
  const { locale } = await params
  const t = T[(locale as Locale)] ?? T.en
  const backHref = `/${locale}/services/tps-ukraine`
  const sourcesHref = `/${locale}/services/tps-ukraine/sources`

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--background)', padding: '0 0 48px' }}>
      <section style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 20px 18px' }}>
        <a
          href={backHref}
          style={{ fontSize: '13px', color: 'var(--text-3)', textDecoration: 'none', display: 'inline-block', marginBottom: '12px' }}
        >
          {t.backTitle}
        </a>
        <span
          style={{
            display: 'inline-block',
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '99px',
            background: 'var(--info-bg)',
            color: 'var(--info-text)',
            marginBottom: '8px',
          }}
        >
          {t.badge}
        </span>
        <h1 style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.2, color: 'var(--text-1)', marginBottom: '8px' }}>
          {t.title}
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-2)', lineHeight: 1.5 }}>{t.intro}</p>
      </section>

      <section style={{ padding: '14px 20px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {t.sections.map((s) => (
          <div
            key={s.h}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '16px 16px 14px',
            }}
          >
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '6px', lineHeight: 1.3 }}>
              {s.h}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.55, marginBottom: '10px' }}>
              {s.body}
            </p>
            <a
              href={s.cta.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--primary)',
                textDecoration: 'none',
              }}
            >
              {s.cta.label}
            </a>
          </div>
        ))}
      </section>

      <section style={{ padding: '14px 20px 0' }}>
        <a
          href={sourcesHref}
          style={{
            display: 'block',
            padding: '14px 16px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--primary)',
            textDecoration: 'none',
            textAlign: 'center',
          }}
        >
          {t.sourcesCta}
        </a>
      </section>

      <section style={{ padding: '14px 20px 0' }}>
        <p style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 }}>
          {t.disclaimer}
        </p>
      </section>
    </main>
  )
}
