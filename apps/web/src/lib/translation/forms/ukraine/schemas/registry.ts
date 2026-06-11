/**
 * Official UA schema registry — the single docType → OfficialFormSchema lookup.
 *
 * Until now the schemas existed as separate files with NO index, so nothing could
 * resolve "given this docType, what is its official mirror structure?". This is the
 * missing brick that lets the live translation flow render a faithful English
 * MIRROR of the Ukrainian document (per its normative source) instead of a generic
 * field table. Each schema already carries its officialSource (KMU act) — no
 * schema, no mirror.
 */
import type { OfficialFormSchema } from './types'
import { birthCertificateSchema } from './birth-certificate.schema'
import { marriageCertificateSchema } from './marriage-certificate.schema'
import { divorceCertificateSchema } from './divorce-certificate.schema'
import { deathCertificateSchema } from './death-certificate.schema'
import { militaryIdSchema } from './military-id.schema'
import { nameChangeCertificateSchema } from './name-change-certificate.schema'
import { internalPassportSchema } from './internal-passport.schema'
import { internationalPassportSchema } from './international-passport.schema'
import { idCardSchema } from './id-card.schema'

const OFFICIAL_SCHEMAS: Record<string, OfficialFormSchema> = {
  ua_birth_certificate: birthCertificateSchema,
  ua_marriage_certificate: marriageCertificateSchema,
  ua_divorce_certificate: divorceCertificateSchema,
  ua_death_certificate: deathCertificateSchema,
  ua_name_change_certificate: nameChangeCertificateSchema,
  ua_military_id: militaryIdSchema,
}

// ── STAGED passport schemas (Migration Plan step A) ─────────────────────────
// Resolving one of these IS the live switch of the customer PDF for that
// docType (generate-pdf: hasOfficialSchema → mirror). They activate ONLY behind
// PASSPORT_SCHEMA_RENDERER_ENABLED — flag absent/OFF ⇒ byte-identical prod.
// The flag is read PER CALL (not at module load) so a Vercel env change takes
// effect on redeploy and test env-stubs work without module re-import.
const STAGED_PASSPORT_SCHEMAS: Record<string, OfficialFormSchema> = {
  ua_internal_passport_booklet: internalPassportSchema,
  ua_international_passport: internationalPassportSchema,
  ua_id_card: idCardSchema,
}

function passportRendererEnabled(): boolean {
  return process.env.PASSPORT_SCHEMA_RENDERER_ENABLED === '1'
}

/** Resolve the official mirror schema for a docType, or null if none exists. */
export function getOfficialSchema(docType: string | null | undefined): OfficialFormSchema | null {
  if (!docType) return null
  const base = OFFICIAL_SCHEMAS[docType]
  if (base) return base
  if (passportRendererEnabled()) return STAGED_PASSPORT_SCHEMAS[docType] ?? null
  return null
}

/** True when a faithful mirror PDF can be rendered for this docType. */
export function hasOfficialSchema(docType: string | null | undefined): boolean {
  return getOfficialSchema(docType) !== null
}

/** All docTypes that have an official mirror schema (for diagnostics/tests). */
export function officialSchemaDocTypes(): string[] {
  return passportRendererEnabled()
    ? [...Object.keys(OFFICIAL_SCHEMAS), ...Object.keys(STAGED_PASSPORT_SCHEMAS)]
    : Object.keys(OFFICIAL_SCHEMAS)
}
