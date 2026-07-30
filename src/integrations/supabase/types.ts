export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activity_configs: {
        Row: {
          created_at: string;
          created_by: string | null;
          header_schema: Json;
          id: string;
          is_active: boolean;
          project_id: string;
          questions_schema: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          header_schema?: Json;
          id?: string;
          is_active?: boolean;
          project_id: string;
          questions_schema?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          header_schema?: Json;
          id?: string;
          is_active?: boolean;
          project_id?: string;
          questions_schema?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_configs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_links: {
        Row: {
          answered_at: string | null;
          config_id: string;
          created_at: string;
          created_by: string | null;
          draft_header_answers: Json;
          draft_question_answers: Json;
          draft_saved_at: string | null;
          expires_at: string;
          header_answers: Json;
          id: string;
          label: string | null;
          project_id: string;
          reviewed_at: string | null;
          status: Database["public"]["Enums"]["activity_link_status"];
          token: string;
          updated_at: string;
        };
        Insert: {
          answered_at?: string | null;
          config_id: string;
          created_at?: string;
          created_by?: string | null;
          draft_header_answers?: Json;
          draft_question_answers?: Json;
          draft_saved_at?: string | null;
          expires_at: string;
          header_answers?: Json;
          id?: string;
          label?: string | null;
          project_id: string;
          reviewed_at?: string | null;
          status?: Database["public"]["Enums"]["activity_link_status"];
          token?: string;
          updated_at?: string;
        };
        Update: {
          answered_at?: string | null;
          config_id?: string;
          created_at?: string;
          created_by?: string | null;
          draft_header_answers?: Json;
          draft_question_answers?: Json;
          draft_saved_at?: string | null;
          expires_at?: string;
          header_answers?: Json;
          id?: string;
          label?: string | null;
          project_id?: string;
          reviewed_at?: string | null;
          status?: Database["public"]["Enums"]["activity_link_status"];
          token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_links_config_id_fkey";
            columns: ["config_id"];
            isOneToOne: false;
            referencedRelation: "activity_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_links_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_responses: {
        Row: {
          created_at: string;
          header_answers: Json;
          id: string;
          link_id: string;
          project_id: string;
          question_answers: Json;
          submitted_at: string;
          submitted_ip: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          header_answers?: Json;
          id?: string;
          link_id: string;
          project_id: string;
          question_answers?: Json;
          submitted_at?: string;
          submitted_ip?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          header_answers?: Json;
          id?: string;
          link_id?: string;
          project_id?: string;
          question_answers?: Json;
          submitted_at?: string;
          submitted_ip?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_responses_link_id_fkey";
            columns: ["link_id"];
            isOneToOne: false;
            referencedRelation: "activity_links";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_responses_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      base_fields: {
        Row: {
          allows_free_text: boolean;
          allows_multiple: boolean;
          created_at: string;
          created_by: string | null;
          data_source: string;
          display_order: number;
          field_key: string;
          field_type: Database["public"]["Enums"]["dynamic_field_type"];
          id: string;
          is_active: boolean;
          is_required: boolean;
          label: string;
          project_id: string | null;
          section: string;
          source_field_id: string | null;
          updated_at: string;
        };
        Insert: {
          allows_free_text?: boolean;
          allows_multiple?: boolean;
          created_at?: string;
          created_by?: string | null;
          data_source?: string;
          display_order?: number;
          field_key: string;
          field_type?: Database["public"]["Enums"]["dynamic_field_type"];
          id?: string;
          is_active?: boolean;
          is_required?: boolean;
          label: string;
          project_id?: string | null;
          section?: string;
          source_field_id?: string | null;
          updated_at?: string;
        };
        Update: {
          allows_free_text?: boolean;
          allows_multiple?: boolean;
          created_at?: string;
          created_by?: string | null;
          data_source?: string;
          display_order?: number;
          field_key?: string;
          field_type?: Database["public"]["Enums"]["dynamic_field_type"];
          id?: string;
          is_active?: boolean;
          is_required?: boolean;
          label?: string;
          project_id?: string | null;
          section?: string;
          source_field_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "base_fields_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "base_fields_source_field_id_fkey";
            columns: ["source_field_id"];
            isOneToOne: false;
            referencedRelation: "base_fields";
            referencedColumns: ["id"];
          },
        ];
      };
      base_options: {
        Row: {
          created_at: string;
          description: string | null;
          display_order: number;
          field_id: string;
          id: string;
          is_active: boolean;
          label: string;
          source_option_id: string | null;
          updated_at: string;
          value: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          display_order?: number;
          field_id: string;
          id?: string;
          is_active?: boolean;
          label: string;
          source_option_id?: string | null;
          updated_at?: string;
          value: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          display_order?: number;
          field_id?: string;
          id?: string;
          is_active?: boolean;
          label?: string;
          source_option_id?: string | null;
          updated_at?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "base_options_field_id_fkey";
            columns: ["field_id"];
            isOneToOne: false;
            referencedRelation: "base_fields";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "base_options_source_option_id_fkey";
            columns: ["source_option_id"];
            isOneToOne: false;
            referencedRelation: "base_options";
            referencedColumns: ["id"];
          },
        ];
      };
      base_section_settings: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_enabled: boolean;
          max_items: number;
          project_id: string | null;
          section: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_enabled?: boolean;
          max_items?: number;
          project_id?: string | null;
          section: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_enabled?: boolean;
          max_items?: number;
          project_id?: string | null;
          section?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "base_section_settings_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      descricoes_cargo: {
        Row: {
          atividades: Json;
          cargo: string;
          conhecimento: Json;
          created_at: string;
          created_by: string;
          data_revisao: string | null;
          data_versao: string | null;
          departamento: string | null;
          dynamic_values: Json;
          etapa: Database["public"]["Enums"]["dc_stage"];
          experiencia: Json;
          habilidades_cargo: Json;
          habilidades_culturais: Json;
          id: string;
          indicadores: Json;
          instrucao: Json;
          nivelamento: string | null;
          objetivo: string | null;
          organization_position_id: string | null;
          postura: Json;
          project_id: string;
          status: string;
          superior_imediato: string | null;
          tipo_carreira: string | null;
          unidade_negocio: string | null;
          updated_at: string;
        };
        Insert: {
          atividades?: Json;
          cargo: string;
          conhecimento?: Json;
          created_at?: string;
          created_by: string;
          data_revisao?: string | null;
          data_versao?: string | null;
          departamento?: string | null;
          dynamic_values?: Json;
          etapa?: Database["public"]["Enums"]["dc_stage"];
          experiencia?: Json;
          habilidades_cargo?: Json;
          habilidades_culturais?: Json;
          id?: string;
          indicadores?: Json;
          instrucao?: Json;
          nivelamento?: string | null;
          objetivo?: string | null;
          organization_position_id?: string | null;
          postura?: Json;
          project_id: string;
          status?: string;
          superior_imediato?: string | null;
          tipo_carreira?: string | null;
          unidade_negocio?: string | null;
          updated_at?: string;
        };
        Update: {
          atividades?: Json;
          cargo?: string;
          conhecimento?: Json;
          created_at?: string;
          created_by?: string;
          data_revisao?: string | null;
          data_versao?: string | null;
          departamento?: string | null;
          dynamic_values?: Json;
          etapa?: Database["public"]["Enums"]["dc_stage"];
          experiencia?: Json;
          habilidades_cargo?: Json;
          habilidades_culturais?: Json;
          id?: string;
          indicadores?: Json;
          instrucao?: Json;
          nivelamento?: string | null;
          objetivo?: string | null;
          organization_position_id?: string | null;
          postura?: Json;
          project_id?: string;
          status?: string;
          superior_imediato?: string | null;
          tipo_carreira?: string | null;
          unidade_negocio?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "descricoes_cargo_organization_position_id_fkey";
            columns: ["organization_position_id"];
            isOneToOne: true;
            referencedRelation: "project_positions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "descricoes_cargo_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      field_comments: {
        Row: {
          approved_version_id: string | null;
          author_id: string;
          content: string;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision: string;
          field_key: string;
          id: string;
          job_description_id: string;
          version_id: string | null;
        };
        Insert: {
          approved_version_id?: string | null;
          author_id: string;
          content: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision?: string;
          field_key: string;
          id?: string;
          job_description_id: string;
          version_id?: string | null;
        };
        Update: {
          approved_version_id?: string | null;
          author_id?: string;
          content?: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision?: string;
          field_key?: string;
          id?: string;
          job_description_id?: string;
          version_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "field_comments_approved_version_id_fkey";
            columns: ["approved_version_id"];
            isOneToOne: false;
            referencedRelation: "job_description_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_comments_job_description_id_fkey";
            columns: ["job_description_id"];
            isOneToOne: false;
            referencedRelation: "descricoes_cargo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_comments_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "job_description_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      job_description_versions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          job_description_id: string;
          snapshot: Json;
          source_comment_version_id: string | null;
          version_number: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          job_description_id: string;
          snapshot: Json;
          source_comment_version_id?: string | null;
          version_number: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          job_description_id?: string;
          snapshot?: Json;
          source_comment_version_id?: string | null;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "job_description_versions_job_description_id_fkey";
            columns: ["job_description_id"];
            isOneToOne: false;
            referencedRelation: "descricoes_cargo";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          nome: string;
          status: Database["public"]["Enums"]["user_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id: string;
          nome: string;
          status?: Database["public"]["Enums"]["user_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          nome?: string;
          status?: Database["public"]["Enums"]["user_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      performance_answer_history: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          id: string;
          new_answer: string | null;
          participant_id: string;
          previous_answer: string | null;
          question_key: string;
          review_id: string;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          new_answer?: string | null;
          participant_id: string;
          previous_answer?: string | null;
          question_key: string;
          review_id: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          new_answer?: string | null;
          participant_id?: string;
          previous_answer?: string | null;
          question_key?: string;
          review_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "performance_answer_history_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: false;
            referencedRelation: "performance_review_participants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "performance_answer_history_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "performance_reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      performance_review_comments: {
        Row: {
          author_id: string;
          content: string;
          created_at: string;
          id: string;
          question_key: string;
          review_id: string;
        };
        Insert: {
          author_id: string;
          content: string;
          created_at?: string;
          id?: string;
          question_key: string;
          review_id: string;
        };
        Update: {
          author_id?: string;
          content?: string;
          created_at?: string;
          id?: string;
          question_key?: string;
          review_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "performance_review_comments_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "performance_reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      performance_review_configs: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          name: string;
          period_days: number;
          project_id: string | null;
          questions_schema: Json;
          review_type: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          period_days?: number;
          project_id?: string | null;
          questions_schema?: Json;
          review_type?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          period_days?: number;
          project_id?: string | null;
          questions_schema?: Json;
          review_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "performance_review_configs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      performance_review_participants: {
        Row: {
          accessed_at: string | null;
          created_at: string;
          draft_answers: Json;
          draft_saved_at: string | null;
          expires_at: string;
          id: string;
          participant_type: Database["public"]["Enums"]["performance_participant_type"];
          project_id: string;
          response_answers: Json;
          review_id: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["performance_participant_status"];
          submitted_at: string | null;
          submitted_ip: string | null;
          token: string;
          updated_at: string;
        };
        Insert: {
          accessed_at?: string | null;
          created_at?: string;
          draft_answers?: Json;
          draft_saved_at?: string | null;
          expires_at?: string;
          id?: string;
          participant_type: Database["public"]["Enums"]["performance_participant_type"];
          project_id: string;
          response_answers?: Json;
          review_id: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["performance_participant_status"];
          submitted_at?: string | null;
          submitted_ip?: string | null;
          token?: string;
          updated_at?: string;
        };
        Update: {
          accessed_at?: string | null;
          created_at?: string;
          draft_answers?: Json;
          draft_saved_at?: string | null;
          expires_at?: string;
          id?: string;
          participant_type?: Database["public"]["Enums"]["performance_participant_type"];
          project_id?: string;
          response_answers?: Json;
          review_id?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["performance_participant_status"];
          submitted_at?: string | null;
          submitted_ip?: string | null;
          token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "performance_review_participants_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "performance_review_participants_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "performance_reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      performance_reviews: {
        Row: {
          activities_snapshot: Json;
          config_id: string | null;
          created_at: string;
          created_by: string | null;
          due_date: string | null;
          employee_id: string | null;
          employee_name: string;
          employee_position_id: string;
          finalized_at: string | null;
          finalized_by: string | null;
          id: string;
          job_description_id: string;
          job_description_snapshot: Json;
          job_title: string;
          leader_name: string;
          leader_position_id: string;
          name: string;
          period_days: number | null;
          period_name: string | null;
          project_id: string;
          questions_snapshot: Json;
          reopened_at: string | null;
          reopened_by: string | null;
          review_type: string;
          status: Database["public"]["Enums"]["performance_review_status"];
          updated_at: string;
        };
        Insert: {
          activities_snapshot?: Json;
          config_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          employee_id?: string | null;
          employee_name: string;
          employee_position_id: string;
          finalized_at?: string | null;
          finalized_by?: string | null;
          id?: string;
          job_description_id: string;
          job_description_snapshot?: Json;
          job_title: string;
          leader_name: string;
          leader_position_id: string;
          name: string;
          period_days?: number | null;
          period_name?: string | null;
          project_id: string;
          questions_snapshot?: Json;
          reopened_at?: string | null;
          reopened_by?: string | null;
          review_type?: string;
          status?: Database["public"]["Enums"]["performance_review_status"];
          updated_at?: string;
        };
        Update: {
          activities_snapshot?: Json;
          config_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          employee_id?: string | null;
          employee_name?: string;
          employee_position_id?: string;
          finalized_at?: string | null;
          finalized_by?: string | null;
          id?: string;
          job_description_id?: string;
          job_description_snapshot?: Json;
          job_title?: string;
          leader_name?: string;
          leader_position_id?: string;
          name?: string;
          period_days?: number | null;
          period_name?: string | null;
          project_id?: string;
          questions_snapshot?: Json;
          reopened_at?: string | null;
          reopened_by?: string | null;
          review_type?: string;
          status?: Database["public"]["Enums"]["performance_review_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "performance_reviews_config_id_fkey";
            columns: ["config_id"];
            isOneToOne: false;
            referencedRelation: "performance_review_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "performance_reviews_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "project_employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "performance_reviews_employee_position_id_fkey";
            columns: ["employee_position_id"];
            isOneToOne: false;
            referencedRelation: "project_positions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "performance_reviews_job_description_id_fkey";
            columns: ["job_description_id"];
            isOneToOne: false;
            referencedRelation: "descricoes_cargo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "performance_reviews_leader_position_id_fkey";
            columns: ["leader_position_id"];
            isOneToOne: false;
            referencedRelation: "project_positions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "performance_reviews_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_areas: {
        Row: {
          cor: string | null;
          created_at: string;
          created_by: string | null;
          display_order: number;
          id: string;
          nome: string;
          parent_id: string | null;
          project_id: string;
          updated_at: string;
        };
        Insert: {
          cor?: string | null;
          created_at?: string;
          created_by?: string | null;
          display_order?: number;
          id?: string;
          nome: string;
          parent_id?: string | null;
          project_id: string;
          updated_at?: string;
        };
        Update: {
          cor?: string | null;
          created_at?: string;
          created_by?: string | null;
          display_order?: number;
          id?: string;
          nome?: string;
          parent_id?: string | null;
          project_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_areas_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "project_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_areas_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_employees: {
        Row: {
          admission_date: string;
          area_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          last_performance_review_date: string | null;
          nome: string;
          position_id: string;
          project_id: string;
          sector_id: string | null;
          superior_imediato_id: string | null;
          updated_at: string;
        };
        Insert: {
          admission_date: string;
          area_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_performance_review_date?: string | null;
          nome: string;
          position_id: string;
          project_id: string;
          sector_id?: string | null;
          superior_imediato_id?: string | null;
          updated_at?: string;
        };
        Update: {
          admission_date?: string;
          area_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_performance_review_date?: string | null;
          nome?: string;
          position_id?: string;
          project_id?: string;
          sector_id?: string | null;
          superior_imediato_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_employees_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "project_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_employees_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "project_positions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_employees_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_employees_sector_id_fkey";
            columns: ["sector_id"];
            isOneToOne: false;
            referencedRelation: "project_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_employees_superior_imediato_id_fkey";
            columns: ["superior_imediato_id"];
            isOneToOne: false;
            referencedRelation: "project_employees";
            referencedColumns: ["id"];
          },
        ];
      };
      project_history: {
        Row: {
          acao: string;
          created_at: string;
          detalhes: Json;
          entidade: string | null;
          entidade_id: string | null;
          id: string;
          project_id: string;
          user_id: string | null;
        };
        Insert: {
          acao: string;
          created_at?: string;
          detalhes?: Json;
          entidade?: string | null;
          entidade_id?: string | null;
          id?: string;
          project_id: string;
          user_id?: string | null;
        };
        Update: {
          acao?: string;
          created_at?: string;
          detalhes?: Json;
          entidade?: string | null;
          entidade_id?: string | null;
          id?: string;
          project_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "project_history_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_history_user_id_profiles_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      project_hub: {
        Row: {
          conteudo: string | null;
          created_at: string;
          created_by: string;
          id: string;
          metadata: Json;
          project_id: string;
          secao: string;
          titulo: string;
          updated_at: string;
        };
        Insert: {
          conteudo?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          metadata?: Json;
          project_id: string;
          secao?: string;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          conteudo?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          metadata?: Json;
          project_id?: string;
          secao?: string;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_hub_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_member_scopes: {
        Row: {
          area_id: string | null;
          created_at: string;
          id: string;
          member_id: string;
        };
        Insert: {
          area_id?: string | null;
          created_at?: string;
          id?: string;
          member_id: string;
        };
        Update: {
          area_id?: string | null;
          created_at?: string;
          id?: string;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_member_scopes_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "project_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_member_scopes_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "project_members";
            referencedColumns: ["id"];
          },
        ];
      };
      project_members: {
        Row: {
          created_at: string;
          id: string;
          project_id: string;
          role: Database["public"]["Enums"]["project_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          project_id: string;
          role: Database["public"]["Enums"]["project_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          project_id?: string;
          role?: Database["public"]["Enums"]["project_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_user_id_profiles_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      project_progress: {
        Row: {
          created_at: string;
          etapa: string;
          id: string;
          ordem: number;
          percentual: number;
          project_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          etapa: string;
          id?: string;
          ordem?: number;
          percentual?: number;
          project_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          etapa?: string;
          id?: string;
          ordem?: number;
          percentual?: number;
          project_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_progress_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_templates: {
        Row: {
          conteudo: Json;
          created_at: string;
          created_by: string;
          descricao: string | null;
          id: string;
          nome: string;
          project_id: string;
          tipo: string;
          updated_at: string;
        };
        Insert: {
          conteudo?: Json;
          created_at?: string;
          created_by: string;
          descricao?: string | null;
          id?: string;
          nome: string;
          project_id: string;
          tipo?: string;
          updated_at?: string;
        };
        Update: {
          conteudo?: Json;
          created_at?: string;
          created_by?: string;
          descricao?: string | null;
          id?: string;
          nome?: string;
          project_id?: string;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_templates_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_positions: {
        Row: {
          created_at: string;
          created_by: string | null;
          descricao: string | null;
          display_order: number;
          id: string;
          nome: string;
          parent_id: string | null;
          project_id: string;
          status: Database["public"]["Enums"]["organization_position_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          descricao?: string | null;
          display_order?: number;
          id?: string;
          nome: string;
          parent_id?: string | null;
          project_id: string;
          status?: Database["public"]["Enums"]["organization_position_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          descricao?: string | null;
          display_order?: number;
          id?: string;
          nome?: string;
          parent_id?: string | null;
          project_id?: string;
          status?: Database["public"]["Enums"]["organization_position_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_positions_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "project_positions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_positions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string;
          created_by: string | null;
          empresa: string | null;
          id: string;
          nome: string;
          responsavel_id: string | null;
          status: Database["public"]["Enums"]["project_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          empresa?: string | null;
          id?: string;
          nome: string;
          responsavel_id?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          empresa?: string | null;
          id?: string;
          nome?: string;
          responsavel_id?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      area_ancestors: { Args: { _area_id: string }; Returns: string[] };
      can_create_dc: {
        Args: { _project_id: string; _user_id: string };
        Returns: boolean;
      };
      can_delete_dc: {
        Args: { _created_by: string; _project_id: string; _user_id: string };
        Returns: boolean;
      };
      can_manage_dc_row: {
        Args: {
          _created_by: string;
          _departamento: string;
          _etapa: Database["public"]["Enums"]["dc_stage"];
          _project_id: string;
          _user_id: string;
        };
        Returns: boolean;
      };
      can_manage_project_base: {
        Args: { _project_id: string; _user_id: string };
        Returns: boolean;
      };
      can_view_dc: {
        Args: { _dc_id: string; _user_id: string };
        Returns: boolean;
      };
      can_view_dc_row: {
        Args: {
          _created_by: string;
          _departamento: string;
          _etapa: Database["public"]["Enums"]["dc_stage"];
          _project_id: string;
          _user_id: string;
        };
        Returns: boolean;
      };
      clone_general_base_to_project: {
        Args: { _created_by?: string; _project_id: string };
        Returns: undefined;
      };
      create_dc_version_snapshot: {
        Args: { _created_by: string; _dc_id: string };
        Returns: string;
      };
      decide_field_comment: {
        Args: { _comment_id: string; _decision: string };
        Returns: string;
      };
      delete_project_position_with_reassignment: {
        Args: { _children_parent_id: string | null; _position_id: string };
        Returns: undefined;
      };
      get_project_role: {
        Args: { _project_id: string; _user_id: string };
        Returns: Database["public"]["Enums"]["project_role"];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      insert_project_position_above: {
        Args: {
          _descricao?: string | null;
          _nome: string;
          _status?: Database["public"]["Enums"]["organization_position_status"];
          _target_id: string;
        };
        Returns: string;
      };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
      is_any_gp: { Args: { _user_id: string }; Returns: boolean };
      is_project_member: {
        Args: { _project_id: string; _user_id: string };
        Returns: boolean;
      };
      move_project_position: {
        Args: { _new_parent_id: string | null; _position_id: string };
        Returns: undefined;
      };
      project_position_is_descendant: {
        Args: { _ancestor_id: string; _candidate_id: string };
        Returns: boolean;
      };
      refresh_performance_review_status: {
        Args: { _review_id: string };
        Returns: undefined;
      };
      reorder_project_position: {
        Args: { _direction: string; _position_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      activity_link_status: "pending" | "answered" | "expired" | "cancelled";
      app_role: "admin" | "user";
      dc_stage: "em_criacao" | "em_aprovacao" | "concluido";
      dynamic_field_type:
        | "text"
        | "textarea"
        | "number"
        | "date"
        | "checkbox"
        | "single_select"
        | "multi_select"
        | "competency_description";
      organization_position_status: "active" | "inactive";
      performance_participant_status: "not_sent" | "sent" | "accessed" | "in_progress" | "answered";
      performance_participant_type: "collaborator" | "leader";
      performance_review_status:
        | "draft"
        | "waiting_responses"
        | "ready_for_comparison"
        | "finalized";
      project_role:
        | "admin"
        | "lider_estrategico"
        | "lider_tatico"
        | "lider_operacional"
        | "gp"
        | "lider_superior"
        | "lider_setor"
        | "usuario_comum";
      project_status: "ativo" | "desativado";
      user_status: "ativo" | "inativo";
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
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
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
      activity_link_status: ["pending", "answered", "expired", "cancelled"],
      app_role: ["admin", "user"],
      dc_stage: ["em_criacao", "em_aprovacao", "concluido"],
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
      organization_position_status: ["active", "inactive"],
      performance_participant_status: ["not_sent", "sent", "accessed", "in_progress", "answered"],
      performance_participant_type: ["collaborator", "leader"],
      performance_review_status: [
        "draft",
        "waiting_responses",
        "ready_for_comparison",
        "finalized",
      ],
      project_role: [
        "admin",
        "lider_estrategico",
        "lider_tatico",
        "lider_operacional",
        "gp",
        "lider_superior",
        "lider_setor",
        "usuario_comum",
      ],
      project_status: ["ativo", "desativado"],
      user_status: ["ativo", "inativo"],
    },
  },
} as const;
