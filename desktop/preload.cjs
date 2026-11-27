// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jcstudioSetup", Object.freeze({
  configureServer: (url) => ipcRenderer.invoke("jcstudio:configure-server", url)
}));
