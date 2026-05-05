/**
 * Generates a USCIS-ready translation draft as an HTML string.
 *
 * Legal basis: 8 CFR 103.2(b)(3)
 * "Any document containing foreign language submitted to USCIS shall be accompanied
 * by a full English language translation which the translator has certified as
 * complete and accurate, and by the translator's certification that he or she is
 * competent to translate from the foreign language into English."
 *
 * IMPORTANT: This is a DRAFT TEMPLATE. The user reviews and signs the certification
 * themselves. Messenginfo does not certify translations.
 */

export type DocumentType =
  | 'passport'
  | 'birth-certificate'
  | 'marriage-certificate'
  | 'divorce-certificate'
  | 'diploma-transcript'
  | 'military-document'
  | 'driver-license'
  | 'other-document'

// ---------------------------------------------------------------------------
// Field definitions per document type
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, Record<string, string>> = {
  passport: {
    full_name: 'Full Legal Name (Last, First, Middle)',
    date_of_birth: 'Date of Birth',
    place_of_birth: 'Place of Birth (City, Country)',
    nationality: 'Nationality / Citizenship',
    gender: 'Gender',
    document_number: 'Passport / Document Number',
    issue_date: 'Date of Issue',
    expiry_date: 'Date of Expiry',
    issuing_authority: 'Issuing Authority',
  },
  'birth-certificate': {
    full_name: "Child's Full Legal Name",
    date_of_birth: 'Date of Birth',
    place_of_birth: 'Place of Birth (City, Region, Country)',
    father_name: "Father's Full Name",
    mother_name: "Mother's Full Name",
    document_number: 'Certificate / Registration Number',
    issue_date: 'Date of Issue',
    issuing_authority: 'Issuing Authority (Office / City)',
  },
  'marriage-certificate': {
    spouse1_name: 'Spouse 1 — Full Legal Name',
    spouse2_name: 'Spouse 2 — Full Legal Name',
    date_of_marriage: 'Date of Marriage',
    place_of_marriage: 'Place of Marriage (City, Country)',
    document_number: 'Certificate / Registration Number',
    issue_date: 'Date of Issue',
    issuing_authority: 'Issuing Authority',
  },
  'divorce-certificate': {
    spouse1_name: 'Former Spouse 1 — Full Legal Name',
    spouse2_name: 'Former Spouse 2 — Full Legal Name',
    date_of_divorce: 'Date of Divorce',
    place_of_divorce: 'Place of Divorce (City, Country)',
    document_number: 'Certificate / Registration Number',
    issue_date: 'Date of Issue',
    issuing_authority: 'Issuing Authority / Court',
  },
  'diploma-transcript': {
    full_name: "Graduate's Full Legal Name",
    degree_title: 'Degree / Qualification Title',
    institution: 'Name of Institution',
    graduation_date: 'Date of Graduation',
    document_number: 'Diploma / Certificate Number',
    issuing_authority: 'Issuing Authority',
  },
  'military-document': {
    full_name: "Service Member's Full Legal Name",
    date_of_birth: 'Date of Birth',
    document_number: 'Document Number / Military ID',
    service_branch: 'Branch of Service',
    issue_date: 'Date of Issue',
    issuing_authority: 'Issuing Authority',
  },
  'driver-license': {
    full_name: "Driver's Full Legal Name",
    date_of_birth: 'Date of Birth',
    address: 'Address on Document',
    document_number: 'License Number',
    issue_date: 'Date of Issue',
    expiry_date: 'Date of Expiry',
    issuing_authority: 'Issuing Authority (State / Country)',
  },
}

const DEFAULT_FIELD_LABELS: Record<string, string> = {
  full_name: 'Full Legal Name',
  date_of_birth: 'Date of Birth',
  document_number: 'Document Number',
  issuing_authority: 'Issuing Authority',
  issue_date: 'Date of Issue',
  expiry_date: 'Date of Expiry',
}

const DOC_TYPE_TITLES: Record<string, string> = {
  passport: 'Passport',
  'birth-certificate': 'Birth Certificate',
  'marriage-certificate': 'Marriage Certificate',
  'divorce-certificate': 'Divorce Certificate',
  'diploma-transcript': 'Diploma / Academic Transcript',
  'military-document': 'Military Document',
  'driver-license': "Driver's License",
  'other-document': 'Official Document',
}

// ---------------------------------------------------------------------------
// HTML generator
// ---------------------------------------------------------------------------

export function generateTranslationHTML(
  docType: string,
  fields: Record<string, string>,
  originalLanguage = 'Ukrainian',
): string {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const docTitle = DOC_TYPE_TITLES[docType] ?? 'Official Document'
  const fieldLabels = FIELD_LABELS[docType] ?? DEFAULT_FIELD_LABELS

  // Build translation rows — only include fields with values
  const filledFields = Object.entries(fields).filter(([_, v]) => v && v.trim().length > 0)

  const rows = filledFields
    .map(([key, value]) => {
      const label = fieldLabels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      return `
        <tr>
          <td class="field-label">${escapeHtml(label)}</td>
          <td class="field-value">${escapeHtml(value)}</td>
        </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Translation of ${escapeHtml(docTitle)} — Messenginfo Draft</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
      background: #fff;
      max-width: 740px;
      margin: 0 auto;
      padding: 40px 30px 60px;
    }
    .header {
      border-bottom: 2px solid #000;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .header h1 {
      font-size: 16pt;
      font-weight: bold;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }
    .header-meta {
      font-size: 11pt;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 20px;
    }
    .header-meta span { color: #333; }
    .header-meta strong { color: #000; }
    .draft-banner {
      background: #fff8e1;
      border: 1.5px solid #f59e0b;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 18px;
      font-size: 10pt;
      color: #92400e;
      text-align: center;
    }
    .section-title {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #555;
      border-bottom: 1px solid #ccc;
      padding-bottom: 4px;
      margin: 18px 0 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    th {
      background: #f5f5f5;
      font-size: 10pt;
      font-weight: bold;
      padding: 6px 10px;
      text-align: left;
      border: 1px solid #ccc;
    }
    td {
      padding: 7px 10px;
      border: 1px solid #ddd;
      font-size: 11pt;
      vertical-align: top;
    }
    .field-label { width: 45%; color: #333; font-style: italic; }
    .field-value { width: 55%; color: #000; font-weight: 500; }
    .certification-block {
      border: 1.5px solid #000;
      padding: 16px 18px;
      margin-top: 24px;
      border-radius: 2px;
    }
    .certification-block h2 {
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 10px;
      text-align: center;
      letter-spacing: 0.04em;
    }
    .certification-block p {
      font-size: 11pt;
      margin-bottom: 12px;
      line-height: 1.6;
    }
    .sign-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 24px;
      margin-top: 14px;
    }
    .sign-line {
      border-bottom: 1px solid #000;
      padding-bottom: 2px;
      min-height: 28px;
    }
    .sign-label {
      font-size: 9.5pt;
      color: #444;
      margin-top: 3px;
    }
    .footer {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #ccc;
      font-size: 9pt;
      color: #666;
      text-align: center;
      line-height: 1.5;
    }
    @media print {
      body { padding: 20px; }
      .draft-banner { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <h1>Translation of ${escapeHtml(docTitle)}</h1>
    <div class="header-meta">
      <div><span>Document Type: </span><strong>${escapeHtml(docTitle)}</strong></div>
      <div><span>Original Language: </span><strong>${escapeHtml(originalLanguage)}</strong></div>
      <div><span>Target Language: </span><strong>English</strong></div>
      <div><span>Date of Translation: </span><strong>${today}</strong></div>
    </div>
  </div>

  <!-- Draft Warning -->
  <div class="draft-banner">
    ⚠ DRAFT TEMPLATE — Prepared by Messenginfo as a reference.
    Messenginfo does not certify translations.
    You must review, complete the certification section below, and sign before submitting to USCIS.
  </div>

  <!-- Fields Table -->
  <div class="section-title">Document Fields — English Translation</div>
  <table>
    <thead>
      <tr>
        <th>Field (English)</th>
        <th>Translation / Value</th>
      </tr>
    </thead>
    <tbody>
      ${rows.length > 0 ? rows : '<tr><td colspan="2" style="color:#999;text-align:center;padding:12px;">No fields entered.</td></tr>'}
    </tbody>
  </table>

  <!-- Certification Block -->
  <div class="certification-block">
    <h2>Translator Certification</h2>
    <p>
      Pursuant to <strong>8 CFR 103.2(b)(3)</strong>, I certify that I am competent to translate
      from <strong>${escapeHtml(originalLanguage)}</strong> into <strong>English</strong>, and that
      the above translation is complete and accurate to the best of my knowledge and belief.
    </p>

    <div class="sign-grid">
      <div>
        <div class="sign-line">&nbsp;</div>
        <div class="sign-label">Signature of Translator</div>
      </div>
      <div>
        <div class="sign-line">&nbsp;</div>
        <div class="sign-label">Date</div>
      </div>
      <div>
        <div class="sign-line">&nbsp;</div>
        <div class="sign-label">Printed Full Name</div>
      </div>
      <div>
        <div class="sign-line">&nbsp;</div>
        <div class="sign-label">Phone / Email (optional)</div>
      </div>
      <div style="grid-column: 1 / -1;">
        <div class="sign-line">&nbsp;</div>
        <div class="sign-label">Mailing Address</div>
      </div>
      <div style="grid-column: 1 / -1;">
        <div class="sign-line">&nbsp;</div>
        <div class="sign-label">City, State, ZIP Code</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>
      Prepared with Messenginfo · messenginfo.com · For informational use only.<br>
      Messenginfo is not a law firm and does not provide legal advice or certified translation services.<br>
      Translation requirements: 8 CFR 103.2(b)(3) · Last verified: 2026-05-04 · uscis.gov
    </p>
  </div>

</body>
</html>`
}

// ---------------------------------------------------------------------------
// Trigger browser download of the generated HTML
// ---------------------------------------------------------------------------

export function downloadTranslationTemplate(
  docType: string,
  fields: Record<string, string>,
  originalLanguage = 'Ukrainian',
): void {
  const html = generateTranslationHTML(docType, fields, originalLanguage)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const docLabel = DOC_TYPE_TITLES[docType] ?? 'document'
  a.download = `translation-draft-${docLabel.toLowerCase().replace(/\s+/g, '-')}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
