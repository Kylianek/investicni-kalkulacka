/*
 * Čisté výpočetní funkce - přepis vzorců z "INVESTIČNÍ KALKULAČKA 1.xlsx" plus
 * rozšířený víceletý simulační model (viz projectPortfolio níže).
 * Žádná z těchto funkcí nesahá na DOM ani na síť.
 */

/** Hodnota nemovitosti po ročním zhodnocení. Excel: F*rate+F */
function appreciatedValue(marketValue, growthRate) {
  return marketValue * (1 + (growthRate || 0));
}

/**
 * Kalendářní rozdíl mezi dvěma daty, ekvivalent Excel DATEDIF("y")/("ym")/("md") dohromady.
 * Předpokládá to >= from. Vrací { years, months, days }.
 */
function calendarDiff(from, to) {
  if (to < from) return { years: 0, months: 0, days: 0 };
  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(to.getFullYear(), to.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

/** Přidá k datu daný počet let (zachovává den/měsíc jako Excel DATE(YEAR(x)+n, MONTH(x), DAY(x))). */
function addYears(date, years) {
  return new Date(date.getFullYear() + years, date.getMonth(), date.getDate());
}

/**
 * ČASOVÝ TEST - zbývající čas do konce daňového časového testu.
 * Excel: "y let " & "ym měs. a " & "md dní", nebo "0 let 0 měs. 0 dní" pokud test už uplynul.
 */
function timeTestRemaining(acquisitionDate, exemptYears, today = new Date()) {
  const target = addYears(acquisitionDate, exemptYears);
  if (today >= target) {
    return { done: true, text: '0 let 0 měs. 0 dní', years: 0, months: 0, days: 0 };
  }
  const { years, months, days } = calendarDiff(today, target);
  return { done: false, text: `${years} let ${months} měs. a ${days} dní`, years, months, days };
}

/**
 * FIXACE - zbývající čas do konce fixace úrokové sazby.
 * Excel: "m měs. a " & "md dní" (m = celkový počet celých měsíců, ne omezeno na 0-11).
 */
function fixationRemaining(startDate, fixationYears, today = new Date()) {
  const target = addYears(startDate, fixationYears);
  if (today >= target) {
    return { done: true, text: '0 měs. 0 dní', totalMonths: 0, days: 0 };
  }
  const { years, months, days } = calendarDiff(today, target);
  const totalMonths = years * 12 + months;
  return { done: false, text: `${totalMonths} měs. a ${days} dní`, totalMonths, days };
}

/* =========================================================================
 * SCÉNÁŘE / PŘEHLED - jednotný víceletý simulační model.
 * rows[0] odpovídá dnešku (stejná čísla jako by dal originální jednoroční
 * Excel vzorec), rows[1..horizonYears] jsou skládaně dopočítané roky dopředu.
 * Přehled i Scénáře čerpají ze stejné funkce - Přehled si jen vybere jeden rok.
 * ========================================================================= */

/** Měsíční anuitní splátka z jistiny, měsíční sazby a počtu měsíců. */
function annuityPayment(principal, monthlyRate, months) {
  if (months <= 0 || principal <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  const f = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * f) / (f - 1);
}

function yearOf(dateStr, fallbackYear) {
  if (!dateStr) return fallbackYear;
  const d = new Date(dateStr);
  return isNaN(d) ? fallbackYear : d.getFullYear();
}

/**
 * Hodnota, kterou pro daný rok přepisuje scénářová událost daného typu (pokud
 * nějaká pro ten rok existuje). Události jsou vždy celoportfoliové - žádný cíl
 * se nevybírá. Pokud se překrývá víc událostí stejného typu, vyhrává poslední
 * v seznamu (uživatel ji může přidat "navrch" té starší).
 */
function resolvePortfolioOverride(events, type, year) {
  const matches = events.filter(
    (e) => e.type === type && year >= Number(e.year_from) && year <= Number(e.year_to || e.year_from)
  );
  if (!matches.length) return undefined;
  return Number(matches[matches.length - 1].value);
}

function resolvePortfolioRate(events, type, year, fallbackFraction) {
  const v = resolvePortfolioOverride(events, type, year);
  return v === undefined ? fallbackFraction : v / 100;
}

/** Efektivní roční úroková sazba úvěru pro daný rok (desetinný zlomek). */
function loanRateForYear(loan, loanStartYear, year) {
  const fixEnd = loanStartYear + (Number(loan.fixation_years) || 0);
  const ratePct =
    year < fixEnd
      ? Number(loan.interest_rate) * 100
      : Number(loan.rate_after_fixation ?? Number(loan.interest_rate) * 100);
  return ratePct / 100;
}

/**
 * Hlavní simulace portfolia na `horizonYears` let dopředu.
 * properties/loans/settings: stejná data jako jinde v appce.
 * events: pole { type: 'growth'|'rent_growth'|'vacancy'|'inflation'|'one_time', year_from, year_to, value, note }
 *
 * Model odděluje STAV (majetek/dluh k danému roku) a TOK (co se stane BĚHEM
 * přechodu do dalšího roku - zhodnocení, nájem, splátky, daň). rows[k].* jsou
 * stavové veličiny NA ZAČÁTKU roku k (rows[0] = přesně dnešek, beze změny) a
 * tokové veličiny (cashflow, zhodnocení, daň...) za rok, který z něj vychází.
 * Poslední řádek má jen stav (nemá už žádný další rok, ze kterého by tok počítal).
 * Daň z příjmu z pronájmu se tak počítá stejně pro "dnešek" i pro všechny
 * budoucí roky - na rozdíl od daně z prodeje se časového testu netýká.
 */
function projectPortfolio({ properties, loans, settings, events, horizonYears, startYear }) {
  startYear = startYear || new Date().getFullYear();
  events = events || [];
  horizonYears = Math.max(1, Number(horizonYears) || 1);
  const rentalTaxRate = (Number(settings.rental_tax_rate) || 0) / 100;
  const inflationBase = Number(settings.inflation_rate) || 0;

  const loanState = {};
  for (const l of loans) {
    loanState[l.id] = { remainingPrincipal: Number(l.amount) || 0, startYear: yearOf(l.start_date, startYear) };
  }

  const curValue = {};
  const curRent = {};
  const curCost = {};
  for (const p of properties) {
    curValue[p.id] = Number(p.market_value) || 0;
    curRent[p.id] = Number(p.rent) || 0;
    curCost[p.id] = (Number(p.monthly_costs) || 0) * 12;
  }

  let cashReserve = 0;
  let cumulativeCashflow = 0;
  const rows = [];

  for (let k = 0; k <= horizonYears; k++) {
    const stateYear = startYear + k;
    const activeProps = properties.filter((p) => yearOf(p.acquisition_date, startYear) <= stateYear);
    const realEstateValue = activeProps.reduce((s, p) => s + curValue[p.id], 0);
    const totalDebt = loans.reduce((s, l) => s + loanState[l.id].remainingPrincipal, 0);
    const totalValue = realEstateValue + cashReserve;
    const equity = totalValue - totalDebt;

    if (k === horizonYears) {
      rows.push({
        year: stateYear,
        realEstateValue,
        cashReserve,
        totalValue,
        totalDebt,
        equity,
        cashflow: null,
        cumulativeCashflow,
        appreciationGain: null,
        inflationLoss: null,
        realAppreciation: null,
        taxes: null,
        perProperty: activeProps.map((p) => ({ id: p.id, name: p.name, value: curValue[p.id] })),
      });
      break;
    }

    // --- TOK: co se stane během přechodu ze stateYear do stateYear+1 ---
    const targetYear = stateYear + 1;
    const inflation = resolvePortfolioRate(events, 'inflation', targetYear, inflationBase);

    let appreciationGain = 0;
    let totalRentNOI = 0;
    const perProperty = [];

    for (const p of activeProps) {
      const growth = resolvePortfolioRate(events, 'growth', targetYear, Number(p.growth_rate) || 0);
      const rentGrowthBase = p.rent_growth_rate != null ? Number(p.rent_growth_rate) : inflationBase;
      const rentGrowth = resolvePortfolioRate(events, 'rent_growth', targetYear, rentGrowthBase);
      const vacancy = resolvePortfolioRate(events, 'vacancy', targetYear, Number(p.vacancy_rate) || 0);

      const valueBefore = curValue[p.id];
      const rentThisYear = curRent[p.id];
      const costThisYear = curCost[p.id];

      curValue[p.id] = valueBefore * (1 + growth);
      curRent[p.id] = curRent[p.id] * (1 + rentGrowth);
      curCost[p.id] = curCost[p.id] * (1 + inflation);

      appreciationGain += curValue[p.id] - valueBefore;
      const propertyNOI = rentThisYear * 12 * (1 - vacancy) - costThisYear;
      totalRentNOI += propertyNOI;
      perProperty.push({ id: p.id, name: p.name, value: valueBefore, cashflow: propertyNOI });
    }

    // Úvěry se umořují agregovaně za portfolio (nezávisle na konkrétní nemovitosti).
    let totalInterest = 0;
    let totalPrincipal = 0;
    for (const l of loans) {
      const ls = loanState[l.id];
      if (ls.remainingPrincipal > 0 && stateYear >= ls.startYear) {
        const rate = loanRateForYear(l, ls.startYear, targetYear);
        const monthlyRate = rate / 12;
        const termBaseYear = Math.max(ls.startYear, startYear);
        const elapsedMonths = Math.max((stateYear - termBaseYear) * 12, 0);
        const totalMonths = (Number(l.term_years) || 30) * 12;
        const remainingMonths = Math.max(totalMonths - elapsedMonths, 0);

        if (l.amortizing === false) {
          totalInterest += ls.remainingPrincipal * rate;
        } else if (remainingMonths > 0) {
          const monthsThisYear = Math.min(12, remainingMonths);
          const payment = annuityPayment(ls.remainingPrincipal, monthlyRate, remainingMonths);
          let principal = ls.remainingPrincipal;
          for (let m = 0; m < monthsThisYear; m++) {
            const interestM = principal * monthlyRate;
            let principalM = payment - interestM;
            if (principalM > principal) principalM = principal;
            if (principalM < 0) principalM = 0;
            principal -= principalM;
            totalInterest += interestM;
            totalPrincipal += principalM;
          }
          ls.remainingPrincipal = Math.max(principal, 0);
        }
      }
    }

    // Daň z příjmu z pronájmu (§9 ZDP) - platí se KAŽDÝ rok, dokud se pronajímá,
    // bez ohledu na časový test (ten se týká jen daně z PRODEJE, viz recommendActions).
    const taxBase = totalRentNOI - totalInterest;
    const tax = Math.max(taxBase, 0) * rentalTaxRate;

    const oneTimeTotal = events
      .filter((e) => e.type === 'one_time' && targetYear >= Number(e.year_from) && targetYear <= Number(e.year_to || e.year_from))
      .reduce((s, e) => s + (Number(e.value) || 0), 0);
    cashReserve += oneTimeTotal;

    const cashflow = totalRentNOI - totalInterest - totalPrincipal - tax + oneTimeTotal;
    cumulativeCashflow += cashflow;

    const inflationLoss = realEstateValue * inflation;

    rows.push({
      year: stateYear,
      realEstateValue,
      cashReserve,
      totalValue,
      totalDebt,
      equity,
      cashflow,
      cumulativeCashflow,
      appreciationGain,
      inflationLoss,
      realAppreciation: appreciationGain - inflationLoss,
      taxes: tax,
      perProperty,
    });
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  const cagr =
    first.equity > 0 && last.equity > 0 ? Math.pow(last.equity / first.equity, 1 / horizonYears) - 1 : null;

  return {
    rows,
    summary: {
      startEquity: first.equity,
      endEquity: last.equity,
      totalCashflow: last.cumulativeCashflow,
      totalGain: last.equity - first.equity + last.cumulativeCashflow,
      cagr,
    },
  };
}

/**
 * Doporučení: kterou nemovitost má smysl zvážit k prodeji (vysoké zhodnocení,
 * ideálně po časovém testu, slabý provozní výnos) a který úvěr splatit
 * přednostně (nejvyšší úrok). Transparentní bodování, ne černá skříňka.
 *
 * estimatedSaleTax = odhad daně z příjmu z PRODEJE, KDYBY se nemovitost prodala
 * teď. Na rozdíl od daně z pronájmu (viz projectPortfolio) se tahle daň platí
 * jen jednou při prodeji a jen pokud ještě neuplynul časový test - po jeho
 * splnění je zisk z prodeje od daně osvobozen (§4 ZDP).
 */
function recommendActions(properties, loans, settings, today = new Date()) {
  const capGainsTaxRate = (Number(settings.capital_gains_tax_rate) || 0) / 100;

  let bestProperty = null;
  let bestScore = -Infinity;
  for (const p of properties) {
    const marketValue = Number(p.market_value) || 0;
    if (marketValue <= 0) continue;
    const gain = marketValue - (Number(p.acquisition_price) || 0);
    const gainPct = gain / marketValue;
    const tt = p.acquisition_date
      ? timeTestRemaining(new Date(p.acquisition_date), Number(p.tax_exempt_years) || 10, today)
      : { done: true };
    const rentAnnual = (Number(p.rent) || 0) * 12 * (1 - (Number(p.vacancy_rate) || 0));
    const costsAnnual = (Number(p.monthly_costs) || 0) * 12;
    const yieldPct = (rentAnnual - costsAnnual) / marketValue;
    const estimatedSaleTax = tt.done ? 0 : Math.max(gain, 0) * capGainsTaxRate;

    const score = gainPct * 2 + (tt.done ? 0.5 : -0.3) - yieldPct * 1.5;
    if (score > bestScore) {
      bestScore = score;
      bestProperty = { property: p, gain, gainPct, taxExempt: tt.done, timeTestText: tt.text, yieldPct, estimatedSaleTax };
    }
  }

  let worstLoan = null;
  for (const l of loans) {
    const rate = Number(l.interest_rate) || 0;
    if (!worstLoan || rate > worstLoan.rate) worstLoan = { loan: l, rate };
  }

  if (!bestProperty && !worstLoan) return null;
  return { bestProperty, worstLoan };
}

// Export pro použití v ostatních skriptech (bez modulů, aby to fungovalo i přes file://).
window.calc = {
  appreciatedValue,
  calendarDiff,
  addYears,
  timeTestRemaining,
  fixationRemaining,
  annuityPayment,
  resolvePortfolioOverride,
  resolvePortfolioRate,
  loanRateForYear,
  projectPortfolio,
  recommendActions,
};