import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ThemeHost from "@/components/ThemeHost";
import { AppShell, EVENTS_PATH, MAIL_PATH, TASKS_PATH, TODAY_PATH } from "@/components/AppShell";
import RequireAuth from "@/components/auth/RequireAuth";
import { LOGIN_PATH } from "@/components/auth/MfaGate";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Events from "@/pages/Events";
import Login, { RESET_PASSWORD_PATH } from "@/pages/Login";
import Mail from "@/pages/Mail";
import ResetPassword from "@/pages/ResetPassword";
import Tasks from "@/pages/Tasks";
import Today from "@/pages/Today";
import { EMPTY_EVENT_SOURCE } from "@/lib/events";
import { createSupabaseTaskSource } from "@/lib/tasks";
import { EMPTY_TODAY_SOURCE } from "@/lib/today";

const queryClient = new QueryClient();

/** Úkoly čtou a zapisují `ukoly` přes supabase-js pod RLS (K2.2 hotové). */
const taskSource = createSupabaseTaskSource();

/**
 * Kořen aplikace. Přihlášení a obnova hesla jsou veřejné, všechno ostatní
 * jde přes `RequireAuth` (session + MFA). Obrazovky (Dnes, Pošta, Úkoly,
 * Události, Kontakty, Nastavení) přijdou podle `docs/prevzeti-z-vividbooks.md`
 * — za přihlášením jsou Dnes a Události (prázdné zdroje), Úkoly nad `ukoly` a Pošta nad enginem.
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
                      {/* Dnes zatím nad prázdným zdrojem — signály přijdou s K2. */}
                      <Route path={TODAY_PATH} element={<Today source={EMPTY_TODAY_SOURCE} />} />
                      <Route path={MAIL_PATH} element={<Mail />} />
                      {/* Úkoly nad tabulkou `ukoly`; `move` zapisuje `stav` + `stav_zdroj = klik`. */}
                      <Route path={TASKS_PATH} element={<Tasks source={taskSource} />} />
                      {/* Události zatím nad prázdným zdrojem — návrhy z mailů přijdou s K2. */}
                      <Route path={EVENTS_PATH} element={<Events source={EMPTY_EVENT_SOURCE} />} />
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
