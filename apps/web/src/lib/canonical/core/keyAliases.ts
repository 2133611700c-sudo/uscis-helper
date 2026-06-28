/**
 * keyAliases — ONE declarative registry of equivalent field keys. Phase 1 single-
 * sources the alias knowledge that today is copy-pasted across reParoleAdapter and
 * eadAdapter (mapFieldWithAliases). PURELY MECHANICAL: a primary canonical key with
 * a list of synonym keys that mean the SAME extracted fact. No normalization, no
 * value transformation, no inference — only "these keys are the same field".
 *
 * One primary key is canonical; the rest are accepted aliases when reading.
 *
 * LEGACY COMPATIBILITY ADAPTER (kept verbatim). When UNIFIED_DOC_CONTRACT_ENABLED=1
 * this table is MERGED with the unified-contract contribution via resolveKeyAliases;
 * the contribution is a subset, so behaviour is unchanged (Phase-3 parity tests).
 */
import { birthCertContractKeyAliases, isUnifiedDocContractEnabled } from '@/lib/contracts/birthCertSovietV1Contract'

export const KEY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  // ── required initial set (owner contract) ──
  date_of_birth: ['dob'],
  middle_name: ['patronymic', 'middle_name_cyrillic'],
  passport_expiration_date: ['date_of_expiry', 'expiry_date', 'passport_expiry'],
  a_number: ['alien_registration_number', 'alien_number'],

  // ── mechanical equivalents already used by the existing adapters ──
  country_of_birth: ['place_of_birth', 'country_of_issuance'],
  country_of_nationality: ['nationality', 'citizenship'],
  i94_admission_number: ['admission_number'],
  i94_class_of_admission: ['class_of_admission'],
  i94_date_of_entry: ['date_of_last_entry', 'last_entry_date', 'last_entry'],
  uscis_number: ['uscis_online_account', 'uscis_online_account_number', 'uscis_account_number'],
  family_name: ['family_name_latin'],
  given_name: ['given_name_latin'],
} as const

/**
 * Resolve the active alias table. Flag OFF → the legacy literal KEY_ALIASES,
 * returned by reference (identical behaviour). Flag ON → the legacy table merged
 * with the unified-contract contribution (birth-cert synonyms, e.g.
 * date_of_birth→['dob']). The contribution is a subset of the legacy table, so
 * the merged result is content-equal to legacy (Phase-3 parity tests).
 */
export function resolveKeyAliases(
  env: Record<string, string | undefined> = process.env,
): Readonly<Record<string, readonly string[]>> {
  if (!isUnifiedDocContractEnabled(env)) return KEY_ALIASES
  const merged: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(KEY_ALIASES)) merged[k] = [...v]
  for (const [k, v] of Object.entries(birthCertContractKeyAliases())) {
    merged[k] = [...new Set([...(merged[k] ?? []), ...v])]
  }
  return merged
}

/** All keys (primary + aliases) that resolve to the given primary key, primary first. */
export function keysFor(primary: string, env: Record<string, string | undefined> = process.env): string[] {
  const aliases = resolveKeyAliases(env)[primary] ?? []
  return [primary, ...aliases]
}

/** Reverse lookup: the primary canonical key a given key belongs to (itself if none). */
export function primaryKeyOf(key: string, env: Record<string, string | undefined> = process.env): string {
  const table = resolveKeyAliases(env)
  if (table[key]) return key
  for (const [primary, aliases] of Object.entries(table)) {
    if (aliases.includes(key)) return primary
  }
  return key
}
