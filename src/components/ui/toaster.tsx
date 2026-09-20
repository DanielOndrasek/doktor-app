import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();
  const isMobile = useIsMobile();

  /* Na mobilu (PWA) skrýváme potvrzovací (ne-chybové) toasty — uživatel
   * nechce hlášky typu „Byli jste úspěšně přihlášeni". Chybové (variant
   * "destructive") necháváme, ať je selhání vidět. */
  const visibleToasts = isMobile
    ? toasts.filter((t) => t.variant === "destructive")
    : toasts;

  return (
    <ToastProvider>
      {visibleToasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
