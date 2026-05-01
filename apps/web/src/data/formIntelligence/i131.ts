export const i131Intelligence = {
  formId: "I-131",
  officialUrl: "https://www.uscis.gov/i-131",
  formPdfUrl: "https://www.uscis.gov/sites/default/files/document/forms/i-131.pdf",
  instructionsPdfUrl: "https://www.uscis.gov/sites/default/files/document/forms/i-131instr.pdf",
  editionDate: "01/20/25",
  filingMethod: "online_for_certain_types_or_by_mail",
  topics: ["re-parole", "travel-document", "parole-document", "arrival-departure-record"],
  extractableFromPassport: ["full_legal_name", "date_of_birth", "country_of_birth", "country_of_citizenship", "passport_number", "passport_issue_date", "passport_expiration_date"],
  extractableFromI94: ["i94_number", "class_of_admission", "parole_expiration_date"],
  extractableFromEad: ["a_number", "category_if_visible"],
  manualFields: ["current_address", "mailing_address", "phone", "email", "height", "weight", "eye_color", "hair_color", "travel_history", "immigration_history", "uscis_online_account_number"],
  notes: [
    "Use official instructions for section-by-section requirements.",
    "Do not infer eligibility beyond the official USCIS page and instructions."
  ]
} as const;
