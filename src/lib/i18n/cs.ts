/**
 * Všechny uživatelsky viditelné texty aplikace. Do komponent se nepíše
 * natvrdo nic, co uživatel uvidí nebo co přečte odečítač obrazovky — viz
 * `CLAUDE.md`, oddíl Konvence.
 *
 * Řazení podle oblasti. Uvnitř oblasti podle toho, jak texty na obrazovce
 * jdou za sebou, ne podle abecedy.
 */
export const cs = {
  /** Texty zabudované v převzatém UI kitu (shadcn). Uživatel je většinou
   *  nevidí — jsou to popisky pro odečítače obrazovky a výchozí hodnoty. */
  ui: {
    zavrit: "Zavřít",
    dalsi: "Další",
    vic: "Více",
    vicStranek: "Další stránky",
    predchoziStranka: "Předchozí stránka",
    dalsiStranka: "Následující stránka",
    strankovani: "Stránkování",
    drobenka: "Cesta na stránce",
    prepnoutPanel: "Přepnout postranní panel",
    nacitani: "Načítání…",
    zacniPsat: "Začněte psát pro vyhledávání…",
  },

  /** Pošta (`src/components/email/`). */
  posta: {
    slozky: {
      inbox: "Příchozí",
      starred: "S hvězdičkou",
      important: "Důležité",
      sent: "Odesláno",
      drafts: "Koncepty",
      archive: "Archiv",
      spam: "Spam",
      trash: "Koš",
      vlastni: "Složky",
      zadneVlastni: "Žádné složky",
    },

    seznam: {
      hledat: "Hledat e-maily…",
      pouzeNeprectene: "Pouze nepřečtené",
      vsechny: "Všechny e-maily",
      obnovit: "Obnovit",
      zadneEmaily: "Žádné e-maily",
      nacistDalsi: "Načíst další",
      bezPredmetu: "(bez předmětu)",
      oznacitNeprectene: "Označit jako nepřečtené",
      vyberEmail: "Vyberte e-mail k zobrazení",
      nacitani: "Načítání…",
    },

    detail: {
      komu: "Komu:",
      telo: "Tělo zprávy",
      prilohy: "Přílohy",
      odpovedet: "Odpovědět",
      preposlat: "Přeposlat",
      neprectene: "Nepřečtené",
      presunout: "Přesunout",
      dnes: "dnes",
      vcera: "včera",
      prilohuOtevreEngine: "Otevírání příloh zařídí engine — zatím není propojený.",
    },

    psani: {
      novy: "Nový e-mail",
      odpoved: "Odpovědět",
      komu: "Komu",
      predmet: "Předmět",
      predmetPlaceholder: "Předmět",
      adresaPlaceholder: "email@example.com",
      adresaCcPlaceholder: "cc@example.com",
      adresaBccPlaceholder: "bcc@example.com",
      odeslat: "Odeslat",
      pridatPrilohu: "Přidat přílohu",
      prilohyNejsouKDispozici: "Nahrávání příloh zařídí engine — zatím není propojený.",
      nahravamPrilohu: "Nahrávám přílohu…",
      ulozitJakoSablonu: "Uložit jako šablonu",
      vybratSablonu: "Vybrat šablonu",
      hledatSablonu: "Hledat šablonu…",
      zadneSablony: "Žádné šablony",
      zadneVysledky: "Žádné výsledky",
      spravovatSablony: "Spravovat šablony",
      chybiPrijemce: "Chybí příjemce",
      chybiText: "Chybí text zprávy",
      odeslano: "E-mail odeslán",
      chybaOdeslani: "Chyba při odesílání",
      chybaPrilohy: "Přílohu se nepodařilo nahrát",
      odebratPrilohu: "Odebrat přílohu",
      odebratAdresata: "Odebrat adresáta",
      enterProPridani: "Stiskněte Enter pro přidání adresy",
      ostatni: "Ostatní",
    },

    chyby: {
      bezSchranky: "Není propojená žádná schránka.",
      nacteniSeznamu: "Nepodařilo se načíst e-maily.",
      nacteniZpravy: "Nepodařilo se načíst e-mail.",
      nacteniSlozek: "Nepodařilo se načíst složky.",
      oznaceni: "Nepodařilo se označit e-mail.",
      presun: "Nepodařilo se přesunout e-mail.",
    },

    presunuto: "Přesunuto do",

    podpis: {
      nahled: "Podpis e-mailu",
    },

    editor: {
      tluste: "Tučné",
      kurziva: "Kurzíva",
      podtrzeni: "Podtržení",
      odkaz: "Hypertext (odkaz)",
      odkazUrl: "URL",
      odkazUrlPlaceholder: "https://… nebo www…",
      odkazText: "Text odkazu (volitelné)",
      odkazTextPlaceholder: "Zobrazený text",
      odebratOdkaz: "Odebrat odkaz",
      vlozit: "Vložit",
      velikost: "Velikost",
      velikostPisma: "Velikost písma",
      velikostVychozi: "Výchozí",
      velikostMala: "Malý",
      velikostNormalni: "Normální",
      velikostVelka: "Velký",
      velikostVelmiVelka: "Velmi velký",
      barvaTextu: "Barva textu",
      podbarveni: "Podbarvení textu",
      odrazky: "Odrážky",
      cislovani: "Číslovaný seznam",
      vlevo: "Zarovnat vlevo",
      naStred: "Zarovnat na střed",
      vpravo: "Zarovnat vpravo",
      smazatFormat: "Smazat formátování",
    },

    sablony: {
      nazevSeznam: "E-mailové šablony",
      nova: "Nová šablona",
      upravitNazev: "Upravit šablonu",
      hledat: "Hledat šablonu…",
      vsechny: "Všechny šablony",
      zadne: "Zatím tu nejsou žádné šablony.",
      zadneVyberu: "Žádné šablony neodpovídají výběru.",
      ostatni: "Ostatní",
      bezPredmetu: "bez předmětu",
      predmetPrefix: "Předmět: ",
      pouzito: "použito",
      nepouzito: "nepoužito",
      upravit: "Upravit",
      smazat: "Smazat",
      pouzit: "Použít",
      nahled: "Náhled šablony",
      bezTextu: "Šablona nemá text.",
      bezNahledu: "Vyber šablonu vlevo.",
      poleVysvetleni:
        "Žlutě označená pole se při použití doplní podle adresáta; co doplnit nejde, zůstane v textu zvýrazněné.",
      nazevPole: "Název šablony",
      nazevPlaceholder: "Např. Potvrzení termínu",
      predmetPole: "Předmět e-mailu",
      predmetPlaceholder: "Předmět (volitelné)",
      zarazeniPole: "Zařazení",
      zarazeniPlaceholder: "Např. Ambulance",
      obsah: "Obsah",
      ulozit: "Uložit",
      zrusit: "Zrušit",
      zadejteNazev: "Zadejte název šablony",
      ulozeno: "Šablona uložena",
      smazano: "Šablona smazána",
    },

    prace: {
      nazev: "Na čem pracovat",
      cekaNaOdpoved: "Čeká na mou odpověď",
      dnu: "d",
      bezPredmetu: "(bez předmětu)",
    },
  },

  /** Výběr data (`ui/date-picker.tsx`). */
  datum: {
    vybratDatum: "Vybrat datum",
    popisek: "Datum",
    smazatDatum: "Smazat datum",
  },

  /** Přepínač světlého a tmavého režimu (`components/ThemeHost.tsx`). */
  tema: {
    svetle: "Světlý režim",
    tmave: "Tmavý režim",
    podleSystemu: "Podle systému",
  },
} as const;
