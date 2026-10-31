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
      athletes: {
        Row: {
          active_status: boolean
          birth_date: string | null
          created_at: string
          federation_id: string | null
          first_name: string
          gender: string | null
          group_id: string | null
          id: string
          last_name: string
          team_id: string | null
          tm_athlete_id: string | null
        }
        Insert: {
          active_status?: boolean
          birth_date?: string | null
          created_at?: string
          federation_id?: string | null
          first_name: string
          gender?: string | null
          group_id?: string | null
          id?: string
          last_name: string
          team_id?: string | null
          tm_athlete_id?: string | null
        }
        Update: {
          active_status?: boolean
          birth_date?: string | null
          created_at?: string
          federation_id?: string | null
          first_name?: string
          gender?: string | null
          group_id?: string | null
          id?: string
          last_name?: string
          team_id?: string | null
          tm_athlete_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athletes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          distance: number
          event_number: string | null
          gender: string | null
          id: string
          is_relay: boolean
          max_age: number | null
          meet_id: string
          min_age: number | null
          stroke: number
        }
        Insert: {
          distance: number
          event_number?: string | null
          gender?: string | null
          id?: string
          is_relay?: boolean
          max_age?: number | null
          meet_id: string
          min_age?: number | null
          stroke: number
        }
        Update: {
          distance?: number
          event_number?: string | null
          gender?: string | null
          id?: string
          is_relay?: boolean
          max_age?: number | null
          meet_id?: string
          min_age?: number | null
          stroke?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_meet_id_fkey"
            columns: ["meet_id"]
            isOneToOne: false
            referencedRelation: "meets"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          code: string
          id: string
          name: string
        }
        Insert: {
          code: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          id: string
          summary: Json | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type: string
          id?: string
          summary?: Json | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          id?: string
          summary?: Json | null
        }
        Relationships: []
      }
      meets: {
        Row: {
          altitude: number | null
          course: string
          created_at: string
          end_date: string | null
          id: string
          location: string | null
          name: string
          start_date: string | null
        }
        Insert: {
          altitude?: number | null
          course?: string
          created_at?: string
          end_date?: string | null
          id?: string
          location?: string | null
          name: string
          start_date?: string | null
        }
        Update: {
          altitude?: number | null
          course?: string
          created_at?: string
          end_date?: string | null
          id?: string
          location?: string | null
          name?: string
          start_date?: string | null
        }
        Relationships: []
      }
      results: {
        Row: {
          aqua_points: number | null
          athlete_id: string
          course: string | null
          created_at: string
          event_id: string | null
          final_time_ms: number | null
          id: string
          is_dq: boolean
          meet_id: string
          place: number | null
          round: string | null
          seed_time_ms: number | null
          stroke_rate: number | null
          video_url: string | null
        }
        Insert: {
          aqua_points?: number | null
          athlete_id: string
          course?: string | null
          created_at?: string
          event_id?: string | null
          final_time_ms?: number | null
          id?: string
          is_dq?: boolean
          meet_id: string
          place?: number | null
          round?: string | null
          seed_time_ms?: number | null
          stroke_rate?: number | null
          video_url?: string | null
        }
        Update: {
          aqua_points?: number | null
          athlete_id?: string
          course?: string | null
          created_at?: string
          event_id?: string | null
          final_time_ms?: number | null
          id?: string
          is_dq?: boolean
          meet_id?: string
          place?: number | null
          round?: string | null
          seed_time_ms?: number | null
          stroke_rate?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "results_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_meet_id_fkey"
            columns: ["meet_id"]
            isOneToOne: false
            referencedRelation: "meets"
            referencedColumns: ["id"]
          },
        ]
      }
      splits: {
        Row: {
          cumulative_time_ms: number
          id: string
          lap_time_ms: number | null
          result_id: string
          split_distance: number
        }
        Insert: {
          cumulative_time_ms: number
          id?: string
          lap_time_ms?: number | null
          result_id: string
          split_distance: number
        }
        Update: {
          cumulative_time_ms?: number
          id?: string
          lap_time_ms?: number | null
          result_id?: string
          split_distance?: number
        }
        Relationships: [
          {
            foreignKeyName: "splits_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "results"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          code: string
          created_at: string
          id: string
          lsc: string | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          lsc?: string | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          lsc?: string | null
          name?: string
        }
        Relationships: []
      }
      time_standards: {
        Row: {
          age_group: string | null
          course: string
          distance: number
          gender: string | null
          id: string
          name: string
          qualifying_time_ms: number
          stroke: number
        }
        Insert: {
          age_group?: string | null
          course: string
          distance: number
          gender?: string | null
          id?: string
          name: string
          qualifying_time_ms: number
          stroke: number
        }
        Update: {
          age_group?: string | null
          course?: string
          distance?: number
          gender?: string | null
          id?: string
          name?: string
          qualifying_time_ms?: number
          stroke?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
    }
    Enums: {
      app_role: "admin"
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
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
