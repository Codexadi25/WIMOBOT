const WebSocket = require('ws');

let wssInstance;

const initializeWebSocketServer = (server) => {
    const wss = new WebSocket.Server({ server });
    wssInstance = wss;

    wss.on('connection', (ws) => {
        console.log('Client connected via WebSocket');
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        ws.on('message', (message) => {
            // Handle incoming messages if needed, e.g., 'ping'
        });
        ws.on('close', () => console.log('Client disconnected'));
    });

    // Keep-alive interval
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping(() => {});
        });
    }, 50000); // Ping every 50 seconds

    wss.on('close', () => {
        clearInterval(interval);
    });

    return wss;
};

// Function to broadcast updates to all connected clients
const broadcastUpdate = (data) => {
    if (wssInstance) {
        const message = JSON.stringify({
            type: 'DATA_UPDATE',
            payload: data,
            timestamp: new Date()
        });

        wssInstance.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
};

module.exports = { initializeWebSocketServer, broadcastUpdate };