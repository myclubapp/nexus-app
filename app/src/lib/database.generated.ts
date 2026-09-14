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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          checked_in_at: string | null
          confirmed_by: string | null
          decline_reason: string | null
          event_id: string
          id: string
          member_id: string
          responded_at: string | null
          shift_id: string | null
          status: string
        }
        Insert: {
          checked_in_at?: string | null
          confirmed_by?: string | null
          decline_reason?: string | null
          event_id: string
          id?: string
          member_id: string
          responded_at?: string | null
          shift_id?: string | null
          status?: string
        }
        Update: {
          checked_in_at?: string | null
          confirmed_by?: string | null
          decline_reason?: string | null
          event_id?: string
          id?: string
          member_id?: string
          responded_at?: string | null
          shift_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
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
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_shift_event_fkey"
            columns: ["shift_id", "event_id"]
            isOneToOne: false
            referencedRelation: "event_shifts"
            referencedColumns: ["id", "event_id"]
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
      billing_outbox: {
        Row: {
          club_id: string
          created_at: string
          id: number
          member_id: string
          operation: string
          sent_at: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: number
          member_id: string
          operation: string
          sent_at?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: number
          member_id?: string
          operation?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_outbox_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_outbox_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "billing_outbox_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_invitations: {
        Row: {
          answered_at: string | null
          asked_on: string
          club_id: string
          context: string
          created_at: string
          event_id: string | null
          id: string
          member_id: string
          skipped_at: string | null
        }
        Insert: {
          answered_at?: string | null
          asked_on?: string
          club_id: string
          context: string
          created_at?: string
          event_id?: string | null
          id?: string
          member_id: string
          skipped_at?: string | null
        }
        Update: {
          answered_at?: string | null
          asked_on?: string
          club_id?: string
          context?: string
          created_at?: string
          event_id?: string | null
          id?: string
          member_id?: string
          skipped_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkin_invitations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_invitations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "checkin_invitations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_prompts: {
        Row: {
          club_id: string
          context: string
          id: string
          is_active: boolean
          question: string
          scale: string
          sort: number
        }
        Insert: {
          club_id: string
          context: string
          id?: string
          is_active?: boolean
          question: string
          scale: string
          sort?: number
        }
        Update: {
          club_id?: string
          context?: string
          id?: string
          is_active?: boolean
          question?: string
          scale?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "checkin_prompts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_responses: {
        Row: {
          club_id: string
          created_at: string
          event_id: string | null
          id: string
          invitation_id: string
          member_id: string
          prompt_id: string
          value_num: number | null
          value_text: string | null
          visibility: string
        }
        Insert: {
          club_id: string
          created_at?: string
          event_id?: string | null
          id?: string
          invitation_id: string
          member_id: string
          prompt_id: string
          value_num?: number | null
          value_text?: string | null
          visibility?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          event_id?: string | null
          id?: string
          invitation_id?: string
          member_id?: string
          prompt_id?: string
          value_num?: number | null
          value_text?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_responses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_responses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_responses_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "checkin_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_responses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "checkin_responses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_responses_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "checkin_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      club_churn_stats: {
        Row: {
          club_id: string
          left_count: number
          season: string
          signalled_count: number
        }
        Insert: {
          club_id: string
          left_count?: number
          season: string
          signalled_count?: number
        }
        Update: {
          club_id?: string
          left_count?: number
          season?: string
          signalled_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_churn_stats_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          area: string | null
          avatar_url: string | null
          club_id: string
          display_name: string
          first_name: string | null
          health_opt_out: boolean
          id: string
          is_minor: boolean
          last_name: string | null
          leaderboard_opt_in: boolean
          legacy_user_id: string | null
          member_since: string
          privacy: Json
          role: string
          season_goal_points: number | null
          status: string
          user_id: string | null
        }
        Insert: {
          area?: string | null
          avatar_url?: string | null
          club_id: string
          display_name: string
          first_name?: string | null
          health_opt_out?: boolean
          id?: string
          is_minor?: boolean
          last_name?: string | null
          leaderboard_opt_in?: boolean
          legacy_user_id?: string | null
          member_since?: string
          privacy?: Json
          role?: string
          season_goal_points?: number | null
          status?: string
          user_id?: string | null
        }
        Update: {
          area?: string | null
          avatar_url?: string | null
          club_id?: string
          display_name?: string
          first_name?: string | null
          health_opt_out?: boolean
          id?: string
          is_minor?: boolean
          last_name?: string | null
          leaderboard_opt_in?: boolean
          legacy_user_id?: string | null
          member_since?: string
          privacy?: Json
          role?: string
          season_goal_points?: number | null
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
      club_message_log: {
        Row: {
          club_id: string
          id: string
          kind: string
          reference: string
          sent_at: string
        }
        Insert: {
          club_id: string
          id?: string
          kind: string
          reference: string
          sent_at?: string
        }
        Update: {
          club_id?: string
          id?: string
          kind?: string
          reference?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_message_log_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_module_suggestions: {
        Row: {
          club_id: string
          module: string
          suggested_at: string
        }
        Insert: {
          club_id: string
          module: string
          suggested_at?: string
        }
        Update: {
          club_id?: string
          module?: string
          suggested_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_module_suggestions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_pulses: {
        Row: {
          club_id: string
          composed_at: string
          happening: Json
          id: string
          intro: string | null
          join_in: Json
          released_by: string | null
          sent_at: string | null
          status: string
          working_on: Json
        }
        Insert: {
          club_id: string
          composed_at?: string
          happening?: Json
          id?: string
          intro?: string | null
          join_in?: Json
          released_by?: string | null
          sent_at?: string | null
          status?: string
          working_on?: Json
        }
        Update: {
          club_id?: string
          composed_at?: string
          happening?: Json
          id?: string
          intro?: string | null
          join_in?: Json
          released_by?: string | null
          sent_at?: string | null
          status?: string
          working_on?: Json
        }
        Relationships: [
          {
            foreignKeyName: "club_pulses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_pulses_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "club_pulses_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          club_kind: string
          created_at: string
          id: string
          is_demo: boolean
          name: string
          season_start: string | null
          settings: Json
          slug: string
        }
        Insert: {
          club_kind?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
          season_start?: string | null
          settings?: Json
          slug: string
        }
        Update: {
          club_kind?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          season_start?: string | null
          settings?: Json
          slug?: string
        }
        Relationships: []
      }
      event_qr_tokens: {
        Row: {
          event_id: string
          token: string
        }
        Insert: {
          event_id: string
          token?: string
        }
        Update: {
          event_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_qr_tokens_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series: {
        Row: {
          club_id: string
          created_at: string
          id: string
          rule: Json
          team_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          rule?: Json
          team_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          rule?: Json
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_series_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_series_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_shifts: {
        Row: {
          ends_at: string
          event_id: string
          external_id: string | null
          id: string
          needed: number
          point_rule_code: string
          points: number
          starts_at: string
          title: string
        }
        Insert: {
          ends_at: string
          event_id: string
          external_id?: string | null
          id?: string
          needed?: number
          point_rule_code: string
          points?: number
          starts_at: string
          title: string
        }
        Update: {
          ends_at?: string
          event_id?: string
          external_id?: string | null
          id?: string
          needed?: number
          point_rule_code?: string
          points?: number
          starts_at?: string
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
          audience_role_ids: Json | null
          cancelled_at: string | null
          cancelled_reason: string | null
          capacity_needed: number | null
          club_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          external_id: string | null
          id: string
          is_sample: boolean
          latitude: number | null
          location: string | null
          longitude: number | null
          point_rule_code: string | null
          published_at: string | null
          reminded_at: string | null
          result: string | null
          series_id: string | null
          starts_at: string
          team_id: string | null
          title: string
          type: string
          why: string | null
        }
        Insert: {
          audience_role_ids?: Json | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          capacity_needed?: number | null
          club_id: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          external_id?: string | null
          id?: string
          is_sample?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          point_rule_code?: string | null
          published_at?: string | null
          reminded_at?: string | null
          result?: string | null
          series_id?: string | null
          starts_at: string
          team_id?: string | null
          title: string
          type: string
          why?: string | null
        }
        Update: {
          audience_role_ids?: Json | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          capacity_needed?: number | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          external_id?: string | null
          id?: string
          is_sample?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          point_rule_code?: string | null
          published_at?: string | null
          reminded_at?: string | null
          result?: string | null
          series_id?: string | null
          starts_at?: string
          team_id?: string | null
          title?: string
          type?: string
          why?: string | null
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
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
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
      federation_connections: {
        Row: {
          api_key_secret: string | null
          club_id: string
          created_at: string
          federation: string
          federation_club_id: string
          last_error: string | null
          last_sync_at: string | null
          status: string
        }
        Insert: {
          api_key_secret?: string | null
          club_id: string
          created_at?: string
          federation: string
          federation_club_id: string
          last_error?: string | null
          last_sync_at?: string | null
          status?: string
        }
        Update: {
          api_key_secret?: string | null
          club_id?: string
          created_at?: string
          federation?: string
          federation_club_id?: string
          last_error?: string | null
          last_sync_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "federation_connections_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      functionary_holders: {
        Row: {
          created_at: string
          display_name: string
          id: string
          interim: boolean
          member_id: string | null
          role_id: string
          since: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          interim?: boolean
          member_id?: string | null
          role_id: string
          since?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          interim?: boolean
          member_id?: string | null
          role_id?: string
          since?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "functionary_holders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "functionary_holders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "functionary_holders_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "functionary_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      functionary_roles: {
        Row: {
          club_id: string
          contact_member_id: string | null
          contact_name: string | null
          created_at: string
          duties: Json
          factsheet_path: string | null
          held_since: string | null
          holder_member_id: string | null
          hours_per_season: string | null
          id: string
          max_holders: number
          points_label: string | null
          title: string
          updated_at: string
          why: string | null
        }
        Insert: {
          club_id: string
          contact_member_id?: string | null
          contact_name?: string | null
          created_at?: string
          duties?: Json
          factsheet_path?: string | null
          held_since?: string | null
          holder_member_id?: string | null
          hours_per_season?: string | null
          id?: string
          max_holders?: number
          points_label?: string | null
          title: string
          updated_at?: string
          why?: string | null
        }
        Update: {
          club_id?: string
          contact_member_id?: string | null
          contact_name?: string | null
          created_at?: string
          duties?: Json
          factsheet_path?: string | null
          held_since?: string | null
          holder_member_id?: string | null
          hours_per_season?: string | null
          id?: string
          max_holders?: number
          points_label?: string | null
          title?: string
          updated_at?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "functionary_roles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "functionary_roles_contact_member_id_fkey"
            columns: ["contact_member_id"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "functionary_roles_contact_member_id_fkey"
            columns: ["contact_member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "functionary_roles_holder_member_id_fkey"
            columns: ["holder_member_id"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "functionary_roles_holder_member_id_fkey"
            columns: ["holder_member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
        ]
      }
      health_alert_routing: {
        Row: {
          club_id: string
          recipient_role: string
          signal_type: string
        }
        Insert: {
          club_id: string
          recipient_role: string
          signal_type: string
        }
        Update: {
          club_id?: string
          recipient_role?: string
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_alert_routing_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      health_signals: {
        Row: {
          club_id: string
          detail: string
          detected_at: string
          expires_at: string
          id: string
          member_id: string | null
          owned_by: string | null
          severity: string
          signal_type: string
          status: string
          team_id: string | null
        }
        Insert: {
          club_id: string
          detail: string
          detected_at?: string
          expires_at?: string
          id?: string
          member_id?: string | null
          owned_by?: string | null
          severity: string
          signal_type: string
          status?: string
          team_id?: string | null
        }
        Update: {
          club_id?: string
          detail?: string
          detected_at?: string
          expires_at?: string
          id?: string
          member_id?: string | null
          owned_by?: string | null
          severity?: string
          signal_type?: string
          status?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_signals_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_signals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "health_signals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_signals_owned_by_fkey"
            columns: ["owned_by"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "health_signals_owned_by_fkey"
            columns: ["owned_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_signals_team_id_fkey"
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
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
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
      invoice_creditors: {
        Row: {
          city: string | null
          club_id: string
          country: string
          house_number: string | null
          iban: string
          name: string
          postal_code: string | null
          street: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          club_id: string
          country?: string
          house_number?: string | null
          iban: string
          name: string
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          club_id?: string
          country?: string
          house_number?: string | null
          iban?: string
          name?: string
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_creditors_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_fee_items: {
        Row: {
          amount: number
          club_id: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          team_id: string | null
        }
        Insert: {
          amount: number
          club_id: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          team_id?: string | null
        }
        Update: {
          amount?: number
          club_id?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_fee_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_fee_items_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payment_imports: {
        Row: {
          already: number
          club_id: string
          created_at: string
          created_by: string | null
          filename: string | null
          found: number
          id: string
          matched: number
          unmatched: Json
        }
        Insert: {
          already?: number
          club_id: string
          created_at?: string
          created_by?: string | null
          filename?: string | null
          found?: number
          id?: string
          matched?: number
          unmatched?: Json
        }
        Update: {
          already?: number
          club_id?: string
          created_at?: string
          created_by?: string | null
          filename?: string | null
          found?: number
          id?: string
          matched?: number
          unmatched?: Json
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payment_imports_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_imports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "invoice_payment_imports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_periods: {
        Row: {
          club_id: string
          created_at: string
          currency: string
          due_date: string
          id: string
          name: string
          reference_prefix: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          currency?: string
          due_date: string
          id?: string
          name: string
          reference_prefix?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          name?: string
          reference_prefix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_periods_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_positions: {
        Row: {
          amount: number
          id: string
          invoice_id: string
          label: string
          sort_order: number
        }
        Insert: {
          amount: number
          id?: string
          invoice_id: string
          label: string
          sort_order?: number
        }
        Update: {
          amount?: number
          id?: string
          invoice_id?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_positions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_refs: {
        Row: {
          amount: number
          club_id: string
          detail_url: string | null
          due_date: string
          id: string
          member_id: string
          paid_at: string | null
          pdf_path: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          club_id: string
          detail_url?: string | null
          due_date: string
          id: string
          member_id: string
          paid_at?: string | null
          pdf_path?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          club_id?: string
          detail_url?: string | null
          due_date?: string
          id?: string
          member_id?: string
          paid_at?: string | null
          pdf_path?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_refs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_refs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "invoice_refs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          club_id: string
          created_at: string
          currency: string
          due_date: string
          id: string
          member_id: string
          paid_at: string | null
          payer: string | null
          pdf_path: string | null
          period_id: string
          reference: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          club_id: string
          created_at?: string
          currency?: string
          due_date: string
          id?: string
          member_id: string
          paid_at?: string | null
          payer?: string | null
          pdf_path?: string | null
          period_id: string
          reference: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          club_id?: string
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          member_id?: string
          paid_at?: string | null
          payer?: string | null
          pdf_path?: string | null
          period_id?: string
          reference?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "invoices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "invoice_periods"
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
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "join_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
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
      legacy_sources: {
        Row: {
          club_id: string
          created_at: string
          firebase_club_id: string
          imported_events: number
          imported_members: number
          imported_responses: number
          last_error: string | null
          last_sync_at: string | null
          status: string
        }
        Insert: {
          club_id: string
          created_at?: string
          firebase_club_id: string
          imported_events?: number
          imported_members?: number
          imported_responses?: number
          last_error?: string | null
          last_sync_at?: string | null
          status?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          firebase_club_id?: string
          imported_events?: number
          imported_members?: number
          imported_responses?: number
          last_error?: string | null
          last_sync_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_sources_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_inputs: {
        Row: {
          anon_token_hash: string | null
          author_member_id: string | null
          body: string
          club_id: string
          committee_role_ids: Json
          converted_task_id: string | null
          created_at: string
          decision_response: string | null
          id: string
          meeting_event_id: string | null
          published_news_id: string | null
          responded_at: string | null
          responded_by: string | null
          source_voice_note_id: string | null
          status: string
        }
        Insert: {
          anon_token_hash?: string | null
          author_member_id?: string | null
          body: string
          club_id: string
          committee_role_ids?: Json
          converted_task_id?: string | null
          created_at?: string
          decision_response?: string | null
          id?: string
          meeting_event_id?: string | null
          published_news_id?: string | null
          responded_at?: string | null
          responded_by?: string | null
          source_voice_note_id?: string | null
          status?: string
        }
        Update: {
          anon_token_hash?: string | null
          author_member_id?: string | null
          body?: string
          club_id?: string
          committee_role_ids?: Json
          converted_task_id?: string | null
          created_at?: string
          decision_response?: string | null
          id?: string
          meeting_event_id?: string | null
          published_news_id?: string | null
          responded_at?: string | null
          responded_by?: string | null
          source_voice_note_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_inputs_author_member_id_fkey"
            columns: ["author_member_id"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "meeting_inputs_author_member_id_fkey"
            columns: ["author_member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_inputs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_inputs_converted_task_id_fkey"
            columns: ["converted_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_inputs_meeting_event_id_fkey"
            columns: ["meeting_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_inputs_published_news_id_fkey"
            columns: ["published_news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_inputs_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "meeting_inputs_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_inputs_source_voice_note_id_fkey"
            columns: ["source_voice_note_id"]
            isOneToOne: false
            referencedRelation: "voice_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      member_contacts: {
        Row: {
          birth_date: string | null
          city: string | null
          country: string | null
          email: string | null
          emergency_name: string | null
          emergency_phone: string | null
          house_number: string | null
          member_id: string
          phone: string | null
          postal_code: string | null
          street: string | null
        }
        Insert: {
          birth_date?: string | null
          city?: string | null
          country?: string | null
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          house_number?: string | null
          member_id: string
          phone?: string | null
          postal_code?: string | null
          street?: string | null
        }
        Update: {
          birth_date?: string | null
          city?: string | null
          country?: string | null
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          house_number?: string | null
          member_id?: string
          phone?: string | null
          postal_code?: string | null
          street?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_contacts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_contacts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_contribution_profiles: {
        Row: {
          asked_at: string | null
          club_id: string
          interests: Json
          member_id: string
          strengths: string | null
          time_budget: string | null
          updated_at: string
        }
        Insert: {
          asked_at?: string | null
          club_id: string
          interests?: Json
          member_id: string
          strengths?: string | null
          time_budget?: string | null
          updated_at?: string
        }
        Update: {
          asked_at?: string | null
          club_id?: string
          interests?: Json
          member_id?: string
          strengths?: string | null
          time_budget?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_contribution_profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_contribution_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_contribution_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          author: string | null
          author_image_url: string | null
          body: string | null
          body_html: string | null
          club_id: string | null
          external_id: string | null
          external_url: string | null
          id: string
          image_url: string | null
          is_sample: boolean
          published_at: string
          source: string
          synced_at: string | null
          team_id: string | null
          title: string
        }
        Insert: {
          author?: string | null
          author_image_url?: string | null
          body?: string | null
          body_html?: string | null
          club_id?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          image_url?: string | null
          is_sample?: boolean
          published_at?: string
          source?: string
          synced_at?: string | null
          team_id?: string | null
          title: string
        }
        Update: {
          author?: string | null
          author_image_url?: string | null
          body?: string | null
          body_html?: string | null
          club_id?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          image_url?: string | null
          is_sample?: boolean
          published_at?: string
          source?: string
          synced_at?: string | null
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
      news_sources: {
        Row: {
          active: boolean
          api_style: string
          categories: Json
          club_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_error: string | null
          last_imported: number
          last_status: string | null
          last_sync_at: string | null
          post_limit: number
          site_name: string | null
          url: string
        }
        Insert: {
          active?: boolean
          api_style?: string
          categories?: Json
          club_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          last_imported?: number
          last_status?: string | null
          last_sync_at?: string | null
          post_limit?: number
          site_name?: string | null
          url: string
        }
        Update: {
          active?: boolean
          api_style?: string
          categories?: Json
          club_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          last_imported?: number
          last_status?: string | null
          last_sync_at?: string | null
          post_limit?: number
          site_name?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_sources_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "news_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          email: Json
          email_mode: string
          locale: string | null
          push: Json
          quiet_from: string | null
          quiet_to: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          email?: Json
          email_mode?: string
          locale?: string | null
          push?: Json
          quiet_from?: string | null
          quiet_to?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: Json
          email_mode?: string
          locale?: string | null
          push?: Json
          quiet_from?: string | null
          quiet_to?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          club_id: string | null
          created_at: string
          email_after: string | null
          email_attempts: number
          email_claimed_at: string | null
          email_error: string | null
          email_sent_at: string | null
          email_wanted: boolean
          id: string
          link: string | null
          push_after: string | null
          push_sent_at: string | null
          push_wanted: boolean
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          club_id?: string | null
          created_at?: string
          email_after?: string | null
          email_attempts?: number
          email_claimed_at?: string | null
          email_error?: string | null
          email_sent_at?: string | null
          email_wanted?: boolean
          id?: string
          link?: string | null
          push_after?: string | null
          push_sent_at?: string | null
          push_wanted?: boolean
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          club_id?: string | null
          created_at?: string
          email_after?: string | null
          email_attempts?: number
          email_claimed_at?: string | null
          email_error?: string | null
          email_sent_at?: string | null
          email_wanted?: boolean
          id?: string
          link?: string | null
          push_after?: string | null
          push_sent_at?: string | null
          push_wanted?: boolean
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
          pillar: number | null
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
          pillar?: number | null
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
          pillar?: number | null
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
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "point_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "point_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
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
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "task_assignments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_directory"
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
          category: string
          club_id: string
          created_at: string
          created_by: string
          description: string | null
          due_at: string | null
          id: string
          is_sample: boolean
          max_assignees: number
          points: number
          recurrence_days: number | null
          status: string
          task_type: string
          team_id: string | null
          title: string
          why: string | null
        }
        Insert: {
          category?: string
          club_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_at?: string | null
          id?: string
          is_sample?: boolean
          max_assignees?: number
          points?: number
          recurrence_days?: number | null
          status?: string
          task_type?: string
          team_id?: string | null
          title: string
          why?: string | null
        }
        Update: {
          category?: string
          club_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string | null
          id?: string
          is_sample?: boolean
          max_assignees?: number
          points?: number
          recurrence_days?: number | null
          status?: string
          task_type?: string
          team_id?: string | null
          title?: string
          why?: string | null
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
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
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
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
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
      teams: {
        Row: {
          area: string | null
          club_id: string
          federation: string | null
          federation_name: string | null
          federation_stale_at: string | null
          federation_synced_at: string | null
          federation_team_id: string | null
          id: string
          league: string | null
          legacy_team_id: string | null
          name: string
          name_addition: string | null
          photo_url: string | null
        }
        Insert: {
          area?: string | null
          club_id: string
          federation?: string | null
          federation_name?: string | null
          federation_stale_at?: string | null
          federation_synced_at?: string | null
          federation_team_id?: string | null
          id?: string
          league?: string | null
          legacy_team_id?: string | null
          name: string
          name_addition?: string | null
          photo_url?: string | null
        }
        Update: {
          area?: string | null
          club_id?: string
          federation?: string | null
          federation_name?: string | null
          federation_stale_at?: string | null
          federation_synced_at?: string | null
          federation_team_id?: string | null
          id?: string
          league?: string | null
          legacy_team_id?: string | null
          name?: string
          name_addition?: string | null
          photo_url?: string | null
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
      voice_note_messages: {
        Row: {
          author_side: string
          body: string
          created_at: string
          id: string
          note_id: string
        }
        Insert: {
          author_side: string
          body: string
          created_at?: string
          id?: string
          note_id: string
        }
        Update: {
          author_side?: string
          body?: string
          created_at?: string
          id?: string
          note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_note_messages_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "voice_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_notes: {
        Row: {
          anon_token_hash: string | null
          answered_at: string | null
          answered_by: string | null
          audio_url: string | null
          author_member_id: string | null
          club_id: string
          converted_task_id: string | null
          created_at: string | null
          created_week: string
          flagged_at: string | null
          id: string
          kind: string
          published_news_id: string | null
          response: string | null
          status: string
          target_member_id: string | null
          target_role: string | null
          target_team_id: string | null
          transcript: string
        }
        Insert: {
          anon_token_hash?: string | null
          answered_at?: string | null
          answered_by?: string | null
          audio_url?: string | null
          author_member_id?: string | null
          club_id: string
          converted_task_id?: string | null
          created_at?: string | null
          created_week: string
          flagged_at?: string | null
          id?: string
          kind: string
          published_news_id?: string | null
          response?: string | null
          status?: string
          target_member_id?: string | null
          target_role?: string | null
          target_team_id?: string | null
          transcript: string
        }
        Update: {
          anon_token_hash?: string | null
          answered_at?: string | null
          answered_by?: string | null
          audio_url?: string | null
          author_member_id?: string | null
          club_id?: string
          converted_task_id?: string | null
          created_at?: string | null
          created_week?: string
          flagged_at?: string | null
          id?: string
          kind?: string
          published_news_id?: string | null
          response?: string | null
          status?: string
          target_member_id?: string | null
          target_role?: string | null
          target_team_id?: string | null
          transcript?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_notes_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "voice_notes_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_notes_author_member_id_fkey"
            columns: ["author_member_id"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "voice_notes_author_member_id_fkey"
            columns: ["author_member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_notes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_notes_converted_task_id_fkey"
            columns: ["converted_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_notes_published_news_id_fkey"
            columns: ["published_news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_notes_target_member_id_fkey"
            columns: ["target_member_id"]
            isOneToOne: false
            referencedRelation: "club_directory"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "voice_notes_target_member_id_fkey"
            columns: ["target_member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_notes_target_team_id_fkey"
            columns: ["target_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      club_directory: {
        Row: {
          avatar_url: string | null
          club_id: string | null
          display_name: string | null
          email: string | null
          member_id: string | null
          member_since: string | null
          phone: string | null
          role: string | null
          status: string | null
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
    }
    Functions: {
      add_invoice_position: {
        Args: { p_amount: number; p_invoice_id: string; p_label: string }
        Returns: string
      }
      add_legacy_team_members: {
        Args: { p_legacy_user_ids: string[]; p_team_id: string }
        Returns: number
      }
      adopt_sample: {
        Args: { p_id: string; p_kind: string }
        Returns: undefined
      }
      announce_event: { Args: { p_event_id: string }; Returns: number }
      announce_task: {
        Args: { p_task_id: string }
        Returns: {
          muted: boolean
          notified: number
        }[]
      }
      anon_input: {
        Args: { p_token_hash: string }
        Returns: {
          body: string
          created_at: string
          input_id: string
          meeting_at: string
          response: string
          status: string
        }[]
      }
      anon_thread: {
        Args: { p_token_hash: string }
        Returns: {
          created_week: string
          messages: Json
          note_id: string
          status: string
          transcript: string
        }[]
      }
      answer_meeting_input: {
        Args: {
          p_answer: string
          p_decline?: boolean
          p_input_id: string
          p_news_title?: string
        }
        Returns: undefined
      }
      answer_voice_note: {
        Args: {
          p_answer: string
          p_decline?: boolean
          p_news_title?: string
          p_note_id: string
        }
        Returns: undefined
      }
      area_covers_team: {
        Args: { p_member_id: string; p_team_id: string }
        Returns: boolean
      }
      ask_contribution_profiles: { Args: never; Returns: number }
      ask_office_load: { Args: never; Returns: number }
      assign_input: {
        Args: { p_input_id: string; p_meeting_event_id?: string }
        Returns: undefined
      }
      auto_release_pulses: { Args: never; Returns: number }
      award_loyalty: { Args: { p_today?: string }; Returns: number }
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
      award_streaks: { Args: { p_today?: string }; Returns: number }
      board_response_metrics: {
        Args: { p_club_id: string }
        Returns: {
          inputs_answered: number
          inputs_avg_hours: number
          inputs_open: number
          inputs_overdue: number
          signals_oldest_days: number
          signals_open: number
          vacancies: number
          vacancy_avg_days: number
        }[]
      }
      book_points_manually: {
        Args: {
          p_club_id: string
          p_member_ids: string[]
          p_note: string
          p_pillar: number
          p_points: number
        }
        Returns: number
      }
      call_is_muted: { Args: { p_club_id: string }; Returns: boolean }
      can_follow_member: {
        Args: { p_club_id: string; p_member_id: string }
        Returns: boolean
      }
      can_handle_input: { Args: { p_input_id: string }; Returns: boolean }
      can_handle_note: { Args: { p_note_id: string }; Returns: boolean }
      can_plan_for_team: {
        Args: { p_club_id: string; p_team_id: string }
        Returns: boolean
      }
      can_read_invoice_pdf: { Args: { p_name: string }; Returns: boolean }
      can_see_agenda: { Args: { p_event_id: string }; Returns: boolean }
      can_write_club_media: { Args: { p_name: string }; Returns: boolean }
      cancel_event: {
        Args: { p_event_id: string; p_reason: string }
        Returns: undefined
      }
      cancel_invoice: {
        Args: { p_invoice_id: string; p_reason?: string }
        Returns: undefined
      }
      check_in: {
        Args: { p_event_id: string; p_qr_token: string }
        Returns: {
          already_checked_in: boolean
          points_awarded: number
        }[]
      }
      checkin_context: {
        Args: { p_event_type: string; p_shift_id: string; p_status: string }
        Returns: string
      }
      claim_task: { Args: { p_task_id: string }; Returns: string }
      club_health: {
        Args: { p_club_id: string }
        Returns: {
          activated: number
          active: number
          active_days: number
          left_count: number
          left_signalled: number
          members: number
          newcomers: number
          newcomers_activated: number
          prev_activated: number
        }[]
      }
      club_seasons: { Args: { p_club_id: string }; Returns: string[] }
      clubs_left_without_admin: {
        Args: { p_user_id: string }
        Returns: {
          club_id: string
          club_name: string
        }[]
      }
      committee_members: {
        Args: { p_club_id: string; p_roles: Json }
        Returns: {
          member_id: string
          user_id: string
        }[]
      }
      compose_club_pulse: { Args: { p_club_id?: string }; Returns: number }
      confirm_shift: {
        Args: { p_member_id: string; p_shift_id: string }
        Returns: {
          booked: boolean
          points: number
        }[]
      }
      confirm_task: {
        Args: { p_assignment_id: string; p_kudos?: string }
        Returns: {
          booked: boolean
          points: number
        }[]
      }
      connect_federation: {
        Args: {
          p_api_key?: string
          p_club_id: string
          p_federation: string
          p_federation_club_id: string
        }
        Returns: undefined
      }
      connect_legacy_source: {
        Args: { p_club_id: string; p_firebase_club_id: string }
        Returns: undefined
      }
      connection_ratio: {
        Args: { p_club_id: string; p_days?: number }
        Returns: {
          calls: number
          connections: number
          last_connection: string
        }[]
      }
      contribution_budget_left: {
        Args: { p_member_id: string }
        Returns: number
      }
      contribution_goal: {
        Args: { p_club_id: string; p_member_id: string }
        Returns: number
      }
      contribution_overview: {
        Args: { p_club_id: string }
        Returns: {
          avatar_url: string
          earned: number
          goal: number
          member_id: string
          name: string
          remaining: number
          state: string
        }[]
      }
      contribution_pillars: { Args: never; Returns: number[] }
      contribution_points: {
        Args: { p_club_id: string; p_member_id: string; p_season?: string }
        Returns: number
      }
      contribution_state: {
        Args: { p_earned: number; p_goal: number }
        Returns: string
      }
      convert_note_to_task: {
        Args: {
          p_category: string
          p_due_at?: string
          p_note_id: string
          p_points: number
          p_title: string
          p_why: string
        }
        Returns: string
      }
      count_club_admins: {
        Args: { p_club_id: string; p_except?: string }
        Returns: number
      }
      count_undecided: { Args: { p_event_id: string }; Returns: number }
      create_club: {
        Args: {
          p_club_kind?: string
          p_kind_label?: string
          p_name: string
          p_season_start?: string
        }
        Returns: string
      }
      create_helper_event: {
        Args: {
          p_ends_at?: string
          p_location?: string
          p_shifts?: Json
          p_starts_at: string
          p_title: string
          p_why: string
        }
        Returns: string
      }
      create_task: {
        Args: {
          p_category: string
          p_club_id: string
          p_description?: string
          p_due_at?: string
          p_max_assignees?: number
          p_points: number
          p_recurrence_days?: number
          p_team_id?: string
          p_title: string
          p_why: string
        }
        Returns: string
      }
      creditor_ready: { Args: { p_club_id: string }; Returns: boolean }
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
      decline_is_early: { Args: { p_starts_at: string }; Returns: boolean }
      default_event_labels: { Args: { p_club_kind: string }; Returns: Json }
      default_season_start: { Args: { p_club_kind: string }; Returns: string }
      delete_event: { Args: { p_event_id: string }; Returns: undefined }
      delete_invoice_draft: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      delete_invoice_position: {
        Args: { p_position_id: string }
        Returns: undefined
      }
      delete_my_account: { Args: never; Returns: undefined }
      delete_point_rule: { Args: { p_rule_id: string }; Returns: undefined }
      delete_team: { Args: { p_team_id: string }; Returns: undefined }
      detect_checkins: { Args: never; Returns: number }
      detect_contribution_gaps: {
        Args: { p_club_id?: string }
        Returns: number
      }
      detect_health_signals: { Args: { p_club_id?: string }; Returns: number }
      detect_succession_gaps: { Args: { p_club_id?: string }; Returns: number }
      dimension_of_pillar: { Args: { p_pillar: number }; Returns: string }
      discard_pulse: { Args: { p_pulse_id: string }; Returns: undefined }
      disconnect_federation: {
        Args: { p_club_id: string; p_federation: string }
        Returns: undefined
      }
      disconnect_legacy_source: {
        Args: { p_club_id: string }
        Returns: undefined
      }
      drop_sample_content: { Args: { p_club_id: string }; Returns: number }
      email_decision: {
        Args: {
          p_at?: string
          p_category: string
          p_urgent?: boolean
          p_user_id: string
        }
        Returns: {
          after_at: string
          wanted: boolean
        }[]
      }
      emergency_contact: {
        Args: { p_member_id: string }
        Returns: {
          emergency_name: string
          emergency_phone: string
        }[]
      }
      ensure_demo_club: { Args: never; Returns: string }
      event_in_scope: { Args: { p_event_id: string }; Returns: boolean }
      event_roster: {
        Args: { p_event_id: string }
        Returns: {
          display_name: string
          member_id: string
          status: string
        }[]
      }
      expire_health_signals: { Args: never; Returns: number }
      expire_sample_content: { Args: never; Returns: number }
      expire_tasks: { Args: { p_limit?: number }; Returns: number }
      export_members: {
        Args: { p_club_id: string; p_team_id?: string }
        Returns: {
          birth_date: string
          city: string
          country: string
          display_name: string
          email: string
          first_name: string
          house_number: string
          last_name: string
          member_id: string
          member_since: string
          offices: string
          phone: string
          postal_code: string
          role: string
          status: string
          street: string
          teams: string
        }[]
      }
      federation_credentials: {
        Args: { p_club_id?: string }
        Returns: {
          api_key: string
          club_id: string
          federation: string
          federation_club_id: string
        }[]
      }
      find_club_by_slug: {
        Args: { p_slug: string }
        Returns: {
          club_id: string
          club_name: string
        }[]
      }
      flag_note: { Args: { p_note_id: string }; Returns: undefined }
      flag_overdue_invoices: { Args: never; Returns: number }
      flag_unanswered_notes: { Args: never; Returns: number }
      follow_up_anon: {
        Args: { p_body: string; p_token_hash: string }
        Returns: undefined
      }
      forget_device: { Args: { p_token_id: string }; Returns: undefined }
      forward_input: {
        Args: { p_input_id: string; p_roles: Json }
        Returns: undefined
      }
      generate_invoices: {
        Args: {
          p_fee_item_ids: string[]
          p_member_ids: string[]
          p_period_id: string
        }
        Returns: Json
      }
      health_definitions: {
        Args: { p_club_id: string }
        Returns: {
          key: string
          value: number
        }[]
      }
      health_signal_in_reach: {
        Args: { p_signal_id: string }
        Returns: boolean
      }
      health_threshold: {
        Args: { p_club_id: string; p_default: number; p_key: string }
        Returns: number
      }
      holds_committee_role: {
        Args: { p_club_id: string; p_roles: Json }
        Returns: boolean
      }
      import_federation_teams: {
        Args: { p_club_id: string; p_federation: string; p_items: Json }
        Returns: {
          created: number
          linked: number
        }[]
      }
      invoice_payload: {
        Args: { p_invoice_id?: string; p_period_id: string }
        Returns: Json
      }
      is_club_admin: { Args: { p_club_id: string }; Returns: boolean }
      is_club_board: { Args: { p_club_id: string }; Returns: boolean }
      is_club_member: { Args: { p_club_id: string }; Returns: boolean }
      is_club_trainer: { Args: { p_club_id: string }; Returns: boolean }
      is_qr_iban: { Args: { p_iban: string }; Returns: boolean }
      is_valid_iban: { Args: { p_iban: string }; Returns: boolean }
      join_demo_club: { Args: never; Returns: string }
      last_connection_at: { Args: { p_club_id: string }; Returns: string }
      leaderboard_rows: {
        Args: {
          p_club_id: string
          p_limit?: number
          p_period?: string
          p_pillar?: number
          p_season?: string
          p_team_id?: string
        }
        Returns: {
          avatar_url: string
          display_name: string
          is_self: boolean
          member_id: string
          rank: number
          total_points: number
        }[]
      }
      link_team: {
        Args: {
          p_federation: string
          p_federation_team_id: string
          p_league?: string
          p_name: string
          p_name_addition?: string
          p_team_id: string
        }
        Returns: undefined
      }
      log_club_message: {
        Args: { p_club_id: string; p_kind: string; p_reference: string }
        Returns: undefined
      }
      mark_attendance: {
        Args: { p_event_id: string; p_member_id: string; p_present?: boolean }
        Returns: number
      }
      mark_invoice_sent: {
        Args: { p_invoice_id: string; p_pdf_path?: string }
        Returns: undefined
      }
      mark_mail_failed: {
        Args: { p_error: string; p_ids: string[] }
        Returns: undefined
      }
      mark_mail_sent: { Args: { p_ids: string[] }; Returns: undefined }
      match_camt_payments: {
        Args: {
          p_actor?: string
          p_club_id: string
          p_filename?: string
          p_payments: Json
        }
        Returns: Json
      }
      matching_tasks: {
        Args: { p_club_id: string; p_limit?: number }
        Returns: {
          category: string
          due_at: string
          points: number
          task_id: string
          title: string
          why: string
        }[]
      }
      matching_vacancies: {
        Args: { p_club_id: string }
        Returns: {
          role_id: string
          title: string
        }[]
      }
      meeting_agenda: {
        Args: { p_event_id: string }
        Returns: {
          detail: string
          kind: string
          ref_id: string
          title: string
        }[]
      }
      module_enabled: {
        Args: { p_club_id: string; p_module: string }
        Returns: boolean
      }
      my_checkin_trend: {
        Args: { p_club_id: string }
        Returns: {
          at: string
          context: string
          value: number
        }[]
      }
      my_clubs_left_without_admin: {
        Args: never
        Returns: {
          club_id: string
          club_name: string
        }[]
      }
      my_contribution_budget: { Args: { p_club_id: string }; Returns: number }
      my_contribution_goal: {
        Args: { p_club_id: string }
        Returns: {
          earned: number
          goal: number
          remaining: number
          season: string
          state: string
        }[]
      }
      my_health_signals: {
        Args: { p_club_id: string }
        Returns: {
          detected_at: string
          expires_at: string
          id: string
          severity: string
          signal_type: string
          status: string
        }[]
      }
      my_points_summary: {
        Args: { p_club_id: string }
        Returns: {
          booking_count: number
          career_points: number
          first_booking: string
          season: string
          season_points: number
        }[]
      }
      my_season_task_count: { Args: { p_club_id: string }; Returns: number }
      next_contributions: {
        Args: { p_club_id: string; p_limit?: number }
        Returns: {
          detail: string
          kind: string
          points: number
          ref_id: string
          title: string
          when_at: string
        }[]
      }
      notify: {
        Args: {
          p_body?: string
          p_category: string
          p_club_id?: string
          p_link?: string
          p_title: string
          p_urgent?: boolean
          p_user_id: string
        }
        Returns: undefined
      }
      notify_signal_owners: { Args: { p_signal_id: string }; Returns: number }
      nudge_low_checkins: { Args: never; Returns: number }
      office_open_seats: { Args: { p_role_id: string }; Returns: number }
      path_club_id: { Args: { p_name: string }; Returns: string }
      path_uuid: {
        Args: { p_name: string; p_segment: number }
        Returns: string
      }
      pending_mail: {
        Args: { p_user_limit?: number }
        Returns: {
          body: string
          category: string
          club_color: string
          club_id: string
          club_name: string
          created_at: string
          display_name: string
          email: string
          email_mode: string
          id: string
          link: string
          locale: string
          title: string
          user_id: string
        }[]
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
      publish_event: {
        Args: { p_event_id: string }
        Returns: {
          muted: boolean
          notified: number
        }[]
      }
      publish_news: {
        Args: {
          p_body: string
          p_club_id: string
          p_image_url?: string
          p_source?: string
          p_team_id?: string
          p_title: string
        }
        Returns: string
      }
      publish_task: {
        Args: { p_task_id: string }
        Returns: {
          muted: boolean
          notified: number
        }[]
      }
      push_decision: {
        Args: { p_at?: string; p_category: string; p_user_id: string }
        Returns: {
          after_at: string
          wanted: boolean
        }[]
      }
      qr_check_digit: { Args: { p_base: string }; Returns: number }
      qr_reference: { Args: { p_prefix?: string }; Returns: string }
      recalc_invoice_amount: { Args: { p_invoice_id: string }; Returns: number }
      record_invoice_payment: {
        Args: { p_invoice_id: string; p_paid_at: string; p_payer?: string }
        Returns: number
      }
      redeem_invite: {
        Args: { p_code: string; p_display_name?: string }
        Returns: string
      }
      reject_task: {
        Args: { p_assignment_id: string; p_note: string }
        Returns: undefined
      }
      release_pulse: {
        Args: { p_intro?: string; p_keep?: Json; p_pulse_id: string }
        Returns: number
      }
      release_shift: {
        Args: { p_shift_id: string }
        Returns: {
          filled: number
          needed: number
          warned: boolean
        }[]
      }
      release_task: { Args: { p_task_id: string }; Returns: boolean }
      remind_due_invoices: { Args: never; Returns: number }
      remind_undecided: {
        Args: { p_event_id: string }
        Returns: {
          last_reminder: string
          notified: number
        }[]
      }
      remind_undecided_internal: {
        Args: { p_event_id: string }
        Returns: {
          last_reminder: string
          notified: number
        }[]
      }
      report_federation_sync: {
        Args: {
          p_club_id: string
          p_error?: string
          p_federation: string
          p_ok: boolean
        }
        Returns: undefined
      }
      report_invoice: {
        Args: {
          p_amount: number
          p_club_id: string
          p_detail_url?: string
          p_due_date: string
          p_invoice_id: string
          p_member_id: string
          p_paid_at?: string
          p_status: string
        }
        Returns: number
      }
      report_legacy_sync: {
        Args: {
          p_club_id: string
          p_count?: number
          p_error?: string
          p_members?: number
          p_ok: boolean
          p_responses?: number
        }
        Returns: undefined
      }
      report_team_sync: {
        Args: {
          p_found: boolean
          p_league?: string
          p_name?: string
          p_team_id: string
        }
        Returns: undefined
      }
      request_join: {
        Args: { p_club_id: string; p_team_id?: string }
        Returns: string
      }
      reset_demo_club: { Args: never; Returns: number }
      respond_to_event: {
        Args: { p_event_id: string; p_reason?: string; p_status: string }
        Returns: {
          is_early: boolean
          points_awarded: number
        }[]
      }
      responsibility_concentration: {
        Args: { p_club_id: string }
        Returns: {
          carriers: number
          contributors: number
          efforts: number
          members: number
        }[]
      }
      retract_news: { Args: { p_news_id: string }; Returns: undefined }
      reverse_points: {
        Args: { p_note: string; p_transaction_id: string }
        Returns: string
      }
      rule_limit_reached: {
        Args: {
          p_member_id: string
          p_rule: Database["public"]["Tables"]["point_rules"]["Row"]
        }
        Returns: boolean
      }
      save_contribution_profile: {
        Args: {
          p_club_id: string
          p_interests: Json
          p_strengths?: string
          p_time_budget?: string
        }
        Returns: undefined
      }
      save_office: {
        Args: {
          p_club_id: string
          p_contact_member_id?: string
          p_contact_name?: string
          p_duties?: Json
          p_holders?: Json
          p_hours_per_season?: string
          p_id?: string
          p_max_holders?: number
          p_points_label?: string
          p_title: string
          p_why?: string
        }
        Returns: string
      }
      season_end: {
        Args: { p_at?: string; p_club_id: string }
        Returns: string
      }
      season_label: {
        Args: { p_at?: string; p_club_id: string }
        Returns: string
      }
      seed_checkin_prompts: { Args: { p_club_id: string }; Returns: number }
      seed_point_rules: {
        Args: { p_club_id: string; p_club_kind: string }
        Returns: undefined
      }
      seed_sample_content: { Args: { p_club_id: string }; Returns: number }
      send_due_reminders: { Args: { p_limit?: number }; Returns: number }
      send_pending_mail: { Args: never; Returns: number }
      set_contribution_goal: {
        Args: { p_goal: number; p_member_id: string }
        Returns: undefined
      }
      set_health_opt_out: {
        Args: { p_club_id: string; p_opt_out: boolean }
        Returns: number
      }
      set_health_routing: {
        Args: { p_club_id: string; p_roles: string[]; p_signal_type: string }
        Returns: undefined
      }
      set_locale: { Args: { p_locale: string }; Returns: undefined }
      set_member_avatar: {
        Args: { p_member_id: string; p_url?: string }
        Returns: undefined
      }
      set_member_teams: {
        Args: { p_member_id: string; p_team_ids: string[] }
        Returns: undefined
      }
      set_note_status: {
        Args: { p_note_id: string; p_status: string }
        Returns: undefined
      }
      set_notification_settings: {
        Args: {
          p_email?: Json
          p_email_mode?: string
          p_locale?: string
          p_push?: Json
          p_quiet_from?: string
          p_quiet_to?: string
        }
        Returns: undefined
      }
      set_pillar_active: {
        Args: { p_active: boolean; p_club_id: string; p_pillar: number }
        Returns: number
      }
      set_shift_absence: {
        Args: { p_member_id: string; p_shift_id: string; p_status: string }
        Returns: undefined
      }
      set_signal_status: {
        Args: { p_signal_id: string; p_status: string }
        Returns: string
      }
      set_team_photo: {
        Args: { p_team_id: string; p_url?: string }
        Returns: undefined
      }
      share_checkin: { Args: { p_response_id: string }; Returns: undefined }
      shift_candidates: {
        Args: { p_shift_id: string }
        Returns: {
          display_name: string
          member_id: string
        }[]
      }
      shift_roster: {
        Args: { p_shift_id: string }
        Returns: {
          confirmed: boolean
          display_name: string
          member_id: string
          status: string
        }[]
      }
      skip_checkin: { Args: { p_invitation_id: string }; Returns: undefined }
      slugify: { Args: { p_value: string }; Returns: string }
      submit_checkin: {
        Args: {
          p_answers: Json
          p_invitation_id: string
          p_visibility?: string
        }
        Returns: number
      }
      submit_meeting_input: {
        Args: {
          p_anonymous?: boolean
          p_body: string
          p_club_id: string
          p_roles: Json
          p_source_note?: string
          p_token_hash?: string
        }
        Returns: string
      }
      submit_task: {
        Args: { p_proof_url?: string; p_task_id: string }
        Returns: boolean
      }
      submit_voice_note: {
        Args: {
          p_club_id: string
          p_kind: string
          p_target_member?: string
          p_target_role?: string
          p_target_team?: string
          p_token_hash?: string
          p_transcript: string
        }
        Returns: string
      }
      succession_lead: {
        Args: { p_club_id: string }
        Returns: {
          is_vacant: boolean
          role_id: string
          title: string
          years: number
        }[]
      }
      suggest_modules: { Args: never; Returns: number }
      suggest_task: { Args: { p_task_id: string }; Returns: number }
      suggested_shift_points: { Args: { p_minutes: number }; Returns: number }
      sync_federations: { Args: never; Returns: number }
      sync_legacy_sources: { Args: never; Returns: number }
      sync_news_sources: { Args: never; Returns: number }
      sync_office_holder: { Args: { p_role_id: string }; Returns: undefined }
      take_shift: {
        Args: { p_accept_overlap?: boolean; p_shift_id: string }
        Returns: {
          filled: number
          needed: number
        }[]
      }
      task_in_scope: { Args: { p_task_id: string }; Returns: boolean }
      task_roster: {
        Args: { p_task_id: string }
        Returns: {
          assignment_id: string
          claimed_at: string
          confirmed_at: string
          display_name: string
          kudos: string
          member_id: string
          proof_url: string
          submitted_at: string
        }[]
      }
      team_health: {
        Args: { p_club_id: string }
        Returns: {
          answered: number
          attended: number
          invitations: number
          members: number
          team_id: string
          team_name: string
        }[]
      }
      team_mood: {
        Args: { p_team_id: string }
        Returns: {
          average: number
          responses: number
        }[]
      }
      team_ranking_rows: {
        Args: {
          p_club_id: string
          p_period?: string
          p_pillar?: number
          p_season?: string
        }
        Returns: {
          avg_points: number
          is_mine: boolean
          member_count: number
          rank: number
          team_id: string
          team_name: string
          total_points: number
        }[]
      }
      training_streak: {
        Args: { p_member_id: string; p_today?: string }
        Returns: number
      }
      unlink_team: { Args: { p_team_id: string }; Returns: undefined }
      update_my_profile: {
        Args: {
          p_birth_date?: string
          p_city?: string
          p_clear_birth_date?: boolean
          p_country?: string
          p_display_name?: string
          p_email?: string
          p_email_public?: boolean
          p_emergency_name?: string
          p_emergency_phone?: string
          p_first_name?: string
          p_house_number?: string
          p_last_name?: string
          p_member_id: string
          p_phone?: string
          p_phone_public?: boolean
          p_postal_code?: string
          p_street?: string
        }
        Returns: undefined
      }
      upsert_federation_game: {
        Args: {
          p_external_id: string
          p_latitude?: number
          p_location?: string
          p_longitude?: number
          p_result?: string
          p_starts_at: string
          p_team_id: string
          p_title: string
        }
        Returns: string
      }
      upsert_legacy_attendance: {
        Args: { p_club_id: string; p_rows: Json }
        Returns: {
          matched: number
          unmatched: number
        }[]
      }
      upsert_legacy_event: {
        Args: {
          p_cancelled?: boolean
          p_cancelled_reason?: string
          p_capacity_needed?: number
          p_club_id: string
          p_ends_at?: string
          p_external_id: string
          p_location?: string
          p_shifts?: Json
          p_starts_at: string
          p_team_id?: string
          p_title: string
          p_type: string
          p_why: string
        }
        Returns: string
      }
      upsert_legacy_members: {
        Args: { p_club_id: string; p_rows: Json }
        Returns: number
      }
      upsert_legacy_team: {
        Args: {
          p_club_id: string
          p_federation_team_id?: string
          p_legacy_team_id: string
          p_name: string
        }
        Returns: string
      }
      value_dimensions: {
        Args: { p_club_id: string; p_member_id?: string }
        Returns: {
          club_value: number
          collected: boolean
          dimension: string
          group_size: number
          own_value: number
          team_value: number
        }[]
      }
      voice_quota_left: { Args: { p_club_id: string }; Returns: number }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
