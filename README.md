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
