import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Podpis v těle e-mailu.
 *
 * Převzato z vividbooks CRM (`831f9ae6`); změněná je jen třída node view
 * (`vb-email-signature` → `doktor-email-signature`).
 *
 * Důvod, proč podpis není obyčejný text (Dan 20. 9. 2026: „podpis nevypadá
 * tak, jak jsem ho uložil – má jiné barvy, fonty a rozložení“):
 *
 * Editor (ProseMirror) umí jen to, co má v schématu – fonty, odsazení buněk a další styly z podpisu by zahodil.
 * Podpis proto drží jako jeden blok s původním HTML: v okně e-mailu je vidět přesně tak, jak byl uložen v profilu,
 * dá se označit a smazat, ale needituje se po písmenkách (mění se v Můj profil → Podpis e-mailu).
 */
export interface EmailSignatureOptions {
  HTMLAttributes: Record<string, unknown>;
}

export const EmailSignature = Node.create<EmailSignatureOptions>({
  name: "emailSignature",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  isolating: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    // HTML podpisu držíme v atributu, ale do výsledného e-mailu se vypisuje jako obsah, ne jako atribut
    return { html: { default: "", rendered: false } };
  },

  parseHTML() {
    return [{
      tag: "div[data-signature]",
      getAttrs: (el) => ({ html: (el as HTMLElement).innerHTML }),
    }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const dom = document.createElement("div");
    for (const [k, v] of Object.entries(mergeAttributes(this.options.HTMLAttributes, HTMLAttributes))) {
      if (v !== null && v !== undefined) dom.setAttribute(k, String(v));
    }
    dom.setAttribute("data-signature", "true");
    dom.innerHTML = String(node.attrs.html ?? "");
    return dom;
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.setAttribute("data-signature", "true");
      dom.className = "not-prose doktor-email-signature";
      dom.contentEditable = "false";
      dom.innerHTML = String(node.attrs.html ?? "");
      return { dom };
    };
  },
});

/** HTML podpisu → blok pro editor. */
export const signatureBlockHtml = (html: string) => `<div data-signature="true">${html}</div>`;
