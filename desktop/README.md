# JCStudio for Windows

The Windows desktop client opens the same authenticated JCStudio web application in a hardened Electron window. Accounts, permissions and records remain managed by JusticeConnect; the desktop package does not contain a service-role key or a local copy of legal matter data.

## Development

Install Node.js 24.22.3 or later:

```powershell
cd desktop
npm install
npm start
```

On first launch, enter the official JCStudio HTTPS deployment address provided by your system administrator. The address is saved in the current Windows user's Electron application data. For local development only, `http://localhost` is accepted when running the unpackaged app. Public installations require HTTPS.

## Build a Windows installer

```powershell
cd desktop
npm install
npm run dist:win
```

The NSIS installer is written to `desktop/release/`. A manual GitHub Actions workflow, **Build JCStudio Windows installer**, can also build and publish an installable CI artifact.

The installer is unsigned until JMSE KAPA HOLDINGS obtains and configures an organisational code-signing certificate. Do not distribute an unsigned build as an authenticated JMSE production installer.

The shell disables Node integration, enables context isolation and Chromium web security, denies website permission prompts, restricts in-app navigation to the configured HTTPS origin, and opens external HTTPS links in the system browser. The setup screen exposes only one narrow IPC method that validates and stores the chosen HTTPS origin.

Offline mode is a reconnect screen only; the PWA and desktop shell do not cache confidential legal content. The installed application requires the hosted JCStudio service and an internet connection. A native offline matter store, background sync and device-bound encryption are future capabilities and are not represented as implemented.
