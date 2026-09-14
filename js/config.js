/*
 * VOLITELNÉ PŘIHLÁŠENÍ / ZÁLOHA DO CLOUDU
 * -----------------------------------------------------------------------
 * Appka funguje i BEZ tohohle - data zůstávají jen v tomto prohlížeči.
 * Chceš-li navíc volitelné přihlášení (data pak budou dostupná i z jiného
 * zařízení/prohlížeče):
 *
 * 1. Založ si zdarma účet na https://supabase.com a nový projekt.
 * 2. V projektu v SQL Editoru spusť obsah souboru sql/schema.sql.
 * 3. V Settings -> API zkopíruj "Project URL" a "anon public" klíč sem níže.
 *    Tenhle klíč je veřejný ("anon") a je v pořádku ho mít i ve veřejném
 *    repu - skutečná ochrana dat je zajištěná přes Row Level Security
 *    z kroku 2 (každý uživatel vidí jen svoje vlastní řádky).
 * 4. V Authentication -> Providers ověř, že je zapnuté "Email".
 * 5. Commitni a pushni - appka pak automaticky nabídne přihlášení v Nastavení.
 */
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
