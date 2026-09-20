import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import ThemeHost from "@/components/ThemeHost";
import RequireAuth from "@/components/auth/RequireAuth";
import { LOGIN_PATH } from "@/components/auth/MfaGate";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login, { RESET_PASSWORD_PATH } from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import Today from "@/pages/Today";
import { EMPTY_TODAY_SOURCE } from "@/lib/today";

const queryClient = new QueryClient();

/**
 * Kořen aplikace. Přihlášení a obnova hesla jsou veřejné, všechno ostatní
 * jde přes `RequireAuth` (session + MFA). Obrazovky (Dnes, Pošta, Úkoly,
 * Události, Kontakty, Nastavení) přijdou podle `docs/prevzeti-z-vividbooks.md`
 * — za přihlášením je zatím jen Dnes nad prázdným zdrojem.
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
                  {/* Dnes zatím nad prázdným zdrojem — signály přijdou s K2. */}
                  <Today source={EMPTY_TODAY_SOURCE} />
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
