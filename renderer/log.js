const { ipcRenderer } = require('electron');

const logArea = document.getElementById('logArea');

ipcRenderer.on('logMessage', (event, message, type) => {
  appendToLog(message, type);
});

function appendToLog(message, type) {
  const logElement = document.createElement('div');
  logElement.className = `log-item ${type}`;
  logElement.textContent = message;
  logArea.appendChild(logElement);
}
