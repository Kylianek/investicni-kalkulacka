/*
 * Čisté výpočetní funkce - přepis vzorců z "INVESTIČNÍ KALKULAČKA 1.xlsx".
 * Žádná z těchto funkcí nesahá na DOM ani na síť, takže odpovídají 1:1 excelovským vzorcům.
 */

/** Hodnota nemovitosti po ročním zhodnocení. Excel: F*rate+F */
function appreciatedValue(marketValue, growthRate) {
  return marketValue * (1 + (growthRate || 0));
}

/** Součty za celé portfolio nemovitostí (list objektů properties). */
function portfolioTotals(properties) {
  const totals = {
    marketValue: 0,
    acquisitionPrice: 0,
    rent: 0,
    payment: 0,
    appreciatedValue: 0,
  };
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
 * Kompletní přehled (list PŘEHLED).
 * properties: pole nemovitostí, loans: pole úvěrů, inflationRate: desetinné číslo (0.03 = 3 %)
 */
function overview(properties, loans, inflationRate) {
  const pt = portfolioTotals(properties);
  const totalDebt = loans.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const assets = pt.marketValue; // majetek
  const debt = totalDebt; // dluh
  const netWorth = assets - debt; // vlastní majetek
  const debtRatio = assets > 0 ? debt / assets : 0; // poměr zadlužení
  const cashflow = pt.rent - pt.payment; // cashflow

  const annualAppreciationGain = pt.appreciatedValue - pt.marketValue; // ROČNÍ ZHODNOCENÍ (Kč)
  const inflationLoss = assets * (inflationRate || 0); // inflace (Kč)
  const realAppreciation = annualAppreciationGain - inflationLoss; // zbývá po inflaci
  const projectedPortfolioValue = pt.appreciatedValue; // majetek po zhodnocení

  return {
    assets,
    debt,
    netWorth,
    debtRatio,
    cashflow,
    totalRent: pt.rent,
    totalPayment: pt.payment,
    totalAcquisitionPrice: pt.acquisitionPrice,
    annualAppreciationGain,
    inflationLoss,
    realAppreciation,
    projectedPortfolioValue,
  };
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
 * SCÉNÁŘE / PREDIKCE - simulace vývoje portfolia na X let dopředu.
 * Na rozdíl od funkcí výše (které odpovídají 1:1 jednoroční Excel logice)
 * tady hodnota nemovitosti a nájem SKLÁDANĚ rostou rok po roce a úvěr se
 * reálně umořuje (anuitní splátka se rozpadá na úrok a jistinu).
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
 * Najde hodnotu, kterou pro daný rok a cíl (nemovitost/úvěr/celé portfolio)
 * přepisuje nějaká "událost" ze scénáře. Nemovitost/úvěr specifická událost
 * má přednost před událostí pro "celé portfolio". Pokud se pro stejný cíl
 * překrývá víc událostí, vyhrává poslední v seznamu (uživatel ji může
 * přidat "navrch" té starší).
 */
function resolveOverride(events, type, year, target) {
  const matches = (e) =>
    e.type === type && year >= Number(e.year_from) && year <= Number(e.year_to || e.year_from);

  const specific = events.filter(
    (e) => matches(e) && e.target_type === target.type && e.target_id === target.id
  );
  if (specific.length) return Number(specific[specific.length - 1].value);

  const global = events.filter((e) => matches(e) && e.target_type === 'portfolio');
  if (global.length) return Number(global[global.length - 1].value);

  return undefined;
}

/** Jako resolveOverride, ale vrací desetinný zlomek (10 % -> 0.1) s výchozí hodnotou. */
function resolveRate(events, type, year, target, fallbackFraction) {
  const v = resolveOverride(events, type, year, target);
  return v === undefined ? fallbackFraction : v / 100;
}

/**
 * Hlavní simulace portfolia na `horizonYears` let dopředu.
 * properties/loans/settings: stejná data jako v ostatních funkcích
 * events: pole scénářových událostí { type, target_type, target_id, year_from, year_to, value, note }
 * Vrací { rows, summary }. rows[0] je "dnešek" (rok startYear), dál rows[1..horizonYears].
 */
function projectPortfolio({ properties, loans, settings, events, horizonYears, startYear }) {
  startYear = startYear || new Date().getFullYear();
  events = events || [];
  horizonYears = Math.max(1, Number(horizonYears) || 1);

  const loanState = {};
  for (const l of loans) {
    loanState[l.id] = {
      remainingPrincipal: Number(l.amount) || 0,
      startYear: yearOf(l.start_date, startYear),
    };
  }

  const curValue = {};
  const curRent = {};
  const curCost = {};
  for (const p of properties) {
    curValue[p.id] = Number(p.market_value) || 0;
    curRent[p.id] = Number(p.rent) || 0;
    curCost[p.id] = (Number(p.monthly_costs) || 0) * 12;
  }

  const rentalTaxRate = (Number(settings.rental_tax_rate) || 0) / 100;
  const capGainsTaxRate = (Number(settings.capital_gains_tax_rate) || 0) / 100;

  let cashReserve = 0;
  let cumulativeCashflow = 0;
  const rows = [];

  // Rok 0 = dnešní stav (nemovitosti, které už jsou pořízené).
  const ownedToday = properties.filter((p) => yearOf(p.acquisition_date, startYear) <= startYear);
  const row0Value = ownedToday.reduce((s, p) => s + (Number(p.market_value) || 0), 0);
  const row0Debt = loans.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  rows.push({
    year: startYear,
    totalValue: row0Value,
    totalDebt: row0Debt,
    equity: row0Value - row0Debt,
    cashflow: 0,
    cumulativeCashflow: 0,
    cashReserve: 0,
    taxes: 0,
    perProperty: ownedToday.map((p) => ({
      id: p.id,
      name: p.name,
      value: Number(p.market_value) || 0,
      debt: 0,
      cashflow: 0,
      sold: false,
    })),
  });

  for (let y = 1; y <= horizonYears; y++) {
    const year = startYear + y;
    const inflation = resolveRate(events, 'inflation', year, { type: 'portfolio' }, Number(settings.inflation_rate) || 0);

    let yearValue = 0;
    let yearDebt = 0;
    let yearCashflow = 0;
    let yearTaxes = 0;
    const perProperty = [];

    for (const p of properties) {
      const acqYear = yearOf(p.acquisition_date, startYear);
      if (acqYear > year) continue; // nemovitost ještě není pořízená
      if (p.planned_sale_year && year > Number(p.planned_sale_year)) continue; // už prodáno dřív

      const target = { type: 'property', id: p.id };
      const growth = resolveRate(events, 'growth', year, target, Number(p.growth_rate) || 0);
      const rentGrowth = resolveRate(events, 'rent_growth', year, target, Number(p.rent_growth_rate) || 0);
      const vacancy = resolveRate(events, 'vacancy', year, target, Number(p.vacancy_rate) || 0);

      if (acqYear < year) {
        // hodnota/nájem/náklady rostou jen v letech, kdy nemovitost už vlastníme
        curValue[p.id] *= 1 + growth;
        curRent[p.id] *= 1 + rentGrowth;
        curCost[p.id] *= 1 + inflation;
      }

      let interestPaid = 0;
      let principalPaid = 0;
      let debtBalance = 0;
      const loan = loans.find((l) => l.id === p.linked_loan_id);
      if (loan) {
        const ls = loanState[loan.id];
        if (ls.remainingPrincipal > 0 && year >= ls.startYear) {
          const fixEnd = ls.startYear + (Number(loan.fixation_years) || 0);
          const baseRatePct =
            year < fixEnd ? Number(loan.interest_rate) * 100 : Number(loan.rate_after_fixation ?? loan.interest_rate * 100);
          const ratePct = resolveOverride(events, 'interest_rate', year, { type: 'loan', id: loan.id });
          const rate = (ratePct === undefined ? baseRatePct : ratePct) / 100;
          const monthlyRate = rate / 12;
          // "term_years" = zbývající doba splatnosti OD DNEŠKA (startYear) pro už běžící
          // úvěry (amount = dnešní zůstatek jistiny). Pro úvěr začínající až v budoucnu
          // (start_date > dnešek) se počítá od jeho vlastního startu (amount = jistina
          // při sjednání).
          const termBaseYear = Math.max(ls.startYear, startYear);
          const elapsedMonths = Math.max((year - termBaseYear) * 12, 0);
          const totalMonths = (Number(loan.term_years) || 30) * 12;
          const remainingMonths = Math.max(totalMonths - elapsedMonths, 0);

          if (loan.amortizing === false) {
            interestPaid = ls.remainingPrincipal * rate;
          } else if (remainingMonths > 0) {
            const monthsThisYear = Math.min(12, remainingMonths);
            const payment = annuityPayment(ls.remainingPrincipal, monthlyRate, remainingMonths);
            let principal = ls.remainingPrincipal;
            let intSum = 0;
            let prinSum = 0;
            for (let m = 0; m < monthsThisYear; m++) {
              const interestM = principal * monthlyRate;
              let principalM = payment - interestM;
              if (principalM > principal) principalM = principal;
              if (principalM < 0) principalM = 0;
              principal -= principalM;
              intSum += interestM;
              prinSum += principalM;
            }
            interestPaid = intSum;
            principalPaid = prinSum;
            ls.remainingPrincipal = Math.max(principal, 0);
          }
        }
        debtBalance = ls.remainingPrincipal;
      }

      const grossRentAnnual = curRent[p.id] * 12 * (1 - vacancy);
      const costsAnnual = curCost[p.id];
      const taxBase = grossRentAnnual - costsAnnual - interestPaid;
      const tax = Math.max(taxBase, 0) * rentalTaxRate;
      const propertyCashflow = grossRentAnnual - costsAnnual - interestPaid - principalPaid - tax;
      yearTaxes += tax;

      const isSoldThisYear = p.planned_sale_year && Number(p.planned_sale_year) === year;
      if (isSoldThisYear) {
        const salePrice = p.planned_sale_price ? Number(p.planned_sale_price) : curValue[p.id];
        const acqDate = p.acquisition_date ? new Date(p.acquisition_date) : null;
        const exemptYears = Number(p.tax_exempt_years) || 10;
        const isExempt = acqDate ? year >= acqDate.getFullYear() + exemptYears : false;
        const gain = salePrice - (Number(p.acquisition_price) || 0);
        const capGainsTax = isExempt ? 0 : Math.max(gain, 0) * capGainsTaxRate;
        const netProceeds = salePrice - debtBalance - capGainsTax;
        cashReserve += netProceeds;
        if (loan) loanState[loan.id].remainingPrincipal = 0;
        yearTaxes += capGainsTax;
        yearCashflow += propertyCashflow;
        perProperty.push({ id: p.id, name: p.name, value: 0, debt: 0, cashflow: propertyCashflow, sold: true, saleProceeds: netProceeds });
      } else {
        yearValue += curValue[p.id];
        yearDebt += debtBalance;
        yearCashflow += propertyCashflow;
        perProperty.push({ id: p.id, name: p.name, value: curValue[p.id], debt: debtBalance, cashflow: propertyCashflow, sold: false });
      }
    }

    // Jednorázové příjmy/výdaje (rekonstrukce, mimořádný příjem apod.) v tomto roce.
    const oneTimeTotal = events
      .filter((e) => e.type === 'one_time' && year >= Number(e.year_from) && year <= Number(e.year_to || e.year_from))
      .reduce((s, e) => s + (Number(e.value) || 0), 0);
    cashReserve += oneTimeTotal;
    yearCashflow += oneTimeTotal;

    yearValue += cashReserve;
    cumulativeCashflow += yearCashflow;

    rows.push({
      year,
      totalValue: yearValue,
      totalDebt: yearDebt,
      equity: yearValue - yearDebt,
      cashflow: yearCashflow,
      cumulativeCashflow,
      cashReserve,
      taxes: yearTaxes,
      perProperty,
    });
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  const cagr =
    first.equity > 0 && last.equity > 0
      ? Math.pow(last.equity / first.equity, 1 / horizonYears) - 1
      : null;

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

// Export pro použití v ostatních skriptech (bez modulů, aby to fungovalo i přes file://).
window.calc = {
  appreciatedValue,
  portfolioTotals,
  overview,
  calendarDiff,
  addYears,
  timeTestRemaining,
  fixationRemaining,
  annuityPayment,
  resolveOverride,
  resolveRate,
  projectPortfolio,
};
