/*
 * KONFIGURACE SUPABASE
 * -----------------------------------------------------------------------
 * 1. Založ si zdarma účet na https://supabase.com a nový projekt.
 * 2. V projektu jdi do Settings -> API a zkopíruj:
 *      - "Project URL"           -> SUPABASE_URL
 *      - "anon public" API klíč  -> SUPABASE_ANON_KEY
 * 3. Vlož je sem. Tento klíč je veřejný ("anon") a je bezpečné ho mít
 *    v prohlížeči i ve veřejném GitHub repu - skutečná ochrana dat je
 *    zajištěna přes Row Level Security (viz sql/schema.sql), takže
 *    každý uživatel vidí v databázi jen svoje vlastní řádky.
 * 4. V Supabase v SQL editoru spusť obsah souboru sql/schema.sql.
 * 5. V Authentication -> Providers ověř, že je zapnuté "Email" (výchozí stav).
 */
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
