const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// This uses the port provided by the hosting service (like Render),
// or defaults to 3000 for local development.
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Serve static files (HTML, CSS, client-side JS) from the current directory
app.use(express.static(__dirname));

// Function to read data from the JSON file
const readData = () => {
  const rawData = fs.readFileSync(DATA_FILE);
  return JSON.parse(rawData);
};

// --- THIS IS THE FUNCTION THAT SAVES THE DATA ---
// It takes a JavaScript object and writes it to the data.json file,
// overwriting the previous content.
const writeData = (data) => {
  // Use null, 2 for pretty-printing the JSON
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
};

// Broadcast function to send data to all connected clients
wss.broadcast = function broadcast(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send the initial full dataset to the newly connected client
  try {
    const initialData = readData();
    ws.send(JSON.stringify({ type: 'initial-data', payload: initialData }));
  } catch (error) {
    console.error("Failed to read data file or send initial data:", error);
  }

  // Handle messages from clients
  ws.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      let data = readData();

      // Update data based on the message type from the client
      if (parsedMessage.type === 'update-categories') {
        data.categories = parsedMessage.payload;
      } else if (parsedMessage.type === 'update-pns') {
        data.pnsData = parsedMessage.payload;
      } else if (parsedMessage.type === 'update-users') {
        data.users = parsedMessage.payload;
      }
       
      // --- THIS IS THE LINE THAT EXECUTES THE SAVE ---
      // After the data object is updated in memory, this line calls the
      // writeData function to make the changes permanent in the data.json file.
      writeData(data);

      // Broadcast the complete, updated data to ALL connected clients
      wss.broadcast(JSON.stringify({ type: 'data-updated', payload: data }));

    } catch (e) {
      console.error('Failed to process message or update data:', e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

server.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
  console.log('Open this address in your browser.');
});