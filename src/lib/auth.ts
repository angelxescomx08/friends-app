import { CognitoIdentityClient, GetIdCommand, GetCredentialsForIdentityCommand } from "@aws-sdk/client-cognito-identity";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { platform } from "@tauri-apps/plugin-os";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { config } from "./config";

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: number;
  userId: string;
  email: string;
  name: string;
  picture?: string;
}

const MOBILE_REDIRECT_URI = "friendsapp://oauth-callback";

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = base64UrlEncode(array.buffer);
  const encoded = new TextEncoder().encode(codeVerifier);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  const codeChallenge = base64UrlEncode(hash);
  return { codeVerifier, codeChallenge };
}

export function buildGoogleAuthUrl(codeChallenge: string, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{ idToken: string; userId: string; email: string; name: string; picture?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  const data = await res.json();
  const idToken: string = data.id_token;

  const base64 = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const payload = JSON.parse(new TextDecoder().decode(bytes));

  return {
    idToken,
    userId: payload.sub as string,
    email: payload.email as string,
    name: payload.name as string,
    picture: payload.picture as string | undefined,
  };
}

export async function getCognitoCredentials(
  idToken: string,
  userId: string,
  email: string,
  name: string,
  picture?: string
): Promise<AwsCredentials> {
  const cognitoClient = new CognitoIdentityClient({ region: config.awsRegion });

  const getIdRes = await cognitoClient.send(
    new GetIdCommand({
      IdentityPoolId: config.cognitoIdentityPoolId,
      Logins: { "accounts.google.com": idToken },
    })
  );

  if (!getIdRes.IdentityId) throw new Error("Failed to get Cognito identity ID");

  const getCredsRes = await cognitoClient.send(
    new GetCredentialsForIdentityCommand({
      IdentityId: getIdRes.IdentityId,
      Logins: { "accounts.google.com": idToken },
    })
  );

  const creds = getCredsRes.Credentials;
  if (!creds?.AccessKeyId || !creds.SecretKey || !creds.SessionToken) {
    throw new Error("Incomplete credentials from Cognito");
  }

  return {
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretKey,
    sessionToken: creds.SessionToken,
    expiration: creds.Expiration ? creds.Expiration.getTime() : Date.now() + 3600_000,
    userId,
    email,
    name,
    picture,
  };
}

async function handleOAuthCallback(
  callbackUrl: string,
  state: string,
  codeVerifier: string,
  redirectUri: string,
  onSuccess: (creds: AwsCredentials) => void,
  onError: (err: string) => void
) {
  try {
    const parsed = new URL(callbackUrl);
    const code = parsed.searchParams.get("code");
    const returnedState = parsed.searchParams.get("state");
    const error = parsed.searchParams.get("error");

    if (error) throw new Error(`OAuth error: ${error}`);
    if (returnedState !== state) throw new Error("State mismatch - possible CSRF");
    if (!code) throw new Error("No code in callback");

    const tokenData = await exchangeCodeForTokens(code, codeVerifier, redirectUri);
    const creds = await getCognitoCredentials(
      tokenData.idToken,
      tokenData.userId,
      tokenData.email,
      tokenData.name,
      tokenData.picture
    );
    onSuccess(creds);
  } catch (e) {
    onError(e instanceof Error ? e.message : String(e));
  }
}

export async function startGoogleLogin(
  onSuccess: (creds: AwsCredentials) => void,
  onError: (err: string) => void
): Promise<void> {
  const { codeVerifier, codeChallenge } = await generatePKCE();
  const state = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)).buffer);

  try {
    const currentPlatform = await platform();
    const isMobile = currentPlatform === "android" || currentPlatform === "ios";

    if (isMobile) {
      const redirectUri = MOBILE_REDIRECT_URI;

      const unlisten = await onOpenUrl(async (urls) => {
        const url = urls[0];
        if (!url) return;
        unlisten();
        await handleOAuthCallback(url, state, codeVerifier, redirectUri, onSuccess, onError);
      });

      const authUrl = buildGoogleAuthUrl(codeChallenge, state, redirectUri);
      await openUrl(authUrl);
    } else {
      const port = await invoke<number>("start_oauth_server");
      const redirectUri = `http://localhost:${port}`;

      const unlisten = await listen<string>("oauth-callback", async (event) => {
        unlisten();
        await handleOAuthCallback(event.payload, state, codeVerifier, redirectUri, onSuccess, onError);
      });

      const authUrl = buildGoogleAuthUrl(codeChallenge, state, redirectUri);
      await openUrl(authUrl);
    }
  } catch (e) {
    onError(e instanceof Error ? e.message : String(e));
  }
}
