const SUPABASE_URL = 'https://aolruspeudebdwcszele.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-YYXXYECMpEknYu1Om2f4w_eD1KA5nc';

export let supabaseClient = null;

export const supabaseReady = new Promise((resolve) => {
    if (!document.querySelector('script[src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"]')) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.async = true;
        script.onload = () => {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    storageKey: 'quizy-auth-token'
                }
            });
            resolve(supabaseClient);
        };
        document.head.appendChild(script);
    } else {
        // Script already loaded, resolve existing client
        resolve(supabaseClient);
    }
});