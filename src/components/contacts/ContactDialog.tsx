import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import { EMPTY_CONTACT_DRAFT, type ContactDetail, type ContactDraft, type ContactSource } from "@/lib/contacts";

interface ContactDialogProps {
  open: boolean;
  source: ContactSource;
  onClose: () => void;
  onCreated: (contact: ContactDetail) => void;
}

/**
 * Nový kontakt: jméno, příjmení, tituly, organizace, e-mail, poznámka.
 * Tvar podle `PersonFormDialog` z CRM (vividbooks, `831f9ae6`), bez vazby
 * na školu, rolí Kabinetu a souhlasů s marketingem.
 */
export function ContactDialog({ open, source, onClose, onCreated }: ContactDialogProps) {
  const t = cs.kontakty.detail;
  const { toast } = useToast();
  const [draft, setDraft] = useState<ContactDraft>(EMPTY_CONTACT_DRAFT);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<ContactDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ title: t.neplatnyEmail, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const created = await source.create(draft, email);
      toast({ title: t.zalozen });
      setDraft(EMPTY_CONTACT_DRAFT);
      setEmail("");
      onCreated(created);
      onClose();
    } catch (err) {
      toast({ title: t.ulozeniSelhalo, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{cs.kontakty.novyKontakt}</DialogTitle>
          <DialogDescription className="sr-only">{cs.kontakty.novyKontakt}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="kontakt-jmeno" className="text-[11px] text-muted-foreground">
              {t.jmeno}
            </Label>
            <Input id="kontakt-jmeno" autoFocus className="h-9" value={draft.firstName} onChange={(e) => set({ firstName: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kontakt-prijmeni" className="text-[11px] text-muted-foreground">
              {t.prijmeni}
            </Label>
            <Input id="kontakt-prijmeni" className="h-9" value={draft.lastName} onChange={(e) => set({ lastName: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kontakt-tituly" className="text-[11px] text-muted-foreground">
              {t.tituly}
            </Label>
            <Input id="kontakt-tituly" className="h-9" value={draft.titles} onChange={(e) => set({ titles: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kontakt-role" className="text-[11px] text-muted-foreground">
              {t.role}
            </Label>
            <Input id="kontakt-role" className="h-9" value={draft.role} onChange={(e) => set({ role: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="kontakt-org" className="text-[11px] text-muted-foreground">
              {t.organizace}
            </Label>
            <Input id="kontakt-org" className="h-9" placeholder={t.organizacePlaceholder} value={draft.organizationName} onChange={(e) => set({ organizationName: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="kontakt-email" className="text-[11px] text-muted-foreground">
              {t.novyEmail}
            </Label>
            <Input id="kontakt-email" type="email" className="h-9" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="kontakt-poznamka" className="text-[11px] text-muted-foreground">
              {t.poznamka}
            </Label>
            <Textarea id="kontakt-poznamka" rows={3} className="text-sm" placeholder={t.poznamkaPlaceholder} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t.zrusit}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {cs.kontakty.novyKontakt}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
