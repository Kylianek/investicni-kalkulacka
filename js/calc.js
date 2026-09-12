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

// Export pro použití v ostatních skriptech (bez modulů, aby to fungovalo i přes file://).
window.calc = {
  appreciatedValue,
  portfolioTotals,
  overview,
  calendarDiff,
  addYears,
  timeTestRemaining,
  fixationRemaining,
};
