/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: {
          client_id: string;
          callback: (response: { credential?: string }) => void;
          login_uri?: string;
          ux_mode?: 'popup' | 'redirect';
          itp_support?: boolean;
        }) => void;
        renderButton: (
          parent: HTMLElement,
          options: {
            theme?: 'outline' | 'filled_blue' | 'filled_black';
            size?: 'large' | 'medium' | 'small';
            text?: 'signin_with' | 'signup_with' | 'continue_with';
            shape?: 'rectangular' | 'pill' | 'circle' | 'square';
            width?: number;
          }
        ) => void;
      };
    };
  };
}
