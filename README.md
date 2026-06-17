# Friends App

Aplicación de escritorio y móvil para gestionar amigos, fechas importantes, notas y recordatorios.

**Stack:** SolidJS · TailwindCSS v4 · TanStack Query · Tauri v2 · AWS DynamoDB · Google OAuth 2.0

---

## Requisitos previos

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- [Rust](https://rustup.rs/) (stable)
- [Tauri CLI prerequisites](https://v2.tauri.app/start/prerequisites/)

**Para Android:**
- Android Studio con SDK API 24+
- NDK instalado (recomendado: NDK 26)
- Variables de entorno configuradas: `ANDROID_HOME`, `NDK_HOME`

---

## Variables de entorno

Copia `.env.example` a `.env` y llena los valores:

```env
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_CLIENT_SECRET=
VITE_COGNITO_IDENTITY_POOL_ID=
VITE_AWS_REGION=
VITE_DYNAMO_TABLE=friends-app
```

Registra `http://localhost` como URI de redirección autorizada en Google Cloud Console.

---

## Desarrollo

```bash
# Instalar dependencias
pnpm install

# Frontend solo (hot reload en localhost:1420)
pnpm dev

# App de escritorio completa (frontend + shell Rust)
pnpm tauri dev

# App de Android en dispositivo/emulador conectado
pnpm tauri android dev
```

---

## Build — Escritorio

```bash
# Construir e instalar app de escritorio (.exe / .dmg / .deb)
pnpm tauri build
```

Los instaladores quedan en `src-tauri/target/release/bundle/`.

---

## Build — Android (APK / AAB)

### Inicializar proyecto Android (solo la primera vez)

```bash
pnpm tauri android init
```

### APK de debug

```bash
pnpm tauri android build --debug
```

Salida: `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`

### APK de release (sin firmar)

```bash
pnpm tauri android build
```

Salida: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`

### AAB de release (para Google Play)

```bash
pnpm tauri android build --aab
```

Salida: `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

### Firmar el APK de release

```bash
# 1. Generar keystore (solo una vez)
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias

# 2. Firmar el APK
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore my-release-key.jks \
  src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk \
  my-key-alias

# 3. Alinear el APK
zipalign -v 4 \
  src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk \
  friends-app-release.apk
```

---

## Arquitectura

```
src/
├── components/       # Componentes SolidJS (FriendsList, FriendDetail, etc.)
├── lib/
│   ├── auth.ts       # Google OAuth + Cognito (PKCE flow)
│   ├── db.ts         # Funciones CRUD contra DynamoDB
│   └── table.ts      # Definición de tabla y entidades (dynamodb-toolbox v2)
├── store/
│   └── auth.ts       # Signals globales: credentials, dynamoCtx
└── main.tsx

src-tauri/
├── src/lib.rs        # Comando Rust: start_oauth_server (OAuth redirect handler)
├── capabilities/     # Permisos de Tauri
└── gen/android/      # Proyecto Android generado (no editar archivos auto-generados)
```

### Modelo de datos en DynamoDB

| Entidad       | PK                  | SK                                        |
|---------------|---------------------|-------------------------------------------|
| Friend        | `USER#<userId>`     | `FRIEND#<friendId>`                       |
| Preference    | `USER#<userId>`     | `FRIEND#<friendId>#PREF#<category>`       |
| ImportantDate | `USER#<userId>`     | `FRIEND#<friendId>#DATE#<dateId>`         |
| Note          | `USER#<userId>`     | `FRIEND#<friendId>#NOTE#<noteId>`         |
| Reminder      | `USER#<userId>`     | `FRIEND#<friendId>#REMINDER#<reminderId>` |

Los recordatorios también escriben en el GSI `GSI1` (`GSI1PK = USER#<userId>#REMINDERS`, `GSI1SK = remindAt`) para consultas por fecha.
