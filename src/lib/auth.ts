import { CognitoIdentityClient, GetIdCommand, GetCredentialsForIdentityCommand } from "@aws-sdk/client-cognito-identity";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
  const data = await invoke<Record<string, string>>("exchange_oauth_code", {
    code,
    codeVerifier,
    redirectUri,
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
  });

  if (data.error) {
    throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  }

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
    const port = await invoke<number>("start_oauth_server");
    const redirectUri = `http://localhost:${port}`;

    const unlisten = await listen<string>("oauth-callback", async (event) => {
      unlisten();
      await handleOAuthCallback(event.payload, state, codeVerifier, redirectUri, onSuccess, onError);
    });

    const authUrl = buildGoogleAuthUrl(codeChallenge, state, redirectUri);
    await openUrl(authUrl);
  } catch (e) {
    onError(e instanceof Error ? e.message : String(e));
  }
}
