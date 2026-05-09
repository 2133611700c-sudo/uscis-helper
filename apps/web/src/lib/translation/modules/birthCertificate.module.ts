/**
 * Birth Certificate Module — Skeleton (DRAFT)
 * Messenginfo v6.0
 *
 * STATUS: draft — NOT for production use.
 * Auto-PDF is DISABLED. This module is a planning skeleton only.
 *
 * Prerequisites before activating:
 *   1. P001 passport pilot GO decision received
 *   2. At least 3 anonymized birth certificate samples (new format + Soviet-era + handwritten)
 *   3. civil_registry_glossary.json created
 *   4. certificate_number_not_act_record_number validator implemented
 *   5. self_cert_birth_v1.ts certification template approved
 *   6. Full test suite for field extraction and act-record vs certificate-number distinction
 *
 * Critical distinction:
 *   certificate_number (e.g. І-КВ 123456) ≠ act_record_number (e.g. 789)
 *   USCIS forms sometimes request the act record number specifically.
 *   Both must be extracted separately.
 */
import type { DocumentModule } from './types'

export const birthCertificateModule: DocumentModule = {
  documentType: 'ua_birth_certificate',

  displayName: {
    en: 'Ukrainian Birth Certificate',
    ru: 'Свидетельство о рождении (Украина)',
    uk: 'Свідоцтво про народження (Україна)',
  },

  status: 'draft',   // ← DRAFT: registry will route to manual review

  supportedLanguages: ['uk', 'ru'],

  criticalFields: [
    // 14 planned critical fields — NOT YET IMPLEMENTED
    {
      key: 'document_type',
      label: { en: 'Document Type', ru: 'Тип документа', uk: 'Тип документа' },
      required: true,
      valueType: 'text',
      sourceLabels: ['СВІДОЦТВО ПРО НАРОДЖЕННЯ', 'СВИДЕТЕЛЬСТВО О РОЖДЕНИИ'],
      validators: [],
      reviewRequired: true,
      evidenceRequired: 'required',
      fallbackIfMissing: 'review_required',
    },
    {
      key: 'certificate_series',
      label: { en: 'Certificate Series', ru: 'Серия свидетельства', uk: 'Серія свідоцтва' },
      required: true,
      valueType: 'series',
      sourceLabels: ['СЕРІЯ', 'СЕРIЯ'],
      validators: [],
      reviewRequired: true,
      evidenceRequired: 'required',
      fallbackIfMissing: 'review_required',
    },
    {
      key: 'certificate_number',
      label: { en: 'Certificate Number', ru: 'Номер свидетельства', uk: 'Номер свідоцтва' },
      required: true,
      valueType: 'number',
      sourceLabels: ['№', 'НОМЕР'],
      validators: ['certificate_number_not_act_record_number'],
      reviewRequired: true,
      evidenceRequired: 'required',
      fallbackIfMissing: 'review_required',
    },
    {
      key: 'act_record_number',
      label: {
        en: 'Act Record Number',
        ru: 'Номер актовой записи',
        uk: 'Номер актового запису',
      },
      required: true,
      valueType: 'number',
      sourceLabels: ['АКТОВИЙ ЗАПИС №', 'АКТОВАЯ ЗАПИСЬ №'],
      validators: ['certificate_number_not_act_record_number'],
      reviewRequired: true,
      evidenceRequired: 'preferred',
      fallbackIfMissing: 'review_required',
    },
    {
      key: 'act_record_date',
      label: { en: 'Act Record Date', ru: 'Дата актовой записи', uk: 'Дата актового запису' },
      required: true,
      valueType: 'date',
      sourceLabels: ['ДАТА СКЛАДАННЯ ЗАПИСУ', 'ДАТА СОСТАВЛЕНИЯ ЗАПИСИ'],
      validators: ['act_record_date_lock', 'month_map_uk_ru'],
      reviewRequired: true,
      evidenceRequired: 'required',
      fallbackIfMissing: 'review_required',
    },
    {
      key: 'child_surname',
      label: { en: "Child's Surname", ru: 'Фамилия ребёнка', uk: 'Прізвище дитини' },
      required: true,
      valueType: 'text',
      sourceLabels: ['ПРІЗВИЩЕ ДИТИНИ', 'ФАМИЛИЯ РЕБЕНКА'],
      validators: ['name_mixed_script'],
      reviewRequired: true,
      evidenceRequired: 'required',
      fallbackIfMissing: 'review_required',
    },
    {
      key: 'child_given_name',
      label: { en: "Child's Given Name", ru: 'Имя ребёнка', uk: "Ім'я дитини" },
      required: true,
      valueType: 'text',
      sourceLabels: ["ІМ'Я ДИТИНИ", 'ИМЯ РЕБЕНКА'],
      validators: ['name_mixed_script'],
      reviewRequired: true,
      evidenceRequired: 'required',
      fallbackIfMissing: 'review_required',
    },
    {
      key: 'child_patronymic',
      label: { en: "Child's Patronymic", ru: 'Отчество ребёнка', uk: 'По батькові дитини' },
      required: true,
      valueType: 'text',
      sourceLabels: ['ПО БАТЬКОВІ ДИТИНИ', 'ОТЧЕСТВО РЕБЕНКА'],
      validators: ['name_mixed_script'],
      reviewRequired: true,
      evidenceRequired: 'preferred',
      fallbackIfMissing: 'review_required',
    },
    {
      key: 'date_of_birth',
      label: { en: 'Date of Birth', ru: 'Дата рождения', uk: 'Дата народження' },
      required: true,
      valueType: 'date',
      sourceLabels: ['ДАТА НАРОДЖЕННЯ', 'ДАТА РОЖДЕНИЯ'],
      validators: ['date_of_birth_lock', 'month_map_uk_ru'],
      reviewRequired: true,
      evidenceRequired: 'required',
      fallbackIfMissing: 'review_required',
    },
    {
      key: 'place_of_birth',
      label: { en: 'Place of Birth', ru: 'Место рождения', uk: 'Місце народження' },
      required: true,
      valueType: 'multi_line',
      sourceLabels: ['МІСЦЕ НАРОДЖЕННЯ', 'МЕСТО РОЖДЕНИЯ'],
      validators: [],
      reviewRequired: true,
      evidenceRequired: 'required',
      fallbackIfMissing: 'review_required',
    },
    {
      key: 'father_full_name',
      label: { en: "Father's Full Name", ru: 'Полное имя отца', uk: 'Повне ім\'я батька' },
      required: true,
      valueType: 'text',
      sourceLabels: ["ІМ'Я ТА ПО БАТЬКОВІ БАТЬКА", 'ИМЯ И ОТЧЕСТВО ОТЦА'],
      validators: ['parent_name_nominative_case'],
      reviewRequired: true,
      evidenceRequired: 'required',
      fallbackIfMissing: 'review_required',
    },
    {
      key: 'mother_full_name',
      label: { en: "Mother's Full Name", ru: 'Полное имя матери', uk: 'Повне ім\'я матері' },
      required: true,
      valueType: 'text',
      sourceLabels: ["ІМ'Я ТА ПО БАТЬКОВІ МАТЕРІ", 'ИМЯ И ОТЧЕСТВО МАТЕРИ'],
      validators: ['parent_name_nominative_case'],
      reviewRequired: true,
      evidenceRequired: 'required',
      fallbackIfMissing: 'review_required',
    },
    {
      key: 'issuing_authority',
      label: { en: 'Issuing Authority', ru: 'Орган выдачи', uk: 'Орган видачі' },
      required: true,
      valueType: 'authority',
      sourceLabels: ['ОРГАН РЕЄСТРАЦІЇ', 'ОРГАН РЕГИСТРАЦИИ', 'ВІДДІЛ РАЦС', 'ЗАГС'],
      validators: ['civil_registry_glossary'],
      reviewRequired: true,
      evidenceRequired: 'required',
      fallbackIfMissing: 'review_required',
    },
    {
      key: 'date_of_issue',
      label: { en: 'Date of Issue', ru: 'Дата выдачи', uk: 'Дата видачі' },
      required: true,
      valueType: 'date',
      sourceLabels: ['ДАТА ВИДАЧІ', 'ДАТА ВЫДАЧИ'],
      validators: ['month_map_uk_ru'],
      reviewRequired: true,
      evidenceRequired: 'required',
      fallbackIfMissing: 'review_required',
    },
  ],

  optionalFields: [],

  expectedLabels: {
    'СВІДОЦТВО ПРО НАРОДЖЕННЯ': ['document_type'],
    'СВИДЕТЕЛЬСТВО О РОЖДЕНИИ': ['document_type'],
    'СЕРІЯ': ['certificate_series'],
    'АКТОВИЙ ЗАПИС №': ['act_record_number'],
    'ДАТА НАРОДЖЕННЯ': ['date_of_birth'],
    'МІСЦЕ НАРОДЖЕННЯ': ['place_of_birth'],
    'ОРГАН РЕЄСТРАЦІЇ': ['issuing_authority'],
  },

  glossaryModules: ['civil_registry_glossary'],   // not yet implemented

  validators: [
    'certificate_number_not_act_record_number',
    'parent_name_nominative_case',
    'civil_registry_glossary',
    'act_record_date_lock',
    'date_of_birth_lock',
    'month_map_uk_ru',
    'name_mixed_script',
    'source_evidence_required',
  ],

  extraction: {
    ocrProvider: 'manual',   // draft — not wired to Google Vision yet
    fieldMapper: 'manual',
    glossaryFiles: [],
    fieldTargets: [],
    timeoutMs: 0,
  },

  render: {
    templateId: 'birth_certificate_v1',   // not yet implemented
    renderFields: [],
    certificationTemplate: 'self_cert_birth_v1',  // not yet implemented
    twoPageLayout: true,
  },

  reviewPolicy: {
    requireUserConfirmation: true,
    requireEvidenceForCriticalFields: true,
    allowAutoPdf: false,           // NEVER until module is promoted to 'active'
    manualReviewIfMissingCritical: true,
    manualReviewIfLowConfidence: true,
    manualReviewIfUnsupportedLayout: true,
    lowConfidenceThreshold: 0.85,
  },

  unsupportedConditions: [
    {
      code: 'module_is_draft',
      description: 'Birth certificate module is not yet active',
      action: 'route_to_manual_review',
    },
    {
      code: 'act_record_number_ambiguous',
      description: 'Act record number and certificate number cannot be distinguished',
      action: 'route_to_manual_review',
    },
    {
      code: 'soviet_era_handwriting',
      description: 'Soviet-era birth certificate with handwritten fields',
      action: 'route_to_manual_review',
    },
  ],

  userStatusMessage:
    'Birth certificate translation is in preparation. Your document needs manual review at this time.',
}
