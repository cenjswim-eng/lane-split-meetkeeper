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
      access_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          email: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          email: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          email?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      app_owner: {
        Row: {
          singleton: boolean
          user_id: string
        }
        Insert: {
          singleton?: boolean
          user_id: string
        }
        Update: {
          singleton?: boolean
          user_id?: string
        }
        Relationships: []
      }
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
          owner_id: string | null
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
          owner_id?: string | null
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
          owner_id?: string | null
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
      club_documents: {
        Row: {
          club_id: string
          file_name: string
          id: string
          owner_id: string | null
          storage_path: string
          table_summary: Json
          uploaded_at: string
        }
        Insert: {
          club_id: string
          file_name: string
          id?: string
          owner_id?: string | null
          storage_path: string
          table_summary?: Json
          uploaded_at?: string
        }
        Update: {
          club_id?: string
          file_name?: string
          id?: string
          owner_id?: string | null
          storage_path?: string
          table_summary?: Json
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_documents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          active: boolean
          birth_date: string | null
          club_id: string
          document_id: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          member_role: string
          notes: string
          owner_id: string | null
          phone: string | null
          source_key: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          birth_date?: string | null
          club_id: string
          document_id?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name?: string
          member_role?: string
          notes?: string
          owner_id?: string | null
          phone?: string | null
          source_key?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          birth_date?: string | null
          club_id?: string
          document_id?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          member_role?: string
          notes?: string
          owner_id?: string | null
          phone?: string | null
          source_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "club_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          id: string
          logo_path: string | null
          name: string
          owner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          owner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          owner_id?: string | null
        }
        Relationships: []
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
          owner_id: string | null
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
          owner_id?: string | null
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
          owner_id?: string | null
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
          owner_id: string | null
        }
        Insert: {
          code: string
          id?: string
          name: string
          owner_id?: string | null
        }
        Update: {
          code?: string
          id?: string
          name?: string
          owner_id?: string | null
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          id: string
          owner_id: string | null
          summary: Json | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type: string
          id?: string
          owner_id?: string | null
          summary?: Json | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          id?: string
          owner_id?: string | null
          summary?: Json | null
        }
        Relationships: []
      }
      meet_entries: {
        Row: {
          athlete_id: string
          created_at: string
          event_id: string
          id: string
          meet_id: string
          owner_id: string
          seed_time_ms: number | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          event_id: string
          id?: string
          meet_id: string
          owner_id?: string
          seed_time_ms?: number | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          event_id?: string
          id?: string
          meet_id?: string
          owner_id?: string
          seed_time_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meet_entries_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meet_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meet_entries_meet_id_fkey"
            columns: ["meet_id"]
            isOneToOne: false
            referencedRelation: "meets"
            referencedColumns: ["id"]
          },
        ]
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
          owner_id: string | null
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
          owner_id?: string | null
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
          owner_id?: string | null
          start_date?: string | null
        }
        Relationships: []
      }
      profile_settings: {
        Row: {
          accent_color: string
          display_name: string
          primary_color: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string
          display_name?: string
          primary_color?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          accent_color?: string
          display_name?: string
          primary_color?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      record_transfers: {
        Row: {
          copied: number
          created_at: string
          id: string
          owner_id: string
          skipped: number
          target_athlete_id: string
          undone_at: string | null
        }
        Insert: {
          copied?: number
          created_at?: string
          id?: string
          owner_id?: string
          skipped?: number
          target_athlete_id: string
          undone_at?: string | null
        }
        Update: {
          copied?: number
          created_at?: string
          id?: string
          owner_id?: string
          skipped?: number
          target_athlete_id?: string
          undone_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "record_transfers_target_athlete_id_fkey"
            columns: ["target_athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
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
          origin_team: string | null
          owner_id: string | null
          place: number | null
          round: string | null
          seed_time_ms: number | null
          source_result_id: string | null
          stroke_rate: number | null
          transfer_id: string | null
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
          origin_team?: string | null
          owner_id?: string | null
          place?: number | null
          round?: string | null
          seed_time_ms?: number | null
          source_result_id?: string | null
          stroke_rate?: number | null
          transfer_id?: string | null
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
          origin_team?: string | null
          owner_id?: string | null
          place?: number | null
          round?: string | null
          seed_time_ms?: number | null
          source_result_id?: string | null
          stroke_rate?: number | null
          transfer_id?: string | null
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
          {
            foreignKeyName: "results_source_result_id_fkey"
            columns: ["source_result_id"]
            isOneToOne: false
            referencedRelation: "results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "record_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      splits: {
        Row: {
          cumulative_time_ms: number
          id: string
          lap_time_ms: number | null
          owner_id: string | null
          result_id: string
          split_distance: number
        }
        Insert: {
          cumulative_time_ms: number
          id?: string
          lap_time_ms?: number | null
          owner_id?: string | null
          result_id: string
          split_distance: number
        }
        Update: {
          cumulative_time_ms?: number
          id?: string
          lap_time_ms?: number | null
          owner_id?: string | null
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
      standard_versions: {
        Row: {
          active: boolean
          document_name: string
          effective_from: string | null
          id: string
          imported_at: string | null
          owner_id: string
          season_year: number | null
          standards: Json
          warnings: Json
        }
        Insert: {
          active?: boolean
          document_name: string
          effective_from?: string | null
          id?: string
          imported_at?: string | null
          owner_id?: string
          season_year?: number | null
          standards: Json
          warnings?: Json
        }
        Update: {
          active?: boolean
          document_name?: string
          effective_from?: string | null
          id?: string
          imported_at?: string | null
          owner_id?: string
          season_year?: number | null
          standards?: Json
          warnings?: Json
        }
        Relationships: []
      }
      swim_categories: {
        Row: {
          age_max: number | null
          age_min: number | null
          created_at: string
          id: string
          name: string
          owner_id: string
          sort: number
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          sort?: number
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          sort?: number
        }
        Relationships: []
      }
      teams: {
        Row: {
          code: string
          created_at: string
          id: string
          lsc: string | null
          name: string
          owner_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          lsc?: string | null
          name: string
          owner_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          lsc?: string | null
          name?: string
          owner_id?: string | null
        }
        Relationships: []
      }
      time_standards: {
        Row: {
          age_group: string | null
          age_max: number | null
          age_min: number | null
          course: string
          distance: number
          gender: string | null
          id: string
          name: string
          owner_id: string | null
          qualifying_time_ms: number
          season_year: number | null
          stroke: number
        }
        Insert: {
          age_group?: string | null
          age_max?: number | null
          age_min?: number | null
          course: string
          distance: number
          gender?: string | null
          id?: string
          name: string
          owner_id?: string | null
          qualifying_time_ms: number
          season_year?: number | null
          stroke: number
        }
        Update: {
          age_group?: string | null
          age_max?: number | null
          age_min?: number | null
          course?: string
          distance?: number
          gender?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          qualifying_time_ms?: number
          season_year?: number | null
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
      activate_standard_version: { Args: { p_id: string }; Returns: undefined }
      copy_athlete_history: {
        Args: { _results: string[]; _target: string }
        Returns: Json
      }
      decide_app_access: {
        Args: { p_approve: boolean; p_id: string }
        Returns: undefined
      }
      find_athlete_record_sources: {
        Args: { _name?: string; _target: string }
        Returns: {
          birth_date: string
          federation_id: string
          first_name: string
          gender: string
          id: string
          last_name: string
          match: string
          results: number
          team: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_club_members: {
        Args: { p_club_id: string; p_document_id: string; p_members: Json }
        Returns: number
      }
      import_standard_version: {
        Args: {
          p_document: string
          p_effective?: string
          p_standards?: Json
          p_warnings?: Json
          p_year?: number
        }
        Returns: string
      }
      is_app_owner: { Args: never; Returns: boolean }
      request_app_access: { Args: never; Returns: Json }
      reset_management_data: {
        Args: { p_confirmation: string }
        Returns: undefined
      }
      resolve_import_event: {
        Args: {
          p_distance: number
          p_gender: string
          p_max_age: number
          p_meet_id: string
          p_min_age: number
          p_number: string
          p_stroke: number
        }
        Returns: string
      }
      resolve_import_identity: {
        Args: { p_data: Json; p_kind: string }
        Returns: string
      }
      resolve_import_meet: {
        Args: {
          p_course: string
          p_end_date: string
          p_location: string
          p_name: string
          p_start_date: string
        }
        Returns: string
      }
      set_app_access_suspended: {
        Args: { p_id: string; p_suspend: boolean }
        Returns: undefined
      }
      swim_name_key: { Args: { _t: string }; Returns: string }
      transfer_athlete_records: {
        Args: { _club?: string; _name?: string; _target: string }
        Returns: Json
      }
      transfer_selected_athlete_records: {
        Args: { _sources: string[]; _target: string }
        Returns: Json
      }
      undo_athlete_history: { Args: { _transfer: string }; Returns: number }
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
