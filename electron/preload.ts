import { contextBridge, ipcRenderer } from 'electron'

const methods = ['snapshot', 'createWork', 'saveDraft', 'restoreRevision', 'renameWork', 'moveWork', 'generate', 'reconcileJob', 'chooseExperiment', 'settings', 'chatgptLogin', 'chatgptCancel', 'chatgptLogout', 'chatgptModels', 'chatgptUsage', 'saveSettings', 'checkCapabilities', 'searchModels', 'searchRecipes', 'savePreset', 'savePreference', 'confirmSave', 'setPreferenceActive', 'pauseRun', 'startAgent', 'continueAgent', 'enhancePrompt', 'importReference', 'exportAsset'] as const
const api = Object.fromEntries(methods.map(method => [method, (input?: unknown) => ipcRenderer.invoke('studio:call', { method, input })]))
contextBridge.exposeInMainWorld('studio', {
  ...api,
  onChange: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('studio:changed', listener)
    return () => ipcRenderer.removeListener('studio:changed', listener)
  },
})
