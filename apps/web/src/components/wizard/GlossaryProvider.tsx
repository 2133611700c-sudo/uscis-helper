/**
 * Glossary of USCIS / immigration terms used in the Re-Parole U4U wizard.
 *
 * Import GLOSSARY directly wherever you need a definition.
 * GlossaryProvider is a no-op wrapper kept for future context expansion.
 */

export const GLOSSARY: Record<string, string> = {
  Parole:
    'A temporary permission to enter or remain in the US granted by DHS. Not the same as a visa or lawful permanent residence.',
  'Re-Parole':
    'An extension of a previous grant of parole. Must be applied for before the current parole expires.',
  'I-131':
    'Application for Travel Document — the USCIS form used for re-parole, advance parole, and refugee travel documents.',
  EAD: 'Employment Authorization Document — a "work permit" that allows non-citizens to legally work in the US.',
  U4U: 'Uniting for Ukraine — a DHS program allowing Ukrainian nationals to come to the US under parole.',
  Biometrics:
    'Fingerprints and photo collected by USCIS at an Application Support Center (ASC). Most U4U re-parole applicants are exempt.',
  USCIS:
    'U.S. Citizenship and Immigration Services — the federal agency that administers immigration benefits.',
  Lockbox:
    'A USCIS processing facility that receives paper filings. U4U I-131 goes to the Chicago Lockbox.',
  'Receipt Notice':
    'Form I-797 — USCIS sends this after receiving your application, confirming it was received and providing a case number.',
}

/** Re-export as a simple wrapper. No context provider needed. */
export function GlossaryProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
