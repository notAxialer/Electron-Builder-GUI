const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    readPackage: (path) => ipcRenderer.invoke('read-package', path),
    savePackage: (path, pkg) => ipcRenderer.invoke('save-package', path, pkg),
    installElectronBuilder: (path) => ipcRenderer.invoke('install-electron-builder', path),
    checkElectronBuilder: (path) => ipcRenderer.invoke('check-electron-builder', path),
    buildProject: (path, platforms) => ipcRenderer.invoke('build-project', path, platforms),
    openFolder: (path) => ipcRenderer.invoke('open-folder', path),
    makeRelativePath: (base, full) => ipcRenderer.invoke('make-relative-path', base, full),
    onBuildLog: (callback) => ipcRenderer.on('build-log', (e, data) => callback(data)),
    onBuildComplete: (callback) => ipcRenderer.on('build-complete', (e, success) => callback(success)),
    installProjectDependencies: (path) => ipcRenderer.invoke('install-project-dependencies', path),
    checkElectronInstalled: (path) => ipcRenderer.invoke('check-electron-installed', path),
    selectFile: (filters = []) => ipcRenderer.invoke('select-file', filters),
    ensureElectronInDevDeps: (path) => ipcRenderer.invoke('ensure-electron-in-devdeps', path),
    createElectronProject: (baseDir, projectName) => ipcRenderer.invoke('create-electron-project', baseDir, projectName)
});