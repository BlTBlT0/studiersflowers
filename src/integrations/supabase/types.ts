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
      activities: {
        Row: {
          end_time: string
          id: string
          name: string
          start_time: string
          user_id: string
          weekday: string
        }
        Insert: {
          end_time: string
          id?: string
          name: string
          start_time: string
          user_id: string
          weekday: string
        }
        Update: {
          end_time?: string
          id?: string
          name?: string
          start_time?: string
          user_id?: string
          weekday?: string
        }
        Relationships: []
      }
      grades: {
        Row: {
          created_at: string
          date: string
          description: string | null
          grade: number
          id: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          description?: string | null
          grade: number
          id?: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          grade?: number
          id?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_blocks: {
        Row: {
          completed: boolean
          date: string
          duration_minutes: number
          end_time: string
          id: string
          is_break: boolean
          start_time: string
          subject: string
          task_id: string | null
          task_title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          date: string
          duration_minutes: number
          end_time: string
          id?: string
          is_break?: boolean
          start_time: string
          subject?: string
          task_id?: string | null
          task_title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          date?: string
          duration_minutes?: number
          end_time?: string
          id?: string
          is_break?: boolean
          start_time?: string
          subject?: string
          task_id?: string | null
          task_title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_blocks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_settings: {
        Row: {
          bedtime: string
          commute_minutes: number
          id: string
          school_end_times: Json
          user_id: string
        }
        Insert: {
          bedtime?: string
          commute_minutes?: number
          id?: string
          school_end_times?: Json
          user_id: string
        }
        Update: {
          bedtime?: string
          commute_minutes?: number
          id?: string
          school_end_times?: Json
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed: boolean
          created_at: string
          due_date: string
          estimated_minutes: number
          id: string
          is_daily_practice: boolean
          priority: string
          subject: string
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          due_date: string
          estimated_minutes?: number
          id?: string
          is_daily_practice?: boolean
          priority?: string
          subject: string
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          due_date?: string
          estimated_minutes?: number
          id?: string
          is_daily_practice?: boolean
          priority?: string
          subject?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      time_tracking: {
        Row: {
          actual_minutes: number
          completed_at: string
          estimated_minutes: number
          id: string
          subject: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          actual_minutes: number
          completed_at?: string
          estimated_minutes: number
          id?: string
          subject: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          actual_minutes?: number
          completed_at?: string
          estimated_minutes?: number
          id?: string
          subject?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_tracking_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
