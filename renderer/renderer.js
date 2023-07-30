const { ipcRenderer } = require('electron');

let selectedFolderPath;

// Function to generate the form elements dynamically based on JSON configuration
function generateFormElements(formConfig) {
  const form = document.getElementById('jsonForm');
  form.innerHTML = ''; // Clear the existing form elements

  formConfig.forEach((field) => {
    const label = document.createElement('label');
    label.setAttribute('for', field.label);
    label.innerText = field.label;

    // Add a tooltip for each label
    label.setAttribute('title', field.info);

    form.appendChild(label);

    // For dropdown fields
    if (field.type === 'dropdown') {
      const dropdown = document.createElement('select');
      dropdown.setAttribute('name', field.label);

      field.options.forEach((option) => {
        const optionElement = document.createElement('option');
        optionElement.setAttribute('value', option.value);
        optionElement.innerText = option.label;
        dropdown.appendChild(optionElement);
      });

      form.appendChild(dropdown);

    } else {
      // For other field types, create regular input elements
      const input = document.createElement('input');
      input.setAttribute('type', field.type);
      input.setAttribute('name', field.label);
      input.setAttribute('placeholder', field.label);

      form.appendChild(input);
    }

    // Add a line break after each input field or dropdown
    form.appendChild(document.createElement('br'));
  });



  const browseButton = document.createElement('button');
  browseButton.setAttribute('type', 'button');
  browseButton.innerText = 'Browse';
  browseButton.addEventListener('click', () => {
    ipcRenderer.send('openFolderDialog');
  });
  form.appendChild(browseButton);

  // Add the "Create JSON" button dynamically
  const createJsonButton = document.createElement('button');
  createJsonButton.setAttribute('type', 'button');
  createJsonButton.innerText = 'Create JSON';
  createJsonButton.addEventListener('click', () => {
    if (!selectedFolderPath) {
      appendToNotification('Please select a folder first.', 'error');
      return;
    }
    const formData = getFormData();
    ipcRenderer.send('writeJson', formData, 'output.json');
  });
  form.appendChild(createJsonButton);

  // Add the "Browse" button dynamically
  function toggleLoader(show) {
    const logArea = document.getElementById('logArea');
    const loader = document.getElementById('processingLoader');
  
    if (show) {
      if (!loader) {
        const loaderDiv = document.createElement('div');
        loaderDiv.classList.add('loader');
        loaderDiv.id = 'processingLoader';
        logArea.appendChild(loaderDiv);
      }
    } else {
      if (loader) {
        logArea.removeChild(loader);
      }
    }
  }
 
}
// Function to get the form data from the rendered form
function getFormData() {
  const form = document.getElementById('jsonForm');
  const formData = new FormData(form);

  // Convert FormData to an object
  const formDataObj = {};
  formData.forEach((value, key) => {
    formDataObj[key] = value;
  });

  return formDataObj;
}


function toggleHelpSection() {
  const helpSection = document.getElementById('helpSection');
  helpSection.classList.toggle('hidden');
}

// Attach a click event listener to the "Help" button
const helpButton = document.getElementById('helpButton');
helpButton.addEventListener('click', () => {
  toggleHelpSection();
});

// Attach a click event listener to the "Close" button inside the Help section
const closeHelpButton = document.getElementById('closeHelpButton');
closeHelpButton.addEventListener('click', () => {
  toggleHelpSection();
});


// Function to show notifications in the log area
function appendToNotification(message, type) {
  const logArea = document.getElementById('logArea');
  const newMessageElement = document.createElement('p');
  newMessageElement.classList.add('log-message', type);
  newMessageElement.innerText = message;
  logArea.appendChild(newMessageElement);
}

// Function to reset the form fields after successful file save
function resetFormFields() {
  const jsonForm = document.getElementById('jsonForm');
  jsonForm.reset();
  const logArea = document.getElementById('logArea');
  logArea.innerHTML = '';
}

// Attach a click event listener to the "Terminate" button
const terminateButton = document.getElementById('terminateButton');
terminateButton.addEventListener('click', () => {
  requestTermination();
});

// Function to request termination of the processes
function requestTermination() {
  toggleLoader(true);
  ipcRenderer.send('terminateProcesses');
  setTimeout(() => {
    window.location.reload();
  }, 5000); // Reload the application after 5 seconds
}

ipcRenderer.on('appStarted', () => {
  // Request the form configuration from the main process
  const formConfig = ipcRenderer.sendSync('getFormConfig');


  

  // Generate the form elements based on the configuration
  generateFormElements(formConfig);
});

ipcRenderer.on('jsonWriteError', (event, error) => {
  appendToNotification(`Error writing JSON file: ${error}`, 'error');
});

ipcRenderer.on('saveFileError', (event, error) => {
  appendToNotification(`Error saving file: ${error}`, 'error');
});

ipcRenderer.on('processTerminated', () => {
  appendToNotification('Process Terminated!!', 'error');
});

ipcRenderer.on('processingFile', (event, fileName) => {
  appendToNotification(fileName, 'info');
});

ipcRenderer.on('logMessage', (event, message, type) => {
  appendToNotification(message, type);
});

ipcRenderer.on('commandExecutionSuccess', (event, saveFilePath) => {
  resetFormFields();
  appendToNotification(`File saved successfully. Path: ${saveFilePath}`, 'success');
});

ipcRenderer.on('folderSelected', (event, folderPath) => {
  selectedFolderPath = folderPath;
});

ipcRenderer.on('folderSelectionError', (event, error) => {
  appendToNotification(`Folder Selection Error: ${error}`, 'error');
});

// Send event to the main process when the renderer process is ready
ipcRenderer.send('appStarted');
