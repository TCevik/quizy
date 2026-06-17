const SUPABASE_URL = 'https://aolruspeudebdwcszele.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-YYXXYECMpEknYu1Om2f4w_eD1KA5nc';

window.supabaseReady = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.onload = () => {
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        resolve(window.supabaseClient);
    };
    document.head.appendChild(script);
});