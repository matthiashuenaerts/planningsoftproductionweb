import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const TOKENS_STORAGE_KEY = 'onedrive_tokens';

const OneDriveCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');

      if (!code || !state) {
        setError('Geen autorisatiecode ontvangen.');
        return;
      }

      const savedState = sessionStorage.getItem('onedrive_oauth_state');
      if (state !== savedState) {
        setError('Ongeldige state parameter.');
        return;
      }

      const codeVerifier = sessionStorage.getItem('onedrive_code_verifier');
      if (!codeVerifier) {
        setError('PKCE code verifier ontbreekt.');
        return;
      }

      const redirectUri = `${window.location.origin}/onedrive-callback`;

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          'onedrive-auth?action=exchange-code',
          {
            body: { code, redirectUri, codeVerifier },
          }
        );

        if (fnError) throw fnError;

        const tokens = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Date.now() + (data.expires_in * 1000),
        };

        localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokens));
        sessionStorage.removeItem('onedrive_oauth_state');
        sessionStorage.removeItem('onedrive_code_verifier');

        // Navigate back to the original page
        const returnPath = sessionStorage.getItem('onedrive_return_path');
        sessionStorage.removeItem('onedrive_return_path');
        navigate(returnPath || '/', { replace: true });
      } catch (err: any) {
        console.error('OneDrive callback error:', err);
        setError(err.message || 'Authenticatie mislukt.');
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-primary underline"
          >
            Ga terug
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Verbinden met OneDrive...</p>
      </div>
    </div>
  );
};

export default OneDriveCallback;
