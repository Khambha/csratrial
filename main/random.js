// main/main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const directoryPath = '/home/auproj2023/AUstudProj2023/AnuVikar'; // Replace with your desired directory path

let mainWindow;
let logWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
    },
  });

  mainWindow.loadURL(`file://${__dirname}/../renderer/index.html`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createLogWindow() {
  logWindow = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  logWindow.loadURL(`file://${__dirname}/../renderer/log.html`);

  logWindow.on('closed', () => {
    logWindow = null;
  });
}

function sendLogMessage(message, type) {
  if (logWindow) {
    logWindow.webContents.send('logMessage', message, type);
  }
}

ipcMain.on('writeJson', (event, jsonData, filename) => {
  createLogWindow(); // Create the log window

  const newFileName = generateUniqueFileName(jsonData.author, jsonData.recen, filename);
  const filePath = path.join(directoryPath, newFileName);
  
  event.reply('jsonFilePath', filePath);

  const formattedData = `LAMMPS-DISP
substrate = ${jsonData.substrate}
latticeConstant = ${jsonData.latticeConstant}
recen = ${jsonData.recen}
offset = ${jsonData.offset}
potentialUsed = ${jsonData.potentialUsed}
author = ${jsonData.author}`;

  try {
    fs.writeFileSync(filePath, formattedData);

    process.chdir(directoryPath);
    sendLogMessage(`Changed directory: ${directoryPath}`, 'info');

    dialog.showOpenDialog({
      properties: ['openDirectory'],
    }).then((result) => {
      if (!result.canceled && result.filePaths.length > 0) {
        const selectedFolderPath = result.filePaths[0];

        fs.rename(filePath, 'common_input.in', (error) => {
          if (error) {
            sendLogMessage(`Command 2 Error: ${error}`, 'error');
            return;
          }

          sendLogMessage('Process Started!!!', 'success');

          exec(`./_build/anuvikar ${path.join(selectedFolderPath, 'Pos*')} `, (error, stdout, stderr) => {
            if (error) {
              sendLogMessage(`Command 3 Error: ${error}`, 'error');
              return;
            }

            sendLogMessage('Building AnuVikar. Please wait....', 'success');

            const newFileName = generateUniqueFileName(jsonData.author, jsonData.recen, filename);
            const cascadesDataFilePath = path.join(directoryPath, 'cascades-data.json');
            const newFilePath = path.join(directoryPath, newFileName);

            fs.copyFile(cascadesDataFilePath, newFilePath, (error) => {
              if (error) {
                sendLogMessage(`Command 4 Error: ${error}`, 'error');
                return;
              }

              sendLogMessage('Creating JSON....', 'success');

              dialog.showSaveDialog({
                defaultPath: newFileName,
              }).then((saveResult) => {
                if (!saveResult.canceled && saveResult.filePath) {
                  const saveFilePath = saveResult.filePath;

                  fs.copyFile(newFilePath, saveFilePath, (error) => {
                    if (error) {
                      sendLogMessage(`Save File Error: ${error}`, 'error');
                      return;
                    }

                    sendLogMessage(`File saved successfully.Path: ${saveFilePath}`, 'success');

                    event.reply('commandExecutionSuccess', saveFilePath);
                  });
                }
              }).catch((error) => {
                event.reply('saveFileError', error.message);
              });
            });
          });
        });
      }
    }).catch((error) => {
      event.reply('jsonWriteError', error.message);
    });
  } catch (error) {
    event.reply('jsonWriteError', error.message);
  }
});

function generateUniqueFileName(author, recen, filename) {
  const sanitizedAuthor = author.replace(/\s/g, '_');
  const sanitizedRecen = recen.replace(/\s/g, '_');
  return `${filename}_${sanitizedAuthor}_${sanitizedRecen}.json`;
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
