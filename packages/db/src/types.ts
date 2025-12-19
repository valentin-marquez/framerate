export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      ai_extraction_jobs: {
        Row: {
          attempts: number;
          category: string;
          context: Json | null;
          created_at: string;
          error_message: string | null;
          id: string;
          mpn: string;
          raw_text: string;
          result: Json | null;
          status: Database["public"]["Enums"]["job_status"];
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          category: string;
          context?: Json | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          mpn: string;
          raw_text: string;
          result?: Json | null;
          status?: Database["public"]["Enums"]["job_status"];
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          category?: string;
          context?: Json | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          mpn?: string;
          raw_text?: string;
          result?: Json | null;
          status?: Database["public"]["Enums"]["job_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
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
      cached_specs_extractions: {
        Row: {
          created_at: string;
          id: string;
          mpn: string;
          specs: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          mpn: string;
          specs?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          mpn?: string;
          specs?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
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
      listings: {
        Row: {
          created_at: string;
          currency: string;
          external_id: string | null;
          id: string;
          is_active: boolean;
          last_scraped_at: string | null;
          price_cash: number | null;
          price_normal: number | null;
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
          price_cash?: number | null;
          price_normal?: number | null;
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
          price_cash?: number | null;
          price_normal?: number | null;
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
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          id: string;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          id: string;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          id?: string;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      quote_items: {
        Row: {
          created_at: string;
          id: string;
          product_id: string;
          quantity: number;
          quote_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id: string;
          quantity?: number;
          quote_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string;
          quantity?: number;
          quote_id?: string;
        };
        Relationships: [
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
          created_at: string;
          description: string | null;
          id: string;
          is_public: boolean;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string;
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
      store_reviews: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          rating: number;
          store_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating: number;
          store_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
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
          created_at: string;
          id: string;
          is_active: boolean;
          logo_url: string | null;
          name: string;
          slug: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          name: string;
          slug: string;
          url: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          name?: string;
          slug?: string;
          url?: string;
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
      extract_numeric_value: { Args: { input_text: string }; Returns: number };
      fetch_pending_jobs: {
        Args: { limit_count: number };
        Returns: {
          attempts: number;
          category: string;
          context: Json | null;
          created_at: string;
          error_message: string | null;
          id: string;
          mpn: string;
          raw_text: string;
          result: Json | null;
          status: Database["public"]["Enums"]["job_status"];
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "ai_extraction_jobs";
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
      get_category_filters: { Args: { p_category_slug: string }; Returns: Json };
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
      get_storage_url: {
        Args: { bucket_name: string; file_path: string };
        Returns: string;
      };
      increment_product_view: { Args: { p_slug: string }; Returns: undefined };
    };
    Enums: {
      job_status: "pending" | "processing" | "completed" | "failed";
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
      job_status: ["pending", "processing", "completed", "failed"],
    },
  },
} as const;
