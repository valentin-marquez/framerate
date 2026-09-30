import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";
import type { SqlBool } from "./codecs";

/**
 * Tipos de las tablas para Kysely: espejo de `migrations/*.sql`, que son la
 * autoridad del esquema. Los tests de integración corren esas migraciones en
 * D1 real, así que un desfase entre este archivo y el SQL rompe CI.
 *
 * Convenciones: booleanos = `SqlBool` (0/1), JSON = `string` (ver codecs.ts),
 * fechas = ISO-8601 `string`. `Generated` = la base asigna el valor (PK, DEFAULT).
 */

type JsonText = ColumnType<string, string | undefined, string>;

/** Columna con DEFAULT: opcional al insertar. */
type Defaulted<T> = ColumnType<T, T | undefined, T>;

// ─── Identidad (0001) ────────────────────────────────────────────────────────

export type UserRole = "user" | "moderator" | "admin";
export type Lang = "es" | "en" | "arn";

export interface UsersTable {
  id: string;
  email: string;
  email_verified: Defaulted<SqlBool>;
  username: string;
  display_name: string;
  avatar_key: string | null;
  avatar_source_url: string | null;
  bio: string | null;
  lang: Defaulted<Lang>;
  theme: Defaulted<"system" | "light" | "dark">;
  role: Defaulted<UserRole>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AuthAccountsTable {
  id: string;
  user_id: string;
  provider_id: string;
  account_id: string;
  access_token: string | null;
  refresh_token: string | null;
  id_token: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  scope: string | null;
  password: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthSessionsTable {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthVerificationsTable {
  id: string;
  identifier: string;
  value: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface UserBansTable {
  id: Generated<number>;
  user_id: string;
  reason: string | null;
  banned_by: string | null;
  created_at: string;
  expires_at: string | null;
  lifted_at: string | null;
  lifted_by: string | null;
}

// ─── Organizaciones (0002) ───────────────────────────────────────────────────

export type OrgRole = "owner" | "admin" | "editor";

export interface OrganizationsTable {
  id: Generated<number>;
  slug: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMembersTable {
  organization_id: number;
  user_id: string;
  role: OrgRole;
  invited_by: string | null;
  created_at: string;
}

export interface OrganizationInvitationsTable {
  id: Generated<number>;
  organization_id: number;
  email: string;
  role: Exclude<OrgRole, "owner">;
  token_hash: string;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
}

// ─── Catálogo (0003) ─────────────────────────────────────────────────────────

export interface StoresTable {
  id: Generated<number>;
  slug: string;
  name: string;
  url: string;
  domain: string | null;
  is_active: Defaulted<SqlBool>;
  scraped_icon_url: string | null;
  organization_id: number | null;
  verified_at: string | null;
  frozen_at: string | null;
  rating_count: Defaulted<number>;
  rating_sum: Defaulted<number>;
  created_at: string;
}

export interface ProductVariantGroupsTable {
  id: Generated<number>;
  category: string;
  name: string;
  created_at: string;
}

export interface ProductsTable {
  id: Generated<number>;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  attribute_key: string | null;
  attributes: JsonText;
  specs: JsonText;
  specs_source: "extracted" | "opendb" | "manual" | null;
  specs_updated_at: string | null;
  variant_group_id: number | null;
  image_url: string | null;
  image_key: string | null;
  best_price: number | null;
  best_price_card: number | null;
  offer_count: Defaulted<number>;
  in_stock_offer_count: Defaulted<number>;
  reference_price: number | null;
  views_7d: Defaulted<number>;
  prices_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductSpecValuesTable {
  product_id: number;
  key: string;
  value_text: string | null;
  value_num: number | null;
}

export interface ProductSlugRedirectsTable {
  old_slug: string;
  product_id: number;
  created_at: string;
}

export interface ProductPriceDailyTable {
  product_id: number;
  day: string;
  min_cash: number;
  min_card: number;
  offer_count: number;
}

export interface ProductIdentifiersTable {
  kind: "mpn" | "gtin";
  value: string;
  product_id: number;
}

export interface ListingsTable {
  id: Generated<number>;
  store_id: number;
  external_id: string;
  url: string;
  title: string;
  raw_title: string | null;
  category: string;
  brand: string | null;
  mpn: string | null;
  gtin: string | null;
  image_url: string | null;
  image_urls: JsonText;
  attributes: JsonText;
  price_cash: number;
  price_card: number;
  in_stock: SqlBool;
  stock_quantity: number | null;
  is_active: Defaulted<SqlBool>;
  product_id: number | null;
  first_seen_at: string;
  last_seen_at: string;
  updated_at: string;
}

export interface PricePointsTable {
  id: Generated<number>;
  listing_id: number;
  price_cash: number;
  price_card: number;
  in_stock: SqlBool;
  observed_at: string;
}

export const MATCH_METHODS = ["identifier", "attributes", "new_product", "manual", "unlinked"] as const;
export type MatchMethod = (typeof MATCH_METHODS)[number];

export interface MatchDecisionsTable {
  id: Generated<number>;
  listing_id: number;
  product_id: number | null;
  method: MatchMethod;
  confidence: number;
  evidence: JsonText;
  decided_by: string;
  created_at: string;
}

export type ReviewStatus = "pending" | "accepted" | "rejected";

export interface MatchReviewsTable {
  id: Generated<number>;
  listing_id: number;
  candidate_product_id: number;
  score: number;
  evidence: JsonText;
  status: ColumnType<ReviewStatus, ReviewStatus | undefined, ReviewStatus>;
  created_at: string;
  resolved_at: string | null;
}

export interface CrawlRunsTable {
  id: string;
  store_id: number;
  category: string;
  status: "running" | "succeeded" | "failed";
  started_at: string;
  finished_at: string | null;
  stats: JsonText;
  error: string | null;
}

export interface QuarantineTable {
  id: Generated<number>;
  run_id: string;
  store_id: number;
  external_id: string | null;
  reason: string;
  payload: string;
  created_at: string;
}

export interface ProductViewsDailyTable {
  product_id: number;
  day: string;
  views: Defaulted<number>;
}

export type ClickSource =
  | "product_hero"
  | "product_comparison"
  | "product_mobile"
  | "quote_item"
  | "quote_pdf"
  | "store_page";

export interface OutboundClicksTable {
  id: Generated<number>;
  listing_id: number | null;
  product_id: number | null;
  store_id: number;
  user_id: string | null;
  source: ClickSource;
  referrer_path: string | null;
  created_at: string;
}

// ─── Tiendas (0004) ──────────────────────────────────────────────────────────

export interface StoreProfilesTable {
  store_id: number;
  display_name: string | null;
  description: string | null;
  website_url: string | null;
  social: JsonText;
  icon_key: string | null;
  banner_key: string | null;
  updated_by: string | null;
  updated_at: string;
}

export type ClaimStatus = "pending" | "verified" | "confirmed" | "expired" | "stale" | "revoked";

export interface StoreClaimsTable {
  id: Generated<number>;
  store_id: number;
  claimant_id: string;
  domain: string;
  token: string;
  status: Defaulted<ClaimStatus>;
  attempts: Defaulted<number>;
  last_attempt_at: string | null;
  consecutive_failures: Defaulted<number>;
  last_checked_at: string | null;
  last_error: string | null;
  dns_provider: string | null;
  verified_at: string | null;
  confirmed_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface StoreClaimEventsTable {
  id: Generated<number>;
  claim_id: number;
  store_id: number;
  action:
    | "created"
    | "verified"
    | "confirmed"
    | "expired"
    | "recheck_ok"
    | "recheck_failed"
    | "stale"
    | "unfrozen"
    | "revoked";
  actor_id: string | null;
  reason: string | null;
  metadata: JsonText;
  created_at: string;
}

export type DeletionReason = "author" | "moderation";

export interface StoreReviewsTable {
  id: Generated<number>;
  store_id: number;
  user_id: string | null;
  rating: number;
  body: string | null;
  helpful_count: Defaulted<number>;
  is_pinned: Defaulted<SqlBool>;
  owner_response: string | null;
  owner_response_at: string | null;
  owner_response_by: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deletion_reason: DeletionReason | null;
  created_at: string;
}

export interface StoreReviewVotesTable {
  review_id: number;
  user_id: string;
  created_at: string;
}

// ─── Cotizaciones (0005) ─────────────────────────────────────────────────────

export type QuoteSlot = "cpu" | "motherboard" | "ram" | "gpu" | "psu" | "case" | "cpu_cooler" | "storage" | "case_fan";

export interface QuotesTable {
  id: Generated<number>;
  public_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  visibility: Defaulted<"private" | "unlisted" | "public">;
  analysis_status: Defaulted<"unknown" | "valid" | "warning" | "incompatible">;
  analysis: string | null;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteItemsTable {
  id: Generated<number>;
  quote_id: number;
  product_id: number;
  slot: QuoteSlot;
  quantity: Defaulted<number>;
  listing_id: number | null;
  is_selected: Defaulted<SqlBool>;
  position: Defaulted<number>;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Comentarios (0006) ──────────────────────────────────────────────────────

export interface CommentsTable {
  id: Generated<number>;
  product_id: number;
  parent_id: number | null;
  /** Calculados por trigger. */
  root_id: ColumnType<number, never, never>;
  depth: ColumnType<number, never, never>;
  path: ColumnType<string, never, never>;
  author_id: string | null;
  body: string | null;
  like_count: ColumnType<number, never, never>;
  reply_count: ColumnType<number, never, never>;
  edited_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deletion_reason: DeletionReason | null;
  created_at: string;
}

export interface CommentLikesTable {
  comment_id: number;
  user_id: string;
  created_at: string;
}

// ─── Moderación (0007) ───────────────────────────────────────────────────────

export type ReportTarget = "product" | "comment" | "store_review" | "store" | "quote" | "user";

export interface ReportsTable {
  id: Generated<number>;
  target_type: ReportTarget;
  target_id: string;
  reporter_id: string | null;
  reason:
    | "spam"
    | "harassment"
    | "misleading"
    | "duplicate"
    | "wrong_listing"
    | "broken_link"
    | "wrong_price"
    | "inappropriate"
    | "other";
  details: string | null;
  status: Defaulted<"open" | "reviewing" | "resolved" | "dismissed">;
  claimed_by: string | null;
  claimed_until: string | null;
  resolution: "no_action" | "content_removed" | "user_banned" | "listing_fixed" | "duplicate_of_other" | null;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export type ModerationAction =
  | "report_resolved"
  | "report_dismissed"
  | "comment_removed"
  | "comment_restored"
  | "review_removed"
  | "review_restored"
  | "user_banned"
  | "user_unbanned"
  | "role_changed"
  | "claim_revoked"
  | "store_frozen"
  | "store_unfrozen"
  | "product_merged"
  | "product_edited"
  | "match_reviewed";

export interface ModerationActionsTable {
  id: Generated<number>;
  actor_id: string | null;
  action: ModerationAction;
  target_type: string;
  target_id: string;
  report_id: number | null;
  reason: string | null;
  before: string | null;
  after: string | null;
  created_at: string;
}

export interface TranslationFeedbackTable {
  id: Generated<number>;
  user_id: string | null;
  lang: Lang;
  translation_key: string;
  current_text: string | null;
  suggested_text: string;
  comment: string | null;
  context_path: string | null;
  status: Defaulted<"new" | "accepted" | "rejected" | "duplicate">;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// ─── Soporte (0008) ──────────────────────────────────────────────────────────

export interface SupportTicketsTable {
  id: Generated<number>;
  public_id: string;
  user_id: string | null;
  email: string;
  category: "privacy" | "data_request" | "abuse_report" | "store_issue" | "bug" | "feature" | "other";
  subject: string;
  status: Defaulted<"open" | "in_progress" | "waiting_user" | "resolved" | "closed">;
  assigned_to: string | null;
  store_id: number | null;
  access_token_hash: string | null;
  source: Defaulted<"web" | "api" | "system">;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  closed_at: string | null;
}

export interface SupportMessagesTable {
  id: Generated<number>;
  ticket_id: number;
  author_id: string | null;
  author_role: "user" | "staff" | "system";
  body: string;
  is_internal: Defaulted<SqlBool>;
  created_at: string;
}

export interface Database {
  users: UsersTable;
  auth_accounts: AuthAccountsTable;
  auth_sessions: AuthSessionsTable;
  auth_verifications: AuthVerificationsTable;
  user_bans: UserBansTable;
  organizations: OrganizationsTable;
  organization_members: OrganizationMembersTable;
  organization_invitations: OrganizationInvitationsTable;
  product_variant_groups: ProductVariantGroupsTable;
  product_spec_values: ProductSpecValuesTable;
  product_slug_redirects: ProductSlugRedirectsTable;
  product_price_daily: ProductPriceDailyTable;
  product_views_daily: ProductViewsDailyTable;
  outbound_clicks: OutboundClicksTable;
  store_profiles: StoreProfilesTable;
  store_claims: StoreClaimsTable;
  store_claim_events: StoreClaimEventsTable;
  store_reviews: StoreReviewsTable;
  store_review_votes: StoreReviewVotesTable;
  quotes: QuotesTable;
  quote_items: QuoteItemsTable;
  comments: CommentsTable;
  comment_likes: CommentLikesTable;
  reports: ReportsTable;
  moderation_actions: ModerationActionsTable;
  translation_feedback: TranslationFeedbackTable;
  support_tickets: SupportTicketsTable;
  support_messages: SupportMessagesTable;
  stores: StoresTable;
  products: ProductsTable;
  product_identifiers: ProductIdentifiersTable;
  listings: ListingsTable;
  price_points: PricePointsTable;
  match_decisions: MatchDecisionsTable;
  match_reviews: MatchReviewsTable;
  crawl_runs: CrawlRunsTable;
  quarantine: QuarantineTable;
}

export type ListingRow = Selectable<ListingsTable>;
export type NewListing = Insertable<ListingsTable>;
export type ListingUpdate = Updateable<ListingsTable>;
export type ProductRow = Selectable<ProductsTable>;
