# Investiční kalkulačka nemovitostí

Webová verze osobní kalkulačky z `INVESTIČNÍ KALKULAČKA 1.xlsx` — přehled nemovitostí,
úvěrů (fixací), časového testu / zástav a zhodnocení portfolia.

Žádné přihlašování, žádný účet, žádný server. Aplikace je čistě statická stránka
(HTML/CSS/JS, žádný build krok) a všechna data se ukládají výhradně v `localStorage`
tvého prohlížeče — nikam se neposílají, takže nejsou nikde veřejně vidět. Nevýhoda
tohoto přístupu: data jsou dostupná jen v tom jednom prohlížeči/zařízení, kde je
zadáš, a zmizí, pokud v něm vymažeš data stránek. Proto je v záložce **Nastavení**
tlačítko na stažení/nahrání zálohy (JSON soubor).

## Jak vzorce odpovídají originálnímu Excelu

| Excel list | List/Buňka | Web |
|---|---|---|
| NEMOVITOSTI | řádek nemovitosti (nájem, splátka, tržní hodnota, pořizovací cena) | záložka **Nemovitosti** |
| NEMOVITOSTI!H = F*růst+F | hodnota po zhodnocení | sloupec "Po zhodnocení" |
| FIXACE | banka, částka, úrok, doba fixace, od | záložka **Úvěry / fixace** |
| FIXACE!G (DATEDIF měsíce+dny) | zbývá do konce fixace | sloupec "Zbývá fixace" |
| ČASOVÝ TEST A ZÁSTAVA | datum pořízení, časový test 5/10 let, zástava | součást formuláře nemovitosti (pole "Datum pořízení", "Časový test", "Zástava") |
| ČASOVÝ TEST!E (DATEDIF roky/měsíce/dny) | zbývá do konce časového testu | sloupec "Časový test - zbývá" |
| PŘEHLED!D5 majetek | `SUM(tržní hodnoty)` | KPI "Majetek" |
| PŘEHLED!D6 dluh | `SUM(úvěry)` | KPI "Dluh" |
| PŘEHLED!D7 vlastní majetek | majetek − dluh | KPI "Vlastní majetek" |
| PŘEHLED!D8 poměr zadlužení | dluh / majetek | KPI "Poměr zadlužení" |
| PŘEHLED!D9 cashflow | `SUM(nájem) − SUM(splátky)` | KPI "Cashflow" |
| PŘEHLED!D11 roční zhodnocení | `SUM(po zhodnocení) − majetek` | KPI "Roční zhodnocení" |
| PŘEHLED!D12 inflace | majetek × míra inflace | KPI "Ztráta inflací" |
| PŘEHLED!D13 zbývá po inflaci | zhodnocení − ztráta inflací | KPI "Zbývá po inflaci" |
| PŘEHLED!D15 majetek po zhodnocení | `SUM(po zhodnocení)` | KPI "Majetek po zhodnocení" |
| údaje!C7:C14 (růst % podle pozice v tabulce) | — | ve webu má **každá nemovitost svoje vlastní pole "Roční růst hodnoty %"**, aby to nezáviselo na pořadí řádků jako v Excelu |

Všechny vzorce jsou v [js/calc.js](js/calc.js) jako čisté funkce (ověřené na skutečných
číslech z originálního souboru — souhlasí do koruny).

## Záložka Scénáře (predikce na X let dopředu)

Nad rámec originálního Excelu přidává aplikace záložku **Scénáře**, která simuluje vývoj
portfolia rok po roce, ne jen jeden rok dopředu:

- Hodnota nemovitosti a nájem rostou **skládaně** (rok po roce), ne jen jednorázově.
- Úvěr se **reálně umořuje** — anuitní splátka se každý rok rozpadá na úrok a jistinu
  podle zbývající jistiny, sazby a doby splatnosti (nastavuje se v pokročilé sekci
  formuláře úvěru). Po konci fixace se použije zadaná "sazba po fixaci".
- Každá nemovitost může mít **neobsazenost (%)**, **provozní náklady (Kč/měs)** a
  vlastní **růst nájmu** — to všechno snižuje reálný cashflow, ne jen nominální nájem.
- Nemovitost lze **navázat na konkrétní úvěr** (pole "Navázaný úvěr"), aby šlo počítat
  vlastní kapitál (equity) skutečně za tu nemovitost, ne jen za celé portfolio.
- Nemovitost může mít nastavený **plánovaný rok prodeje** — simulace pak k tomu roku
  spočítá čistý výnos z prodeje (cena − zbývající dluh − daň z prodeje, pokud ještě
  neuplynul časový test) a přesune ho do hotovostní rezervy portfolia.
- **Scénářové události** umožňují dočasně přepsat libovolnou sazbu na určité období,
  pro konkrétní nemovitost/úvěr nebo pro celé portfolio, např.:
  - *"roky 2031-2036: úrok úvěru X klesne na 3 %"* (typ "Úroková sazba úvěru")
  - *"rok 2029: neobsazenost 50 %"* (výpadek nájemníka na půl roku) (typ "Neobsazenost")
  - *"roky 2027-2029: nižší růst hodnoty (recese)"* (typ "Růst hodnoty nemovitosti", cíl "Celé portfolio")
  - *"rok 2030: jednorázový výdaj -500 000 Kč"* (rekonstrukce) (typ "Jednorázový příjem/výdaj")

  Když se pro stejný rok překrývá událost pro konkrétní nemovitost/úvěr a událost pro
  celé portfolio, vyhrává ta konkrétnější.
- Výstup: graf a tabulka vývoje majetku/dluhu/vlastního kapitálu po letech, plus
  souhrnné KPI (vlastní kapitál za N let, kumulovaný cashflow, průměrný roční růst).

V **Nastavení** lze nastavit i orientační daň z příjmu z pronájmu a daň z prodeje
nemovitosti (uplatní se jen při prodeji před koncem časového testu) — jde o zjednodušení
pro účely predikce, ne o daňové poradenství.

## Lokální vyzkoušení

Stačí otevřít `index.html` přímo v prohlížeči (dvojklikem), nebo spustit jednoduchý
lokální server, např. `npx serve .`

## Nasazení (GitHub Pages)

Repozitář je nasazený na GitHub Pages ze složky `/ (root)` větve `main`:
**https://kylianek.github.io/investicni-kalkulacka/**

## Soukromí dat

- Žádné přihlašování ani účet — aplikace se otevře rovnou.
- Veškerá data (nemovitosti, úvěry, nastavení) se ukládají pouze lokálně v
  `localStorage` tvého prohlížeče. Nic se neodesílá na žádný server, takže nejsou
  nikde veřejně dostupná, ani ve zdrojovém kódu na GitHubu.
- Zálohuj si data přes tlačítko "Stáhnout zálohu (JSON)" v Nastavení — zvlášť před
  smazáním dat prohlížeče nebo při přechodu na jiné zařízení/prohlížeč (tam pak
  zálohu nahraješ přes "Nahrát zálohu").
