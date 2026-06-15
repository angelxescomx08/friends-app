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
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Desktop app client ID — redirect URI must be `friendsapp://auth` |
| `VITE_COGNITO_IDENTITY_POOL_ID` | Cognito Identity Pool with Google as identity provider |
| `VITE_AWS_REGION` | AWS region for Cognito + DynamoDB |
| `VITE_DYNAMO_TABLE` | DynamoDB table name (default: `friends-app`) |

The DynamoDB table requires: `PK` (String) + `SK` (String) primary key, and a GSI named `GSI1` with `GSI1PK` (String) + `GSI1SK` (String).

## Architecture

### Tech Stack
- **Frontend**: SolidJS + TailwindCSS v4 + TanStack Query
- **Desktop shell**: Tauri v2 (Rust, no custom commands — only plugins)
- **Backend**: AWS DynamoDB accessed directly from the frontend via AWS SDK; no server
- **Auth**: Google OAuth 2.0 with PKCE → AWS Cognito Identity Pool → temporary AWS credentials

### Auth Flow
1. `src/store/auth.ts` — holds `credentials` and `dynamoCtx` as SolidJS signals; persists credentials to Tauri's `plugin-store` (`credentials.json`)
2. On startup, `initAuth()` restores credentials from the store if not expired
3. Login uses `startGoogleLogin()` from `src/lib/auth.ts`: opens browser via `plugin-opener`, listens for the deep-link callback (`friendsapp://auth`) via `plugin-deep-link`, exchanges the code + PKCE verifier for a Google ID token, then calls Cognito to get short-lived AWS credentials
4. `dynamoCtx` is a `DynamoContext` object (all DynamoDB entities + table) created from the live credentials

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

`src/lib/db.ts` — all CRUD functions. Each function takes a `DynamoContext` (from `dynamoCtx()` in the auth store) as its first argument. Callers must guard with `enabled: !!dynamoCtx()` before querying.

### Component Pattern
Components use TanStack Query (`createQuery` / `createMutation`) to interact with `src/lib/db.ts`. They read `dynamoCtx()` and `credentials()` directly from the auth store signals. Query keys follow the pattern `["entity-type", userId]` or `["entity-type", userId, friendId]`.

### Tauri Capabilities
The app uses three Tauri plugins (no custom Rust commands): `plugin-opener` (open browser URLs), `plugin-deep-link` (receive `friendsapp://` callbacks), and `plugin-store` (persist credentials). Permissions are declared in `src-tauri/capabilities/default.json`.
