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
      club_members: {
        Row: {
          avatar_url: string | null
          club_id: string
          display_name: string
          health_opt_out: boolean
          id: string
          is_minor: boolean
          leaderboard_opt_in: boolean
          member_since: string
          privacy: Json
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          club_id: string
          display_name: string
          health_opt_out?: boolean
          id?: string
          is_minor?: boolean
          leaderboard_opt_in?: boolean
          member_since?: string
          privacy?: Json
          role?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          club_id?: string
          display_name?: string
          health_opt_out?: boolean
          id?: string
          is_minor?: boolean
          leaderboard_opt_in?: boolean
          member_since?: string
          privacy?: Json
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
          id: string
          is_sample: boolean
          location: string | null
          point_rule_code: string | null
          published_at: string | null
          reminded_at: string | null
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
          id?: string
          is_sample?: boolean
          location?: string | null
          point_rule_code?: string | null
          published_at?: string | null
          reminded_at?: string | null
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
          id?: string
          is_sample?: boolean
          location?: string | null
          point_rule_code?: string | null
          published_at?: string | null
          reminded_at?: string | null
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
      member_contacts: {
        Row: {
          email: string | null
          member_id: string
          phone: string | null
        }
        Insert: {
          email?: string | null
          member_id: string
          phone?: string | null
        }
        Update: {
          email?: string | null
          member_id?: string
          phone?: string | null
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
      news: {
        Row: {
          author: string | null
          author_image_url: string | null
          body: string | null
          club_id: string | null
          external_id: string | null
          external_url: string | null
          id: string
          image_url: string | null
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
          club_id?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          image_url?: string | null
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
          club_id?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          image_url?: string | null
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
          club_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_error: string | null
          last_imported: number
          last_status: string | null
          last_sync_at: string | null
          url: string
        }
        Insert: {
          active?: boolean
          club_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          last_imported?: number
          last_status?: string | null
          last_sync_at?: string | null
          url: string
        }
        Update: {
          active?: boolean
          club_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          last_imported?: number
          last_status?: string | null
          last_sync_at?: string | null
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
          push: Json
          quiet_from: string | null
          quiet_to: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          push?: Json
          quiet_from?: string | null
          quiet_to?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
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
      voice_notes: {
        Row: {
          anon_token_hash: string | null
          audio_url: string | null
          author_member_id: string | null
          club_id: string
          converted_task_id: string | null
          created_at: string | null
          created_week: string
          id: string
          kind: string
          response: string | null
          status: string
          target_member_id: string | null
          target_role: string | null
          target_team_id: string | null
          transcript: string
        }
        Insert: {
          anon_token_hash?: string | null
          audio_url?: string | null
          author_member_id?: string | null
          club_id: string
          converted_task_id?: string | null
          created_at?: string | null
          created_week: string
          id?: string
          kind: string
          response?: string | null
          status?: string
          target_member_id?: string | null
          target_role?: string | null
          target_team_id?: string | null
          transcript: string
        }
        Update: {
          anon_token_hash?: string | null
          audio_url?: string | null
          author_member_id?: string | null
          club_id?: string
          converted_task_id?: string | null
          created_at?: string | null
          created_week?: string
          id?: string
          kind?: string
          response?: string | null
          status?: string
          target_member_id?: string | null
          target_role?: string | null
          target_team_id?: string | null
          transcript?: string
        }
        Relationships: [
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
      announce_event: { Args: { p_event_id: string }; Returns: number }
      announce_task: {
        Args: { p_task_id: string }
        Returns: {
          muted: boolean
          notified: number
        }[]
      }
      auto_release_pulses: { Args: never; Returns: number }
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
      cancel_event: {
        Args: { p_event_id: string; p_reason: string }
        Returns: undefined
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
      connection_ratio: {
        Args: { p_club_id: string; p_days?: number }
        Returns: {
          calls: number
          connections: number
          last_connection: string
        }[]
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
      delete_my_account: { Args: never; Returns: undefined }
      detect_health_signals: { Args: { p_club_id?: string }; Returns: number }
      dimension_of_pillar: { Args: { p_pillar: number }; Returns: string }
      discard_pulse: { Args: { p_pulse_id: string }; Returns: undefined }
      event_roster: {
        Args: { p_event_id: string }
        Returns: {
          display_name: string
          member_id: string
          status: string
        }[]
      }
      expire_health_signals: { Args: never; Returns: number }
      expire_tasks: { Args: { p_limit?: number }; Returns: number }
      find_club_by_slug: {
        Args: { p_slug: string }
        Returns: {
          club_id: string
          club_name: string
        }[]
      }
      forget_device: { Args: { p_token_id: string }; Returns: undefined }
      health_signal_in_reach: {
        Args: { p_signal_id: string }
        Returns: boolean
      }
      health_threshold: {
        Args: { p_club_id: string; p_default: number; p_key: string }
        Returns: number
      }
      is_club_admin: { Args: { p_club_id: string }; Returns: boolean }
      is_club_member: { Args: { p_club_id: string }; Returns: boolean }
      is_club_trainer: { Args: { p_club_id: string }; Returns: boolean }
      last_connection_at: { Args: { p_club_id: string }; Returns: string }
      leaderboard_rows: {
        Args: {
          p_club_id: string
          p_limit?: number
          p_period?: string
          p_pillar?: number
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
      log_club_message: {
        Args: { p_club_id: string; p_kind: string; p_reference: string }
        Returns: undefined
      }
      mark_attendance: {
        Args: { p_event_id: string; p_member_id: string; p_present?: boolean }
        Returns: number
      }
      my_clubs_left_without_admin: {
        Args: never
        Returns: {
          club_id: string
          club_name: string
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
          p_user_id: string
        }
        Returns: undefined
      }
      notify_signal_owners: { Args: { p_signal_id: string }; Returns: number }
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
      request_join: {
        Args: { p_club_id: string; p_team_id?: string }
        Returns: string
      }
      respond_to_event: {
        Args: { p_event_id: string; p_reason?: string; p_status: string }
        Returns: {
          is_early: boolean
          points_awarded: number
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
      season_label: {
        Args: { p_at?: string; p_club_id: string }
        Returns: string
      }
      seed_point_rules: {
        Args: { p_club_id: string; p_club_kind: string }
        Returns: undefined
      }
      send_due_reminders: { Args: { p_limit?: number }; Returns: number }
      set_health_opt_out: {
        Args: { p_club_id: string; p_opt_out: boolean }
        Returns: number
      }
      set_member_teams: {
        Args: { p_member_id: string; p_team_ids: string[] }
        Returns: undefined
      }
      set_notification_settings: {
        Args: { p_push?: Json; p_quiet_from?: string; p_quiet_to?: string }
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
      slugify: { Args: { p_value: string }; Returns: string }
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
      suggest_task: { Args: { p_task_id: string }; Returns: number }
      sync_news_sources: { Args: never; Returns: number }
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
      update_my_profile: {
        Args: {
          p_display_name?: string
          p_email?: string
          p_email_public?: boolean
          p_member_id: string
          p_phone?: string
          p_phone_public?: boolean
        }
        Returns: undefined
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
  public: {
    Enums: {},
  },
} as const
