import { FolderOpen, PenSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import type { MailFolderRef } from "@/lib/email/types";
import type { EmailFolder } from "./emailFolders";

interface EmailFolderNavProps {
  activeFolder: string;
  folders: EmailFolder[];
  onFolderChange: (folder: EmailFolder) => void;
  onNewEmail: () => void;
  customFolders?: MailFolderRef[];
}

/**
 * Levá navigace schránky. Převzato z vividbooks CRM (`831f9ae6`).
 *
 * Odstřižené zakládání a mazání složek (`onCreateFolder`, `onDeleteFolder`
 * a celý inline formulář): `createFolder` ani `deleteFolder` se nevystavují
 * (pravidlo 3 v `CLAUDE.md`). Vlastní složky jsou jen k prohlížení a k přesunu
 * zprávy — skládá je engine, ne uživatel.
 */
export function EmailFolderNav({
  activeFolder,
  folders,
  onFolderChange,
  onNewEmail,
  customFolders = [],
}: EmailFolderNavProps) {
  return (
    <div className="flex h-full flex-col px-2 py-3">
      <Button onClick={onNewEmail} className="mx-1 mb-4">
        <PenSquare className="mr-2 h-4 w-4" />
        {cs.posta.psani.novy}
      </Button>

      <nav className="flex flex-col gap-0.5">
        {folders.map((folder) => {
          const Icon = folder.icon;
          const isActive = activeFolder === folder.id;
          return (
            <button
              key={folder.id}
              onClick={() => onFolderChange(folder)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                isActive
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{folder.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-1 px-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {cs.posta.slozky.vlastni}
          </span>
        </div>

        <nav className="flex flex-col gap-0.5">
          {customFolders.map((folder) => {
            const isActive = activeFolder === folder.id;
            return (
              <button
                key={folder.id}
                onClick={() => onFolderChange({ id: folder.id, label: folder.name, icon: FolderOpen })}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  isActive
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <FolderOpen className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 truncate">{folder.name}</span>
              </button>
            );
          })}
          {customFolders.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">{cs.posta.slozky.zadneVlastni}</p>
          )}
        </nav>
      </div>
    </div>
  );
}

interface EmailFolderTabsProps {
  activeFolder: string;
  folders: EmailFolder[];
  onFolderChange: (folder: EmailFolder) => void;
}

export function EmailFolderTabs({ activeFolder, folders, onFolderChange }: EmailFolderTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3 py-2">
      {folders.map((folder) => {
        const Icon = folder.icon;
        const isActive = activeFolder === folder.id;
        return (
          <button
            key={folder.id}
            onClick={() => onFolderChange(folder)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs transition-colors",
              isActive
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {folder.label}
          </button>
        );
      })}
    </div>
  );
}
