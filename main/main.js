const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Read the JSON configuration file for form parameters
function readFormParametersJSON() {
  try {
    const configFilePath = path.join(__dirname, 'form_parameters.json'); // Update the file path here
    const data = fs.readFileSync(configFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading form parameters JSON file:', error);
    return [];
  }
}

const directoryPath = './AnuVikar'; // Replace with your desired directory path

let mainWindow;
let processTerminated = false;

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

  // Send event to renderer process when the main window is created
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('appStarted');
  });
}

function sendNotification(message, type) {
  const notification = new Notification({
    title: 'Electron App',
    body: message,
    icon: 'assets/icons/check-ok.ico',
  });

  notification.show();
}

ipcMain.on('getFormConfig', (event) => {
  const formConfig = readFormParametersJSON();
  event.returnValue = formConfig;
});

ipcMain.on('writeJson', (event, jsonData, filename) => {
  // ... Your existing code ...

  // Split the 'recen' parameter by commas to get individual values
  const recenValues = jsonData['recen'].split(',');

  // Create an array to store the promises for writing files and executing commands
  const processPromises = [];

  // Iterate through each 'recen' value and process data in separate folders
  recenValues.forEach((recenValue) => {
    // Convert recenValue to a number (assuming it's a valid number)
    recenValue = Number(recenValue.trim());

    // Create a new folder path based on the 'recen' value and the modified folder name
    const folderNameWithRecenModified = jsonData['folderNameWithRecen'].replace('%x%', recenValue);
    const folderPathWithRecen = path.join(selectedFolderPath, folderNameWithRecenModified);

    // Update the 'recen' value in the 'jsonData' object for the current folder
    jsonData['recen'] = recenValue.toString(); // Convert back to string as it was split as a string

    // Get the formatted data with updated 'recen' value
    const formattedDataWithRecen = getFormattedDataWithRecen(jsonData);

    // Write the formattedData to the common_input.in file in the new folder
    const filePathWithRecen = path.join(folderPathWithRecen, 'common_input.in');
    const writeFilePromise = fs.promises.writeFile(filePathWithRecen, formattedDataWithRecen);
    const folderNameWithRecenModified1 = jsonData['folderNameWithRecen'].replace('%x%', '*');
    const folderPathWithRecen1 = path.join(selectedFolderPath, folderNameWithRecenModified1);
    // Execute the 'anuvikar' function in the new folder
    const execCommandPromise = new Promise((resolve, reject) => {
      process.chdir(directoryPath);
      exec(`./_build/anuvikar ${path.join(folderPathWithRecen1, '/Pos*')} `, (error, stdout, stderr) => {
        if (processTerminated) {
          event.reply('processTerminated');
          return;
        }

        if (error) {
          reject(`Command Execution Error: ${error}`);
          return;
        }

        const fileNames = stdout.split('\n').filter((line) => line.trim() !== '');

        fileNames.forEach((fileName) => {
          mainWindow.webContents.send('processingFile', fileName);
        });

        sendNotification('Building AnuVikar. Please wait....', 'success');

        const cascadesDataFilePath = path.join(__dirname, '..', 'AnuVikar', 'cascades-data.json');
        fs.readFile(cascadesDataFilePath, 'utf-8', (err, data) => {
          if (processTerminated) {
            event.reply('processTerminated');
            return;
          }

          if (err) {
            reject(`Command 4 Error: ${err}`);
            return;
          }

          fs.writeFile(cascadesDataFilePath, data, (err) => {
            if (processTerminated) {
              event.reply('processTerminated');
              return;
            }

            if (err) {
              reject(`Command 4 Error: ${err}`);
              return;
            }

            sendNotification('Creating JSON....', 'success');

            // Show Save dialog to let the user choose the destination and file name
            dialog
              .showSaveDialog({
                defaultPath: 'output.json',
              })
              .then((saveResult) => {
                if (!saveResult.canceled && saveResult.filePath) {
                  const saveFilePath = saveResult.filePath;

                  fs.copyFile(cascadesDataFilePath, saveFilePath, (error) => {
                    if (processTerminated) {
                      event.reply('processTerminated');
                      return;
                    }

                    if (error) {
                      reject(`Save File Error: ${error}`);
                      return;
                    }

                    sendNotification(`File saved successfully. Path: ${saveFilePath}`, 'success');
                    resolve(saveFilePath);
                  });
                } else {
                  resolve(); // Resolve the promise even if the user canceled the save dialog
                }
              })
              .catch((error) => {
                reject(`Save File Error: ${error.message}`);
              });
          });
        });
      });
    });

    // Add the promises to the processPromises array
    processPromises.push(writeFilePromise, execCommandPromise);
  });

  // Wait for all the promises to complete
  Promise.allSettled(processPromises)
    .then((results) => {
      const successResults = results.filter((result) => result.status === 'fulfilled');
      const filePaths = successResults.map((result) => result.value);

      if (filePaths.length > 0) {
        event.reply('commandExecutionSuccess', filePaths);
      } else {
        event.reply('processTerminated');
      }
    })
    .catch((error) => {
      console.error('Error during processing:', error);
      event.reply('processTerminated');
    });
});

function getFormattedDataWithRecen(jsonData) {
  let formattedData = '';

  // Read the selectedFormattedData from jsonData
  const selectedFormattedData = jsonData['Formatted Data'];

  // Prepare the formattedData based on the selected value
  if (selectedFormattedData === 'LAMMPS-DISP') {
    formattedData = 'LAMMPS-DISP\n';
  } else if (selectedFormattedData === 'LAMMPS-XYZ') {
    formattedData = 'LAMMPS-XYZ\n';
  } else if (selectedFormattedData === 'PARCAS') {
    formattedData = 'PARCAS \n';
  } else if (selectedFormattedData === 'XYZ') {
    formattedData = 'XYZ\n';
  } else if (selectedFormattedData === 'CASCADESDBLIKECOLS') {
    formattedData = 'CASCADESDBLIKECOLS\n';
  } else {
    formattedData = 'Unknown formatted data\n';
  }

  // Add other key-value pairs to formattedData
  Object.entries(jsonData).forEach(([key, value]) => {
    if (key !== 'Formatted Data' && key !== 'folderNameWithRecen') {
      formattedData += `${key} = ${value}\n`;
    }
  });

  return formattedData;
}

// Listen for the termination request from the renderer process
ipcMain.on('terminateProcesses', () => {
  processTerminated = true;
});

ipcMain.on('openFolderDialog', (event) => {
  dialog
    .showOpenDialog({
      properties: ['openDirectory'],
    })
    .then((result) => {
      if (!result.canceled && result.filePaths.length > 0) {
        selectedFolderPath = result.filePaths[0]; // Store the selected folder path
        event.reply('folderSelected', selectedFolderPath); // Send the selected folder path back to the renderer process
      }
    })
    .catch((error) => {
      event.reply('folderSelectionError', error.message);
    });
});

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
