export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          completed_at: string | null
          content: string | null
          created_at: string
          id: string
          lead_id: string | null
          scheduled_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          content?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          scheduled_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          content?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          scheduled_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          area: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          name: string
          opportunity_score: number
          phone: string | null
          segment: string | null
          source: string
          state: string | null
          updated_at: string
          user_id: string
          website: string | null
          website_status: string
        }
        Insert: {
          area?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
          opportunity_score?: number
          phone?: string | null
          segment?: string | null
          source?: string
          state?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          website_status?: string
        }
        Update: {
          area?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          opportunity_score?: number
          phone?: string | null
          segment?: string | null
          source?: string
          state?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          website_status?: string
        }
        Relationships: []
      }
      pipeline_items: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          stage: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          stage?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          stage?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string
          plan_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
          plan_code?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          plan_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          amount: number
          created_at: string
          id: string
          lead_id: string | null
          sold_at: string
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          lead_id?: string | null
          sold_at?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          lead_id?: string | null
          sold_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      searches: {
        Row: {
          area: string | null
          city: string | null
          country: string | null
          created_at: string
          filters: Json
          id: string
          result_count: number
          segment: string | null
          state: string | null
          user_id: string
        }
        Insert: {
          area?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          filters?: Json
          id?: string
          result_count?: number
          segment?: string | null
          state?: string | null
          user_id: string
        }
        Update: {
          area?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          filters?: Json
          id?: string
          result_count?: number
          segment?: string | null
          state?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          external_id: string | null
          id: string
          plan_code: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          cancel_at_period_end: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_id?: string | null
          id?: string
          plan_code?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          cancel_at_period_end?: boolean
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_id?: string | null
          id?: string
          plan_code?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          cancel_at_period_end?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: { id: string; provider: string; event_id: string; event_type: string; payload: Json; processed: boolean; created_at: string; processed_at: string | null }
        Insert: { id?: string; provider: string; event_id: string; event_type: string; payload?: Json; processed?: boolean; created_at?: string; processed_at?: string | null }
        Update: { id?: string; provider?: string; event_id?: string; event_type?: string; payload?: Json; processed?: boolean; created_at?: string; processed_at?: string | null }
        Relationships: []
      }
      gateway_settings: {
        Row: { id: boolean; provider: string; mode: string; public_key: string | null; webhook_url: string | null; enabled: boolean; updated_at: string }
        Insert: { id?: boolean; provider?: string; mode?: string; public_key?: string | null; webhook_url?: string | null; enabled?: boolean; updated_at?: string }
        Update: { id?: boolean; provider?: string; mode?: string; public_key?: string | null; webhook_url?: string | null; enabled?: boolean; updated_at?: string }
        Relationships: []
      }
      plan_settings: {
        Row: { plan_code: string; name: string; price: number; search_limit: number | null; companies_per_search: number; ai_limit: number | null; renewable: boolean; updated_at: string }
        Insert: { plan_code: string; name: string; price?: number; search_limit?: number | null; companies_per_search?: number; ai_limit?: number | null; renewable?: boolean; updated_at?: string }
        Update: { plan_code?: string; name?: string; price?: number; search_limit?: number | null; companies_per_search?: number; ai_limit?: number | null; renewable?: boolean; updated_at?: string }
        Relationships: []
      }
      usage_monthly: {
        Row: {
          ai_count: number
          created_at: string
          id: string
          month_start: string
          search_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_count?: number
          created_at?: string
          id?: string
          month_start: string
          search_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_count?: number
          created_at?: string
          id?: string
          month_start?: string
          search_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }\n      consume_ai: {
        Args: never
        Returns: {
          allowed: boolean
          plan_code: string
          renewable: boolean
          usage_limit: number
          used: number
        }[]
      }
      consume_search: {
        Args: {
          p_area?: string
          p_city?: string
          p_country?: string
          p_filters?: Json
          p_result_count?: number
          p_segment?: string
          p_state?: string
        }
        Returns: {
          allowed: boolean
          plan_code: string
          renewable: boolean
          usage_limit: number
          used: number
        }[]
      }
      plan_limits: {
        Args: { p_plan: string }
        Returns: {
          ai_limit: number
          companies_per_search: number
          renewable: boolean
          search_limit: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
