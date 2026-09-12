# Investiční kalkulačka nemovitostí

Webová verze osobní kalkulačky z `INVESTIČNÍ KALKULAČKA 1.xlsx` — přehled nemovitostí,
úvěrů (fixací), časového testu / zástav a zhodnocení portfolia. Přístup jen po přihlášení,
každý uživatel vidí pouze svoje vlastní údaje.

Je to čistě statická stránka (HTML/CSS/JS, žádný build krok), takže jde hostovat zdarma
na GitHub Pages. Přihlášení, databázi a zabezpečení dat řeší [Supabase](https://supabase.com)
(zdarma).

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

Všechny vzorce jsou v [js/calc.js](js/calc.js) jako čisté funkce.

## Nastavení (nutné před prvním použitím)

1. Založ si zdarma účet na [supabase.com](https://supabase.com) a klikni na **New project**.
2. V projektu otevři **SQL Editor** → **New query**, vlož obsah souboru
   [sql/schema.sql](sql/schema.sql) a spusť ho (vytvoří tabulky + zabezpečení).
3. V **Settings → API** zkopíruj `Project URL` a `anon public` klíč.
4. Otevři [js/config.js](js/config.js) a vlož obě hodnoty. Tento klíč je veřejný
   ("anon") a je v pořádku ho mít i ve veřejném repozitáři — skutečná ochrana dat je
   zajištěná přes Row Level Security z kroku 2 (každý uživatel vidí jen svoje řádky).
5. (Volitelné) V **Authentication → Emails** si můžeš upravit e-mailové šablony
   (potvrzení registrace) do češtiny.
6. Commitni a pushni změnu v `js/config.js` — GitHub Pages se automaticky nasadí znovu.

## Lokální vyzkoušení

Stačí otevřít `index.html` přímo v prohlížeči (dvojklikem), nebo spustit jednoduchý
lokální server, např. `npx serve .`

## Nasazení (GitHub Pages)

Repozitář je připravený na GitHub Pages ze složky `/ (root)` větve `main` — stránka
běží na `https://<tvůj-github-účet>.github.io/investicni-kalkulacka/`.

## Bezpečnost dat

- Registrace/přihlášení probíhá přes Supabase Auth (e-mail + heslo).
- Všechny tabulky (`properties`, `loans`, `settings`) mají zapnuté Row Level Security —
  databáze na úrovni SQL politik zaručuje, že uživatel může číst a měnit jen řádky,
  kde `user_id` odpovídá jeho vlastnímu přihlášenému účtu.
- Bez přihlášení nejsou žádná data vidět — aplikace zobrazí jen přihlašovací obrazovku.
