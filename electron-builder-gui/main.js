const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 750,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

// --- Валидация и исправление package.json ---
function validateAndFixPackageJson(pkg) {
    const fixes = [];

    // 1. Проверка и исправление: electron должен быть только в devDependencies
    if (pkg.dependencies?.electron) {
        pkg.devDependencies = pkg.devDependencies || {};
        pkg.devDependencies.electron = pkg.dependencies.electron;
        delete pkg.dependencies.electron;
        if (Object.keys(pkg.dependencies).length === 0) {
            delete pkg.dependencies;
        }
        fixes.push('electron перемещён из dependencies в devDependencies');
    }

    // 2. Добавляем description, если нет
    if (!pkg.description) {
        pkg.description = pkg.productName || pkg.name || 'Electron application';
        fixes.push('добавлено поле description');
    }

    // 3. Проверка наличия main
    if (!pkg.main) {
        pkg.main = 'main.js';
        fixes.push('установлена точка входа: main.js');
    }

    return { pkg, fixes };
}

// --- IPC обработчики ---

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-platform', () => {
    const platform = os.platform(); // 'win32', 'darwin', 'linux'
    return platform;
});

ipcMain.handle('install-project-dependencies', async (e, projectPath) => {
    return new Promise((resolve, reject) => {
        const child = spawn('npm', ['install'], {
            cwd: projectPath,
            shell: true
        });

        child.on('close', (code) => {
            resolve(code === 0);
        });
        child.on('error', reject);
    });
});

// Проверка: есть ли electron в node_modules
ipcMain.handle('check-electron-installed', async (e, projectPath) => {
    return fs.existsSync(path.join(projectPath, 'node_modules', 'electron'));
});

ipcMain.handle('select-file', async (e, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters.length ? filters : undefined
    });
    return result.canceled ? null : result.filePaths[0];
  });

ipcMain.handle('read-package', async (e, projectPath) => {
    const pkgPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const { pkg: fixedPkg, fixes } = validateAndFixPackageJson(pkg);
    if (fixes.length > 0) {
        fs.writeFileSync(pkgPath, JSON.stringify(fixedPkg, null, 2));
    }
    return fixedPkg;
});

ipcMain.handle('save-package', async (e, projectPath, pkg) => {
    const { pkg: fixedPkg } = validateAndFixPackageJson(pkg);
    const pkgPath = path.join(projectPath, 'package.json');
    fs.writeFileSync(pkgPath, JSON.stringify(fixedPkg, null, 2));
    return true;
});

// Проверка devDependencies
ipcMain.handle('ensure-electron-in-devdeps', async (e, projectPath) => {
    const pkgPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      throw new Error('package.json не найден');
    }
  
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    let wasModified = false;
  
    if (pkg.dependencies?.electron) {
      pkg.devDependencies = pkg.devDependencies || {};
      pkg.devDependencies.electron = pkg.dependencies.electron;
      delete pkg.dependencies.electron;
      if (Object.keys(pkg.dependencies).length === 0) {
        delete pkg.dependencies;
      }
      wasModified = true;
    }
  
    if (!pkg.devDependencies?.electron) {
      pkg.devDependencies = pkg.devDependencies || {};
      pkg.devDependencies.electron = '^30.0.0';
      wasModified = true;
    }
  
    if (wasModified) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    }
  
    return wasModified;
  });

ipcMain.handle('install-electron-builder', async (e, projectPath) => {
    const pkgPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        throw new Error('package.json не найден');
    }

    return new Promise((resolve, reject) => {
        const child = spawn('npm', ['install', 'electron-builder', '--save-dev'], {
            cwd: projectPath,
            shell: true
        });

        child.on('close', (code) => {
            if (code === 0) resolve(true);
            else reject(new Error('Не удалось установить electron-builder'));
        });

        child.on('error', reject);
    });
});

ipcMain.handle('check-electron-builder', async (e, projectPath) => {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json')));
        return pkg.devDependencies?.['electron-builder'] != null;
    } catch {
        return false;
    }
});

ipcMain.handle('build-project', async (e, projectPath, platforms) => {
    const args = [];
    if (platforms.includes('win')) args.push('--win');
    if (platforms.includes('mac')) args.push('--mac');
    if (platforms.includes('linux')) args.push('--linux');

    const child = spawn('npx', ['electron-builder', ...args], {
        cwd: projectPath,
        shell: true
    });

    child.stdout.on('data', (data) => {
        mainWindow.webContents.send('build-log', data.toString());
    });
    child.stderr.on('data', (data) => {
        mainWindow.webContents.send('build-log', data.toString());
    });

    return new Promise((resolve) => {
        child.on('close', (code) => {
            mainWindow.webContents.send('build-complete', code === 0);
            resolve(code === 0);
        });
    });
});

ipcMain.handle('open-folder', (e, folderPath) => {
    shell.openPath(folderPath);
});

ipcMain.handle('make-relative-path', (e, basePath, fullPath) => {
    return path.relative(basePath, fullPath);
});

// Создать новый Electron-проект
ipcMain.handle('create-electron-project', async (e, baseDir, projectName) => {
    const projectPath = path.join(baseDir, projectName);
  
    if (fs.existsSync(projectPath)) {
      throw new Error(`Папка "${projectName}" уже существует`);
    }
  
    fs.mkdirSync(projectPath, { recursive: true });
  
    // package.json
    const pkg = {
      name: projectName,
      version: "1.0.0",
      description: "My Electron App",
      main: "main.js",
      scripts: {
        start: "electron .",
        build: "electron-builder"
      },
      devDependencies: {
        electron: "^30.0.0",
        "electron-builder": "^26.0.12"
      }
    };
    fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify(pkg, null, 2));
  
    // main.js
    const mainJs = `
  const { app, BrowserWindow } = require('electron');
  const path = require('path');
  
  function createWindow() {
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js')
      }
    });
  
    win.loadFile('index.html');
  }
  
  app.whenReady().then(createWindow);
  
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  `.trim();
    fs.writeFileSync(path.join(projectPath, 'main.js'), mainJs);
  
    // preload.js
    const preloadJs = `
  // Preload script
  `.trim();
    fs.writeFileSync(path.join(projectPath, 'preload.js'), preloadJs);
  
    // index.html
    const indexHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>${projectName}</title>
  </head>
  <body>
    <h1>Hello from Electron!</h1>
    <p>Project: ${projectName}</p>
  </body>
  </html>
  `.trim();
    fs.writeFileSync(path.join(projectPath, 'index.html'), indexHtml);
  
    // Установка зависимостей
    return new Promise((resolve, reject) => {
      const child = spawn('npm', ['install'], {
        cwd: projectPath,
        shell: true
      });
  
      child.on('close', (code) => {
        if (code === 0) {
          resolve(projectPath);
        } else {
          reject(new Error('Ошибка при установке зависимостей'));
        }
      });
      child.on('error', reject);
    });

  });
