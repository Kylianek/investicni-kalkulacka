/* Hlavní logika aplikace: data se ukládají jen lokálně v prohlížeči (localStorage),
   žádný účet ani server. Výpočty jsou v js/calc.js. */

const STORAGE_KEY = 'investicni-kalkulacka-v1';

const state = {
  properties: [],
  loans: [],
  events: [],
  settings: { inflation_rate: 0.03, rental_tax_rate: 15, capital_gains_tax_rate: 15 },
  scenario: { horizonYears: 20 },
};

const fmtMoney = (n) =>
  (Number(n) || 0).toLocaleString('cs-CZ', { maximumFractionDigits: 0 }) + ' Kč';
const fmtPercent = (n) => ((Number(n) || 0) * 100).toLocaleString('cs-CZ', { maximumFractionDigits: 2 }) + ' %';

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
}

/* ---------- Perzistence (localStorage) ---------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.properties)) state.properties = parsed.properties;
    if (Array.isArray(parsed.loans)) state.loans = parsed.loans;
    if (Array.isArray(parsed.events)) state.events = parsed.events;
    if (parsed.settings) Object.assign(state.settings, parsed.settings);
    if (parsed.scenario) Object.assign(state.scenario, parsed.scenario);
  } catch (e) {
    console.error('Nepodařilo se načíst uložená data:', e);
  }
}

function saveState() {
  const payload = {
    properties: state.properties,
    loans: state.loans,
    events: state.events,
    settings: state.settings,
    scenario: state.scenario,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/* ---------- Inicializace ---------- */

function init() {
  loadState();
  wireTabs();
  wireForms();
  wireBackup();
  document.getElementById('event-type').addEventListener('change', updateEventTargetOptions);
  document.getElementById('scenario-horizon').addEventListener('input', (e) => {
    state.scenario.horizonYears = Math.max(1, Number(e.target.value) || 1);
    saveState();
    renderScenario();
  });
  renderAll();
}

function renderAll() {
  renderProperties();
  renderLoans();
  renderSettings();
  renderDashboard();
  renderEvents();
  renderScenario();
}

/* ---------- Tabs ---------- */

function wireTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('tab-active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
      btn.classList.add('tab-active');
      document.getElementById(btn.dataset.tab).classList.remove('hidden');
    });
  });
}

/* ---------- NEMOVITOSTI ---------- */

function populateLoanOptions() {
  document.querySelectorAll('.property-loan-select').forEach((sel) => {
    const current = sel.value;
    sel.innerHTML = '<option value="">Bez úvěru / vlastní kapitál</option>';
    for (const l of state.loans) {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = `${l.bank} (${fmtMoney(l.amount)})`;
      sel.appendChild(opt);
    }
    sel.value = current;
  });
}

function renderProperties() {
  populateLoanOptions();
  const tbody = document.getElementById('properties-tbody');
  tbody.innerHTML = '';
  for (const p of state.properties) {
    const av = calc.appreciatedValue(Number(p.market_value), Number(p.growth_rate));
    const tt = p.acquisition_date
      ? calc.timeTestRemaining(new Date(p.acquisition_date), p.tax_exempt_years || 10)
      : null;
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-200 dark:border-slate-700';
    tr.innerHTML = `
      <td class="py-2 pr-3 font-medium">${escapeHtml(p.name)}</td>
      <td class="py-2 pr-3 text-right">${fmtMoney(p.rent)}</td>
      <td class="py-2 pr-3 text-right">${fmtMoney(p.payment)}</td>
      <td class="py-2 pr-3 text-right">${fmtMoney(p.market_value)}</td>
      <td class="py-2 pr-3 text-right">${fmtMoney(p.acquisition_price)}</td>
      <td class="py-2 pr-3 text-right">${fmtPercent(p.growth_rate)}</td>
      <td class="py-2 pr-3 text-right">${fmtMoney(av)}</td>
      <td class="py-2 pr-3">${p.has_lien ? `ANO (${escapeHtml(p.lien_bank || '')})` : 'NE'}</td>
      <td class="py-2 pr-3">${tt ? tt.text : '—'}</td>
      <td class="py-2 pr-3 whitespace-nowrap">
        <button class="text-blue-600 hover:underline mr-2" data-edit-property="${p.id}">Upravit</button>
        <button class="text-red-600 hover:underline" data-delete-property="${p.id}">Smazat</button>
      </td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('[data-edit-property]').forEach((btn) =>
    btn.addEventListener('click', () => fillPropertyForm(btn.dataset.editProperty))
  );
  tbody.querySelectorAll('[data-delete-property]').forEach((btn) =>
    btn.addEventListener('click', () => deleteProperty(btn.dataset.deleteProperty))
  );
}

function fillPropertyForm(id) {
  const p = state.properties.find((x) => x.id === id);
  if (!p) return;
  const f = document.getElementById('property-form');
  f.elements['id'].value = p.id;
  f.elements['name'].value = p.name;
  f.elements['rent'].value = p.rent;
  f.elements['payment'].value = p.payment;
  f.elements['market_value'].value = p.market_value;
  f.elements['acquisition_price'].value = p.acquisition_price;
  f.elements['growth_rate'].value = p.growth_rate * 100;
  f.elements['acquisition_date'].value = p.acquisition_date || '';
  f.elements['tax_exempt_years'].value = p.tax_exempt_years || 10;
  f.elements['has_lien'].checked = !!p.has_lien;
  f.elements['lien_bank'].value = p.lien_bank || '';
  f.elements['vacancy_rate'].value = (p.vacancy_rate || 0) * 100;
  f.elements['monthly_costs'].value = p.monthly_costs || 0;
  f.elements['rent_growth_rate'].value = (p.rent_growth_rate || 0) * 100;
  f.elements['linked_loan_id'].value = p.linked_loan_id || '';
  f.elements['planned_sale_year'].value = p.planned_sale_year || '';
  f.elements['planned_sale_price'].value = p.planned_sale_price || '';
  document.getElementById('property-form-title').textContent = 'Upravit nemovitost';
}

function resetPropertyForm() {
  const f = document.getElementById('property-form');
  f.reset();
  f.elements['id'].value = '';
  f.elements['tax_exempt_years'].value = '10';
  document.getElementById('property-form-title').textContent = 'Přidat nemovitost';
}

function deleteProperty(id) {
  if (!confirm('Opravdu smazat tuto nemovitost?')) return;
  state.properties = state.properties.filter((p) => p.id !== id);
  saveState();
  renderAll();
}

function submitPropertyForm(e) {
  e.preventDefault();
  const f = e.target;
  const id = f.elements['id'].value;
  const payload = {
    id: id || uid(),
    name: f.elements['name'].value.trim(),
    rent: Number(f.elements['rent'].value) || 0,
    payment: Number(f.elements['payment'].value) || 0,
    market_value: Number(f.elements['market_value'].value) || 0,
    acquisition_price: Number(f.elements['acquisition_price'].value) || 0,
    growth_rate: (Number(f.elements['growth_rate'].value) || 0) / 100,
    acquisition_date: f.elements['acquisition_date'].value || null,
    tax_exempt_years: Number(f.elements['tax_exempt_years'].value) || 10,
    has_lien: f.elements['has_lien'].checked,
    lien_bank: f.elements['lien_bank'].value.trim() || null,
    vacancy_rate: (Number(f.elements['vacancy_rate'].value) || 0) / 100,
    monthly_costs: Number(f.elements['monthly_costs'].value) || 0,
    rent_growth_rate: (Number(f.elements['rent_growth_rate'].value) || 0) / 100,
    linked_loan_id: f.elements['linked_loan_id'].value || null,
    planned_sale_year: f.elements['planned_sale_year'].value ? Number(f.elements['planned_sale_year'].value) : null,
    planned_sale_price: f.elements['planned_sale_price'].value ? Number(f.elements['planned_sale_price'].value) : null,
  };
  if (id) {
    const idx = state.properties.findIndex((p) => p.id === id);
    if (idx !== -1) state.properties[idx] = payload;
  } else {
    state.properties.push(payload);
  }
  saveState();
  resetPropertyForm();
  renderAll();
}

/* ---------- FIXACE / ÚVĚRY ---------- */

function renderLoans() {
  const tbody = document.getElementById('loans-tbody');
  tbody.innerHTML = '';
  for (const l of state.loans) {
    const fx = l.start_date ? calc.fixationRemaining(new Date(l.start_date), l.fixation_years) : null;
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-200 dark:border-slate-700';
    tr.innerHTML = `
      <td class="py-2 pr-3 font-medium">${escapeHtml(l.bank)}</td>
      <td class="py-2 pr-3 text-right">${fmtMoney(l.amount)}</td>
      <td class="py-2 pr-3 text-right">${fmtPercent(l.interest_rate)}</td>
      <td class="py-2 pr-3 text-right">${l.fixation_years} let</td>
      <td class="py-2 pr-3">${l.start_date || '—'}</td>
      <td class="py-2 pr-3">${fx ? fx.text : '—'}</td>
      <td class="py-2 pr-3">${escapeHtml(l.note || '')}</td>
      <td class="py-2 pr-3 whitespace-nowrap">
        <button class="text-blue-600 hover:underline mr-2" data-edit-loan="${l.id}">Upravit</button>
        <button class="text-red-600 hover:underline" data-delete-loan="${l.id}">Smazat</button>
      </td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('[data-edit-loan]').forEach((btn) =>
    btn.addEventListener('click', () => fillLoanForm(btn.dataset.editLoan))
  );
  tbody.querySelectorAll('[data-delete-loan]').forEach((btn) =>
    btn.addEventListener('click', () => deleteLoan(btn.dataset.deleteLoan))
  );
}

function fillLoanForm(id) {
  const l = state.loans.find((x) => x.id === id);
  if (!l) return;
  const f = document.getElementById('loan-form');
  f.elements['id'].value = l.id;
  f.elements['bank'].value = l.bank;
  f.elements['amount'].value = l.amount;
  f.elements['interest_rate'].value = l.interest_rate * 100;
  f.elements['fixation_years'].value = l.fixation_years;
  f.elements['start_date'].value = l.start_date || '';
  f.elements['note'].value = l.note || '';
  f.elements['term_years'].value = l.term_years || 30;
  f.elements['amortizing'].value = l.amortizing === false ? 'false' : 'true';
  f.elements['rate_after_fixation'].value = l.rate_after_fixation != null ? l.rate_after_fixation : '';
  document.getElementById('loan-form-title').textContent = 'Upravit úvěr';
}

function resetLoanForm() {
  const f = document.getElementById('loan-form');
  f.reset();
  f.elements['id'].value = '';
  document.getElementById('loan-form-title').textContent = 'Přidat úvěr';
}

function deleteLoan(id) {
  if (!confirm('Opravdu smazat tento úvěr? (Nemovitosti na něj navázané o vazbu přijdou.)')) return;
  state.loans = state.loans.filter((l) => l.id !== id);
  for (const p of state.properties) {
    if (p.linked_loan_id === id) p.linked_loan_id = null;
  }
  saveState();
  renderAll();
}

function submitLoanForm(e) {
  e.preventDefault();
  const f = e.target;
  const id = f.elements['id'].value;
  const rateAfterRaw = f.elements['rate_after_fixation'].value;
  const payload = {
    id: id || uid(),
    bank: f.elements['bank'].value.trim(),
    amount: Number(f.elements['amount'].value) || 0,
    interest_rate: (Number(f.elements['interest_rate'].value) || 0) / 100,
    fixation_years: Number(f.elements['fixation_years'].value) || 5,
    start_date: f.elements['start_date'].value || null,
    note: f.elements['note'].value.trim() || null,
    term_years: Number(f.elements['term_years'].value) || 30,
    amortizing: f.elements['amortizing'].value !== 'false',
    rate_after_fixation: rateAfterRaw ? Number(rateAfterRaw) : null,
  };
  if (id) {
    const idx = state.loans.findIndex((l) => l.id === id);
    if (idx !== -1) state.loans[idx] = payload;
  } else {
    state.loans.push(payload);
  }
  saveState();
  resetLoanForm();
  renderAll();
}

/* ---------- NASTAVENÍ ---------- */

function renderSettings() {
  document.getElementById('inflation-input').value = (state.settings.inflation_rate * 100).toFixed(2);
  document.getElementById('rental-tax-input').value = state.settings.rental_tax_rate;
  document.getElementById('capgains-tax-input').value = state.settings.capital_gains_tax_rate;
}

function submitSettingsForm(e) {
  e.preventDefault();
  state.settings.inflation_rate = (Number(document.getElementById('inflation-input').value) || 0) / 100;
  state.settings.rental_tax_rate = Number(document.getElementById('rental-tax-input').value) || 0;
  state.settings.capital_gains_tax_rate = Number(document.getElementById('capgains-tax-input').value) || 0;
  saveState();
  renderDashboard();
  renderScenario();
}

/* ---------- SCÉNÁŘOVÉ UDÁLOSTI ---------- */

const EVENT_LABELS = {
  growth: 'Růst hodnoty nemovitosti',
  rent_growth: 'Růst nájmu',
  vacancy: 'Neobsazenost',
  interest_rate: 'Úroková sazba úvěru',
  inflation: 'Inflace',
  one_time: 'Jednorázový příjem/výdaj',
};

function eventTargetKind(type) {
  if (type === 'interest_rate') return 'loan';
  if (type === 'growth' || type === 'rent_growth' || type === 'vacancy') return 'property_or_portfolio';
  return 'portfolio'; // inflation, one_time
}

function updateEventTargetOptions() {
  const type = document.getElementById('event-type').value;
  const kind = eventTargetKind(type);
  const sel = document.getElementById('event-target');
  const wrap = document.getElementById('event-target-wrap');
  const valueLabel = document.getElementById('event-value-label');
  sel.innerHTML = '';

  if (kind === 'loan') {
    for (const l of state.loans) {
      const opt = document.createElement('option');
      opt.value = `loan:${l.id}`;
      opt.textContent = l.bank;
      sel.appendChild(opt);
    }
    wrap.classList.remove('hidden');
  } else if (kind === 'property_or_portfolio') {
    const optAll = document.createElement('option');
    optAll.value = 'portfolio:';
    optAll.textContent = 'Celé portfolio';
    sel.appendChild(optAll);
    for (const p of state.properties) {
      const opt = document.createElement('option');
      opt.value = `property:${p.id}`;
      opt.textContent = p.name;
      sel.appendChild(opt);
    }
    wrap.classList.remove('hidden');
  } else {
    wrap.classList.add('hidden');
    sel.innerHTML = '<option value="portfolio:">Celé portfolio</option>';
  }

  valueLabel.textContent = type === 'one_time' ? 'Hodnota (Kč)' : 'Hodnota (%)';
}

function renderEvents() {
  updateEventTargetOptions();
  const tbody = document.getElementById('events-tbody');
  tbody.innerHTML = '';
  for (const ev of state.events) {
    const targetLabel = targetDisplayName(ev.target_type, ev.target_id);
    const period = ev.year_to && ev.year_to !== ev.year_from ? `${ev.year_from}–${ev.year_to}` : `${ev.year_from}`;
    const valueLabel = ev.type === 'one_time' ? fmtMoney(ev.value) : `${ev.value} %`;
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-200';
    tr.innerHTML = `
      <td class="py-2 pr-3">${EVENT_LABELS[ev.type] || ev.type}</td>
      <td class="py-2 pr-3">${escapeHtml(targetLabel)}</td>
      <td class="py-2 pr-3">${period}</td>
      <td class="py-2 pr-3 text-right">${valueLabel}</td>
      <td class="py-2 pr-3">${escapeHtml(ev.note || '')}</td>
      <td class="py-2 pr-3 whitespace-nowrap">
        <button class="text-blue-600 hover:underline mr-2" data-edit-event="${ev.id}">Upravit</button>
        <button class="text-red-600 hover:underline" data-delete-event="${ev.id}">Smazat</button>
      </td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('[data-edit-event]').forEach((btn) =>
    btn.addEventListener('click', () => fillEventForm(btn.dataset.editEvent))
  );
  tbody.querySelectorAll('[data-delete-event]').forEach((btn) =>
    btn.addEventListener('click', () => deleteEvent(btn.dataset.deleteEvent))
  );
}

function targetDisplayName(targetType, targetId) {
  if (targetType === 'portfolio') return 'Celé portfolio';
  if (targetType === 'property') {
    const p = state.properties.find((x) => x.id === targetId);
    return p ? p.name : '(smazaná nemovitost)';
  }
  if (targetType === 'loan') {
    const l = state.loans.find((x) => x.id === targetId);
    return l ? l.bank : '(smazaný úvěr)';
  }
  return '—';
}

function fillEventForm(id) {
  const ev = state.events.find((x) => x.id === id);
  if (!ev) return;
  const f = document.getElementById('event-form');
  f.elements['id'].value = ev.id;
  f.elements['type'].value = ev.type;
  updateEventTargetOptions();
  f.elements['target'].value = `${ev.target_type}:${ev.target_id || ''}`;
  f.elements['year_from'].value = ev.year_from;
  f.elements['year_to'].value = ev.year_to && ev.year_to !== ev.year_from ? ev.year_to : '';
  f.elements['value'].value = ev.value;
  f.elements['note'].value = ev.note || '';
  document.getElementById('event-form-title').textContent = 'Upravit scénářovou událost';
}

function resetEventForm() {
  const f = document.getElementById('event-form');
  f.reset();
  f.elements['id'].value = '';
  updateEventTargetOptions();
  document.getElementById('event-form-title').textContent = 'Přidat scénářovou událost';
}

function deleteEvent(id) {
  if (!confirm('Smazat tuto scénářovou událost?')) return;
  state.events = state.events.filter((e) => e.id !== id);
  saveState();
  renderEvents();
  renderScenario();
}

function submitEventForm(e) {
  e.preventDefault();
  const f = e.target;
  const id = f.elements['id'].value;
  const [targetType, targetId] = f.elements['target'].value.split(':');
  const yearFrom = Number(f.elements['year_from'].value);
  const yearToRaw = f.elements['year_to'].value;
  const payload = {
    id: id || uid(),
    type: f.elements['type'].value,
    target_type: targetType,
    target_id: targetId || null,
    year_from: yearFrom,
    year_to: yearToRaw ? Number(yearToRaw) : yearFrom,
    value: Number(f.elements['value'].value) || 0,
    note: f.elements['note'].value.trim() || null,
  };
  if (id) {
    const idx = state.events.findIndex((ev) => ev.id === id);
    if (idx !== -1) state.events[idx] = payload;
  } else {
    state.events.push(payload);
  }
  saveState();
  resetEventForm();
  renderEvents();
  renderScenario();
}

/* ---------- SCÉNÁŘE (predikce) ---------- */

function renderScenario() {
  document.getElementById('scenario-horizon').value = state.scenario.horizonYears;

  const result = calc.projectPortfolio({
    properties: state.properties,
    loans: state.loans,
    settings: state.settings,
    events: state.events,
    horizonYears: state.scenario.horizonYears,
  });

  const { rows, summary } = result;

  document.getElementById('sc-kpi-start-equity').textContent = fmtMoney(summary.startEquity);
  document.getElementById('sc-kpi-end-equity').textContent = fmtMoney(summary.endEquity);
  document.getElementById('sc-kpi-cashflow').textContent = fmtMoney(summary.totalCashflow);
  document.getElementById('sc-kpi-cagr').textContent = summary.cagr === null ? '—' : fmtPercent(summary.cagr);

  const chartEl = document.getElementById('scenario-chart');
  chartEl.innerHTML = buildLineChartSVG([
    { label: 'Majetek', color: '#2563eb', points: rows.map((r) => ({ x: r.year, y: r.totalValue })) },
    { label: 'Dluh', color: '#dc2626', points: rows.map((r) => ({ x: r.year, y: r.totalDebt })) },
    { label: 'Vlastní kapitál', color: '#16a34a', points: rows.map((r) => ({ x: r.year, y: r.equity })) },
  ]);

  const tbody = document.getElementById('scenario-tbody');
  tbody.innerHTML = '';
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-200';
    tr.innerHTML = `
      <td class="py-1.5 pr-3">${r.year}</td>
      <td class="py-1.5 pr-3 text-right">${fmtMoney(r.totalValue)}</td>
      <td class="py-1.5 pr-3 text-right">${fmtMoney(r.totalDebt)}</td>
      <td class="py-1.5 pr-3 text-right font-medium">${fmtMoney(r.equity)}</td>
      <td class="py-1.5 pr-3 text-right ${r.cashflow < 0 ? 'text-red-600' : ''}">${fmtMoney(r.cashflow)}</td>
      <td class="py-1.5 pr-3 text-right">${fmtMoney(r.cumulativeCashflow)}</td>`;
    tbody.appendChild(tr);
  }
}

function fmtCompact(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(0) + 'k';
  return String(Math.round(n));
}

function buildLineChartSVG(seriesList, { width = 900, height = 280, padding = 46 } = {}) {
  const allPoints = seriesList.flatMap((s) => s.points);
  if (!allPoints.length) return '<p class="text-sm text-slate-400">Zatím žádná data - přidej nemovitost nebo úvěr.</p>';

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(...ys, 1);

  const xScale = (x) => padding + ((x - minX) / (maxX - minX || 1)) * (width - 2 * padding);
  const yScale = (y) => height - padding - ((y - minY) / (maxY - minY || 1)) * (height - 2 * padding);

  let gridSvg = '';
  for (let i = 0; i <= 4; i++) {
    const y = minY + (i / 4) * (maxY - minY);
    const yy = yScale(y);
    gridSvg += `<line x1="${padding}" y1="${yy}" x2="${width - padding}" y2="${yy}" stroke="#e2e8f0" stroke-width="1" />`;
    gridSvg += `<text x="${padding - 8}" y="${yy + 4}" font-size="11" text-anchor="end" fill="#94a3b8">${fmtCompact(y)}</text>`;
  }

  let xTicksSvg = '';
  const tickCount = Math.min(maxX - minX, 10) || 1;
  for (let i = 0; i <= tickCount; i++) {
    const x = Math.round(minX + (i / tickCount) * (maxX - minX));
    xTicksSvg += `<text x="${xScale(x)}" y="${height - padding + 18}" font-size="11" text-anchor="middle" fill="#94a3b8">${x}</text>`;
  }

  const pathsSvg = seriesList
    .map((s) => {
      const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`).join(' ');
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" />`;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" class="w-full h-auto">
    ${gridSvg}
    <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="1" />
    ${pathsSvg}
    ${xTicksSvg}
  </svg>`;
}

/* ---------- Záloha (export / import / smazání) ---------- */

function wireBackup() {
  document.getElementById('btn-export').addEventListener('click', exportBackup);
  document.getElementById('import-file').addEventListener('change', importBackup);
  document.getElementById('btn-clear').addEventListener('click', clearAllData);
}

function exportBackup() {
  const payload = {
    properties: state.properties,
    loans: state.loans,
    events: state.events,
    settings: state.settings,
    scenario: state.scenario,
    exported_at: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `investicni-kalkulacka-zaloha-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!confirm('Nahrání zálohy přepíše aktuální data v tomto prohlížeči. Pokračovat?')) return;
      state.properties = Array.isArray(parsed.properties) ? parsed.properties : [];
      state.loans = Array.isArray(parsed.loans) ? parsed.loans : [];
      state.events = Array.isArray(parsed.events) ? parsed.events : [];
      state.settings = parsed.settings && typeof parsed.settings.inflation_rate === 'number'
        ? { inflation_rate: 0.03, rental_tax_rate: 15, capital_gains_tax_rate: 15, ...parsed.settings }
        : { inflation_rate: 0.03, rental_tax_rate: 15, capital_gains_tax_rate: 15 };
      state.scenario = parsed.scenario && typeof parsed.scenario.horizonYears === 'number'
        ? parsed.scenario
        : { horizonYears: 20 };
      saveState();
      renderAll();
      alert('Záloha byla úspěšně nahrána.');
    } catch (err) {
      alert('Soubor se nepodařilo přečíst - není to platná záloha.');
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm('Opravdu smazat všechna data v tomto prohlížeči? Tuto akci nelze vrátit zpět.')) return;
  state.properties = [];
  state.loans = [];
  state.events = [];
  state.settings = { inflation_rate: 0.03, rental_tax_rate: 15, capital_gains_tax_rate: 15 };
  state.scenario = { horizonYears: 20 };
  saveState();
  renderAll();
}

/* ---------- PŘEHLED (dashboard) ---------- */

function renderDashboard() {
  const o = calc.overview(state.properties, state.loans, state.settings.inflation_rate);
  document.getElementById('kpi-assets').textContent = fmtMoney(o.assets);
  document.getElementById('kpi-debt').textContent = fmtMoney(o.debt);
  document.getElementById('kpi-networth').textContent = fmtMoney(o.netWorth);
  document.getElementById('kpi-debtratio').textContent = fmtPercent(o.debtRatio);
  document.getElementById('kpi-cashflow').textContent = fmtMoney(o.cashflow);
  document.getElementById('kpi-appreciation').textContent = fmtMoney(o.annualAppreciationGain);
  document.getElementById('kpi-inflation-loss').textContent = fmtMoney(o.inflationLoss);
  document.getElementById('kpi-real-appreciation').textContent = fmtMoney(o.realAppreciation);
  document.getElementById('kpi-projected-value').textContent = fmtMoney(o.projectedPortfolioValue);

  const cashflowEl = document.getElementById('kpi-cashflow');
  cashflowEl.classList.toggle('text-red-600', o.cashflow < 0);
  cashflowEl.classList.toggle('text-emerald-600', o.cashflow >= 0);

  const realAppEl = document.getElementById('kpi-real-appreciation');
  realAppEl.classList.toggle('text-red-600', o.realAppreciation < 0);
  realAppEl.classList.toggle('text-emerald-600', o.realAppreciation >= 0);
}

/* ---------- Pomocné ---------- */

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function wireForms() {
  document.getElementById('property-form').addEventListener('submit', submitPropertyForm);
  document.getElementById('property-form-reset').addEventListener('click', resetPropertyForm);
  document.getElementById('loan-form').addEventListener('submit', submitLoanForm);
  document.getElementById('loan-form-reset').addEventListener('click', resetLoanForm);
  document.getElementById('settings-form').addEventListener('submit', submitSettingsForm);
  document.getElementById('event-form').addEventListener('submit', submitEventForm);
  document.getElementById('event-form-reset').addEventListener('click', resetEventForm);
}

document.addEventListener('DOMContentLoaded', init);
