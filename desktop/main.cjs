const { app, BrowserWindow, dialog, shell, session, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

let configuredUrl = "";
let trustedOrigin = "";

function validateApplicationUrl(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 2048) {
    throw new Error("Enter the HTTPS address issued by your organisation.");
  }
  const target = new URL(value);
  const isLocalhost = ["localhost", "127.0.0.1"].includes(target.hostname);
  if (target.protocol !== "https:" && !(isLocalhost && target.protocol === "http:" && !app.isPackaged)) {
    throw new Error("A public JCStudio service must use HTTPS. HTTP is permitted only for local development.");
  }
  if (target.username || target.password || target.search || target.hash) {
    throw new Error("Do not include account credentials, query strings or fragments in the JCStudio address.");
  }
  trustedOrigin = target.origin;
  return target.toString();
}

async function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

async function readConfiguredUrl() {
  const environmentUrl = process.env.JCSTUDIO_URL || app.commandLine.getSwitchValue("jcstudio-url");
  if (environmentUrl) return validateApplicationUrl(environmentUrl);
  try {
    const content = await fs.readFile(await settingsPath(), "utf8");
    const settings = JSON.parse(content);
    return validateApplicationUrl(settings.serverUrl);
  } catch {
    return "";
  }
}

async function saveConfiguredUrl(serverUrl) {
  const validUrl = validateApplicationUrl(serverUrl);
  const destination = await settingsPath();
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, JSON.stringify({ serverUrl: validUrl, updatedAt: new Date().toISOString() }, null, 2), {
    encoding: "utf8",
    mode: 0o600
  });
  configuredUrl = validUrl;
  return validUrl;
}

function openExternalHttps(value) {
  try {
    const target = new URL(value);
    if (target.protocol === "https:") void shell.openExternal(target.toString());
  } catch {
    // Invalid or non-HTTPS external navigation is ignored.
  }
}

function applyNavigationGuards(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalHttps(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, value) => {
    try {
      if (new URL(value).origin !== trustedOrigin) {
        event.preventDefault();
        openExternalHttps(value);
      }
    } catch {
      event.preventDefault();
    }
  });
}

async function createApplicationWindow() {
  if (!configuredUrl || !trustedOrigin) throw new Error("JCStudio has not been configured.");
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 980,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b1728",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });
  applyNavigationGuards(window);
  window.once("ready-to-show", () => window.show());
  await window.loadURL(configuredUrl);
}

async function createSetupWindow() {
  const window = new BrowserWindow({
    width: 680,
    height: 720,
    minWidth: 480,
    minHeight: 580,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b1728",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.once("ready-to-show", () => window.show());
  await window.loadFile(path.join(__dirname, "setup.html"));
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  ipcMain.handle("jcstudio:configure-server", async (_event, value) => {
    try {
      await saveConfiguredUrl(value);
      await createApplicationWindow();
      BrowserWindow.fromWebContents(_event.sender)?.close();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "The JCStudio address could not be saved."
      };
    }
  });

  try {
    configuredUrl = await readConfiguredUrl();
    if (configuredUrl) {
      await createApplicationWindow();
    } else {
      await createSetupWindow();
    }
  } catch {
    await dialog.showMessageBox({
      type: "error",
      title: "JCStudio could not start",
      message: "The desktop application could not start its secure workspace."
    });
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length !== 0) return;
  if (configuredUrl) void createApplicationWindow().catch(() => app.quit());
  else void createSetupWindow().catch(() => app.quit());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
