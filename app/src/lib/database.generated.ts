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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          checked_in_at: string | null
          confirmed_by: string | null
          event_id: string
          member_id: string
          reason: string | null
          shift_id: string | null
          status: string
        }
        Insert: {
          checked_in_at?: string | null
          confirmed_by?: string | null
          event_id: string
          member_id: string
          reason?: string | null
          shift_id?: string | null
          status?: string
        }
        Update: {
          checked_in_at?: string | null
          confirmed_by?: string | null
          event_id?: string
          member_id?: string
          reason?: string | null
          shift_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "event_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          avatar_url: string | null
          club_id: string
          display_name: string
          id: string
          is_minor: boolean
          leaderboard_opt_in: boolean
          member_since: string
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          club_id: string
          display_name: string
          id?: string
          is_minor?: boolean
          leaderboard_opt_in?: boolean
          member_since?: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          club_id?: string
          display_name?: string
          id?: string
          is_minor?: boolean
          leaderboard_opt_in?: boolean
          member_since?: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          club_kind: string
          created_at: string
          id: string
          name: string
          season_start: string | null
          settings: Json
          slug: string
        }
        Insert: {
          club_kind?: string
          created_at?: string
          id?: string
          name: string
          season_start?: string | null
          settings?: Json
          slug: string
        }
        Update: {
          club_kind?: string
          created_at?: string
          id?: string
          name?: string
          season_start?: string | null
          settings?: Json
          slug?: string
        }
        Relationships: []
      }
      event_shifts: {
        Row: {
          ends_at: string | null
          event_id: string
          id: string
          needed: number
          point_rule_code: string | null
          starts_at: string | null
          title: string
        }
        Insert: {
          ends_at?: string | null
          event_id: string
          id?: string
          needed?: number
          point_rule_code?: string | null
          starts_at?: string | null
          title: string
        }
        Update: {
          ends_at?: string | null
          event_id?: string
          id?: string
          needed?: number
          point_rule_code?: string | null
          starts_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_shifts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          club_id: string
          created_at: string
          ends_at: string | null
          id: string
          location: string | null
          point_rule_code: string | null
          qr_token: string
          starts_at: string
          team_id: string | null
          title: string
          type: string
        }
        Insert: {
          club_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          location?: string | null
          point_rule_code?: string | null
          qr_token?: string
          starts_at: string
          team_id?: string | null
          title: string
          type: string
        }
        Update: {
          club_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          location?: string | null
          point_rule_code?: string | null
          qr_token?: string
          starts_at?: string
          team_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          club_id: string
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          max_uses: number
          revoked_at: string | null
          role: string
          team_id: string | null
          uses: number
        }
        Insert: {
          club_id: string
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          max_uses?: number
          revoked_at?: string | null
          role?: string
          team_id?: string | null
          uses?: number
        }
        Update: {
          club_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          max_uses?: number
          revoked_at?: string | null
          role?: string
          team_id?: string | null
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "invites_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          club_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          status: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          status?: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          status?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "join_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          body: string | null
          club_id: string | null
          id: string
          image_url: string | null
          published_at: string
          source: string
          team_id: string | null
          title: string
        }
        Insert: {
          body?: string | null
          club_id?: string | null
          id?: string
          image_url?: string | null
          published_at?: string
          source?: string
          team_id?: string | null
          title: string
        }
        Update: {
          body?: string | null
          club_id?: string | null
          id?: string
          image_url?: string | null
          published_at?: string
          source?: string
          team_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          club_id: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          club_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          club_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      point_rules: {
        Row: {
          club_id: string
          code: string
          id: string
          is_active: boolean
          label: string
          meta: Json
          pillar: number
          points: number
        }
        Insert: {
          club_id: string
          code: string
          id?: string
          is_active?: boolean
          label: string
          meta?: Json
          pillar: number
          points: number
        }
        Update: {
          club_id?: string
          code?: string
          id?: string
          is_active?: boolean
          label?: string
          meta?: Json
          pillar?: number
          points?: number
        }
        Relationships: [
          {
            foreignKeyName: "point_rules_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      point_transactions: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          note: string | null
          points: number
          rule_code: string | null
          season: string
          source_id: string | null
          source_type: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id: string
          note?: string | null
          points: number
          rule_code?: string | null
          season: string
          source_id?: string | null
          source_type: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string
          note?: string | null
          points?: number
          rule_code?: string | null
          season?: string
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "point_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["member_id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          claimed_at: string
          confirmed_at: string | null
          confirmed_by: string | null
          id: string
          kudos: string | null
          member_id: string
          proof_url: string | null
          submitted_at: string | null
          task_id: string
        }
        Insert: {
          claimed_at?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          id?: string
          kudos?: string | null
          member_id: string
          proof_url?: string | null
          submitted_at?: string | null
          task_id: string
        }
        Update: {
          claimed_at?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          id?: string
          kudos?: string | null
          member_id?: string
          proof_url?: string | null
          submitted_at?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "task_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category: string | null
          club_id: string
          created_at: string
          created_by: string
          description: string | null
          due_at: string | null
          id: string
          max_assignees: number
          points: number
          status: string
          task_type: string
          team_id: string | null
          title: string
        }
        Insert: {
          category?: string | null
          club_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_at?: string | null
          id?: string
          max_assignees?: number
          points?: number
          status?: string
          task_type?: string
          team_id?: string | null
          title: string
        }
        Update: {
          category?: string | null
          club_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string | null
          id?: string
          max_assignees?: number
          points?: number
          status?: string
          task_type?: string
          team_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          member_id: string
          role: string
          team_id: string
        }
        Insert: {
          member_id: string
          role?: string
          team_id: string
        }
        Update: {
          member_id?: string
          role?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          club_id: string
          id: string
          name: string
        }
        Insert: {
          club_id: string
          id?: string
          name: string
        }
        Update: {
          club_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          avatar_url: string | null
          club_id: string | null
          display_name: string | null
          member_id: string | null
          rank: number | null
          season: string | null
          team_id: string | null
          total_points: number | null
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
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      award_points: {
        Args: {
          p_member_id: string
          p_note?: string
          p_rule_code: string
          p_source_id?: string
          p_source_type: string
        }
        Returns: number
      }
      check_in: {
        Args: { p_event_id: string; p_qr_token: string }
        Returns: {
          already_checked_in: boolean
          points_awarded: number
        }[]
      }
      claim_task: { Args: { p_task_id: string }; Returns: string }
      clubs_left_without_admin: {
        Args: { p_user_id: string }
        Returns: {
          club_id: string
          club_name: string
        }[]
      }
      confirm_shift: {
        Args: { p_event_id: string; p_member_id: string }
        Returns: number
      }
      confirm_task: {
        Args: { p_assignment_id: string; p_kudos?: string }
        Returns: number
      }
      count_club_admins: {
        Args: { p_club_id: string; p_except?: string }
        Returns: number
      }
      create_club: {
        Args: {
          p_club_kind?: string
          p_kind_label?: string
          p_name: string
          p_season_start?: string
        }
        Returns: string
      }
      current_member_id: { Args: { p_club_id: string }; Returns: string }
      decide_join_request: {
        Args: {
          p_approve: boolean
          p_request_id: string
          p_role?: string
          p_team_id?: string
        }
        Returns: string
      }
      default_event_labels: { Args: { p_club_kind: string }; Returns: Json }
      default_season_start: { Args: { p_club_kind: string }; Returns: string }
      delete_my_account: { Args: never; Returns: undefined }
      find_club_by_slug: {
        Args: { p_slug: string }
        Returns: {
          club_id: string
          club_name: string
        }[]
      }
      is_club_admin: { Args: { p_club_id: string }; Returns: boolean }
      is_club_member: { Args: { p_club_id: string }; Returns: boolean }
      my_clubs_left_without_admin: {
        Args: never
        Returns: {
          club_id: string
          club_name: string
        }[]
      }
      notify: {
        Args: {
          p_body?: string
          p_category: string
          p_club_id?: string
          p_link?: string
          p_title: string
          p_user_id: string
        }
        Returns: undefined
      }
      preview_invite: {
        Args: { p_code: string }
        Returns: {
          club_id: string
          club_name: string
          is_valid: boolean
          reason: string
          role: string
          team_name: string
        }[]
      }
      redeem_invite: {
        Args: { p_code: string; p_display_name?: string }
        Returns: string
      }
      request_join: {
        Args: { p_club_id: string; p_team_id?: string }
        Returns: string
      }
      season_label: {
        Args: { p_at?: string; p_club_id: string }
        Returns: string
      }
      seed_point_rules: {
        Args: { p_club_id: string; p_club_kind: string }
        Returns: undefined
      }
      set_member_teams: {
        Args: { p_member_id: string; p_team_ids: string[] }
        Returns: undefined
      }
      slugify: { Args: { p_value: string }; Returns: string }
      withdraw_join_request: {
        Args: { p_request_id: string }
        Returns: undefined
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
