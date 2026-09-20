import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ThemeHost from "@/components/ThemeHost";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const queryClient = new QueryClient();

/**
 * Kořen aplikace. Zatím jen obaly, které převzatý UI kit potřebuje —
 * obrazovky (Dnes, Pošta, Úkoly, Události, Kontakty, Nastavení) přijdou
 * podle `docs/prevzeti-z-vividbooks.md`.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeHost />
      <TooltipProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
