const { app, BrowserWindow, Tray, Menu, protocol, ipcMain } = require('electron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Request a single instance lock to prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();
let isAppReady = true;
let queuedUrls = [];

if (!gotTheLock) {
  app.quit(); // Exit if another instance is already running
} else {
  app.on('second-instance', (event, commandLine) => {
    const url = commandLine.find(arg => arg.startsWith('myapp://'));
    if (url) {
     processUrl(url); // Handle the URL (e.g., open it in the editor)
    }
   });

  const logFilePath = path.join(app.getPath('appData'), 'app.log');

  function logToFile(message) {
    fs.appendFileSync(logFilePath, message + '\n', 'utf8');
  }

  // Use logToFile function to log messages to a file
  logToFile('This is a log message');

  // Store references
  let mainWindow;
  let tray;

  // Set the app as the default protocol client for 'myapp'
  if (!app.isDefaultProtocolClient('myapp')) {
    app.setAsDefaultProtocolClient('myapp');
  }

  // Function to create the tray icon and menu
  function createTray() {
    tray = new Tray(path.join(__dirname, 'assets', 'icon.png')); // Ensure this path is correct
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Quit', click: () => app.quit() }
    ]);
    tray.setToolTip('Excellerant Revision Manager File Handler');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    });
  }

  app.on('ready', () => {
    // Register custom protocol
    protocol.handle('myapp', (request, callback) => {
      const url = request.url;
      logToFile('Received URL in custom protocol:', url); // Debug: Log the URL received
      try {
        const urlObj = new URL(url);
        const fileName = urlObj.searchParams.get('fileName'); // Get file name
        const editor = urlObj.searchParams.get('editor'); // Get editor path
        logToFile('Parsed fileName in open-url event:', fileName); // Debug: Log parsed file name
        logToFile('Parsed editor in open-url event:', editor); // Debug: Log parsed editor
        if (fileName && editor) {
          // Get the default Downloads directory
          const downloadPath = app.getPath('downloads');
          // Combine the Downloads path with the file name
          const filePath = path.join(downloadPath, fileName);
          logToFile('Full file path:', filePath); // Debug: Log the full file path
          // Check if file exists
          if (fs.existsSync(filePath)) {
            const command = `start "" "${decodeURIComponent(editor)}" "${filePath}"`;
            logToFile('Command to execute in open-url event:', command); // Debug: Log the command to be executed
            exec(command, (err) => {
              if (err) {
                console.error('Error opening file:', err);
              } else {
                logToFile('File opened successfully');
              }
            });
          } else {
            console.error('File does not exist:', filePath);
          }
        } else {
          console.error('Invalid parameters in the URL.');
        }
      } catch (err) {
        console.error('Error parsing URL:', err);
      }
    });
  });

  // Function to register the custom protocol in the Windows registry
  function registerProtocol() {
    const appPath = path.resolve('editor_portable.exe');
    const regScript = `Windows Registry Editor Version 5.00

    [HKEY_CLASSES_ROOT\\myapp]
    @="URL:MyApp Protocol"
    "URL Protocol"=""

    [HKEY_CLASSES_ROOT\\myapp\\shell]

    [HKEY_CLASSES_ROOT\\myapp\\shell\\open]

    [HKEY_CLASSES_ROOT\\myapp\\shell\\open\\command]
    @="\"${appPath}\" \"%1\""
    `;

    const regPath = path.join(app.getPath('temp'), 'myapp-register.reg');
    fs.writeFileSync(regPath, regScript, 'utf8'); // Save registry script in UTF-16 encoding

    exec(`reg import "${regPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error registering protocol:', error.message);
        return;
      }
      logToFile('Protocol registered successfully');
    });
  }

   // Function to add the app to the system's startup (Windows-only)
  function setAppToStart() {
    addToWindowsStartup(); // Only for Windows
  }

  // Windows startup via registry
  function addToWindowsStartup() {
    const appPath = path.join(__dirname, 'editor_portable.exe'); // Path to your app executable
    const regScript = `Windows Registry Editor Version 5.00

      [HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run]
      "MyApp" = "${appPath}"
    `;

    const regPath = path.join(app.getPath('temp'), 'myapp-startup.reg');
    fs.writeFileSync(regPath, regScript, 'utf8');

    exec(`reg import "${regPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error adding app to startup:', error.message);
      } else {
        logToFile('App added to startup successfully');
      }
    });
  }

  // Set a custom path for user data (e.g., cache)
  app.setPath('userData', path.join(app.getPath('appData'), 'myapp_cache'));

  app.whenReady().then(() => {
    registerProtocol(); // Register the custom protocol

    // Parse command line arguments
    const url = process.argv.find(arg => arg.startsWith('myapp://'));
    // Process the URL if it's present
    if (url) {
      console.log(`Protocol URL received: ${url}`);
      processUrl(url); // Custom function to handle the URL
    }

    createTray(); // Create the tray icon
  });

  // Close app when all windows are closed (except on macOS)
  app.on('window-all-closed', () => {
    app.quit();
  });

  // Process custom protocol
  function processUrl(url) {
    if (!url) return;
    logToFile(`Processing URL: ${url}`);
    try {
      const urlObj = new URL(url);
      const fileName = urlObj.searchParams.get('fileName'); // Get file name
      const editor = urlObj.searchParams.get('editor'); // Get editor path
      logToFile('Parsed fileName in open-url event:', fileName); // Debug: Log parsed file name
      logToFile('Parsed editor in open-url event:', editor); // Debug: Log parsed editor
      if (fileName && editor) {
        // Get the default Downloads directory
        const downloadPath = app.getPath('downloads');
        // Combine the Downloads path with the file name
        const filePath = path.join(downloadPath, fileName);
        logToFile('Full file path:', filePath); // Debug: Log the full file path
        // Check if file exists
        if (fs.existsSync(filePath)) {
          const command = `start "" "${decodeURIComponent(editor)}" "${filePath}"`;
          logToFile('Command to execute in open-url event:', command); // Debug: Log the command to be executed
          exec(command, (err) => {
            if (err) {
              console.error('Error opening file:', err);
            } else {
              logToFile('File opened successfully');
            }
          });
        } else {
          console.error('File does not exist:', filePath);
        }
      } else {
        console.error('Invalid parameters in the URL.');
      }
    } catch (err) {
      console.error('Error parsing URL:', err);
    }
  }

  // Reopen the app window on macOS when clicked on the dock icon
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: true,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: true
        },
      });
      mainWindow.loadFile('index.html');
    }
  });
}