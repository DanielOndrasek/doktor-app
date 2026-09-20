import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import type { EmailTemplateDraft } from "@/lib/email/compose";

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  bodyHtml: string;
  onSave: (draft: EmailTemplateDraft) => Promise<void>;
}

/**
 * Uložení rozepsané zprávy jako šablony. Převzato z vividbooks CRM
 * (`831f9ae6`); zápis do `email_templates` nahradil prop `onSave`
 * a zaškrtávátko „Sdílet s ostatními uživateli" (`is_shared`) je pryč.
 */
export function SaveAsTemplateDialog({ open, onOpenChange, subject, bodyHtml, onSave }: SaveAsTemplateDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: cs.posta.sablony.zadejteNazev, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), subject: subject || null, bodyHtml: bodyHtml || null, folder: null });
      toast({ title: cs.posta.sablony.ulozeno });
      setName("");
      onOpenChange(false);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{cs.posta.psani.ulozitJakoSablonu}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={cs.posta.sablony.nazevPole}
            className="h-8 text-sm"
            autoFocus
          />
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
            {cs.posta.sablony.ulozit}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
