/**
 * Service-level data types for verified USCIS service info.
 *
 * Per BUG-002: kept separate from formIntelligence/* (which is form-level
 * snapshot data). These types describe what user-facing content needs.
 */

export interface ServiceFormInfo {
  id: string
  edition: string
  item_for_u4u: string
  item_label: string
  top_of_form_text?: string
}

export interface ServiceEadInfo {
  form: string
  category: string
  part: string
}

export interface ServiceFilingInfo {
  window_days?: number
  window_description?: string
  methods: ('online' | 'mail')[]
  online_url: string
  addresses_url: string
  processing_times_url: string
}

export interface ServiceFeesInfo {
  calculator_url: string
  schedule_url: string
  note_key: string
}

export interface ServiceSource {
  label: string
  url: string
  last_verified: string
}

export interface ServiceData {
  slug: string
  full_data: boolean
  verification_status: 'verified' | 'partial' | 'unverified'
  verified_at: string
  form: ServiceFormInfo
  ead?: ServiceEadInfo
  filing: ServiceFilingInfo
  fees: ServiceFeesInfo
  sources: ServiceSource[]
}
