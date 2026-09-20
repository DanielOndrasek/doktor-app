import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ThemeHost from "@/components/ThemeHost";

const queryClient = new QueryClient();

/**
 * Kořen aplikace. Zatím jen obaly — obrazovky (Dnes, Pošta, Úkoly, Události,
 * Kontakty, Nastavení) přijdou podle `docs/prevzeti-z-vividbooks.md`.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeHost />
    </QueryClientProvider>
  );
}
