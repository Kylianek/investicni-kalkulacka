/* Hlavní logika aplikace: načítání dat z Supabase, CRUD formuláře, přepočet a vykreslení přehledu. */

const state = {
  userId: null,
  properties: [],
  loans: [],
  settings: { inflation_rate: 0.03 },
};

const fmtMoney = (n) =>
  (Number(n) || 0).toLocaleString('cs-CZ', { maximumFractionDigits: 0 }) + ' Kč';
const fmtPercent = (n) => ((Number(n) || 0) * 100).toLocaleString('cs-CZ', { maximumFractionDigits: 2 }) + ' %';

/* ---------- Inicializace po přihlášení ---------- */

async function onAuthReady(user) {
  state.userId = user.id;
  wireTabs();
  wireForms();
  await refreshAll();
}

async function refreshAll() {
  await Promise.all([loadProperties(), loadLoans(), loadSettings()]);
  renderProperties();
  renderLoans();
  renderSettings();
  renderDashboard();
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

async function loadProperties() {
  const { data, error } = await supabaseClient
    .from('properties')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error(error);
    return;
  }
  state.properties = data;
}

function renderProperties() {
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
  document.getElementById('property-form-title').textContent = 'Upravit nemovitost';
}

function resetPropertyForm() {
  const f = document.getElementById('property-form');
  f.reset();
  f.elements['id'].value = '';
  f.elements['tax_exempt_years'].value = '10';
  document.getElementById('property-form-title').textContent = 'Přidat nemovitost';
}

async function deleteProperty(id) {
  if (!confirm('Opravdu smazat tuto nemovitost?')) return;
  const { error } = await supabaseClient.from('properties').delete().eq('id', id);
  if (error) return alert('Chyba: ' + error.message);
  await refreshAll();
}

async function submitPropertyForm(e) {
  e.preventDefault();
  const f = e.target;
  const payload = {
    user_id: state.userId,
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
  };
  const id = f.elements['id'].value;
  const { error } = id
    ? await supabaseClient.from('properties').update(payload).eq('id', id)
    : await supabaseClient.from('properties').insert(payload);
  if (error) return alert('Chyba: ' + error.message);
  resetPropertyForm();
  await refreshAll();
}

/* ---------- FIXACE / ÚVĚRY ---------- */

async function loadLoans() {
  const { data, error } = await supabaseClient
    .from('loans')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error(error);
    return;
  }
  state.loans = data;
}

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
  document.getElementById('loan-form-title').textContent = 'Upravit úvěr';
}

function resetLoanForm() {
  const f = document.getElementById('loan-form');
  f.reset();
  f.elements['id'].value = '';
  document.getElementById('loan-form-title').textContent = 'Přidat úvěr';
}

async function deleteLoan(id) {
  if (!confirm('Opravdu smazat tento úvěr?')) return;
  const { error } = await supabaseClient.from('loans').delete().eq('id', id);
  if (error) return alert('Chyba: ' + error.message);
  await refreshAll();
}

async function submitLoanForm(e) {
  e.preventDefault();
  const f = e.target;
  const payload = {
    user_id: state.userId,
    bank: f.elements['bank'].value.trim(),
    amount: Number(f.elements['amount'].value) || 0,
    interest_rate: (Number(f.elements['interest_rate'].value) || 0) / 100,
    fixation_years: Number(f.elements['fixation_years'].value) || 5,
    start_date: f.elements['start_date'].value || null,
    note: f.elements['note'].value.trim() || null,
  };
  const id = f.elements['id'].value;
  const { error } = id
    ? await supabaseClient.from('loans').update(payload).eq('id', id)
    : await supabaseClient.from('loans').insert(payload);
  if (error) return alert('Chyba: ' + error.message);
  resetLoanForm();
  await refreshAll();
}

/* ---------- NASTAVENÍ (inflace) ---------- */

async function loadSettings() {
  const { data, error } = await supabaseClient
    .from('settings')
    .select('*')
    .eq('user_id', state.userId)
    .maybeSingle();
  if (error) {
    console.error(error);
    return;
  }
  if (data) state.settings = data;
}

function renderSettings() {
  document.getElementById('inflation-input').value = (state.settings.inflation_rate * 100).toFixed(2);
}

async function submitSettingsForm(e) {
  e.preventDefault();
  const rate = (Number(document.getElementById('inflation-input').value) || 0) / 100;
  const { error } = await supabaseClient
    .from('settings')
    .upsert({ user_id: state.userId, inflation_rate: rate }, { onConflict: 'user_id' });
  if (error) return alert('Chyba: ' + error.message);
  state.settings.inflation_rate = rate;
  renderDashboard();
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
}
