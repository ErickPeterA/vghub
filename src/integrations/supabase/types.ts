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
      base_fields: {
        Row: {
          allows_free_text: boolean
          allows_multiple: boolean
          created_at: string
          created_by: string | null
          data_source: string
          display_order: number
          field_key: string
          field_type: Database["public"]["Enums"]["dynamic_field_type"]
          id: string
          is_active: boolean
          is_required: boolean
          label: string
          project_id: string | null
          section: string
          source_field_id: string | null
          updated_at: string
        }
        Insert: {
          allows_free_text?: boolean
          allows_multiple?: boolean
          created_at?: string
          created_by?: string | null
          data_source?: string
          display_order?: number
          field_key: string
          field_type?: Database["public"]["Enums"]["dynamic_field_type"]
          id?: string
          is_active?: boolean
          is_required?: boolean
          label: string
          project_id?: string | null
          section?: string
          source_field_id?: string | null
          updated_at?: string
        }
        Update: {
          allows_free_text?: boolean
          allows_multiple?: boolean
          created_at?: string
          created_by?: string | null
          data_source?: string
          display_order?: number
          field_key?: string
          field_type?: Database["public"]["Enums"]["dynamic_field_type"]
          id?: string
          is_active?: boolean
          is_required?: boolean
          label?: string
          project_id?: string | null
          section?: string
          source_field_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_fields_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_fields_source_field_id_fkey"
            columns: ["source_field_id"]
            isOneToOne: false
            referencedRelation: "base_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      base_options: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          field_id: string
          id: string
          is_active: boolean
          label: string
          source_option_id: string | null
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          field_id: string
          id?: string
          is_active?: boolean
          label: string
          source_option_id?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          field_id?: string
          id?: string
          is_active?: boolean
          label?: string
          source_option_id?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_options_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "base_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_options_source_option_id_fkey"
            columns: ["source_option_id"]
            isOneToOne: false
            referencedRelation: "base_options"
            referencedColumns: ["id"]
          },
        ]
      }
      descricoes_cargo: {
        Row: {
          atividades: Json
          cargo: string
          conhecimento: Json
          created_at: string
          created_by: string
          data_revisao: string | null
          data_versao: string | null
          departamento: string | null
          dynamic_values: Json
          experiencia: Json
          habilidades_cargo: Json
          habilidades_culturais: Json
          id: string
          indicadores: Json
          instrucao: Json
          nivelamento: string | null
          objetivo: string | null
          postura: Json
          project_id: string
          status: string
          superior_imediato: string | null
          tipo_carreira: string | null
          unidade_negocio: string | null
          updated_at: string
        }
        Insert: {
          atividades?: Json
          cargo: string
          conhecimento?: Json
          created_at?: string
          created_by: string
          data_revisao?: string | null
          data_versao?: string | null
          departamento?: string | null
          dynamic_values?: Json
          experiencia?: Json
          habilidades_cargo?: Json
          habilidades_culturais?: Json
          id?: string
          indicadores?: Json
          instrucao?: Json
          nivelamento?: string | null
          objetivo?: string | null
          postura?: Json
          project_id: string
          status?: string
          superior_imediato?: string | null
          tipo_carreira?: string | null
          unidade_negocio?: string | null
          updated_at?: string
        }
        Update: {
          atividades?: Json
          cargo?: string
          conhecimento?: Json
          created_at?: string
          created_by?: string
          data_revisao?: string | null
          data_versao?: string | null
          departamento?: string | null
          dynamic_values?: Json
          experiencia?: Json
          habilidades_cargo?: Json
          habilidades_culturais?: Json
          id?: string
          indicadores?: Json
          instrucao?: Json
          nivelamento?: string | null
          objetivo?: string | null
          postura?: Json
          project_id?: string
          status?: string
          superior_imediato?: string | null
          tipo_carreira?: string | null
          unidade_negocio?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "descricoes_cargo_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nome: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      project_areas: {
        Row: {
          cor: string | null
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          nome: string
          parent_id: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          nome: string
          parent_id?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          nome?: string
          parent_id?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_areas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_areas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_history: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json
          entidade: string | null
          entidade_id: string | null
          id: string
          project_id: string
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          project_id: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          project_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_hub: {
        Row: {
          conteudo: string | null
          created_at: string
          created_by: string
          id: string
          metadata: Json
          project_id: string
          secao: string
          titulo: string
          updated_at: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          created_by: string
          id?: string
          metadata?: Json
          project_id: string
          secao?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          created_by?: string
          id?: string
          metadata?: Json
          project_id?: string
          secao?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_hub_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_progress: {
        Row: {
          created_at: string
          etapa: string
          id: string
          ordem: number
          percentual: number
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          etapa: string
          id?: string
          ordem?: number
          percentual?: number
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          etapa?: string
          id?: string
          ordem?: number
          percentual?: number
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_progress_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          conteudo: Json
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          nome: string
          project_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          conteudo?: Json
          created_at?: string
          created_by: string
          descricao?: string | null
          id?: string
          nome: string
          project_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          conteudo?: Json
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          nome?: string
          project_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          empresa: string | null
          id: string
          nome: string
          responsavel_id: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa?: string | null
          id?: string
          nome: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa?: string | null
          id?: string
          nome?: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      can_manage_project_base: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      clone_general_base_to_project: {
        Args: { _created_by?: string; _project_id: string }
        Returns: undefined
      }
      get_project_role: {
        Args: { _project_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["project_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      dynamic_field_type:
        | "text"
        | "textarea"
        | "number"
        | "date"
        | "checkbox"
        | "single_select"
        | "multi_select"
        | "competency_description"
      project_role:
        | "admin"
        | "lider_estrategico"
        | "lider_tatico"
        | "lider_operacional"
        | "gp"
      project_status: "ativo" | "arquivado"
      user_status: "ativo" | "inativo"
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
      app_role: ["admin", "user"],
      dynamic_field_type: [
        "text",
        "textarea",
        "number",
        "date",
        "checkbox",
        "single_select",
        "multi_select",
        "competency_description",
      ],
      project_role: [
        "admin",
        "lider_estrategico",
        "lider_tatico",
        "lider_operacional",
        "gp",
      ],
      project_status: ["ativo", "arquivado"],
      user_status: ["ativo", "inativo"],
    },
  },
} as const
