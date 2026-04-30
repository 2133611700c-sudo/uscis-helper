import type {
  Profile, UserSession, TranslationOrder, TranslationFile,
  FormSession, FormAnswer, OfficialSource, CanonicalAnswer,
  RiskFlag, ModerationQueueItem, BotThread, ScannerHit,
  FacebookLead, AuditLog,
} from './tables';

// Supabase-compatible Database type for createClient<Database>()
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'> & Partial<Pick<Profile, 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<Profile, 'id'>>;
      };
      user_sessions: {
        Row: UserSession;
        Insert: Omit<UserSession, 'id' | 'created_at'> & Partial<Pick<UserSession, 'id' | 'created_at'>>;
        Update: Partial<Omit<UserSession, 'id'>>;
      };
      translations_orders: {
        Row: TranslationOrder;
        Insert: Omit<TranslationOrder, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<TranslationOrder, 'id' | 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<TranslationOrder, 'id'>>;
      };
      translation_files: {
        Row: TranslationFile;
        Insert: Omit<TranslationFile, 'id'> & Partial<Pick<TranslationFile, 'id'>>;
        Update: Partial<Omit<TranslationFile, 'id'>>;
      };
      form_sessions: {
        Row: FormSession;
        Insert: Omit<FormSession, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<FormSession, 'id' | 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<FormSession, 'id'>>;
      };
      form_answers: {
        Row: FormAnswer;
        Insert: Omit<FormAnswer, 'id'> & Partial<Pick<FormAnswer, 'id'>>;
        Update: Partial<Omit<FormAnswer, 'id'>>;
      };
      official_sources: {
        Row: OfficialSource;
        Insert: Omit<OfficialSource, 'id' | 'created_at'> & Partial<Pick<OfficialSource, 'id' | 'created_at'>>;
        Update: Partial<Omit<OfficialSource, 'id'>>;
      };
      canonical_answers: {
        Row: CanonicalAnswer;
        Insert: Omit<CanonicalAnswer, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<CanonicalAnswer, 'id' | 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<CanonicalAnswer, 'id'>>;
      };
      risk_flags: {
        Row: RiskFlag;
        Insert: Omit<RiskFlag, 'id' | 'created_at'> & Partial<Pick<RiskFlag, 'id' | 'created_at'>>;
        Update: Partial<Omit<RiskFlag, 'id'>>;
      };
      moderation_queue: {
        Row: ModerationQueueItem;
        Insert: Omit<ModerationQueueItem, 'id' | 'created_at'> & Partial<Pick<ModerationQueueItem, 'id' | 'created_at'>>;
        Update: Partial<Omit<ModerationQueueItem, 'id'>>;
      };
      bot_threads: {
        Row: BotThread;
        Insert: Omit<BotThread, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<BotThread, 'id' | 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<BotThread, 'id'>>;
      };
      scanner_hits: {
        Row: ScannerHit;
        Insert: Omit<ScannerHit, 'id' | 'created_at'> & Partial<Pick<ScannerHit, 'id' | 'created_at'>>;
        Update: Partial<Omit<ScannerHit, 'id'>>;
      };
      facebook_leads: {
        Row: FacebookLead;
        Insert: Omit<FacebookLead, 'id' | 'created_at'> & Partial<Pick<FacebookLead, 'id' | 'created_at'>>;
        Update: Partial<Omit<FacebookLead, 'id'>>;
      };
      audit_log: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id' | 'created_at'> & Partial<Pick<AuditLog, 'id' | 'created_at'>>;
        Update: never; // append-only
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
