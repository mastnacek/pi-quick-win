# PRD — pi-quick-win

**Datum:** 2026-09-28
**Autor:** pi-plugin-dev (workshop), zadavatel: Jaroslav
**Stav:** návrh / zadáno — SPAI-015 (`docs/spai/2026-09-28-SPAI-015-…md`), `@plugins !medium :plugin:motivation:ux:`
**Repozitář (plánovaný):** `git:github.com/mastnacek/pi-quick-win`
**Typ:** Pi extension (custom tool + prompt policy)

---

## 1. Proč tento plugin vznikl

Myšlenka vznikla 2026-09-28 během práce na dlouhém, vícekrokovém LotusScript zadání
(BL agenti + Informix API v `nsfodp-export`). Zadání bylo velké, kroků desítky,
a **jeho skutečná hodnota se objevila až na konci** — mezitím bylo vidět jen
„agent pracuje". Přesně v tom okně vzniká únava: práce běží, ale nic není hotové.

Zaznamenané pozorování, ze kterého plugin vychází:

1. **Agent hlásí aktivitu, ne doručení.** „Prohledal jsem 12 souborů", „upravil jsem
   3 moduly" je popis pohybu. Programátor z něj nedostane signál *„už je z toho
   něco použitelné"*. Chybí odpověď na jedinou otázku, která drží motivaci:
   **co je nejmenší věc, kterou můžeme doručit teď?**
2. **Otázka „nejmenší doručitelná část" je to, co dělá senior seniora.** Dobrý
   vývojář nerozbaluje velké zadání na fáze; hledá nejmenší svislý řez, který
   má samostatnou hodnotu. Agent to dělá implicitně a tiše, uvnitř svého plánu.
   Kdyby to vyslovil nahlas a hned, programátor by dostal okamžitou informaci
   a okamžitou volbu.
3. **Ve workshopu už tato disciplína existuje, ale jen pro agenta.** Vlastní
   `.pi/APPEND_SYSTEM.md` má *Momentum rule (prewalk discipline)*: „Every task
   starts with a small, real, successful action within the first few tool calls."
   Vzniklo to proto, aby se agent nerozjížděl dlouhým plánem. Plugin dělá totéž
   pro **člověka** — dává mu malý, reálný, úspěšný krok na začátku a tím uzavírá
   smyčku, ze které pochází energie.
4. **Rychlá smyčka je i ekonomická.** Motivace a tokenová ekonomie mají stejný
   zdroj: krátká smyčka. Než se ukáže hodnota, spotřebují se tisíce tokenů;
   plugin, který hodnotu zviditelní dřív, šetří i peníze.

Stručně: **plugin nevznikl z touhy motivovat, ale z konkrétní slepé skvrny —
zadání přichází v nejhorším okamžiku pro motivaci (nic není hotové), a nikdo
v tu chvíli neřekne, jak vypadá nejbližší výhra.**

---

## 2. Problém

| Fáze | Co se děje dnes | Následek |
| --- | --- | --- |
| Zadání | Uživatel napíše velký požadavek | Neví, jestli to je 20 minut nebo 3 dny |
| Průběh | Agent streamuje tool-cally a thinking | Signál je „pracuje se", ne „něco je použitelné" |
| Polovina | Kontext roste, směr se koriguje | Pocit, že práce nemá hranici |
| Konec | Výsledek přijde (i dobře) | Odměna je pozdě → nevzniká asociace „tohle mě bavilo" |

Chybí **okamžité, konkrétní a pravdivé oznámení nejbližší doručitelné hodnoty**
v momentě zadání, plus **uzavření smyčky** ve chvíli, kdy je opravdu doručena.

---

## 3. Psychologie programátora — proč to není kosmetika

Tohle je jádro PRD, ne příloha. Plugin, který jen ukáže hezký modal, selže;
plugin, který zasáhne skutečné zdroje pracovní energie, může změnit, jak se
programuje. Co víme o tom, co člověka u práce drží:

### 3.1 Progres v smysluplné práci je nejsilnější zdroj vnitřní pohody
Amabileová a Kramerová (*The Progress Principle*, 2011) analyzovali tisíce
deníkových záznamů: největší vliv na „inner work life" (emoce, motivace,
vnímání práce) neměly velké úspěchy ani odměny, ale **malé vítězství — pocit
postupu v práci, na které záleží**. Nejhorší den nebyl den selhání, ale den
**blokace**: pracoval jsi, ale nepostoupil.

→ Z toho plyne tvar produktu: nestačí „hrozí blokace"; musí přijít
**dokázaný, malý postup**, a to včas.

### 3.2 Kompetence, autonomie, vztah — self-determination theory
Deci a Ryan: vnitřní motivace stojí na třech pilířích, a každý z nich má
v našem případě konkrétní protějšek:

| Pilíř | Co ho v agentní práci zabíjí | Co ho plugin vrací |
| --- | --- | --- |
| **Kompetence** | Nevím, jestli to, co dělám, vede k výsledku | Konkrétní krok + jak se pozná, že je hotový |
| **Autonomie** | Agent si volí směr sám, jsem jen divák | Volba *deliver now / later / skip* |
| **Sounáležitost** | Práce je tichá | Oznámení je adresované mně, ne logu |

### 3.3 Dopamin je predikční chyba, ne odměna za výsledek
Schultz a kol.: dopaminergní neurony kódují **rozpor mezi očekávanou a skutečnou
odměnou** a silně reagují už na *předpověď* odměny. Praktické důsledky:

- Odměna musí být **okamžitá** (pozdní odměna se neučí).
- Musí být **nepodmíněná a pravdivá** (falešný signál se naučí ignorovat).
- Nejsilnější je **nejistá, ale reálná** výhra — proto volba a proto skutečný kód,
  ne odznáček.
- Odměna musí být **spojena s konkrétní akcí** (doručený inkrement), jinak
  vzniká závislost na notifikacích místo na práci.

### 3.4 Flow potřebuje rovnováhu výzvy a dovednosti
Csikszentmihalyi: flow nastává, když výzva odpovídá dovednostem. Velké zadání
bez viditelné struktury = výzva „neuchopitelná" → úzkost nebo nuda.
Nejmenší doručitelný inkrement je **kalibrace obtížnosti**: převádí
neomezenou výzvu na měřitelnou.

### 3.5 Otevřené smyčky a cílová gradientová hypotéza
- **Zeigarniková:** nedokončené úlohy zůstávají v paměti a vytvářejí tenzi.
  Pojmenovaný nejbližší cíl je uzavřená smyčka — odstraňuje šum.
- **Kivetz, Urminsky & Zheng (2006), goal-gradient:** úsilí roste s blížícím se
  cílem. Viditelný blízký cíl tedy není jen pocit — **mění tempo práce**.

### 3.6 Zahraniční past: overjustification / gamifikace
Deci, Koestner & Ryan (1999): očekávaná vnější hmotná odměna **snižuje**
vnitřní motivaci. Proto tento plugin **nesmí** být bodové skóre, série dnů,
odznáčky ani sledování produktivity. Musí ukazovat **skutečně doručitelnou
práci** a nechat odměnu vzniknout z ní (kód, který běží), ne z metadat.

### 3.7 Závěr z psychologie (závazné požadavky na design)

1. Oznámení přichází **při zadání**, ne na konci.
2. Obsahuje **jednu** věc (nejmenší doručitelná), ne seznam možností.
3. Obsahuje **důkaz hotovosti** (jak poznám, že je to hotové) — kompetence.
4. Nabízí **volbu** (autonomie), včetně práva odmítnout.
5. Uzavře se **ve chvíli doručení** (oslava/ozvěna), a to jen když je to pravda.
6. **Žádné skóre, série, žebříčky** — jen pravdivé malé výhry.
7. Cena za to musí být ~nula tokenů (viz §6) — jinak plugin sežere víc, než dá.

---

## 4. Proč to nestačí vyřešit promptem

Byly zvažovány tři levnější cesty a všechny selhaly:

| Cesta | Proč nestačí |
| --- | --- |
| Jen politika v `APPEND_SYSTEM.md` | Model text vygeneruje, ale **nevykreslí modal** a **neuzavře smyčku**. Programátor dostane další odstavec textu mezi ostatními — přesně ten šum, který má zmizet. |
| Hook na `edit`/`write`/`read` | Hook vidí **souborový I/O**, ne smysluplnost. Neumí rozhodnout, jestli změna znamená doručitelnou hodnotu; upozorňoval by na každý zápis. Špatná páka. |
| Nový slash command (`/win`) | Vyžaduje, aby si uživatel řekl o motivaci — kdo je unavený, ten si neřekne. Musí to přijít samo. |

Proto: **politika (aby agent věděl, kdy a jak) + custom tool (aby to uměl
zobrazit a vrátit volbu)**. Dvě části, každá dělá to, co ta druhá neumí.

---

## 5. Navržené řešení

### 5.1 Tvar

```
zadání úkolu
     │
     ▼
[APPEND_SYSTEM: quick-win politika]  ← agent hledá nejmenší doručitelný inkrement
     │
     ▼
[quick_win tool] ──► ctx.ui.custom() overlay  (přínos · náročnost · kroky · důkaz)
     │                        │
     │                        ├─ deliver_now  → agent implementuje právě ten inkrement
     │                        ├─ later        → zapíše se, připomene se později
     │                        └─ skip         → už dnes se neozve
     ▼
doručení inkrementu ──► [uzavření smyčky: oslava/ozvěna, jen když je pravda]
```

### 5.2 Části

| # | Část | Popis |
| --- | --- | --- |
| 1 | **Prompt politika** | 2–3 řádky v `APPEND_SYSTEM.md`: kdy volat `quick_win` (při přijetí netriviálního zadání, po první orientaci, před prvním velkým zápisem), co je „nejmenší doručitelný inkrement", zákaz vymýšlet si přínos. |
| 2 | **Tool `quick_win`** | Vstup: `title`, `impact`, `effort`, `steps[]`, `proof`, volitelně `alternatives`. Přes `StringEnum` (nikdy `Type.Union`/`Type.Literal` kvůli Gemini). Chyby `throw new Error(...)`. |
| 3 | **Overlay** | `ctx.ui.custom()` — karta s přínosem, náročností, kroky a **důkazem hotovosti**; klávesové volby `deliver_now` / `later` / `skip`. Návratová hodnota se vrací modelu jako výsledek toolu. |
| 4 | **Uzavření smyčky** | Po doručení inkrementu krátká ozvěna (statusline/ozvěna/sound); spouští se **jen** když je inkrement opravdu hotový a ověřený. |
| 5 | **Stav** | `later` položky přežijí `/reload`, `/tree` i kompakci — přes `pi.appendEntry()` (TUI-only) nebo `details` toolu (branch-aware). Konfigurace globálně v `~/.pi/agent/pi-quick-win.json`. |

### 5.3 Tvrdé invarianty (z workshopu, nepodkročitelné)

- `ctx.hasUI` je `true` i v RPC → **vždy** guard `ctx.mode === "tui"` u `ctx.ui.custom()`
  a `onTerminalInput()`; v `json`/`print` módech žádné UI, chování toolu na renderu nezávislé.
- Šířková bezpečnost: `visibleWidth()` / `truncateToWidth()` / `wrapTextByWidth()`, téma
  reaplikovat na každý řádek (nespoléhat na zděděné styly).
- `pi.on(...)` vrací unsubscribe → ukládat a vyprázdnit v `session_shutdown`.
- Žádné procesy/sockety/časovače ve factory extensionu — dlouhožijící zdroje
  startovat v `session_start`, `session_shutdown` idempotentní.
- Core balíčky (`@earendil-works/pi-ai`, `pi-agent-core`, `pi-coding-agent`, `pi-tui`,
  `typebox`) jen v `peerDependencies`, `"type": "module"`, `files` + `pi` manifest,
  `npm test` povinně.
- ≤ 400 řádků na soubor; TS přes jiti, **žádný build krok**.
- Instalace **výhradně** z GitHubu (`git:github.com/mastnacek/pi-quick-win`), nikdy
  z lokální cesty.

---

## 6. Tokenová ekonomie

Plugin, který má šetřit sílu, nesmí sežrat kontext. Závazek:

- Politika v systémové vrstvě: **≤ 3 řádky**, žádný tutoriál.
- Tool vrací **krátký strukturovaný výsledek**, ne esej.
- Vykreslení overlaye **nestojí žádné tokeny modelu** (je to TUI vrstva).
- Reference k psychologii a designu se **nedávají do promptu** — jsou v tomto PRD,
  načítané jen při vývoji.

Měřitelné: plugin nesmí zvýšit vstupní kontext session o víc než ~150 tokenů.

---

## 7. Znovupoužitelné stavební bloky

Nic z toho nevymýšlíme znovu. Co přesně si odkud bereme:

### 7.1 Modal + volba typu (UX overlaye)
**`@juicesharp/rpiv-ask-user-question`** — strukturovaný dotazník, který model
položí uživateli, s typovanými volbami místo volného textu. To je přesně tvar
našeho overlaye: „chci *tuhle* volbu, ne odpověď v próze".
- npm: https://www.npmjs.com/package/@juicesharp/rpiv-ask-user-question
- repo: https://github.com/juicesharp/rpiv-mono
- lokální klon: `inspirace/rpiv-mono/packages/rpiv-ask-user-question`

**Bereme:** stavbu overlaye, klávesové volby, návrat typované hodnoty z `ctx.ui.custom()`.
**Nebereme:** jeho doménu (dotaz na chybějící informaci) — my se ptáme na směr práce.

### 7.2 Odolná overlay karta (přežije `/reload` a kompakci)
**`@juicesharp/rpiv-todo`** — todo list modelu vykreslený jako živý overlay, který
přežije `/reload` i kompakci konverzace.
- npm: https://www.npmjs.com/package/@juicesharp/rpiv-todo
- repo: https://github.com/juicesharp/rpiv-mono
- lokální klon: `inspirace/rpiv-mono/packages/rpiv-todo`

**Bereme:** persistenci overlay stavu a to, jak přežít reload/kompakci (náš `later` seznam
musí přežít obojí). **Nebereme:** seznam úkolů jako hlavní UI — náš overlay je jednorázová karta.

### 7.3 Precedens oslavy / vykreslení výhry
**`@hank-warren/pi-statusline`** — kompaktní statusline s „neon celebrations for
exceptional prompt-cache hits": existující, fungující precedens, že Pi umí oslavit
metriku v TUI vrstvě.
- npm: https://www.npmjs.com/package/@hank-warren/pi-statusline
- repo: https://github.com/hank-warren/pi-extensions

**Bereme:** jak vypadá oslava, která není trapná (krátká, vzácná, jen při výjimečném
jevu) a jak se kreslí přes statusline/footer. **Nebereme:** co oslavuje (prompt-cache
hit) — my oslavujeme doručený krok.

### 7.4 Kanál zvuku a hlasu (ozvěna výhry)
**`pi-notify`** — desktop notifikace přes OSC 777/99/9 a Windows toast; jeho varianta
`@bacnh85/pi-notify` navíc umí zvuky.
- npm: https://www.npmjs.com/package/pi-notify
- repo: https://github.com/ferologics/pi-notify
- npm (varianta se zvukem): https://www.npmjs.com/package/@bacnh85/pi-notify

**`i-am-cooking`** — „když je uživatel pryč, agent pracuje sám; když je hotovo nebo
blokovaný, **vykřikne** — zvukem, TTS, toastem a push notifikací". Tohle je přesně
problematika „ozvěna musí přijít včas a musí být slyšet".
- npm: https://www.npmjs.com/package/i-am-cooking

**Bereme:** oddělení *události* od *kanálu*, fallback kaskádu (zvuk → TTS → toast)
a pravidlo, že ozvěna je opt-in a ztlumitelná. **Nebereme:** celý jejich event set.

Zvukový/hlasový subsystém **už máme vlastní, ve workshopu** — není důvod tahat cizí:
- `pi-tui-sound` — engine zvukových efektů pro TUI (zero-latency background engine,
  profily, `/sound`) → https://github.com/mastnacek/pi-tui-sound
- `pi-tts` — TTS s backendy edge/WinRT/SAPI5/espeak + `/audio`
  → https://github.com/mastnacek/pi-tts
- `inspirace/rpiv-mono/packages/rpiv-voice` — hlasový vzor v rpiv monu

### 7.5 Doplňkové vzory (vedlejší, ale známé)
| Plugin | Co si bereme |
| --- | --- |
| `pi-klid` (vlastní) | Měření doku při kreslení overlaye, chování bez TUI (`rpc`/`json`/`print` fallback) |
| `pi-eval-harness` (vlastní) | Rubriky a definition-of-done — zdroj pro pole `proof` (jak poznám, že je inkrement hotový) |
| `pi-goal-x` (https://github.com/tmonk/pi-goal-x) | Trvalé vykreslení karty, kterou přežije dlouhá session |
| `inspirace/rpiv-mono` (slice/design/blueprint) | Slovník „vertical slice" a micro-checkpointů |

### 7.6 Co jsme záměrně **ne**našli (důkaz novosti)
Prohledali jsme živý registry `pi.dev/packages` (**5 399 balíčků**, full-text přes
`GET /packages?name=…`) + 27 pluginů workshopu + 21 naklonovaných balíčků v `inspirace/`:

- `quick win`, `quickwin`, `momentum`, `motivation`, `celebrate`, `streak`,
  `dopamine`, `confetti`, `smallest`, `shippable`, `vertical slice`, `first win`,
  `small wins`, `positive feedback`, `well done` → **0 shod u jádra myšlenky**.
- Nejbližší nálezy byly jiné kategorie: `pi-eval-harness` (motivace = *zpětné
  známkování*), `inspirace/rpiv-mono` slice/blueprint (plánovací workflow, bez
  motivační smyčky a modalu), `bigpowers/develop-tdd` (metodika TDD), checkpointy
  a `*notify` balíčky (notifikace o dokončení — ale nikdo nerozhoduje, **co** je výhra).

→ Plugin řeší mezeru, kterou ekosystém nemá. To je jeho oprávnění existovat.

---

## 8. Rozsah a non-goals

**V rozsahu (v1):**
- politika + tool `quick_win` + overlay s volbou a zápisem stavu
- `deliver_now` / `later` / `skip`, `later` přežije reload
- jedna krátká ozvěna po doručení
- funguje v TUI; v ostatních módech se chová tiše a nespadne

**Mimo rozsah (záměrně, ať to nikdo nedodělává „protože by to šlo"):**
- ❌ bodové skóre, série, odznáčky, žebříčky, statistiky produktivity
- ❌ plánovač, správa backlogu, nahrazení `/goal` nebo todo listu
- ❌ měření „kolik kódu kdo napsal" a jakékoli hodnocení člověka
- ❌ delegování na subagenty, vlastní modely, autonomní rozhodování o prioritách

---

## 9. Akceptační kritéria (testovatelná)

1. Při netriviálním zadání agent zavolá `quick_win` a v TUI se objeví overlay
   karta s přínosem, náročností, kroky a důkazem hotovosti.
2. Volba `deliver_now` se vrátí modelu jako výsledek toolu a agent implementuje
   právě ten inkrement (ne jiný).
3. Volba `later` přežije `/reload` i kompakci a je dohledatelná.
4. V `--mode rpc`, `--mode json`, `--mode print` plugin **nevypíše žádné UI**
   a tool funguje (jen bez karty).
5. Po doručení a ověření inkrementu proběhne právě jedna krátká ozvěna;
   bez doručení neproběhne žádná.
6. `/quick-win off` (nebo ekvivalent v `~/.pi/agent/pi-quick-win.json`) plugin zcela ztiší.
7. `npm test` projde a pokrývá: volbu, přežití reloadu, chování bez TUI, ztlumení.
8. Nárůst vstupního kontextu session ≤ ~150 tokenů (změřeno).
9. Žádný soubor > 400 řádků; žádné core balíčky v `dependencies`.
10. Instalace `pi install git:github.com/mastnacek/pi-quick-win` funguje z čistého stavu.

---

## 10. Rizika a ošetření

| Riziko | Ošetření |
| --- | --- |
| Plugin obtěžuje (modal při každé maličkosti) | Tvrdý limit: nejvýš jednou na zadání; `skip` v session ztiší; globální vypínač |
| „Nejmenší inkrement" je vymyšlený, ne doručitelný | Pole `proof` je povinné; co nemá důkaz hotovosti, se nezobrazí |
| Oslava se zvrhne v gamifikaci (vnější odměna) | Žádné skóre/série; odměna je jen ozvěna reálného doručení (§3.6) |
| Overlay rozbije úzký terminál | `visibleWidth()`/`truncateToWidth()`/`wrapTextByWidth()` + měření doku jako v `pi-klid` |
| Duplicita s `/goal` a todo pluginy | Jasné non-goals (§8); plugin nemá vlastní seznam úkolů, jen jednorázovou kartu |
| Závislost na zvukovém subsystému | Zvuk je volitelný; absence `pi-tui-sound`/`pi-tts` degraduje na tichý režim |

---

## 11. Otevřené otázky (rozhodnout při implementaci)

1. Detekce „netriviálního zadání": jen politika v promptu, nebo i lehká heuristika
   na `turn_start`? (Politika je lacinější a míň křehká.)
2. `later` — připomínat kdy? (Začátek dalšího tahu vs. `session_start`.)
3. Má overlay nabízet i *jiný* nejmenší inkrement (2 volby), nebo vždy jeden?
   (Psychologie §3.4 říká jeden; autonomie §3.2 říká nabídnout alternativu.
   Kompromis: jeden primární + „jiný" skrytě.)
4. Ukládat `later` branch-aware (v `details` toolu) nebo TUI-only (`appendEntry`)?
5. Oslava: text ve statusline, zvuk, nebo obojí podle konfigurace?

---

## 12. Reference

**Psychologie a výzkum**
- Amabile, T. & Kramer, S. — *The Progress Principle* (2011) — malá vítězství a progres v smysluplné práci
- Deci, E. & Ryan, R. — self-determination theory (kompetence, autonomie, sounáležitost)
- Deci, E., Koestner, R. & Ryan, R. (1999) — meta-analýza: vnější hmotné odměny snižují vnitřní motivaci
- Schultz, W. — dopamine jako reward prediction error
- Csikszentmihalyi, M. — flow, rovnováha výzvy a dovednosti
- Zeigarniková, B. — efekt nedokončených úloh
- Kivetz, R., Urminsky, O. & Zheng, Y. (2006) — goal-gradient hypothesis

**Ekosystém a stavební bloky**
- `@juicesharp/rpiv-ask-user-question` — https://www.npmjs.com/package/@juicesharp/rpiv-ask-user-question · https://github.com/juicesharp/rpiv-mono
- `@juicesharp/rpiv-todo` — https://www.npmjs.com/package/@juicesharp/rpiv-todo
- `@hank-warren/pi-statusline` — https://www.npmjs.com/package/@hank-warren/pi-statusline · https://github.com/hank-warren/pi-extensions
- `pi-notify` — https://www.npmjs.com/package/pi-notify · https://github.com/ferologics/pi-notify
- `@bacnh85/pi-notify` (zvuky) — https://www.npmjs.com/package/@bacnh85/pi-notify
- `i-am-cooking` — https://www.npmjs.com/package/i-am-cooking
- `pi-goal-x` — https://www.npmjs.com/package/pi-goal-x · https://github.com/tmonk/pi-goal-x
- `pi-eval-harness` — https://www.npmjs.com/package/pi-eval-harness

**Vlastní workshop**
- `pi-tui-sound` — https://github.com/mastnacek/pi-tui-sound
- `pi-tts` — https://github.com/mastnacek/pi-tts
- `pi-klid`, `pi-eval-harness`, `pi-spai` — lokálně v `D:\01_programovani\pi\plugins\`
- `.pi/APPEND_SYSTEM.md` (Momentum rule) a `.pi/skills/pi-plugin-dev/SKILL.md`

**Engine**
- `D:\02_knihovny_path\node-v22.17.1-win-x64\node_modules\@earendil-works\pi-coding-agent\docs\`
  (`extensions.md`, `tui.md`, `packages.md`)

---

## 13. Zadání úkolu

> **Cíl:** Vytvořit plugin `pi-quick-win` — agent při zadání úkolu najde nejmenší
> samostatně doručitelnou část a ohlásí ji programátorovi modalem (přínos,
> náročnost, kroky, důkaz hotovosti) pro rychlou pozitivní smyčku.

**SPAI:** `SPAI-015` v `D:/01_programovani/pi/plugins/docs/spai/` (`@plugins !medium :plugin:motivation:ux:`)
**Projekt:** `D:/01_programovani/pi/plugins/pi-quick-win/` (složka existuje, prázdná)
**Cílový repozitář:** `github.com/mastnacek/pi-quick-win` → instalace `pi install git:github.com/mastnacek/pi-quick-win`

### 13.1 Postup (v tomto pořadí)

1. **Přečíst skill** — `.pi/skills/pi-plugin-dev/SKILL.md` (+ `references/tools-and-schema.md`,
   `references/event-and-api-surface.md`, `references/state-persistence.md`) **v tomtéž tahu,
   před prvním editem**. Bez výjimek.
2. **Ověřit, že to neexistuje** — potvrzeno §7.6 (registry `pi.dev/packages`: 5 399 balíčků,
   0 shod na jádro myšlenky). Zopakovat jen kdyby od zadání utekl měsíc.
3. **Scaffold** — `package.json` (`"type": "module"`, `peerDependencies` s core balíčky,
   `files`, `pi` manifest, `test` script), `index.ts`, `src/`, `test/`, `README.md`,
   `CHANGELOG.md`, `LICENSE`.
4. **Politika** — 2–3 řádky do `APPEND_SYSTEM.md` pluginu (kdy volat `quick_win`,
   co je nejmenší doručitelný inkrement, zákaz vymýšlet si přínos).
5. **Tool `quick_win`** — TypeBox schéma, `StringEnum` pro volbu (`deliver_now|later|skip`),
   `throw new Error(...)`, JSON-kompatibilní payload.
6. **Overlay** — `ctx.ui.custom()` s guardem `ctx.mode === "tui"`; karta s přínosem,
   náročností, kroky a důkazem; šířková bezpečnost; téma na každý řádek.
7. **Persistence** — `later` přežije `/reload` a kompakci; globální config v `~/.pi/agent/pi-quick-win.json`.
8. **Ztišení a non-TUI** — vypínač + tiché chování v `rpc`/`json`/`print`.
9. **Oslava** — jedna krátká ozvěna po doručení; kanál volitelně `pi-tui-sound` / `pi-tts`
   (vlastní, https://github.com/mastnacek/pi-tui-sound, https://github.com/mastnacek/pi-tts),
   jinak tiše.
10. **Testy** — `npm test` pokrývá §9 kritéria 2–3, 4, 5, 6.
11. **Commit + push** — atomicky, podle §3.8 workshopu; repo založit přes
    `gh repo create mastnacek/pi-quick-win --source . --push` (viditelnost potvrdit s uživatelem).
12. **Nabídnout instalaci** z GitHubu po prvním pushi (nikdy z lokální cesty).
13. **Ověřit tokenový rozpočet** — ≤ ~150 tokenů navíc (§6).

### 13.2 Definition of done

- [ ] `npm test` zelený, ≥ 4 testy (volba, reload, non-TUI, ztišení)
- [ ] Všechna akceptační kritéria §9 splněna a ověřena
- [ ] Plugin funguje v TUI (`ctx.mode === "tui"`) a je tichý v `rpc`/`json`/`print`
- [ ] Žádný soubor > 400 řádků; core balíčky jen v `peerDependencies`
- [ ] `README.md` (co to je, jak nainstalovat, jak ztišit) + `CHANGELOG.md`
- [ ] Commit + push do `mastnacek/pi-quick-win`; instalace z GitHubu ověřena
- [ ] SPAI-015 přepnut na `x` (done) až po ověření instalace

### 13.3 Stavební bloky a odkazy (ke znovupoužití)

| Co | Odkaz |
| --- | --- |
| Modal + typované volby | https://www.npmjs.com/package/@juicesharp/rpiv-ask-user-question · https://github.com/juicesharp/rpiv-mono |
| Odolná overlay karta (přežije `/reload` + kompakci) | https://www.npmjs.com/package/@juicesharp/rpiv-todo |
| Precedens vykreslení oslavy | https://www.npmjs.com/package/@hank-warren/pi-statusline · https://github.com/hank-warren/pi-extensions |
| Kanál zvuku/notifikací | https://www.npmjs.com/package/pi-notify · https://github.com/ferologics/pi-notify · https://www.npmjs.com/package/@bacnh85/pi-notify |
| Kanál „vykřikni, když je hotovo" | https://www.npmjs.com/package/i-am-cooking |
| Vlastní zvukový engine | https://github.com/mastnacek/pi-tui-sound |
| Vlastní TTS | https://github.com/mastnacek/pi-tts |
| Trvalá karta / plánování | https://www.npmjs.com/package/pi-goal-x · https://github.com/tmonk/pi-goal-x |
| Rubriky a definition-of-done pro `proof` | https://www.npmjs.com/package/pi-eval-harness |

### 13.4 Proč je to důležité (zadavatelský záměr)

Tohle není plugin pro pohodlí. Agentní programování dnes optimalizuje výkon
a zapomnělo na člověka, který u toho sedí: smyčka je dlouhá, hodnota se objeví
pozdě a práce se tím pádem **necítí jako práce, ale jako čekání**. `pi-quick-win`
vrací do smyčky to, co výzkum označuje za nejsilnější zdroj vnitřní motivace —
**malé vítězství včas** — a dělá to pravdivě: žádné skóre, jen skutečný nejmenší
doručitelný kus práce, pojmenovaný ve chvíli, kdy ho člověk potřebuje slyšet.
Může to být plugin, který rozhoduje o tom, jestli u agentního programování
vydržíme pracovat celé dny — proto není volitelný, ale zásadní.
