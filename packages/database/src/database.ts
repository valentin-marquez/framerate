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

export type UserRole = "user" | "support" | "moderator" | "admin";
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

// ─── Fusión de usuarios (0011) ───────────────────────────────────────────────

export interface AccountMergesTable {
  id: Generated<number>;
  survivor_id: string;
  token_hash: string;
  status: Defaulted<"pending" | "done">;
  absorbed_id: string | null;
  absorbed_username: string | null;
  absorbed_email: string | null;
  summary: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
}

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
  scraped_banner_url: string | null;
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
  // Modelo sin lo que distingue una variante (0025, #101): los productos con la misma clave son variantes entre sí.
  family_key: string | null;
  // Nombre normalizado para el índice de búsqueda (`searchText`); la escribe quien crea el producto.
  search: string | null;
  // Modelo sacado del nombre por el modelo de lenguaje donde no hay clave de atributos (#98), y cuándo se preguntó.
  model_ai: string | null;
  model_ai_at: string | null;
  attributes: JsonText;
  specs: JsonText;
  specs_source: "extracted" | "opendb" | "manual" | null;
  specs_updated_at: string | null;
  variant_group_id: number | null;
  image_url: string | null;
  image_key: string | null;
  image_checked_at: string | null;
  best_price: number | null;
  best_price_card: number | null;
  offer_count: Defaulted<number>;
  in_stock_offer_count: Defaulted<number>;
  reference_price: number | null;
  views_7d: Defaulted<number>;
  prices_updated_at: string | null;
  // Cuándo se vinculó su primera oferta visible (0022); null = nace oculto hasta pasar el pipeline.
  published_at: string | null;
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
  // Pipeline de normalización (0022).
  norm_hash: string | null;
  norm_status: Defaulted<NormStatus>;
  norm_at: string | null;
  source_text: string | null;
  visible: Defaulted<SqlBool>;
  crawl_category: string | null;
}

export type NormStatus = "legacy" | "pending" | "normalized" | "linked" | "fallback" | "failed";

export interface ListingIdentityTable {
  listing_id: number;
  version: number;
  input_hash: string;
  model: string;
  category: string;
  brand: string | null;
  name: string;
  mpn: string | null;
  confidence: "high" | "medium" | "low";
  identity: JsonText;
  identity_raw: JsonText;
  specs: JsonText;
  specs_source: JsonText;
  /** Producto que Haiku reconoció como el mismo SKU entre los candidatos del catálogo (#157). */
  same_as: number | null;
  created_at: string;
}

export interface AiUsageTable {
  id: Generated<number>;
  at: string;
  worker: "normalize" | "match";
  purpose: "normalize" | "judge" | "extract";
  model: string;
  listing_id: number | null;
  review_id: number | null;
  input_tokens: Defaulted<number>;
  cache_read_tokens: Defaulted<number>;
  cache_write_tokens: Defaulted<number>;
  output_tokens: Defaulted<number>;
  usd: Defaulted<number>;
  ms: number | null;
  status: "ok" | "invalid" | "refusal" | "rate_limited" | "no_credit" | "error";
  error: string | null;
}

export interface PipelineStateTable {
  id: number;
  paused_until: string | null;
  updated_at: string;
}

export interface MatchShadowTable {
  id: Generated<number>;
  listing_id: number;
  version: number;
  kind: "link" | "review" | "new_product";
  product_id: number | null;
  score: number;
  vetoes: JsonText;
  current_product_id: number | null;
  agrees: SqlBool;
  created_at: string;
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

export interface MatchOverridesTable {
  id: Generated<number>;
  listing_id: number;
  product_id: number;
  kind: "force" | "forbid";
  created_by: string;
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
  norm_hash: string | null;
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

export type QuoteSlot =
  | "cpu"
  | "motherboard"
  | "ram"
  | "gpu"
  | "psu"
  | "case"
  | "cpu_cooler"
  | "storage"
  | "case_fan"
  | "peripherals";

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
  /** Mantenido por triggers sobre `quote_likes` (0036). */
  like_count: Defaulted<number>;
  created_at: string;
  updated_at: string;
}

export interface QuoteLikesTable {
  quote_id: number;
  user_id: string;
  created_at: string;
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
  source: Defaulted<"web" | "api" | "system" | "email">;
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
  message_id: string | null;
  created_at: string;
}

/** Tier de calidad de fuentes de poder (#177, migración 0028). Se reemplaza entera en cada importación. */
export interface PsuTierTable {
  id: Generated<number>;
  brand: string;
  brand_key: string;
  series: string;
  subseries: Defaulted<string>;
  variant: Defaulted<string>;
  wattages: JsonText;
  tier: string;
  limited: Defaulted<SqlBool>;
  year: number | null;
  form_factor: string | null;
  atx_version: string | null;
  modular: string | null;
  efficiency: string | null;
  odm: string | null;
  platform: string | null;
  notes: string | null;
  source_version: string;
  /** "sheet" (la tier list), "own" (nota propia desde reseñas) o "brand" (nota base de la marca); las dos últimas, especulativas. */
  origin: Defaulted<string>;
  source_urls: string | null;
  /** Sólo en las filas de marca (`series` = "*"): la mejor nota del rango; `tier` es la peor. */
  best: string | null;
}

/** Referencia de procesadores desde las fichas oficiales (#179, migración 0029). Se reemplaza entera al importar. */
export interface CpuReferenceTable {
  model: string;
  brand: string;
  name: string;
  number: string;
  socket: string | null;
  cores_total: number | null;
  cores_performance: number | null;
  cores_efficiency: number | null;
  threads: number | null;
  base_ghz: number | null;
  boost_ghz: number | null;
  l3_mb: number | null;
  tdp_w: number | null;
  max_power_w: number | null;
  integrated_graphics: string | null;
  boxed_cooler: string | null;
  memory_types: string | null;
  memory_max_mt_s: number | null;
  launch: string | null;
  part_numbers: JsonText;
  source_url: string;
  unlocked: number | null;
  pcie_version: string | null;
  memory_channels: number | null;
  max_memory_gb: number | null;
  cooler_recommendation: string | null;
  codename: string | null;
  lithography: string | null;
}

/** Referencia de tarjetas de video por chipset (#180, migración 0031). Se reemplaza entera al importar. */
export interface GpuReferenceTable {
  chipset: string;
  brand: string;
  name: string;
  number: string;
  architecture: string | null;
  launch: string | null;
  shader_cores: number | null;
  board_power_w: number | null;
  min_psu_w: number | null;
  power_connectors: string | null;
  memory_type: string | null;
  vram_gb: JsonText;
  memory_bus_bit: number | null;
  pcie_version: string | null;
  reference_length_mm: number | null;
  source_url: string;
}

/** Referencia de ventiladores por familia y tamaño (#181, migración 0034). Se reemplaza entera al importar. */
export interface FanReferenceTable {
  id: Generated<number>;
  brand: string;
  brand_key: string;
  family: string;
  size_mm: number | null;
  rpm_min: number | null;
  rpm_max: number | null;
  airflow_cfm: number | null;
  static_pressure_mmh2o: number | null;
  noise_dba: number | null;
  bearing: string | null;
  fan_connector: string | null;
  lighting: string | null;
  controller: string | null;
  requires_controller: number | null;
  daisy_chain: number | null;
  warranty_years: number | null;
  aliases: JsonText;
  source_url: string | null;
}

/** Referencia por modelo de coolers y gabinetes (#182, migración 0035), con las specs en JSON. */
export interface PartReferenceTable {
  id: Generated<number>;
  category: string;
  brand: string;
  brand_key: string;
  model: string;
  specs: JsonText;
  aliases: JsonText;
  source_url: string | null;
}

export interface CatalogVersionTable {
  id: number;
  version: number;
  /** ISO de la última subida (0038); NULL antes de la primera. */
  bumped_at: string | null;
}

export interface Database {
  catalog_version: CatalogVersionTable;
  users: UsersTable;
  auth_accounts: AuthAccountsTable;
  auth_sessions: AuthSessionsTable;
  auth_verifications: AuthVerificationsTable;
  user_bans: UserBansTable;
  account_merges: AccountMergesTable;
  organizations: OrganizationsTable;
  organization_members: OrganizationMembersTable;
  organization_invitations: OrganizationInvitationsTable;
  product_variant_groups: ProductVariantGroupsTable;
  product_spec_values: ProductSpecValuesTable;
  product_slug_redirects: ProductSlugRedirectsTable;
  product_price_daily: ProductPriceDailyTable;
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
  quote_likes: QuoteLikesTable;
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
  match_overrides: MatchOverridesTable;
  crawl_runs: CrawlRunsTable;
  quarantine: QuarantineTable;
  listing_identity: ListingIdentityTable;
  ai_usage: AiUsageTable;
  pipeline_state: PipelineStateTable;
  match_shadow: MatchShadowTable;
  psu_tier: PsuTierTable;
  cpu_reference: CpuReferenceTable;
  gpu_reference: GpuReferenceTable;
  fan_reference: FanReferenceTable;
  part_reference: PartReferenceTable;
}

export type ListingRow = Selectable<ListingsTable>;
export type NewListing = Insertable<ListingsTable>;
export type ListingUpdate = Updateable<ListingsTable>;
export type ProductRow = Selectable<ProductsTable>;
