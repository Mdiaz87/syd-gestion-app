import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://oznvuehmlorpnutwigtm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4vO1w1Dj0yPwajEfNcL_9w_Igo_kSeJ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Cliente descartable, con su propia sesión aislada — se usa para crear una
// cuenta de Supabase Auth para OTRA persona (signUp) sin reemplazar la sesión
// del Directivo que está usando la app en ese momento.
export const createScratchClient = () => createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, storageKey: `syd-scratch-${Date.now()}-${Math.random()}` }
});
