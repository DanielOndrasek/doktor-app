import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ThemeHost from "@/components/ThemeHost";
import { AppShell, CONTACTS_PATH, EVENTS_PATH, MAIL_PATH, TASKS_PATH, TODAY_PATH } from "@/components/AppShell";
import RequireAuth from "@/components/auth/RequireAuth";
import { LOGIN_PATH } from "@/components/auth/MfaGate";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Contacts from "@/pages/Contacts";
import Events from "@/pages/Events";
import Login, { RESET_PASSWORD_PATH } from "@/pages/Login";
import Mail from "@/pages/Mail";
import ResetPassword from "@/pages/ResetPassword";
import Tasks from "@/pages/Tasks";
import Today from "@/pages/Today";
import { createSupabaseClaudeWorkSource } from "@/lib/claudeProjects";
import { createSupabaseContactSource } from "@/lib/contacts";
import { createEngineClientFromEnv } from "@/lib/engine/client";
import { createSupabaseEventSource } from "@/lib/events";
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
/** Úkoly čtou a zapisují `ukoly` přes supabase-js pod RLS (K2.2 hotové). */
const taskSource = createSupabaseTaskSource();
/** Události: `udalosti` pod RLS; kalendáře přes engine, dokud není propojený, jde návrhy jen zamítat. */
const eventSource = createSupabaseEventSource({ engine: createEngineClientFromEnv(getAccessToken) });

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
                      <Route path={MAIL_PATH} element={<Mail />} />
                      {/* Úkoly nad tabulkou `ukoly`; `move` zapisuje `stav` + `stav_zdroj = klik`. */}
                      <Route path={TASKS_PATH} element={<Tasks source={taskSource} />} />
                      {/* Události nad `udalosti`; zápis do kalendáře jen z tlačítka přes engine. */}
                      <Route path={EVENTS_PATH} element={<Events source={eventSource} />} />
                      {/* Kontakty (K4.1 přitažené do K3): adresář a karta s poznámkami a úkoly. */}
                      <Route path={CONTACTS_PATH} element={<Contacts source={contactSource} taskSource={taskSource} />} />
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
