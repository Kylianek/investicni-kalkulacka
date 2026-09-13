/*
 * Čisté výpočetní funkce - přepis vzorců z "INVESTIČNÍ KALKULAČKA 1.xlsx" plus
 * rozšířený víceletý simulační model (viz projectPortfolio níže).
 * Žádná z těchto funkcí nesahá na DOM ani na síť.
 */

/** Hodnota nemovitosti po ročním zhodnocení. Excel: F*rate+F */
function appreciatedValue(marketValue, growthRate) {
  return marketValue * (1 + (growthRate || 0));
}

/** Součty za celé portfolio nemovitostí (list objektů properties). */
function portfolioTotals(properties) {
  const totals = { marketValue: 0, acquisitionPrice: 0, rent: 0, payment: 0, appreciatedValue: 0 };
  for (const p of properties) {
    totals.marketValue += Number(p.market_value) || 0;
    totals.acquisitionPrice += Number(p.acquisition_price) || 0;
    totals.rent += Number(p.rent) || 0;
    totals.payment += Number(p.payment) || 0;
    totals.appreciatedValue += appreciatedValue(Number(p.market_value) || 0, Number(p.growth_rate) || 0);
  }
  return totals;
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
 * Vrací { rows, summary }.
 */
function projectPortfolio({ properties, loans, settings, events, horizonYears, startYear }) {
  startYear = startYear || new Date().getFullYear();
  events = events || [];
  horizonYears = Math.max(1, Number(horizonYears) || 1);
  const rentalTaxRate = (Number(settings.rental_tax_rate) || 0) / 100;
  const capGainsTaxRate = (Number(settings.capital_gains_tax_rate) || 0) / 100;

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

  // Rok 0 = dnešek, spočítaný stejným jednoročním vzorcem jako originální Excel.
  const ownedToday = properties.filter((p) => yearOf(p.acquisition_date, startYear) <= startYear);
  const pt0 = portfolioTotals(ownedToday);
  const debt0 = loans.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const appreciation0 = pt0.appreciatedValue - pt0.marketValue;
  const inflation0 = resolvePortfolioRate(events, 'inflation', startYear, Number(settings.inflation_rate) || 0);
  const inflationLoss0 = pt0.marketValue * inflation0;
  rows.push({
    year: startYear,
    realEstateValue: pt0.marketValue,
    cashReserve: 0,
    totalValue: pt0.marketValue,
    totalDebt: debt0,
    equity: pt0.marketValue - debt0,
    cashflow: (pt0.rent - pt0.payment) * 12,
    cumulativeCashflow: 0,
    appreciationGain: appreciation0,
    inflationLoss: inflationLoss0,
    realAppreciation: appreciation0 - inflationLoss0,
    taxes: 0,
    perProperty: ownedToday.map((p) => ({
      id: p.id,
      name: p.name,
      value: Number(p.market_value) || 0,
      cashflow: (Number(p.rent) - Number(p.payment)) * 12,
      sold: false,
    })),
  });

  for (let y = 1; y <= horizonYears; y++) {
    const year = startYear + y;
    const inflation = resolvePortfolioRate(events, 'inflation', year, Number(settings.inflation_rate) || 0);

    let realEstateValue = 0;
    let appreciationGain = 0;
    let totalRentNOI = 0;
    let saleTax = 0;
    const perProperty = [];

    for (const p of properties) {
      const acqYear = yearOf(p.acquisition_date, startYear);
      if (acqYear > year) continue; // ještě není pořízeno
      if (p.planned_sale_year && year > Number(p.planned_sale_year)) continue; // už prodáno dřív

      const growth = resolvePortfolioRate(events, 'growth', year, Number(p.growth_rate) || 0);
      const rentGrowth = resolvePortfolioRate(events, 'rent_growth', year, Number(p.rent_growth_rate) || 0);
      const vacancy = resolvePortfolioRate(events, 'vacancy', year, Number(p.vacancy_rate) || 0);

      if (acqYear < year) {
        const before = curValue[p.id];
        curValue[p.id] *= 1 + growth;
        appreciationGain += curValue[p.id] - before;
        curRent[p.id] *= 1 + rentGrowth;
        curCost[p.id] *= 1 + inflation;
      }

      const rentAnnual = curRent[p.id] * 12 * (1 - vacancy);
      const costsAnnual = curCost[p.id];
      const propertyNOI = rentAnnual - costsAnnual;

      const isSoldThisYear = p.planned_sale_year && Number(p.planned_sale_year) === year;
      if (isSoldThisYear) {
        const salePrice = p.planned_sale_price ? Number(p.planned_sale_price) : curValue[p.id];
        const acqDate = p.acquisition_date ? new Date(p.acquisition_date) : null;
        const exemptYears = Number(p.tax_exempt_years) || 10;
        const isExempt = acqDate ? year >= acqDate.getFullYear() + exemptYears : false;
        const gain = salePrice - (Number(p.acquisition_price) || 0);
        const capGainsTax = isExempt ? 0 : Math.max(gain, 0) * capGainsTaxRate;
        const netProceeds = salePrice - capGainsTax;
        saleTax += capGainsTax;

        // Peníze z prodeje nejdřív splatí "cizí kapitál" navázaný na tuhle
        // nemovitost - přednostně u úvěru s nejvyšší aktuální sazbou (nejdřív
        // se zbavit toho nejnevýhodnějšího dluhu).
        const payoffBudget = Math.min(Number(p.debt_invested) || 0, netProceeds);
        let remainingBudget = payoffBudget;
        const loansByRateDesc = [...loans].sort(
          (a, b) => loanRateForYear(b, loanState[b.id].startYear, year) - loanRateForYear(a, loanState[a.id].startYear, year)
        );
        for (const l of loansByRateDesc) {
          if (remainingBudget <= 0) break;
          const ls = loanState[l.id];
          const pay = Math.min(ls.remainingPrincipal, remainingBudget);
          ls.remainingPrincipal -= pay;
          remainingBudget -= pay;
        }
        const actuallyPaidDown = payoffBudget - remainingBudget;
        cashReserve += netProceeds - actuallyPaidDown;

        perProperty.push({ id: p.id, name: p.name, value: 0, cashflow: propertyNOI, sold: true, saleProceeds: netProceeds, debtPaidOff: actuallyPaidDown });
      } else {
        realEstateValue += curValue[p.id];
        totalRentNOI += propertyNOI;
        perProperty.push({ id: p.id, name: p.name, value: curValue[p.id], cashflow: propertyNOI, sold: false });
      }
    }

    // Úvěry se umořují nezávisle na konkrétní nemovitosti (agregovaně za portfolio).
    let totalDebt = 0;
    let totalInterest = 0;
    let totalPrincipal = 0;
    for (const l of loans) {
      const ls = loanState[l.id];
      if (ls.remainingPrincipal > 0 && year >= ls.startYear) {
        const rate = loanRateForYear(l, ls.startYear, year);
        const monthlyRate = rate / 12;
        const termBaseYear = Math.max(ls.startYear, startYear);
        const elapsedMonths = Math.max((year - termBaseYear) * 12, 0);
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
      totalDebt += ls.remainingPrincipal;
    }

    const taxBase = totalRentNOI - totalInterest;
    const rentalTax = Math.max(taxBase, 0) * rentalTaxRate;
    const taxes = rentalTax + saleTax;

    const oneTimeTotal = events
      .filter((e) => e.type === 'one_time' && year >= Number(e.year_from) && year <= Number(e.year_to || e.year_from))
      .reduce((s, e) => s + (Number(e.value) || 0), 0);
    cashReserve += oneTimeTotal;

    const cashflow = totalRentNOI - totalInterest - totalPrincipal - rentalTax + oneTimeTotal;
    cumulativeCashflow += cashflow;

    const totalValue = realEstateValue + cashReserve;
    const inflationLoss = realEstateValue * inflation;

    rows.push({
      year,
      realEstateValue,
      cashReserve,
      totalValue,
      totalDebt,
      equity: totalValue - totalDebt,
      cashflow,
      cumulativeCashflow,
      appreciationGain,
      inflationLoss,
      realAppreciation: appreciationGain - inflationLoss,
      taxes,
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
 */
function recommendActions(properties, loans, today = new Date()) {
  let bestProperty = null;
  let bestScore = -Infinity;
  for (const p of properties) {
    const marketValue = Number(p.market_value) || 0;
    if (marketValue <= 0 || p.planned_sale_year) continue;
    const gain = marketValue - (Number(p.acquisition_price) || 0);
    const gainPct = gain / marketValue;
    const tt = p.acquisition_date
      ? timeTestRemaining(new Date(p.acquisition_date), Number(p.tax_exempt_years) || 10, today)
      : { done: true };
    const rentAnnual = (Number(p.rent) || 0) * 12 * (1 - (Number(p.vacancy_rate) || 0));
    const costsAnnual = (Number(p.monthly_costs) || 0) * 12;
    const yieldPct = (rentAnnual - costsAnnual) / marketValue;

    const score = gainPct * 2 + (tt.done ? 0.5 : -0.3) - yieldPct * 1.5;
    if (score > bestScore) {
      bestScore = score;
      bestProperty = { property: p, gain, gainPct, taxExempt: tt.done, timeTestText: tt.text, yieldPct };
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
  portfolioTotals,
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