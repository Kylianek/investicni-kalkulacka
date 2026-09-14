/* Vytvoří sdíleného Supabase klienta, pokud je appka nakonfigurovaná (viz config.js).
   Když není, přihlášení se v appce prostě nenabídne - zbytek funguje normálně dál. */
const supabaseClient = (() => {
  try {
    if (!window.supabase || !window.supabase.createClient) return null;
    if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR-PROJECT-REF')) return null;
    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('YOUR-ANON-PUBLIC-KEY')) return null;
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.warn('Supabase se nepodařilo nakonfigurovat, přihlášení bude vypnuté:', e);
    return null;
  }
})();
