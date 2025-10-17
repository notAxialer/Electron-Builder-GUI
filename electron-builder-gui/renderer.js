let currentProjectPath = null;
let currentPkg = {};

const TEMPLATES = {
    basic: {
        name: 'my-electron-app',
        productName: 'My Electron App',
        version: '1.0.0',
        description: 'My awesome Electron application',
        main: 'main.js',
        build: {
            appId: 'com.example.myapp',
            productName: 'My Electron App',
            directories: { output: 'dist' },
            win: { target: 'nsis' },
            mac: { target: 'dmg' },
            linux: { target: 'AppImage' }
        }
    },
    'python-backend': {
        name: 'my-app-with-python',
        productName: 'My App (Python Backend)',
        version: '1.0.0',
        description: 'Electron app with local Python backend',
        main: 'main.js',
        build: {
            appId: 'com.example.pythonapp',
            productName: 'My App (Python Backend)',
            extraResources: [{ from: 'backend/', to: 'backend/' }],
            directories: { output: 'dist' },
            win: { target: 'nsis' }
        }
    },
    'frontend-only': {
        name: 'my-frontend-app',
        productName: 'My Frontend App',
        version: '1.0.0',
        description: 'Frontend-only Electron app',
        main: 'main.js',
        build: {
            appId: 'com.example.frontend',
            productName: 'My Frontend App',
            directories: { output: 'dist' },
            win: { target: 'portable' },
            mac: { target: 'zip' }
        }
    }
};

// ЭЛЕМЕНТЫ DOM
const mainMenu = document.getElementById('mainMenu');
const mainInterface = document.getElementById('mainInterface');
const backBtn = document.getElementById('backBtn');
const openExistingBtn = document.getElementById('openExistingBtn');
const createNewBtn = document.getElementById('createNewBtn');
const projectPathEl = document.getElementById('projectPath');
const configSection = document.getElementById('configSection');
const jsonEditor = document.getElementById('jsonEditor');
const logSectionContainer = document.getElementById('logSection');
const buildLogEl = document.getElementById('buildLog');
const openDistBtn = document.getElementById('openDist');

// Модальное окно
function showModal(title, message, buttons = [{ text: "ОК" }]) {
    const overlay = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalButtons = document.getElementById('modalButtons');

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalButtons.innerHTML = '';

    buttons.forEach(btn => {
        const b = document.createElement('button');
        b.textContent = btn.text;
        b.onclick = () => {
            overlay.classList.remove('active');
            if (btn.onClick) btn.onClick();
        };
        modalButtons.appendChild(b);
    });

    overlay.classList.add('active');
}

// Навигация
function showMainMenu() {
    mainMenu.classList.add('active');
    mainInterface.classList.remove('active');
    currentProjectPath = null;
    currentPkg = {};
    projectPathEl.classList.add('hidden');
    logSectionContainer.classList.add('hidden');
    configSection.classList.add('hidden');
    jsonEditor.classList.add('hidden');
    openDistBtn.classList.add('hidden');
}

function showProjectInterface() {
    mainMenu.classList.remove('active');
    mainInterface.classList.add('active');
}

// Инициализация
showMainMenu();

// Обработчики главного меню
openExistingBtn.addEventListener('click', async () => {
    const folder = await window.api.selectFolder();
    if (folder) {
        currentProjectPath = folder;
        projectPathEl.textContent = `Папка: ${folder}`;
        projectPathEl.classList.remove('hidden');
        await loadPackage();
        showProjectInterface();
    }
});

function showPrompt(title, defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modalOverlay');
        const modal = document.createElement('div');
        modal.className = 'modal';

        modal.innerHTML = `
        <h3>${title}</h3>
        <input type="text" id="promptInput" value="${defaultValue}" placeholder="Введите название">
        <div style="margin-top: 15px;">
          <button id="promptOk">OK</button>
          <button id="promptCancel">Отмена</button>
        </div>
      `;

        const input = modal.querySelector('#promptInput');
        const okBtn = modal.querySelector('#promptOk');
        const cancelBtn = modal.querySelector('#promptCancel');

        okBtn.onclick = () => {
            overlay.removeChild(modal);
            overlay.classList.remove('active');
            resolve(input.value.trim());
        };

        cancelBtn.onclick = () => {
            overlay.removeChild(modal);
            overlay.classList.remove('active');
            resolve(null);
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') okBtn.click();
        };

        overlay.appendChild(modal);
        overlay.classList.add('active');
        input.focus();
    });
}

createNewBtn.addEventListener('click', async () => {
    const folder = await window.api.selectFolder();
    if (!folder) return;

    const projectName = await showPrompt("Название проекта:", "my-electron-app");
    if (!projectName) return;

    try {
        showModal("🏗️ Создание", "Создаётся структура проекта...");
        const projectPath = await window.api.createElectronProject(folder, projectName);
        showModal("✅ Готово", "Проект создан! Устанавливаются зависимости...");

        currentProjectPath = projectPath;
        await loadPackage();
        showProjectInterface();
    } catch (err) {
        showModal("❌ Ошибка", "Не удалось создать проект: " + err.message);
    }
});

backBtn.addEventListener('click', () => {
    showMainMenu();
});

// Загрузка и отображение package.json
async function loadPackage() {
    const pkg = await window.api.readPackage(currentProjectPath);
    currentPkg = pkg || {};

    configSection.classList.remove('hidden');
    jsonEditor.classList.remove('hidden');
    logSectionContainer.classList.add('hidden');

    const currentOS = await window.api.getPlatform();
    const winLabel = document.querySelector('label[for="win"]') || document.getElementById('win').parentElement;
    const macLabel = document.querySelector('label[for="mac"]') || document.getElementById('mac').parentElement;
    const linuxLabel = document.querySelector('label[for="linux"]') || document.getElementById('linux').parentElement;

    winLabel.style.display = '';
    macLabel.style.display = '';
    linuxLabel.style.display = '';
    
    if (currentOS === 'win32' || currentOS === 'linux') {
        macLabel.style.display = 'none';
    } else if (currentOS === 'linux') {
        document.getElementById('mac').closest('label').style.display = 'none';
    }

    updateUI();
    updateJsonEditor();
}

function updateUI() {
    document.getElementById('productName').value = currentPkg.build?.productName || currentPkg.productName || '';
    document.getElementById('version').value = currentPkg.version || '1.0.0';
    document.getElementById('iconPath').value = currentPkg.build?.icon || '';
}

function updateJsonEditor() {
    const jsonStr = JSON.stringify(currentPkg, null, 2);
    const highlighted = hljs.highlight(jsonStr, { language: "json" }).value;
    document.getElementById('jsonOutput').innerHTML = highlighted;
}

// Применение шаблона
document.getElementById('applyTemplate').addEventListener('click', () => {
    const templateKey = document.getElementById('template').value;
    const template = TEMPLATES[templateKey];
    currentPkg = { ...currentPkg, ...template };
    if (template.build) {
        currentPkg.build = { ...currentPkg.build, ...template.build };
    }
    updateUI();
    updateJsonEditor();
});

// Сохранение
document.getElementById('saveBtn').addEventListener('click', async () => {
    currentPkg.productName = document.getElementById('productName').value;
    currentPkg.version = document.getElementById('version').value;
    currentPkg.build = currentPkg.build || {};
    currentPkg.build.productName = currentPkg.productName;
    currentPkg.build.icon = document.getElementById('iconPath').value;

    await window.api.savePackage(currentProjectPath, currentPkg);
    showModal("✅ Готово", "Конфигурация сохранена и проверена!");
    updateJsonEditor();
});

// Выбор иконки
document.getElementById('selectIcon').addEventListener('click', async () => {
    const result = await window.api.selectFile([
        { name: 'Images', extensions: ['png', 'ico', 'icns'] }
    ]);
    if (result) {
        const relPath = await window.api.makeRelativePath(currentProjectPath, result);
        document.getElementById('iconPath').value = relPath;
        currentPkg.build = currentPkg.build || {};
        currentPkg.build.icon = relPath;
        updateJsonEditor();
    }
});


// Экспорт профиля
document.getElementById('exportProfile').addEventListener('click', () => {
    const dataStr = JSON.stringify({ pkg: currentPkg }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'electron-profile.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showModal("📤 Экспорт", "Профиль успешно экспортирован!");
});

// Импорт профиля
document.getElementById('importProfile').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
            const data = JSON.parse(text);
            if (data.pkg) {
                currentPkg = data.pkg;
                updateUI();
                updateJsonEditor();
                showModal("📥 Импорт", "Профиль успешно импортирован!");
            } else {
                throw new Error("Файл не содержит pkg");
            }
        } catch (err) {
            showModal("❌ Ошибка", "Не удалось импортировать: " + err.message);
        }
    };
    input.click();
});

// Проверка и установка electron-builder
document.getElementById('checkBtn').addEventListener('click', async () => {
    const hasBuilder = await window.api.checkElectronBuilder(currentProjectPath);
    if (!hasBuilder) {
        showModal("⚠️ Проверка", "electron-builder не найден. Установить?", [
            {
                text: "Да",
                onClick: async () => {
                    try {
                        const success = await window.api.installElectronBuilder(currentProjectPath);
                        if (success) {
                            showModal("✅ Установлено", "electron-builder успешно установлен!");
                        } else {
                            showModal("❌ Ошибка", "Не удалось установить electron-builder.");
                        }
                    } catch (err) {
                        showModal("❌ Ошибка", "Ошибка: " + err.message);
                    }
                }
            },
            { text: "Нет" }
        ]);
    } else {
        showModal("✅ Проверка", "Всё готово к сборке!");
    }
});

// Сборка
document.getElementById('buildBtn').addEventListener('click', async () => {
    const platforms = [];
    if (document.getElementById('win').checked) platforms.push('win');
    if (document.getElementById('mac').checked) platforms.push('mac');
    if (document.getElementById('linux').checked) platforms.push('linux');

    if (platforms.length === 0) {
        showModal("⚠️ Внимание", "Выберите хотя бы одну платформу!");
        return;
    }

    // 1. electron-builder установлен
    const hasBuilder = await window.api.checkElectronBuilder(currentProjectPath);
    if (!hasBuilder) {
        await window.api.installElectronBuilder(currentProjectPath);
    }

    // 2. electron есть в devDependencies
    const electronAdded = await window.api.ensureElectronInDevDeps(currentProjectPath);
    if (electronAdded) {
        showModal("🔧 Настройка", "Добавлен electron в devDependencies...");
    }

    // 3. Установить зависимости
    const hasElectron = await window.api.checkElectronInstalled(currentProjectPath);
    if (!hasElectron) {
        showModal("📦 Установка", "Устанавливаются зависимости проекта...");
        const success = await window.api.installProjectDependencies(currentProjectPath);
        if (!success) {
            showModal("❌ Ошибка", "Не удалось установить зависимости.");
            return;
        }
    }

    // 4. Сборка
    configSection.classList.add('hidden');
    logSectionContainer.classList.remove('hidden');
    buildLogEl.innerHTML = '';

    window.api.onBuildLog((data) => {
        const div = document.createElement("div");
        div.textContent = data;
        buildLogEl.appendChild(div);
        buildLogEl.scrollTop = buildLogEl.scrollHeight;
    });

    window.api.onBuildComplete((success) => {
        showModal(success ? "✅ Сборка завершена" : "❌ Ошибка", success ? "Сборка успешно завершена!" : "Произошла ошибка при сборке.");
        if (success) openDistBtn.classList.remove('hidden');
    });

    await window.api.buildProject(currentProjectPath, platforms);
});

// Открыть dist
openDistBtn.addEventListener('click', () => {
    window.api.openFolder(currentProjectPath + '/dist');
});

