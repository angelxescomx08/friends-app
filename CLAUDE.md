# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend only (hot reload at localhost:1420)
pnpm dev

# Full Tauri desktop app (starts frontend + Rust shell)
pnpm tauri dev

# Build frontend only
pnpm build

# Build and bundle desktop app
pnpm tauri build
```

There is no test suite and no lint script configured.

## Environment Setup

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Desktop app client ID |
| `VITE_GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `VITE_COGNITO_IDENTITY_POOL_ID` | Cognito Identity Pool with Google as identity provider |
| `VITE_AWS_REGION` | AWS region for Cognito + DynamoDB |
| `VITE_DYNAMO_TABLE` | DynamoDB table name (default: `friends-app`) |

The OAuth redirect URI is `http://localhost` (dynamic port) — register it as an authorized redirect URI in the Google Cloud Console. The DynamoDB table requires: `PK` (String) + `SK` (String) primary key, and a GSI named `GSI1` with `GSI1PK` (String) + `GSI1SK` (String).

## Architecture

### Tech Stack
- **Frontend**: SolidJS + TailwindCSS v4 + TanStack Query (UI language: Spanish)
- **Desktop shell**: Tauri v2 (Rust)
- **Backend**: AWS DynamoDB accessed directly from the frontend via AWS SDK; no server
- **Auth**: Google OAuth 2.0 with PKCE → AWS Cognito Identity Pool → temporary AWS credentials

### Auth Flow
1. `src/store/auth.ts` — holds `credentials` and `dynamoCtx` as SolidJS signals; persists credentials to Tauri's `plugin-store` (`credentials.json`)
2. On startup, `initAuth()` restores credentials from the store if not expired
3. Login uses `startGoogleLogin()` from `src/lib/auth.ts`: invokes the custom Rust command `start_oauth_server` (in `src-tauri/src/lib.rs`) which binds a local TCP listener on a random port and returns that port; opens the Google auth URL in the browser via `plugin-opener`; the Rust server accepts the OAuth redirect, sends a success HTML response, then emits an `oauth-callback` Tauri event with the full callback URL; the frontend listener exchanges the code + PKCE verifier for a Google ID token, then calls Cognito to get short-lived AWS credentials
4. `dynamoCtx` is a `DynamoContext` object (all DynamoDB entities + table) created from the live credentials

`AwsCredentials` stores both the AWS credentials and the user profile: `accessKeyId`, `secretAccessKey`, `sessionToken`, `expiration` (epoch ms), `userId` (Google `sub` — used as the DynamoDB partition key), `email`, `name`, `picture?`.

### Data Layer
`src/lib/table.ts` — defines the single DynamoDB table and all entities using `dynamodb-toolbox v2`. All entities share one table using a composite key pattern:

| Entity | PK | SK |
|---|---|---|
| Friend | `USER#<userId>` | `FRIEND#<friendId>` |
| Preference | `USER#<userId>` | `FRIEND#<friendId>#PREF#<category>` |
| ImportantDate | `USER#<userId>` | `FRIEND#<friendId>#DATE#<dateId>` |
| Note | `USER#<userId>` | `FRIEND#<friendId>#NOTE#<noteId>` |
| Reminder | `USER#<userId>` | `FRIEND#<friendId>#REMINDER#<reminderId>` |

Reminders also write `GSI1PK = USER#<userId>#REMINDERS` / `GSI1SK = remindAt` for querying all reminders by date across friends.

`src/lib/db.ts` — all CRUD functions. Each function takes a `DynamoContext` (from `dynamoCtx()` in the auth store) as its first argument. Callers must guard with `enabled: !!dynamoCtx()` before querying. The `put*` functions serve as both create (omit the ID field → generates a UUID) and full replace (pass an existing ID). Partial updates use the separate `updateFriend` / `updateNote` functions; ImportantDate and Reminder have no partial update — delete + recreate instead.

### Component Pattern
Components use TanStack Query (`createQuery` / `createMutation`) to interact with `src/lib/db.ts`. They read `dynamoCtx()` and `credentials()` directly from the auth store signals. Query keys follow the pattern `["entity-type", userId]` or `["entity-type", userId, friendId]`.

Layout is a mobile-first two-panel design: sidebar (`FriendsList`) replaces the detail panel (`FriendDetail`) on small screens; both are visible on `md+` breakpoints.

### Tauri Backend
`src-tauri/src/lib.rs` contains one custom command: `start_oauth_server` — binds an ephemeral TCP listener, handles one HTTP request (the OAuth redirect), emits an `oauth-callback` event, and returns the port number. Two plugins are registered: `plugin-opener` (open browser URLs) and `plugin-store` (persist credentials). Permissions are declared in `src-tauri/capabilities/default.json`.
