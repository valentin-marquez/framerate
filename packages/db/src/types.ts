export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      brands: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      comment_moderation_log: {
        Row: {
          action: string;
          after_snapshot: Json | null;
          before_snapshot: Json | null;
          comment_id: string;
          created_at: string;
          id: string;
          moderator_id: string | null;
          reason: string | null;
        };
        Insert: {
          action: string;
          after_snapshot?: Json | null;
          before_snapshot?: Json | null;
          comment_id: string;
          created_at?: string;
          id?: string;
          moderator_id?: string | null;
          reason?: string | null;
        };
        Update: {
          action?: string;
          after_snapshot?: Json | null;
          before_snapshot?: Json | null;
          comment_id?: string;
          created_at?: string;
          id?: string;
          moderator_id?: string | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "comment_moderation_log_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      comment_votes: {
        Row: {
          comment_id: string;
          created_at: string;
          user_id: string;
          value: number;
        };
        Insert: {
          comment_id: string;
          created_at?: string;
          user_id: string;
          value: number;
        };
        Update: {
          comment_id?: string;
          created_at?: string;
          user_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "comment_votes_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
          depth: number;
          edited_at: string | null;
          id: string;
          parent_id: string | null;
          path: unknown;
          root_id: string;
          score: number;
          target_id: string;
          target_type: Database["public"]["Enums"]["comment_target_type"];
        };
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
          depth?: number;
          edited_at?: string | null;
          id?: string;
          parent_id?: string | null;
          path: unknown;
          root_id: string;
          score?: number;
          target_id: string;
          target_type?: Database["public"]["Enums"]["comment_target_type"];
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
          depth?: number;
          edited_at?: string | null;
          id?: string;
          parent_id?: string | null;
          path?: unknown;
          root_id?: string;
          score?: number;
          target_id?: string;
          target_type?: Database["public"]["Enums"]["comment_target_type"];
        };
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      extraction_jobs: {
        Row: {
          attempts: number;
          brand: string | null;
          category: string;
          context: Json | null;
          created_at: string;
          error_message: string | null;
          id: string;
          mpn: string;
          normalized_title: string | null;
          raw_text: string;
          result: Json | null;
          status: Database["public"]["Enums"]["job_status"];
          updated_at: string;
          url: string | null;
        };
        Insert: {
          attempts?: number;
          brand?: string | null;
          category: string;
          context?: Json | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          mpn: string;
          normalized_title?: string | null;
          raw_text: string;
          result?: Json | null;
          status?: Database["public"]["Enums"]["job_status"];
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          attempts?: number;
          brand?: string | null;
          category?: string;
          context?: Json | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          mpn?: string;
          normalized_title?: string | null;
          raw_text?: string;
          result?: Json | null;
          status?: Database["public"]["Enums"]["job_status"];
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [];
      };
      listings: {
        Row: {
          created_at: string;
          currency: string;
          external_id: string | null;
          id: string;
          is_active: boolean;
          last_scraped_at: string | null;
          price_cash: number;
          price_normal: number;
          product_id: string;
          stock_quantity: number | null;
          store_id: string;
          updated_at: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          external_id?: string | null;
          id?: string;
          is_active?: boolean;
          last_scraped_at?: string | null;
          price_cash?: number;
          price_normal?: number;
          product_id: string;
          stock_quantity?: number | null;
          store_id: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          external_id?: string | null;
          id?: string;
          is_active?: boolean;
          last_scraped_at?: string | null;
          price_cash?: number;
          price_normal?: number;
          product_id?: string;
          stock_quantity?: number | null;
          store_id?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listings_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "api_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listings_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listings_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products_with_prices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listings_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      mod_actions: {
        Row: {
          action: string;
          actor_id: string | null;
          after_snapshot: Json | null;
          before_snapshot: Json | null;
          created_at: string;
          id: string;
          metadata: Json | null;
          reason: string | null;
          target_id: string | null;
          target_type: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after_snapshot?: Json | null;
          before_snapshot?: Json | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          reason?: string | null;
          target_id?: string | null;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after_snapshot?: Json | null;
          before_snapshot?: Json | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          reason?: string | null;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [];
      };
      price_alerts: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          product_id: string;
          target_price: number;
          triggered_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          product_id: string;
          target_price: number;
          triggered_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          product_id?: string;
          target_price?: number;
          triggered_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_alerts_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "api_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_alerts_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_alerts_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products_with_prices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_alerts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      price_history: {
        Row: {
          currency: string;
          id: string;
          listing_id: string;
          price_cash: number;
          price_normal: number;
          recorded_at: string;
        };
        Insert: {
          currency?: string;
          id?: string;
          listing_id: string;
          price_cash: number;
          price_normal: number;
          recorded_at?: string;
        };
        Update: {
          currency?: string;
          id?: string;
          listing_id?: string;
          price_cash?: number;
          price_normal?: number;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_history_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      product_groups: {
        Row: {
          category_id: string | null;
          created_at: string;
          id: string;
          name: string | null;
          updated_at: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          id?: string;
          name?: string | null;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          id?: string;
          name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_groups_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_groups_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "products_with_prices";
            referencedColumns: ["category_id"];
          },
        ];
      };
      product_metrics: {
        Row: {
          clicks_count: number | null;
          product_id: string;
          updated_at: string | null;
          views_count: number | null;
        };
        Insert: {
          clicks_count?: number | null;
          product_id: string;
          updated_at?: string | null;
          views_count?: number | null;
        };
        Update: {
          clicks_count?: number | null;
          product_id?: string;
          updated_at?: string | null;
          views_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_metrics_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "api_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_metrics_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_metrics_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products_with_prices";
            referencedColumns: ["id"];
          },
        ];
      };
      product_recheck_queue: {
        Row: {
          attempts: number;
          id: string;
          last_error: string | null;
          processed_at: string | null;
          product_id: string;
          reason: string | null;
          requested_at: string;
          requested_by: string | null;
          status: string;
        };
        Insert: {
          attempts?: number;
          id?: string;
          last_error?: string | null;
          processed_at?: string | null;
          product_id: string;
          reason?: string | null;
          requested_at?: string;
          requested_by?: string | null;
          status?: string;
        };
        Update: {
          attempts?: number;
          id?: string;
          last_error?: string | null;
          processed_at?: string | null;
          product_id?: string;
          reason?: string | null;
          requested_at?: string;
          requested_by?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_recheck_queue_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "api_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_recheck_queue_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_recheck_queue_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products_with_prices";
            referencedColumns: ["id"];
          },
        ];
      };
      product_reviews: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          is_verified_purchase: boolean;
          product_id: string;
          rating: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          is_verified_purchase?: boolean;
          product_id: string;
          rating: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          is_verified_purchase?: boolean;
          product_id?: string;
          rating?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "api_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products_with_prices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      product_slug_redirects: {
        Row: {
          created_at: string;
          old_slug: string;
          product_id: string;
        };
        Insert: {
          created_at?: string;
          old_slug: string;
          product_id: string;
        };
        Update: {
          created_at?: string;
          old_slug?: string;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_slug_redirects_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "api_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_slug_redirects_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_slug_redirects_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products_with_prices";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          brand_id: string;
          category_id: string;
          created_at: string;
          group_id: string | null;
          id: string;
          image_url: string | null;
          mpn: string | null;
          name: string;
          search_vector: unknown;
          slug: string;
          specs: Json;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          category_id: string;
          created_at?: string;
          group_id?: string | null;
          id?: string;
          image_url?: string | null;
          mpn?: string | null;
          name: string;
          search_vector?: unknown;
          slug: string;
          specs?: Json;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          category_id?: string;
          created_at?: string;
          group_id?: string | null;
          id?: string;
          image_url?: string | null;
          mpn?: string | null;
          name?: string;
          search_vector?: unknown;
          slug?: string;
          specs?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "products_with_prices";
            referencedColumns: ["brand_id"];
          },
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "products_with_prices";
            referencedColumns: ["category_id"];
          },
          {
            foreignKeyName: "products_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "product_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "products_with_prices";
            referencedColumns: ["group_id"];
          },
        ];
      };
      products_canonical: {
        Row: {
          archived_at: string | null;
          created_at: string;
          git_blob_hash: string | null;
          git_commit_hash: string | null;
          id: string;
          is_deleted: boolean;
          last_synced_at: string | null;
          specifications: Json;
          sync_metadata: Json | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          git_blob_hash?: string | null;
          git_commit_hash?: string | null;
          id: string;
          is_deleted?: boolean;
          last_synced_at?: string | null;
          specifications?: Json;
          sync_metadata?: Json | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          git_blob_hash?: string | null;
          git_commit_hash?: string | null;
          id?: string;
          is_deleted?: boolean;
          last_synced_at?: string | null;
          specifications?: Json;
          sync_metadata?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          lang: string;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          lang?: string;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          lang?: string;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      quote_items: {
        Row: {
          category_id: string | null;
          created_at: string;
          id: string;
          listing_id: string | null;
          product_id: string | null;
          quantity: number;
          quote_id: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          id?: string;
          listing_id?: string | null;
          product_id?: string | null;
          quantity?: number;
          quote_id: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          id?: string;
          listing_id?: string | null;
          product_id?: string | null;
          quantity?: number;
          quote_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "products_with_prices";
            referencedColumns: ["category_id"];
          },
          {
            foreignKeyName: "quote_items_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "api_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products_with_prices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      quotes: {
        Row: {
          compatibility_status: Database["public"]["Enums"]["compatibility_status"] | null;
          created_at: string;
          description: string | null;
          estimated_wattage: number | null;
          id: string;
          is_public: boolean;
          last_analyzed_at: string | null;
          name: string;
          updated_at: string;
          user_id: string;
          validation_errors: Json | null;
        };
        Insert: {
          compatibility_status?: Database["public"]["Enums"]["compatibility_status"] | null;
          created_at?: string;
          description?: string | null;
          estimated_wattage?: number | null;
          id?: string;
          is_public?: boolean;
          last_analyzed_at?: string | null;
          name: string;
          updated_at?: string;
          user_id: string;
          validation_errors?: Json | null;
        };
        Update: {
          compatibility_status?: Database["public"]["Enums"]["compatibility_status"] | null;
          created_at?: string;
          description?: string | null;
          estimated_wattage?: number | null;
          id?: string;
          is_public?: boolean;
          last_analyzed_at?: string | null;
          name?: string;
          updated_at?: string;
          user_id?: string;
          validation_errors?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      raw_feed: {
        Row: {
          created_at: string;
          error_message: string | null;
          external_id: string | null;
          id: string;
          ingested_at: string;
          match_candidate_id: string | null;
          match_score: number | null;
          payload: Json;
          processing_status: Database["public"]["Enums"]["feed_processing_status"];
          source: string;
          synced_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          external_id?: string | null;
          id?: string;
          ingested_at?: string;
          match_candidate_id?: string | null;
          match_score?: number | null;
          payload: Json;
          processing_status?: Database["public"]["Enums"]["feed_processing_status"];
          source: string;
          synced_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          external_id?: string | null;
          id?: string;
          ingested_at?: string;
          match_candidate_id?: string | null;
          match_score?: number | null;
          payload?: Json;
          processing_status?: Database["public"]["Enums"]["feed_processing_status"];
          source?: string;
          synced_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_raw_feed_candidate";
            columns: ["match_candidate_id"];
            isOneToOne: false;
            referencedRelation: "products_canonical";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_id: string | null;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target_type"];
        };
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_id?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target_type"];
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason?: Database["public"]["Enums"]["report_reason"];
          reporter_id?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_id?: string;
          target_type?: Database["public"]["Enums"]["report_target_type"];
        };
        Relationships: [];
      };
      store_claim_requests: {
        Row: {
          attempts: number;
          claimant_user_id: string;
          claimed_domain: string;
          created_at: string;
          expires_at: string;
          id: string;
          last_checked_at: string | null;
          last_error: string | null;
          status: string;
          store_id: string | null;
          txt_record_name: string;
          verification_token: string;
          verified_at: string | null;
        };
        Insert: {
          attempts?: number;
          claimant_user_id: string;
          claimed_domain: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          last_checked_at?: string | null;
          last_error?: string | null;
          status?: string;
          store_id?: string | null;
          txt_record_name: string;
          verification_token: string;
          verified_at?: string | null;
        };
        Update: {
          attempts?: number;
          claimant_user_id?: string;
          claimed_domain?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          last_checked_at?: string | null;
          last_error?: string | null;
          status?: string;
          store_id?: string | null;
          txt_record_name?: string;
          verification_token?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "store_claim_requests_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_members: {
        Row: {
          created_at: string;
          id: string;
          invited_by: string | null;
          role: Database["public"]["Enums"]["store_member_role"];
          store_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: Database["public"]["Enums"]["store_member_role"];
          store_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: Database["public"]["Enums"]["store_member_role"];
          store_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_review_helpful: {
        Row: {
          created_at: string;
          review_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          review_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          review_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_review_helpful_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "store_reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      store_reviews: {
        Row: {
          comment: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deleted_reason: string | null;
          helpful_count: number;
          id: string;
          is_pinned: boolean;
          owner_response: string | null;
          owner_response_at: string | null;
          owner_response_by: string | null;
          rating: number;
          store_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
          helpful_count?: number;
          id?: string;
          is_pinned?: boolean;
          owner_response?: string | null;
          owner_response_at?: string | null;
          owner_response_by?: string | null;
          rating: number;
          store_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deleted_reason?: string | null;
          helpful_count?: number;
          id?: string;
          is_pinned?: boolean;
          owner_response?: string | null;
          owner_response_at?: string | null;
          owner_response_by?: string | null;
          rating?: number;
          store_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_reviews_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stores: {
        Row: {
          appearance: string;
          banner_url: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          logo_url: string | null;
          name: string;
          owner_user_id: string | null;
          slug: string;
          social: Json;
          updated_at: string;
          url: string;
          verification_last_checked_at: string | null;
          verified_at: string | null;
          website: string | null;
        };
        Insert: {
          appearance?: string;
          banner_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          name: string;
          owner_user_id?: string | null;
          slug: string;
          social?: Json;
          updated_at?: string;
          url: string;
          verification_last_checked_at?: string | null;
          verified_at?: string | null;
          website?: string | null;
        };
        Update: {
          appearance?: string;
          banner_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          name?: string;
          owner_user_id?: string | null;
          slug?: string;
          social?: Json;
          updated_at?: string;
          url?: string;
          verification_last_checked_at?: string | null;
          verified_at?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      translation_feedback: {
        Row: {
          comment: string | null;
          context_url: string | null;
          created_at: string;
          current_text: string;
          id: string;
          lang: string;
          suggested_text: string;
          translation_key: string;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          comment?: string | null;
          context_url?: string | null;
          created_at?: string;
          current_text: string;
          id?: string;
          lang: string;
          suggested_text: string;
          translation_key: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          comment?: string | null;
          context_url?: string | null;
          created_at?: string;
          current_text?: string;
          id?: string;
          lang?: string;
          suggested_text?: string;
          translation_key?: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      user_bans: {
        Row: {
          banned_at: string;
          banned_by: string | null;
          expires_at: string | null;
          id: string;
          lifted_at: string | null;
          lifted_by: string | null;
          reason: string | null;
          user_id: string;
        };
        Insert: {
          banned_at?: string;
          banned_by?: string | null;
          expires_at?: string | null;
          id?: string;
          lifted_at?: string | null;
          lifted_by?: string | null;
          reason?: string | null;
          user_id: string;
        };
        Update: {
          banned_at?: string;
          banned_by?: string | null;
          expires_at?: string | null;
          id?: string;
          lifted_at?: string | null;
          lifted_by?: string | null;
          reason?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          role: Database["public"]["Enums"]["user_role"];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["user_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      api_products: {
        Row: {
          brand: Json | null;
          brand_slug: string | null;
          category: Json | null;
          category_slug: string | null;
          created_at: string | null;
          group_id: string | null;
          id: string | null;
          image_url: string | null;
          listings_count: number | null;
          mpn: string | null;
          name: string | null;
          popularity_score: number | null;
          prices: Json | null;
          slug: string | null;
          specs: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "product_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "products_with_prices";
            referencedColumns: ["group_id"];
          },
        ];
      };
      products_with_prices: {
        Row: {
          active_listings_count: number | null;
          brand_id: string | null;
          brand_name: string | null;
          brand_slug: string | null;
          category_id: string | null;
          category_name: string | null;
          category_slug: string | null;
          created_at: string | null;
          group_id: string | null;
          group_name: string | null;
          id: string | null;
          image_url: string | null;
          min_price_cash: number | null;
          min_price_normal: number | null;
          mpn: string | null;
          name: string | null;
          slug: string | null;
          specs: Json | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admin_ban_user: {
        Args: { p_expires_at?: string; p_reason?: string; p_user_id: string };
        Returns: string;
      };
      admin_unban_user: { Args: { p_user_id: string }; Returns: undefined };
      authorize:
        | {
            Args: { required_role: Database["public"]["Enums"]["app_role"] };
            Returns: {
              error: true;
            } & "Could not choose the best candidate function between: public.authorize(required_role => text), public.authorize(required_role => app_role). Try renaming the parameters or the function itself in the database so function overloading can be resolved";
          }
        | {
            Args: { required_role: string };
            Returns: {
              error: true;
            } & "Could not choose the best candidate function between: public.authorize(required_role => text), public.authorize(required_role => app_role). Try renaming the parameters or the function itself in the database so function overloading can be resolved";
          };
      claims_due_for_recheck: {
        Args: { p_grace?: string };
        Returns: {
          attempts: number;
          claimant_user_id: string;
          claimed_domain: string;
          created_at: string;
          expires_at: string;
          id: string;
          last_checked_at: string | null;
          last_error: string | null;
          status: string;
          store_id: string | null;
          txt_record_name: string;
          verification_token: string;
          verified_at: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "store_claim_requests";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      confirm_store_claim: {
        Args: { p_claim_id: string };
        Returns: {
          appearance: string;
          banner_url: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          logo_url: string | null;
          name: string;
          owner_user_id: string | null;
          slug: string;
          social: Json;
          updated_at: string;
          url: string;
          verification_last_checked_at: string | null;
          verified_at: string | null;
          website: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "stores";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      custom_access_token_hook: { Args: { event: Json }; Returns: Json };
      enqueue_review_item: { Args: { p_raw_feed_id: string }; Returns: number };
      extract_numeric_value: { Args: { input_text: string }; Returns: number };
      f_norm_mpn: { Args: { mpn: string }; Returns: string };
      fetch_pending_jobs: {
        Args: { limit_count: number };
        Returns: {
          attempts: number;
          brand: string | null;
          category: string;
          context: Json | null;
          created_at: string;
          error_message: string | null;
          id: string;
          mpn: string;
          normalized_title: string | null;
          raw_text: string;
          result: Json | null;
          status: Database["public"]["Enums"]["job_status"];
          updated_at: string;
          url: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "extraction_jobs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      filter_products: {
        Args: {
          p_brand_slug?: string;
          p_category_slug?: string;
          p_limit?: number;
          p_max_price?: number;
          p_min_price?: number;
          p_offset?: number;
          p_search?: string;
          p_sort_by?: string;
          p_specs_filters?: Json;
        };
        Returns: {
          brand: Json;
          category: Json;
          created_at: string;
          group_id: string;
          id: string;
          image_url: string;
          listings_count: number;
          mpn: string;
          name: string;
          popularity_score: number;
          prices: Json;
          slug: string;
          specs: Json;
          total_count: number;
        }[];
      };
      flag_product_for_recheck: {
        Args: { p_product_id: string; p_reason?: string };
        Returns: string;
      };
      get_category_filters: { Args: { p_category_slug: string }; Returns: Json };
      get_comment_thread: {
        Args: { p_limit?: number; p_root_id: string };
        Returns: {
          author_avatar_url: string;
          author_id: string;
          author_username: string;
          body: string;
          created_at: string;
          deleted_at: string;
          deleted_reason: string;
          depth: number;
          edited_at: string;
          id: string;
          parent_id: string;
          path: string;
          root_id: string;
          score: number;
          target_id: string;
          target_type: Database["public"]["Enums"]["comment_target_type"];
        }[];
      };
      get_my_comment_votes: {
        Args: { p_comment_ids: string[] };
        Returns: {
          comment_id: string;
          value: number;
        }[];
      };
      get_next_mod_item: {
        Args: never;
        Returns: {
          details: string;
          enqueued_at: string;
          msg_id: number;
          read_ct: number;
          reason: Database["public"]["Enums"]["report_reason"];
          report_created_at: string;
          report_id: string;
          reporter_id: string;
          status: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_snapshot: Json;
          target_type: Database["public"]["Enums"]["report_target_type"];
        }[];
      };
      get_next_review_item: {
        Args: never;
        Returns: {
          candidate_data: Json;
          candidate_id: string;
          enqueued_at: string;
          match_reasons: Json;
          match_score: number;
          msg_id: number;
          raw_feed_id: string;
          read_ct: number;
          scraped_data: Json;
        }[];
      };
      get_price_drops: {
        Args: {
          limit_count?: number;
          lookback_days?: number;
          min_discount_percent?: number;
        };
        Returns: {
          category_slug: string;
          current_price: number;
          discount_percentage: number;
          previous_price: number;
          product_id: string;
          product_image_url: string;
          product_name: string;
          product_slug: string;
          product_specs: Json;
          store_logo_url: string;
          store_name: string;
        }[];
      };
      get_product_comments: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_product_id: string;
          p_sort?: string;
        };
        Returns: {
          author_avatar_url: string;
          author_id: string;
          author_username: string;
          body: string;
          created_at: string;
          deleted_at: string;
          deleted_reason: string;
          edited_at: string;
          id: string;
          reply_count: number;
          score: number;
          target_id: string;
        }[];
      };
      get_storage_url: {
        Args: { bucket_name: string; file_path: string };
        Returns: string;
      };
      get_store_rating_stats: { Args: { p_store_slug: string }; Returns: Json };
      increment_product_view: { Args: { p_slug: string }; Returns: undefined };
      is_admin: { Args: never; Returns: boolean };
      is_moderator_or_admin: { Args: never; Returns: boolean };
      is_store_member: {
        Args: { p_required_role?: string; p_store_id: string };
        Returns: boolean;
      };
      is_user_banned: { Args: { p_user_id: string }; Returns: boolean };
      log_mod_action: {
        Args: {
          p_action: string;
          p_actor_id: string;
          p_after?: Json;
          p_before?: Json;
          p_metadata?: Json;
          p_reason?: string;
          p_target_id: string;
          p_target_type: string;
        };
        Returns: string;
      };
      quick_search_products: {
        Args: { p_limit?: number; search_term: string };
        Returns: {
          brand_name: string;
          category_name: string;
          current_price: number;
          id: string;
          image_url: string;
          name: string;
          rank: number;
          slug: string;
        }[];
      };
      record_claim_verification_attempt: {
        Args: { p_claim_id: string; p_dns_details?: Json; p_matched: boolean };
        Returns: {
          attempts: number;
          id: string;
          last_checked_at: string;
          last_error: string;
          status: string;
          verified_at: string;
        }[];
      };
      resolve_mod_report: {
        Args: {
          p_decision: string;
          p_msg_id: number;
          p_note?: string;
          p_report_id: string;
        };
        Returns: undefined;
      };
      resolve_review_item: {
        Args: { p_decision: string; p_msg_id: number; p_raw_feed_id: string };
        Returns: undefined;
      };
      search_products: {
        Args: { p_limit?: number; p_offset?: number; search_term: string };
        Returns: {
          active_listings_count: number | null;
          brand_id: string | null;
          brand_name: string | null;
          brand_slug: string | null;
          category_id: string | null;
          category_name: string | null;
          category_slug: string | null;
          created_at: string | null;
          group_id: string | null;
          group_name: string | null;
          id: string | null;
          image_url: string | null;
          min_price_cash: number | null;
          min_price_normal: number | null;
          mpn: string | null;
          name: string | null;
          slug: string | null;
          specs: Json | null;
          updated_at: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "products_with_prices";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      text2ltree: { Args: { "": string }; Returns: unknown };
    };
    Enums: {
      app_role: "user" | "moderator" | "admin";
      comment_target_type: "product";
      compatibility_status: "valid" | "warning" | "incompatible" | "unknown";
      feed_processing_status: "NEW" | "PROCESSING" | "MATCHED" | "FAILED";
      job_status: "pending" | "processing" | "completed" | "failed";
      report_reason:
        | "spam"
        | "harassment"
        | "misleading"
        | "duplicate"
        | "wrong_listing"
        | "broken_link"
        | "inappropriate"
        | "other";
      report_status: "open" | "reviewing" | "resolved" | "dismissed";
      report_target_type: "product" | "comment" | "store_review" | "store";
      store_member_role: "owner" | "editor";
      user_role: "user" | "moderator" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "moderator", "admin"],
      comment_target_type: ["product"],
      compatibility_status: ["valid", "warning", "incompatible", "unknown"],
      feed_processing_status: ["NEW", "PROCESSING", "MATCHED", "FAILED"],
      job_status: ["pending", "processing", "completed", "failed"],
      report_reason: [
        "spam",
        "harassment",
        "misleading",
        "duplicate",
        "wrong_listing",
        "broken_link",
        "inappropriate",
        "other",
      ],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      report_target_type: ["product", "comment", "store_review", "store"],
      store_member_role: ["owner", "editor"],
      user_role: ["user", "moderator", "admin"],
    },
  },
} as const;
