import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";

const Dialog = DialogPrimitive.Root;

/**
 * Mobilní safe-area pro celoobrazovkové / vysoké dialogy.
 *
 * U dialogů, které na mobilu sahají k hornímu okraji viewportu (fullscreen,
 * resp. centrovaný dialog s ~92dvh výškou), se zavírací křížek i hlavička
 * dostávaly příliš nahoru a na mobilu (zejm. iOS) mizely pod lištou
 * prohlížeče / výřezem (notch). Tyto třídy přidají na mobilu větší horní
 * mezeru s respektem k `env(safe-area-inset-top)` a zároveň posunou vestavěný
 * křížek (`[data-dialog-close]`) o stejnou hodnotu níž, aby zůstal zarovnaný.
 *
 * Použij variantu podle toho, do jaké šířky je daný dialog fullscreen:
 * `…Sm` (do `sm`) nebo `…Lg` (do `lg`). Řetězce jsou záměrně literální,
 * aby je Tailwind JIT spolehlivě vygeneroval.
 */
export const dialogMobileSafeTopSm =
  "max-sm:pt-[max(1.5rem,env(safe-area-inset-top))] max-sm:[&_[data-dialog-close]]:top-[max(2rem,calc(env(safe-area-inset-top)+0.5rem))]";
export const dialogMobileSafeTopLg =
  "max-lg:pt-[max(1.5rem,env(safe-area-inset-top))] max-lg:[&_[data-dialog-close]]:top-[max(2rem,calc(env(safe-area-inset-top)+0.5rem))]";

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
  ({ className, ...props }, ref) =>
  <DialogPrimitive.Overlay
    ref={ref}
    /* `data-radix-dialog-overlay` — vlastní marker, kvůli kterému umíme overlay
     * jednoznačně vyselektovat z globálního CSS (Radix sám tento atribut
     * nepřidává, drží jen `data-state="open|closed"`, který je sdílený s
     * Tooltipy/Accordions/atd.). Cíl: během screenshotu (`body.vividbooks-
     * screenshot-capturing`) overlay přechodně schovat — viz `index.css`. */
    data-radix-dialog-overlay=""
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props} />

);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Enter/exit animace obsahu dialogu.
 *
 * - `default`: shadcn zoom (95 % → 100 %) + slide z centra — pro běžné malé
 *   vycentrované dialogy.
 * - `fade`: pouze fade-in/out — pro fullscreen / velkoplošné dialogy.
 *   POZOR: zoom/slide třídy z `tailwindcss-animate` NEJDOU přebít přes
 *   `className` — `tailwind-merge` je nezná, takže ve výsledku zůstanou
 *   default třídy i „přepisující" třídy zároveň a okno při otevření letí
 *   přes obrazovku a škáluje se (v dark mode viditelné jako „ghost" obrysy).
 *   Proto se animace volí touto propou, ne přes `className`.
 */
const dialogContentMotion = {
  default:
    "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
  fade: "",
} as const;

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  motion?: keyof typeof dialogContentMotion;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps>(
  ({ className, children, motion = "default", ...props }, ref) =>
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      /* `data-radix-dialog-content` — viz komentář u DialogOverlay.
       * Tento marker dovoluje globálnímu CSS (a html-to-image filtru
       * v `captureAppScreenshot.ts`) jednoznačně rozeznat content box
       * od ostatních elementů s `data-state="open"`. */
      data-radix-dialog-content=""
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 focus:outline-none focus-visible:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:rounded-lg",
        dialogContentMotion[motion],
        className
      )}
      {...props}>

      {children}
      <DialogPrimitive.Close data-dialog-close="" className="absolute right-4 top-4 z-[70] rounded-md bg-background/95 p-1 opacity-90 shadow-sm ring-offset-background backdrop-blur-sm transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">{cs.ui.zavrit}</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
<div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />;

DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
<div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />;

DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...props }, ref) =>
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props} />

);
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )

);
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription };