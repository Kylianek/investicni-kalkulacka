/* Vytvoří jediného sdíleného Supabase klienta pro celou aplikaci. */
const supabaseClient = (() => {
  if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase knihovna se nenačetla (zkontroluj připojení k internetu / CDN).');
    return null;
  }
  if (SUPABASE_URL.includes('YOUR-PROJECT-REF') || SUPABASE_ANON_KEY.includes('YOUR-ANON-PUBLIC-KEY')) {
    console.warn('Supabase zatím není nakonfigurován - uprav js/config.js.');
  }
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
