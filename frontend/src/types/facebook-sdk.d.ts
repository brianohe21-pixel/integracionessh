export {};

declare global {
  interface FBLoginResponse {
    authResponse?: {
      code?: string;
      accessToken?: string;
    };
    status?: string;
  }

  interface Window {
    FB?: {
      init: (params: Record<string, unknown>) => void;
      login: (
        callback: (response: FBLoginResponse) => void,
        options: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}
