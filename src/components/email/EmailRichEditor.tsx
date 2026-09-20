import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, Color, BackgroundColor, FontSize } from "@tiptap/extension-text-style";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table/kit";
import { EmailSignature } from "./EmailSignatureNode";
import Link from "@tiptap/extension-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Paintbrush,
  Link2,
  Eraser,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { cs } from "@/lib/i18n/cs";

/**
 * Převede vložené HTML (např. z Wordu / webu) na prostý text bez stylů, fontů
 * a barev — zachová jen zalomení odstavců. Vložený text tak převezme výchozí
 * formátování editoru (font, velikost, barva).
 */
function pastedHtmlToPlain(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr|blockquote)\s*>/gi, "\n");
  const doc = new DOMParser().parseFromString(withBreaks, "text/html");
  const text = doc.body.textContent || "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n/g, "<br>");
}

function normalizeHref(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^mailto:/i.test(t) || /^tel:/i.test(t)) return t;
  return `https://${t}`;
}

function safeHref(raw: string): string | null {
  const h = normalizeHref(raw);
  if (!h) return null;
  if (/^\s*javascript:/i.test(h) || /^\s*data:/i.test(h)) return null;
  return h;
}

/** Obrázek, který si nechá width / height / style – podpisy z Gmailu nosí rozměry v atributech (jinak se fotka roztáhne). */
const SignatureImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null },
      height: { default: null },
      style: { default: null },
    };
  },
});

const FONT_SIZES = [
  { label: cs.posta.editor.velikostMala, value: "12px" },
  { label: cs.posta.editor.velikostNormalni, value: "14px" },
  { label: cs.posta.editor.velikostVelka, value: "18px" },
  { label: cs.posta.editor.velikostVelmiVelka, value: "24px" },
];

interface EmailRichEditorProps {
  defaultContent?: string;
  onUpdate?: (html: string) => void;
  editorRef?: React.MutableRefObject<ReturnType<typeof useEditor> | null>;
  compact?: boolean;
  /** Přepíše výchozí min. výšku editačního pole (např. kompaktní zeď). */
  minHeightClass?: string;
  /** Soubory přetažené / vložené do editoru se přidají jako přílohy (ne do textu). */
  onFilesAdded?: (files: File[]) => void;
}

/**
 * Editor těla zprávy (tiptap). Převzato z vividbooks CRM (`831f9ae6`) beze
 * změny chování — texty šly do `src/lib/i18n/cs.ts`.
 */
export function EmailRichEditor({ defaultContent = "", onUpdate, editorRef, compact = false, minHeightClass, onFilesAdded }: EmailRichEditorProps) {
  const [textColor, setTextColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const onFilesAddedRef = useRef(onFilesAdded);
  onFilesAddedRef.current = onFilesAdded;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
        },
      }),
      TextStyle,
      FontSize,
      Color,
      BackgroundColor,
      // podpisy z Gmailu nesou rozměry a styl v atributech obrázku – bez nich by se fotka roztáhla na plnou velikost
      SignatureImage.configure({ inline: true, allowBase64: true }),
      // tabulky drží pohromadě vložené HTML (logo vedle textu, ikony v řadě)
      TableKit.configure({ table: { resizable: false } }),
      // podpis = jeden blok s původním HTML (fonty, barvy a rozložení z profilu)
      EmailSignature,
      TextAlign.configure({ types: ["paragraph"] }),
    ],
    content: defaultContent,
    autofocus: "start",        // kurzor na prvním řádku, ať se dá hned psát (podpis je dole)
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none px-3 py-2 text-sm " +
          (minHeightClass ?? (compact ? "min-h-[320px]" : "min-h-[300px]")) +
          " [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0" +
          // tabulky v podpisu se nesmí roztáhnout na celou šířku (ProseMirror je defaultně stahuje na 100 %)
          " [&_table]:!w-auto [&_table]:border-collapse [&_colgroup]:hidden [&_td]:p-0 [&_td]:!w-auto [&_td]:align-top" +
          " [&_img]:inline-block [&_img]:max-w-full" +
          " [&_[data-signature]]:mt-3 [&_[data-signature]]:cursor-default [&_[data-signature]]:select-none" +
          " [&_[data-signature].ProseMirror-selectednode]:outline [&_[data-signature].ProseMirror-selectednode]:outline-2 [&_[data-signature].ProseMirror-selectednode]:outline-primary/40",
        style: "font-family: Arial, sans-serif; line-height: 1.4; color: hsl(var(--foreground)); caret-color: auto;",
      },
      // Přetažené soubory → příloha, ne vložení do textu.
      handleDrop: (_view, event) => {
        const files = (event as DragEvent).dataTransfer?.files;
        if (files && files.length > 0) {
          event.preventDefault();
          onFilesAddedRef.current?.(Array.from(files));
          return true;
        }
        return false;
      },
      // Vložené soubory (obrázek ze schránky apod.) → příloha, ne do textu.
      handlePaste: (_view, event) => {
        const files = (event as ClipboardEvent).clipboardData?.files;
        if (files && files.length > 0) {
          event.preventDefault();
          onFilesAddedRef.current?.(Array.from(files));
          return true;
        }
        return false;
      },
      // Vložení textu odjinud zbaví stylů — převezme výchozí formátování e-mailu.
      transformPastedHTML: (html) => pastedHtmlToPlain(html),
    },
  });

  useEffect(() => {
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  if (!editor) return null;

  const clearFormatting = () => {
    editor
      .chain()
      .focus()
      .unsetAllMarks()
      .unsetColor()
      .unsetFontSize()
      .unsetBackgroundColor()
      .clearNodes()
      .run();
  };

  const ToolbarButton = ({
    onClick,
    active,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    children: ReactNode;
    title?: string;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", active && "bg-accent text-accent-foreground")}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      {title && <TooltipContent>{title}</TooltipContent>}
    </Tooltip>
  );

  return (
    <div className="border border-input rounded-md bg-background overflow-hidden flex flex-col flex-1">
      {/* Toolbar */}
      <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-border bg-muted/30 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title={cs.posta.editor.tluste}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title={cs.posta.editor.kurziva}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title={cs.posta.editor.podtrzeni}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Popover
          open={linkOpen}
          onOpenChange={(open) => {
            setLinkOpen(open);
            if (open) {
              const attrs = editor.getAttributes("link") as { href?: string };
              setLinkUrl(attrs.href || "");
              const { from, to } = editor.state.selection;
              const selected = editor.state.doc.textBetween(from, to, "");
              setLinkText(selected);
            }
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7", editor.isActive("link") && "bg-accent text-accent-foreground")}
                >
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>{cs.posta.editor.odkaz}</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email-link-url" className="text-xs">
                  {cs.posta.editor.odkazUrl}
                </Label>
                <Input
                  id="email-link-url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder={cs.posta.editor.odkazUrlPlaceholder}
                  className="h-8 text-sm"
                />
              </div>
              {editor.state.selection.empty && (
                <div className="space-y-1.5">
                  <Label htmlFor="email-link-text" className="text-xs">
                    {cs.posta.editor.odkazText}
                  </Label>
                  <Input
                    id="email-link-text"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    placeholder={cs.posta.editor.odkazTextPlaceholder}
                    className="h-8 text-sm"
                  />
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    setLinkOpen(false);
                  }}
                  disabled={!editor.isActive("link")}
                >
                  {cs.posta.editor.odebratOdkaz}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  disabled={!safeHref(linkUrl)}
                  onClick={() => {
                    const href = safeHref(linkUrl);
                    if (!href) return;
                    const { from, to } = editor.state.selection;
                    const empty = from === to;
                    if (empty && editor.isActive("link")) {
                      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
                    } else if (empty) {
                      const label = (linkText.trim() || href).trim();
                      editor
                        .chain()
                        .focus()
                        .insertContent({
                          type: "text",
                          text: label,
                          marks: [{ type: "link", attrs: { href } }],
                        })
                        .run();
                    } else {
                      editor.chain().focus().setLink({ href }).run();
                    }
                    setLinkOpen(false);
                    onUpdate?.(editor.getHTML());
                  }}
                >
                  {cs.posta.editor.vlozit}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Font size dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                  <Type className="h-3.5 w-3.5" />
                  {cs.posta.editor.velikost}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{cs.posta.editor.velikostPisma}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start">
            {FONT_SIZES.map((size) => (
              <DropdownMenuItem
                key={size.value}
                onClick={() => editor.chain().focus().setFontSize(size.value).run()}
              >
                <span style={{ fontSize: size.value }}>{size.label}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={() => editor.chain().focus().unsetFontSize().run()}
            >
              {cs.posta.editor.velikostVychozi}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Text color */}
        <Tooltip>
          <TooltipTrigger asChild>
            <label className="relative flex items-center gap-1 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors px-1">
              <Type className="h-3.5 w-3.5" />
              <input
                type="color"
                value={textColor}
                onChange={(e) => {
                  setTextColor(e.target.value);
                  editor.chain().focus().setColor(e.target.value).run();
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <span className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: textColor }} />
            </label>
          </TooltipTrigger>
          <TooltipContent>{cs.posta.editor.barvaTextu}</TooltipContent>
        </Tooltip>

        {/* Background color */}
        <Tooltip>
          <TooltipTrigger asChild>
            <label className="relative flex items-center gap-1 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors px-1">
              <Paintbrush className="h-3.5 w-3.5" />
              <input
                type="color"
                value={bgColor}
                onChange={(e) => {
                  setBgColor(e.target.value);
                  editor.chain().focus().setBackgroundColor(e.target.value).run();
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <span className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: bgColor }} />
            </label>
          </TooltipTrigger>
          <TooltipContent>{cs.posta.editor.podbarveni}</TooltipContent>
        </Tooltip>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title={cs.posta.editor.odrazky}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title={cs.posta.editor.cislovani}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title={cs.posta.editor.vlevo}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title={cs.posta.editor.naStred}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title={cs.posta.editor.vpravo}
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={clearFormatting}
          title={cs.posta.editor.smazatFormat}
        >
          <Eraser className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      </TooltipProvider>

      {/* Editor content */}
      <EditorContent editor={editor} className="flex-1 overflow-auto" />
    </div>
  );
}
