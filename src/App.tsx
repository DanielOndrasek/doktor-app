import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ThemeHost from "@/components/ThemeHost";
import { AppShell, CONTACTS_PATH, EVENTS_PATH, MAIL_PATH, PATIENTS_PATH, SETTINGS_PATH, TASKS_PATH, TODAY_PATH } from "@/components/AppShell";
import RequireAuth from "@/components/auth/RequireAuth";
import { LOGIN_PATH } from "@/components/auth/MfaGate";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Contacts from "@/pages/Contacts";
import Events from "@/pages/Events";
import Login, { RESET_PASSWORD_PATH } from "@/pages/Login";
import Mail from "@/pages/Mail";
import Patients from "@/pages/Patients";
import ResetPassword from "@/pages/ResetPassword";
import Settings from "@/pages/Settings";
import Tasks from "@/pages/Tasks";
import Today from "@/pages/Today";
import { createSupabaseCaseSource } from "@/lib/cases";
import { createSupabaseClaudeWorkSource } from "@/lib/claudeProjects";
import { createSupabaseContactSource } from "@/lib/contacts";
import { createEngineClientFromEnv } from "@/lib/engine/client";
import { createSupabaseEventSource } from "@/lib/events";
import { createSupabaseItemSource } from "@/lib/items";
import { createSupabaseRuleSource } from "@/lib/rules";
import { createSupabaseRunsSource } from "@/lib/runs";
import { createSupabaseSignatureSource } from "@/lib/signatures";
import { createSupabaseTaskSource } from "@/lib/tasks";
import { getAccessToken } from "@/lib/supabase/token";
import { createSupabaseTodaySource } from "@/lib/today";

const queryClient = new QueryClient();

/** Dnes: signály z `doktor.dnes()`, odkládání přes `doktor.signal_odlozit()`. */
const todaySource = createSupabaseTodaySource();
/** Rozpracováno v Claude: projekty z `ukoly.claude_projekt` a fronta pro Clauda. */
const claudeWork = createSupabaseClaudeWorkSource();
/** Kontakty: adresář a minimální CRM nad `kontakty`, `poznamky`, `ukoly`. */
const contactSource = createSupabaseContactSource();
/** Engine `uvn-mail-mcp` (REST /api/v1) pro kalendáře; `null`, dokud není `VITE_ENGINE_URL`. */
const engine = createEngineClientFromEnv(getAccessToken);
/** Úkoly čtou a zapisují `ukoly` přes supabase-js pod RLS; „do iCloud" přes engine `cal_pridat` (K3.6). */
const taskSource = createSupabaseTaskSource(undefined, { engine });
/** Události: `udalosti` pod RLS; kalendáře přes engine, dokud není propojený, jde návrhy jen zamítat. */
const eventSource = createSupabaseEventSource({ engine });
/** Podpisy e-mailu (`podpisy`, K3.3): Nastavení je spravuje, Pošta vkládá podle schránky odeslání. */
const signatureSource = createSupabaseSignatureSource();
/** Položky pošty z běhu třídění (`polozky`, K3.2): triage v seznamu, návrh odpovědi, rozepsaný text. */
const itemSource = createSupabaseItemSource();
/** Běhy a zásahy Clauda (`behy` + zápisové řádky `audit`, K3.9) na Dnes. */
const runsSource = createSupabaseRunsSource();
/** Pravidla pro Clauda (`pouceni`): návrhy z běhů ke schválení a vlastní pravidla v Nastavení. */
const ruleSource = createSupabaseRuleSource();
/** Karty pacientů (`pripady`, O2 z 22. 9.): návrhy z běhů, schválení kliknutím. */
const caseSource = createSupabaseCaseSource();

/**
 * Kořen aplikace. Přihlášení a obnova hesla jsou veřejné, všechno ostatní
 * jde přes `RequireAuth` (session + MFA). Obrazovky (Dnes, Pošta, Úkoly,
 * Události, Kontakty, Nastavení) přijdou podle `docs/prevzeti-z-vividbooks.md`
 * — za přihlášením je Dnes nad `dnes()`, Úkoly nad `ukoly`, Události nad `udalosti` a Pošta nad enginem.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeHost />
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path={LOGIN_PATH} element={<Login />} />
            <Route path={RESET_PASSWORD_PATH} element={<ResetPassword />} />
            <Route
              path="*"
              element={
                <RequireAuth>
                  <AppShell>
                    <Routes>
                      {/* Dnes nad `dnes()`; odložení signálu jde do `signaly_odlozene`. */}
                      <Route path={TODAY_PATH} element={<Today source={todaySource} claudeWork={claudeWork} />} />
                      {/* Pošta nad enginem; kontext u e-mailu (K3.8) z kontaktů a úkolů, „Úkol z mailu" do `ukoly`. */}
                      <Route path={MAIL_PATH} element={<Mail contactSource={contactSource} taskSource={taskSource} signatureSource={signatureSource} itemSource={itemSource} claudeWork={claudeWork} />} />
                      {/* Úkoly nad tabulkou `ukoly`; `move` zapisuje `stav` + `stav_zdroj = klik`. */}
                      <Route path={TASKS_PATH} element={<Tasks source={taskSource} />} />
                      {/* Události nad `udalosti`; zápis do kalendáře jen z tlačítka přes engine. */}
                      <Route path={EVENTS_PATH} element={<Events source={eventSource} />} />
                      {/* Kontakty (K4.1 přitažené do K3): adresář a karta s poznámkami a úkoly. */}
                      <Route path={CONTACTS_PATH} element={<Contacts source={contactSource} taskSource={taskSource} />} />
                      {/* Nastavení: podpisy (K3.3). */}
                      {/* Pacienti nad `pripady`: karty navržené během, schválení / zamítnutí kliknutím. */}
                      <Route path={PATIENTS_PATH} element={<Patients source={caseSource} />} />
                      <Route path={SETTINGS_PATH} element={<Settings signatures={signatureSource} rules={ruleSource} runs={runsSource} />} />
                      <Route path="*" element={<Navigate to={TODAY_PATH} replace />} />
                    </Routes>
                  </AppShell>
                </RequireAuth>
              }
            />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
