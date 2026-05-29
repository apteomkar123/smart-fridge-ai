import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

// AppWare SSO portal — update this URL when the portal is deployed
const AUTH_PORTAL_URL = 'https://authappware.netlify.app';

export function useAppWareSSO() {
  useEffect(() => {
    const ingestIncomingSession = async () => {
      // Supabase redirects back with tokens in the URL hash after OAuth
      if (!window.location.hash.includes('access_token=')) return;

      const params = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        // Clean the tokens out of the address bar
        window.history.replaceState(null, '', window.location.pathname);
        window.location.reload();
      }
    };

    ingestIncomingSession();
  }, []);

  const triggerAppWareRedirect = () => {
    const callbackOrigin = import.meta.env.VITE_APP_URL || window.location.origin;
    window.location.href = `${AUTH_PORTAL_URL}?redirect_to=${encodeURIComponent(callbackOrigin)}`;
  };

  return { triggerAppWareRedirect };
}
