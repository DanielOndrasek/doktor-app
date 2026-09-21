export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  doktor: {
    Tables: {
      audit: {
        Row: {
          cas: string
          id: string
          kdo: string
          nastroj: string
          upraveno: string
          user_id: string
          vstup_hash: string | null
          vysledek: string | null
          vytvoreno: string
        }
        Insert: {
          cas?: string
          id?: string
          kdo: string
          nastroj: string
          upraveno?: string
          user_id: string
          vstup_hash?: string | null
          vysledek?: string | null
          vytvoreno?: string
        }
        Update: {
          cas?: string
          id?: string
          kdo?: string
          nastroj?: string
          upraveno?: string
          user_id?: string
          vstup_hash?: string | null
          vysledek?: string | null
          vytvoreno?: string
        }
        Relationships: []
      }
      behy: {
        Row: {
          chyba: string | null
          id: string
          konec: string | null
          pocty: NonNullable<Json>
          schranky: string[]
          stav: string
          upraveno: string
          user_id: string
          vytvoreno: string
          zacatek: string
        }
        Insert: {
          chyba?: string | null
          id?: string
          konec?: string | null
          pocty?: NonNullable<Json>
          schranky?: string[]
          stav?: string
          upraveno?: string
          user_id: string
          vytvoreno?: string
          zacatek?: string
        }
        Update: {
          chyba?: string | null
          id?: string
          konec?: string | null
          pocty?: NonNullable<Json>
          schranky?: string[]
          stav?: string
          upraveno?: string
          user_id?: string
          vytvoreno?: string
          zacatek?: string
        }
        Relationships: []
      }
      fronta_claude: {
        Row: {
          druh: string
          id: string
          stav: string
          upraveno: string
          user_id: string
          vstup: NonNullable<Json>
          vysledek: Json | null
          vytvoreno: string
        }
        Insert: {
          druh: string
          id?: string
          stav?: string
          upraveno?: string
          user_id: string
          vstup?: NonNullable<Json>
          vysledek?: Json | null
          vytvoreno?: string
        }
        Update: {
          druh?: string
          id?: string
          stav?: string
          upraveno?: string
          user_id?: string
          vstup?: NonNullable<Json>
          vysledek?: Json | null
          vytvoreno?: string
        }
        Relationships: []
      }
      kontakt_adresy: {
        Row: {
          hodnota: string
          id: string
          kontakt_id: string
          primarni: boolean
          upraveno: string
          user_id: string
          vytvoreno: string
        }
        Insert: {
          hodnota: string
          id?: string
          kontakt_id: string
          primarni?: boolean
          upraveno?: string
          user_id: string
          vytvoreno?: string
        }
        Update: {
          hodnota?: string
          id?: string
          kontakt_id?: string
          primarni?: boolean
          upraveno?: string
          user_id?: string
          vytvoreno?: string
        }
        Relationships: [
          {
            foreignKeyName: "kontakt_adresy_kontakt_id_fkey"
            columns: ["kontakt_id"]
            isOneToOne: false
            referencedRelation: "kontakty"
            referencedColumns: ["id"]
          },
        ]
      }
      kontakt_stitky: {
        Row: {
          kontakt_id: string
          stitek_id: string
          upraveno: string
          user_id: string
          vytvoreno: string
        }
        Insert: {
          kontakt_id: string
          stitek_id: string
          upraveno?: string
          user_id: string
          vytvoreno?: string
        }
        Update: {
          kontakt_id?: string
          stitek_id?: string
          upraveno?: string
          user_id?: string
          vytvoreno?: string
        }
        Relationships: [
          {
            foreignKeyName: "kontakt_stitky_kontakt_id_fkey"
            columns: ["kontakt_id"]
            isOneToOne: false
            referencedRelation: "kontakty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kontakt_stitky_stitek_id_fkey"
            columns: ["stitek_id"]
            isOneToOne: false
            referencedRelation: "stitky"
            referencedColumns: ["id"]
          },
        ]
      }
      kontakt_telefony: {
        Row: {
          hodnota: string
          id: string
          kontakt_id: string
          primarni: boolean
          upraveno: string
          user_id: string
          vytvoreno: string
        }
        Insert: {
          hodnota: string
          id?: string
          kontakt_id: string
          primarni?: boolean
          upraveno?: string
          user_id: string
          vytvoreno?: string
        }
        Update: {
          hodnota?: string
          id?: string
          kontakt_id?: string
          primarni?: boolean
          upraveno?: string
          user_id?: string
          vytvoreno?: string
        }
        Relationships: [
          {
            foreignKeyName: "kontakt_telefony_kontakt_id_fkey"
            columns: ["kontakt_id"]
            isOneToOne: false
            referencedRelation: "kontakty"
            referencedColumns: ["id"]
          },
        ]
      }
      kontakty: {
        Row: {
          carddav_uid: string | null
          id: string
          jmeno: string | null
          organizace_id: string | null
          poznamka: string | null
          prijmeni: string | null
          profil_psani: Json | null
          role: string | null
          sloucen_do: string | null
          tituly: string | null
          ulozit_do_kontaktu: boolean
          upraveno: string
          user_id: string
          vytvoreno: string
          zdroj: string | null
        }
        Insert: {
          carddav_uid?: string | null
          id?: string
          jmeno?: string | null
          organizace_id?: string | null
          poznamka?: string | null
          prijmeni?: string | null
          profil_psani?: Json | null
          role?: string | null
          sloucen_do?: string | null
          tituly?: string | null
          ulozit_do_kontaktu?: boolean
          upraveno?: string
          user_id: string
          vytvoreno?: string
          zdroj?: string | null
        }
        Update: {
          carddav_uid?: string | null
          id?: string
          jmeno?: string | null
          organizace_id?: string | null
          poznamka?: string | null
          prijmeni?: string | null
          profil_psani?: Json | null
          role?: string | null
          sloucen_do?: string | null
          tituly?: string | null
          ulozit_do_kontaktu?: boolean
          upraveno?: string
          user_id?: string
          vytvoreno?: string
          zdroj?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kontakty_organizace_id_fkey"
            columns: ["organizace_id"]
            isOneToOne: false
            referencedRelation: "organizace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kontakty_sloucen_do_fkey"
            columns: ["sloucen_do"]
            isOneToOne: false
            referencedRelation: "kontakty"
            referencedColumns: ["id"]
          },
        ]
      }
      opravy: {
        Row: {
          id: string
          navrh: string | null
          odeslano_ref: string | null
          podobnost: number | null
          polozka_id: string | null
          rozdil: Json | null
          upraveno: string
          user_id: string
          vytvoreno: string
          zpracovano: boolean
        }
        Insert: {
          id?: string
          navrh?: string | null
          odeslano_ref?: string | null
          podobnost?: number | null
          polozka_id?: string | null
          rozdil?: Json | null
          upraveno?: string
          user_id: string
          vytvoreno?: string
          zpracovano?: boolean
        }
        Update: {
          id?: string
          navrh?: string | null
          odeslano_ref?: string | null
          podobnost?: number | null
          polozka_id?: string | null
          rozdil?: Json | null
          upraveno?: string
          user_id?: string
          vytvoreno?: string
          zpracovano?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "opravy_polozka_id_fkey"
            columns: ["polozka_id"]
            isOneToOne: false
            referencedRelation: "polozky"
            referencedColumns: ["id"]
          },
        ]
      }
      organizace: {
        Row: {
          domena: string | null
          id: string
          nazev: string
          upraveno: string
          user_id: string
          vytvoreno: string
        }
        Insert: {
          domena?: string | null
          id?: string
          nazev: string
          upraveno?: string
          user_id: string
          vytvoreno?: string
        }
        Update: {
          domena?: string | null
          id?: string
          nazev?: string
          upraveno?: string
          user_id?: string
          vytvoreno?: string
        }
        Relationships: []
      }
      podpisy: {
        Row: {
          html: string | null
          id: string
          jazyk: string | null
          nazev: string
          text: string | null
          upraveno: string
          user_id: string
          vychozi_pro_schranku: string | null
          vytvoreno: string
        }
        Insert: {
          html?: string | null
          id?: string
          jazyk?: string | null
          nazev: string
          text?: string | null
          upraveno?: string
          user_id: string
          vychozi_pro_schranku?: string | null
          vytvoreno?: string
        }
        Update: {
          html?: string | null
          id?: string
          jazyk?: string | null
          nazev?: string
          text?: string | null
          upraveno?: string
          user_id?: string
          vychozi_pro_schranku?: string | null
          vytvoreno?: string
        }
        Relationships: [
          {
            foreignKeyName: "podpisy_vychozi_pro_schranku_fkey"
            columns: ["vychozi_pro_schranku"]
            isOneToOne: false
            referencedRelation: "schranky"
            referencedColumns: ["id"]
          },
        ]
      }
      pohledy: {
        Row: {
          filtr: NonNullable<Json>
          id: string
          nazev: string
          pripnuto: boolean
          upraveno: string
          user_id: string
          vytvoreno: string
        }
        Insert: {
          filtr?: NonNullable<Json>
          id?: string
          nazev: string
          pripnuto?: boolean
          upraveno?: string
          user_id: string
          vytvoreno?: string
        }
        Update: {
          filtr?: NonNullable<Json>
          id?: string
          nazev?: string
          pripnuto?: boolean
          upraveno?: string
          user_id?: string
          vytvoreno?: string
        }
        Relationships: []
      }
      polozky: {
        Row: {
          beh_id: string | null
          co_resit: string | null
          datum: string | null
          id: string
          kategorie: string | null
          komu: string[]
          kontakt_id: string | null
          kopie: string[]
          message_id: string
          navrh_predmet: string | null
          navrh_telo: string | null
          od: string | null
          od_email: string | null
          odeslat_z: string | null
          podpis_id: string | null
          predmet: string | null
          prilohy_meta: NonNullable<Json>
          priorita: number | null
          pripad_id: string | null
          ref_cache: string | null
          rozepsano_telo: string | null
          schranka_id: string
          stav: string
          stav_zdroj: string
          upraveno: string
          user_id: string
          vlakno: string | null
          vytvoreno: string
        }
        Insert: {
          beh_id?: string | null
          co_resit?: string | null
          datum?: string | null
          id?: string
          kategorie?: string | null
          komu?: string[]
          kontakt_id?: string | null
          kopie?: string[]
          message_id: string
          navrh_predmet?: string | null
          navrh_telo?: string | null
          od?: string | null
          od_email?: string | null
          odeslat_z?: string | null
          podpis_id?: string | null
          predmet?: string | null
          prilohy_meta?: NonNullable<Json>
          priorita?: number | null
          pripad_id?: string | null
          ref_cache?: string | null
          rozepsano_telo?: string | null
          schranka_id: string
          stav?: string
          stav_zdroj?: string
          upraveno?: string
          user_id: string
          vlakno?: string | null
          vytvoreno?: string
        }
        Update: {
          beh_id?: string | null
          co_resit?: string | null
          datum?: string | null
          id?: string
          kategorie?: string | null
          komu?: string[]
          kontakt_id?: string | null
          kopie?: string[]
          message_id?: string
          navrh_predmet?: string | null
          navrh_telo?: string | null
          od?: string | null
          od_email?: string | null
          odeslat_z?: string | null
          podpis_id?: string | null
          predmet?: string | null
          prilohy_meta?: NonNullable<Json>
          priorita?: number | null
          pripad_id?: string | null
          ref_cache?: string | null
          rozepsano_telo?: string | null
          schranka_id?: string
          stav?: string
          stav_zdroj?: string
          upraveno?: string
          user_id?: string
          vlakno?: string | null
          vytvoreno?: string
        }
        Relationships: [
          {
            foreignKeyName: "polozky_beh_id_fkey"
            columns: ["beh_id"]
            isOneToOne: false
            referencedRelation: "behy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polozky_kontakt_id_fkey"
            columns: ["kontakt_id"]
            isOneToOne: false
            referencedRelation: "kontakty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polozky_podpis_id_fkey"
            columns: ["podpis_id"]
            isOneToOne: false
            referencedRelation: "podpisy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polozky_pripad_id_fkey"
            columns: ["pripad_id"]
            isOneToOne: false
            referencedRelation: "pripady"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polozky_schranka_id_fkey"
            columns: ["schranka_id"]
            isOneToOne: false
            referencedRelation: "schranky"
            referencedColumns: ["id"]
          },
        ]
      }
      pouceni: {
        Row: {
          id: string
          stav: string
          text: string
          upraveno: string
          user_id: string
          vytvoreno: string
          zdroj_opravy: string[]
        }
        Insert: {
          id?: string
          stav?: string
          text: string
          upraveno?: string
          user_id: string
          vytvoreno?: string
          zdroj_opravy?: string[]
        }
        Update: {
          id?: string
          stav?: string
          text?: string
          upraveno?: string
          user_id?: string
          vytvoreno?: string
          zdroj_opravy?: string[]
        }
        Relationships: []
      }
      poznamky: {
        Row: {
          druh: string
          id: string
          kontakt_id: string | null
          pripad_id: string | null
          text: string
          upraveno: string
          user_id: string
          vytvoreno: string
          zdroj: string
          zdroj_id: string | null
        }
        Insert: {
          druh?: string
          id?: string
          kontakt_id?: string | null
          pripad_id?: string | null
          text: string
          upraveno?: string
          user_id: string
          vytvoreno?: string
          zdroj?: string
          zdroj_id?: string | null
        }
        Update: {
          druh?: string
          id?: string
          kontakt_id?: string | null
          pripad_id?: string | null
          text?: string
          upraveno?: string
          user_id?: string
          vytvoreno?: string
          zdroj?: string
          zdroj_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poznamky_kontakt_id_fkey"
            columns: ["kontakt_id"]
            isOneToOne: false
            referencedRelation: "kontakty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poznamky_pripad_id_fkey"
            columns: ["pripad_id"]
            isOneToOne: false
            referencedRelation: "pripady"
            referencedColumns: ["id"]
          },
        ]
      }
      pravidla: {
        Row: {
          aktivni: boolean
          id: string
          kategorie: string | null
          text: string
          upraveno: string
          user_id: string
          vytvoreno: string
          zdroj: string | null
        }
        Insert: {
          aktivni?: boolean
          id?: string
          kategorie?: string | null
          text: string
          upraveno?: string
          user_id: string
          vytvoreno?: string
          zdroj?: string | null
        }
        Update: {
          aktivni?: boolean
          id?: string
          kategorie?: string | null
          text?: string
          upraveno?: string
          user_id?: string
          vytvoreno?: string
          zdroj?: string | null
        }
        Relationships: []
      }
      pripady: {
        Row: {
          id: string
          kontakt_id: string | null
          nazev: string
          upraveno: string
          user_id: string
          vytvoreno: string
        }
        Insert: {
          id?: string
          kontakt_id?: string | null
          nazev: string
          upraveno?: string
          user_id: string
          vytvoreno?: string
        }
        Update: {
          id?: string
          kontakt_id?: string | null
          nazev?: string
          upraveno?: string
          user_id?: string
          vytvoreno?: string
        }
        Relationships: [
          {
            foreignKeyName: "pripady_kontakt_id_fkey"
            columns: ["kontakt_id"]
            isOneToOne: false
            referencedRelation: "kontakty"
            referencedColumns: ["id"]
          },
        ]
      }
      sablony: {
        Row: {
          id: string
          nazev: string
          pouzito: number
          predmet: string | null
          telo_html: string | null
          upraveno: string
          user_id: string
          vytvoreno: string
          zarazeni: string | null
        }
        Insert: {
          id?: string
          nazev: string
          pouzito?: number
          predmet?: string | null
          telo_html?: string | null
          upraveno?: string
          user_id: string
          vytvoreno?: string
          zarazeni?: string | null
        }
        Update: {
          id?: string
          nazev?: string
          pouzito?: number
          predmet?: string | null
          telo_html?: string | null
          upraveno?: string
          user_id?: string
          vytvoreno?: string
          zarazeni?: string | null
        }
        Relationships: []
      }
      schranky: {
        Row: {
          adresa: string
          aktivni: boolean
          id: string
          typ: string
          upraveno: string
          user_id: string
          vychozi_podpis_id: string | null
          vytvoreno: string
        }
        Insert: {
          adresa: string
          aktivni?: boolean
          id?: string
          typ: string
          upraveno?: string
          user_id: string
          vychozi_podpis_id?: string | null
          vytvoreno?: string
        }
        Update: {
          adresa?: string
          aktivni?: boolean
          id?: string
          typ?: string
          upraveno?: string
          user_id?: string
          vychozi_podpis_id?: string | null
          vytvoreno?: string
        }
        Relationships: [
          {
            foreignKeyName: "schranky_vychozi_podpis_fk"
            columns: ["vychozi_podpis_id"]
            isOneToOne: false
            referencedRelation: "podpisy"
            referencedColumns: ["id"]
          },
        ]
      }
      signaly_odlozene: {
        Row: {
          akce: string
          do_kdy: string | null
          id: string
          klic: string
          upraveno: string
          user_id: string
          vytvoreno: string
        }
        Insert: {
          akce: string
          do_kdy?: string | null
          id?: string
          klic: string
          upraveno?: string
          user_id: string
          vytvoreno?: string
        }
        Update: {
          akce?: string
          do_kdy?: string | null
          id?: string
          klic?: string
          upraveno?: string
          user_id?: string
          vytvoreno?: string
        }
        Relationships: []
      }
      stitky: {
        Row: {
          id: string
          nazev: string
          upraveno: string
          user_id: string
          vytvoreno: string
        }
        Insert: {
          id?: string
          nazev: string
          upraveno?: string
          user_id: string
          vytvoreno?: string
        }
        Update: {
          id?: string
          nazev?: string
          upraveno?: string
          user_id?: string
          vytvoreno?: string
        }
        Relationships: []
      }
      udalosti: {
        Row: {
          celodenni: boolean
          id: string
          kal_uid: string | null
          kalendar: string | null
          kolize: NonNullable<Json>
          konec: string | null
          misto: string | null
          nazev: string
          polozka_id: string | null
          stav: string
          upraveno: string
          user_id: string
          vytvoreno: string
          zacatek: string
          zdroj_id: string | null
        }
        Insert: {
          celodenni?: boolean
          id?: string
          kal_uid?: string | null
          kalendar?: string | null
          kolize?: NonNullable<Json>
          konec?: string | null
          misto?: string | null
          nazev: string
          polozka_id?: string | null
          stav?: string
          upraveno?: string
          user_id: string
          vytvoreno?: string
          zacatek: string
          zdroj_id?: string | null
        }
        Update: {
          celodenni?: boolean
          id?: string
          kal_uid?: string | null
          kalendar?: string | null
          kolize?: NonNullable<Json>
          konec?: string | null
          misto?: string | null
          nazev?: string
          polozka_id?: string | null
          stav?: string
          upraveno?: string
          user_id?: string
          vytvoreno?: string
          zacatek?: string
          zdroj_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "udalosti_polozka_id_fkey"
            columns: ["polozka_id"]
            isOneToOne: false
            referencedRelation: "polozky"
            referencedColumns: ["id"]
          },
        ]
      }
      ukoly: {
        Row: {
          cas: string | null
          claude_projekt: string | null
          druh: string | null
          id: string
          kal_uid: string | null
          kontakt_id: string | null
          nazev: string
          oblast: string | null
          odlozeno_do: string | null
          polozka_id: string | null
          popis: string | null
          poradi: number
          priorita: string | null
          stav: string
          stav_zdroj: string
          stav_zmenen: string
          termin: string | null
          upraveno: string
          user_id: string
          vytvoreno: string
          zdroj: string
          zdroj_id: string | null
        }
        Insert: {
          cas?: string | null
          claude_projekt?: string | null
          druh?: string | null
          id?: string
          kal_uid?: string | null
          kontakt_id?: string | null
          nazev: string
          oblast?: string | null
          odlozeno_do?: string | null
          polozka_id?: string | null
          popis?: string | null
          poradi?: number
          priorita?: string | null
          stav?: string
          stav_zdroj?: string
          stav_zmenen?: string
          termin?: string | null
          upraveno?: string
          user_id: string
          vytvoreno?: string
          zdroj?: string
          zdroj_id?: string | null
        }
        Update: {
          cas?: string | null
          claude_projekt?: string | null
          druh?: string | null
          id?: string
          kal_uid?: string | null
          kontakt_id?: string | null
          nazev?: string
          oblast?: string | null
          odlozeno_do?: string | null
          polozka_id?: string | null
          popis?: string | null
          poradi?: number
          priorita?: string | null
          stav?: string
          stav_zdroj?: string
          stav_zmenen?: string
          termin?: string | null
          upraveno?: string
          user_id?: string
          vytvoreno?: string
          zdroj?: string
          zdroj_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ukoly_kontakt_id_fkey"
            columns: ["kontakt_id"]
            isOneToOne: false
            referencedRelation: "kontakty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ukoly_polozka_id_fkey"
            columns: ["polozka_id"]
            isOneToOne: false
            referencedRelation: "polozky"
            referencedColumns: ["id"]
          },
        ]
      }
      vazby_dokumentu: {
        Row: {
          disk_file_id: string | null
          id: string
          kontakt_id: string
          nazev: string | null
          priloha_sha: string | null
          upraveno: string
          user_id: string
          vytvoreno: string
          zdroj: string
        }
        Insert: {
          disk_file_id?: string | null
          id?: string
          kontakt_id: string
          nazev?: string | null
          priloha_sha?: string | null
          upraveno?: string
          user_id: string
          vytvoreno?: string
          zdroj: string
        }
        Update: {
          disk_file_id?: string | null
          id?: string
          kontakt_id?: string
          nazev?: string | null
          priloha_sha?: string | null
          upraveno?: string
          user_id?: string
          vytvoreno?: string
          zdroj?: string
        }
        Relationships: [
          {
            foreignKeyName: "vazby_dokumentu_kontakt_id_fkey"
            columns: ["kontakt_id"]
            isOneToOne: false
            referencedRelation: "kontakty"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dnes: {
        Args: Record<PropertyKey, never>
        Returns: {
          akce: Json
          dukazy: string[]
          href: string
          kat: string
          klic: string
          nazev: string
          proc: string
          termin: string
          urg: number
        }[]
      }
      pracovni_dny_od: { Args: { od: string }; Returns: number }
      signal_odlozit: {
        Args: { p_akce: string; p_klic: string }
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
  doktor: {
    Enums: {},
  },
} as const
