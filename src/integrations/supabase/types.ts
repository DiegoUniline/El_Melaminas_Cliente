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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      client_billing: {
        Row: {
          balance: number
          client_id: string
          created_at: string
          first_billing_date: string
          id: string
          installation_cost: number
          installation_date: string
          monthly_fee: number
          updated_at: string
        }
        Insert: {
          balance?: number
          client_id: string
          created_at?: string
          first_billing_date: string
          id?: string
          installation_cost?: number
          installation_date: string
          monthly_fee: number
          updated_at?: string
        }
        Update: {
          balance?: number
          client_id?: string
          created_at?: string
          first_billing_date?: string
          id?: string
          installation_cost?: number
          installation_date?: string
          monthly_fee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_billing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          city: string
          contract_page1: string | null
          contract_page2: string | null
          created_at: string
          created_by: string | null
          exterior_number: string
          first_name: string
          id: string
          ine_other_back: string | null
          ine_other_front: string | null
          ine_subscriber_back: string | null
          ine_subscriber_front: string | null
          interior_number: string | null
          last_name_materno: string | null
          last_name_paterno: string
          neighborhood: string
          phone1: string
          phone2: string | null
          phone3: string | null
          postal_code: string | null
          prospect_id: string | null
          status: Database["public"]["Enums"]["client_status"]
          street: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          city: string
          contract_page1?: string | null
          contract_page2?: string | null
          created_at?: string
          created_by?: string | null
          exterior_number: string
          first_name: string
          id?: string
          ine_other_back?: string | null
          ine_other_front?: string | null
          ine_subscriber_back?: string | null
          ine_subscriber_front?: string | null
          interior_number?: string | null
          last_name_materno?: string | null
          last_name_paterno: string
          neighborhood: string
          phone1: string
          phone2?: string | null
          phone3?: string | null
          postal_code?: string | null
          prospect_id?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          street: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          city?: string
          contract_page1?: string | null
          contract_page2?: string | null
          created_at?: string
          created_by?: string | null
          exterior_number?: string
          first_name?: string
          id?: string
          ine_other_back?: string | null
          ine_other_front?: string | null
          ine_subscriber_back?: string | null
          ine_subscriber_front?: string | null
          interior_number?: string | null
          last_name_materno?: string | null
          last_name_paterno?: string
          neighborhood?: string
          phone1?: string
          phone2?: string | null
          phone3?: string | null
          postal_code?: string | null
          prospect_id?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          street?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          antenna_brand: string | null
          antenna_ip: string | null
          antenna_mac: string | null
          antenna_model: string | null
          antenna_ssid: string | null
          client_id: string
          created_at: string
          id: string
          installation_date: string | null
          installer_name: string | null
          router_brand: string | null
          router_ip: string | null
          router_mac: string | null
          router_model: string | null
          router_network_name: string | null
          router_password: string | null
          router_serial: string | null
          updated_at: string
        }
        Insert: {
          antenna_brand?: string | null
          antenna_ip?: string | null
          antenna_mac?: string | null
          antenna_model?: string | null
          antenna_ssid?: string | null
          client_id: string
          created_at?: string
          id?: string
          installation_date?: string | null
          installer_name?: string | null
          router_brand?: string | null
          router_ip?: string | null
          router_mac?: string | null
          router_model?: string | null
          router_network_name?: string | null
          router_password?: string | null
          router_serial?: string | null
          updated_at?: string
        }
        Update: {
          antenna_brand?: string | null
          antenna_ip?: string | null
          antenna_mac?: string | null
          antenna_model?: string | null
          antenna_ssid?: string | null
          client_id?: string
          created_at?: string
          id?: string
          installation_date?: string | null
          installer_name?: string | null
          router_brand?: string | null
          router_ip?: string | null
          router_mac?: string | null
          router_model?: string | null
          router_network_name?: string | null
          router_password?: string | null
          router_serial?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_type: string | null
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payer_name: string | null
          payer_phone: string | null
          payment_date: string
          payment_type: string
          period_month: number | null
          period_year: number | null
          receipt_number: string | null
        }
        Insert: {
          amount: number
          bank_type?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_date?: string
          payment_type: string
          period_month?: number | null
          period_year?: number | null
          receipt_number?: string | null
        }
        Update: {
          amount?: number
          bank_type?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_date?: string
          payment_type?: string
          period_month?: number | null
          period_year?: number | null
          receipt_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          antenna_ip: string | null
          assigned_date: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          city: string
          created_at: string
          created_by: string | null
          exterior_number: string
          finalized_at: string | null
          first_name: string
          id: string
          interior_number: string | null
          last_name_materno: string | null
          last_name_paterno: string
          neighborhood: string
          notes: string | null
          phone1: string
          phone2: string | null
          phone3_signer: string | null
          postal_code: string | null
          request_date: string
          ssid: string | null
          status: Database["public"]["Enums"]["prospect_status"]
          street: string
          updated_at: string
          work_type: string | null
        }
        Insert: {
          antenna_ip?: string | null
          assigned_date?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          city: string
          created_at?: string
          created_by?: string | null
          exterior_number: string
          finalized_at?: string | null
          first_name: string
          id?: string
          interior_number?: string | null
          last_name_materno?: string | null
          last_name_paterno: string
          neighborhood: string
          notes?: string | null
          phone1: string
          phone2?: string | null
          phone3_signer?: string | null
          postal_code?: string | null
          request_date?: string
          ssid?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          street: string
          updated_at?: string
          work_type?: string | null
        }
        Update: {
          antenna_ip?: string | null
          assigned_date?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          city?: string
          created_at?: string
          created_by?: string | null
          exterior_number?: string
          finalized_at?: string | null
          first_name?: string
          id?: string
          interior_number?: string | null
          last_name_materno?: string | null
          last_name_paterno?: string
          neighborhood?: string
          notes?: string | null
          phone1?: string
          phone2?: string | null
          phone3_signer?: string | null
          postal_code?: string | null
          request_date?: string
          ssid?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          street?: string
          updated_at?: string
          work_type?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "employee"
      client_status: "active" | "cancelled"
      prospect_status: "pending" | "finalized" | "cancelled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "employee"],
      client_status: ["active", "cancelled"],
      prospect_status: ["pending", "finalized", "cancelled"],
    },
  },
} as const
