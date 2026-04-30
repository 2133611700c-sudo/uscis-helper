import type {
  UserRole, LanguageCode, OrderStatus, FormType,
  RiskLevel, ModerationStatus, SourceType, BotPlatform, LeadStatus,
} from './enums';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  language: LanguageCode;
  role: UserRole;
  phone: string | null;
  timezone: string;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: string;
  user_id: string | null;
  platform: string;
  ip_hash: string | null;
  user_agent: string | null;
  language: LanguageCode;
  started_at: string;
  ended_at: string | null;
  page_count: number;
  created_at: string;
}

export interface TranslationOrder {
  id: string;
  user_id: string | null;
  source_language: LanguageCode;
  target_language: LanguageCode;
  document_type: string;
  page_count: number | null;
  status: OrderStatus;
  price_usd: number | null;
  paid_at: string | null;
  delivered_at: string | null;
  uscis_certified: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranslationFile {
  id: string;
  order_id: string;
  file_name: string;
  file_type: string;
  storage_key: string;
  is_source: boolean;
  uploaded_at: string;
}

export interface FormSession {
  id: string;
  user_id: string | null;
  form_type: FormType;
  language: LanguageCode;
  started_at: string;
  completed_at: string | null;
  last_step: string | null;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormAnswer {
  id: string;
  session_id: string;
  question_key: string;
  answer_value: string | null;
  answered_at: string;
}

export interface OfficialSource {
  id: string;
  url: string;
  source_type: SourceType;
  title: string;
  language: LanguageCode;
  content_hash: string | null;
  last_fetched: string | null;
  last_changed: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CanonicalAnswer {
  id: string;
  slug: string;
  question_en: string;
  answer_en: string;
  question_uk: string | null;
  answer_uk: string | null;
  question_ru: string | null;
  answer_ru: string | null;
  category: string;
  source_ids: string[] | null;
  verified_at: string | null;
  verified_by: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface RiskFlag {
  id: string;
  user_id: string | null;
  session_id: string | null;
  flag_type: string;
  risk_level: RiskLevel;
  detail: Record<string, unknown> | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface ModerationQueueItem {
  id: string;
  source_table: string;
  source_id: string;
  flagged_reason: string;
  status: ModerationStatus;
  assigned_to: string | null;
  reviewed_at: string | null;
  reviewer_note: string | null;
  created_at: string;
}

export interface BotThread {
  id: string;
  platform: BotPlatform;
  platform_id: string;
  user_id: string | null;
  language: LanguageCode;
  last_message_at: string | null;
  message_count: number;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ScannerHit {
  id: string;
  source_id: string;
  detected_at: string;
  change_type: string;
  snippet: string | null;
  raw_diff: string | null;
  processed: boolean;
  canonical_id: string | null;
  created_at: string;
}

export interface FacebookLead {
  id: string;
  fb_user_id: string | null;
  platform_thread: string | null;
  language: LanguageCode | null;
  inquiry_text: string | null;
  status: LeadStatus;
  converted_user: string | null;
  source_campaign: string | null;
  captured_at: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  ip_hash: string | null;
  created_at: string;
}
