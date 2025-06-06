
import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { oneDriveService } from '@/services/oneDriveService';

const OneDriveCallback: React.FC = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        console.error('OneDrive OAuth error:', error);
        window.opener?.postMessage(
          { type: 'ONEDRIVE_AUTH_ERROR', error },
          window.location.origin
        );
        window.close();
        return;
      }

      if (!code || !state) {
        console.error('Missing code or state parameter');
        window.opener?.postMessage(
          { type: 'ONEDRIVE_AUTH_ERROR', error: 'Missing parameters' },
          window.location.origin
        );
        window.close();
        return;
      }

      try {
        // Decode project ID from state
        const { projectId } = JSON.parse(atob(state));
        
        // Exchange code for tokens
        const tokens = await oneDriveService.exchangeCodeForTokens(
          code,
          '092681d3-68ad-4b6d-84f0-995b3525462a',
          window.location.origin + '/onedrive-callback',
          '6d129b43-6491-418d-b9cd-e1f43b7866bb'
        );

        // Create project folder
        const folder = await oneDriveService.createProjectFolderStructure(
          tokens.access_token,
          `Project ${projectId}`
        );

        // Save configuration
        await oneDriveService.connectProjectToOneDrive(projectId, folder, tokens);

        // Notify parent window
        window.opener?.postMessage(
          { type: 'ONEDRIVE_AUTH_SUCCESS', projectId },
          window.location.origin
        );
        
        window.close();
      } catch (error) {
        console.error('Error in OneDrive callback:', error);
        window.opener?.postMessage(
          { type: 'ONEDRIVE_AUTH_ERROR', error: error.message },
          window.location.origin
        );
        window.close();
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p>OneDrive verbinding wordt verwerkt...</p>
      </div>
    </div>
  );
};

export default OneDriveCallback;
