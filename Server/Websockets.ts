import { WebSocketServer, WebSocket } from "ws";
import { Server as HTTPServer } from "http";

interface Client {
  ws: WebSocket;
  userId?: string;
  username?: string;
}

let clients: Map<string, Client> = new Map();
let wsServer: WebSocketServer;

export const initializeWebSocketServer = (httpServer: HTTPServer) => {
  wsServer = new WebSocketServer({ server: httpServer });

  wsServer.on("connection", (ws: WebSocket) => {
    console.log("New WebSocket connection established");
    const clientId = generateClientId();

    const client: Client = { ws };
    clients.set(clientId, client);

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "connection",
        message: "Connected to WebSocket server",
        clientId,
      })
    );

    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(clientId, message, client);
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    });

    ws.on("close", () => {
      const username = client.username;
      console.log(`Client ${clientId} (${username}) disconnected`);
      clients.delete(clientId);
      // Broadcast user-left
      broadcastToAll({
        type: "user-left",
        username,
        userId: client.userId,
      });
    });

    ws.on("error", (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
    });
  });

  console.log("WebSocket server initialized");
};

const handleClientMessage = (
  clientId: string,
  message: any,
  client: Client
) => {
  switch (message.type) {
    case "auth":
      // Store user info when they authenticate
      client.userId = String(message.userId);
      client.username = message.username;
      console.log(`User authenticated: ${message.username} (ID: ${message.userId})`);

      // Broadcast user-joined to everyone
      broadcastToAll({
        type: "user-joined",
        username: message.username,
        userId: message.userId,
      });

      // Send current online users list to the newly connected user
      const onlineUsers = getConnectedClients().filter(
        (c) => c.userId && c.connected
      );
      client.ws.send(
        JSON.stringify({
          type: "online-users",
          users: onlineUsers,
        })
      );
      break;

    case "typing":
      // Forward typing indicator to a specific user or group
      if (message.receiverId) {
        broadcastToUser(message.receiverId, {
          type: "typing",
          senderId: client.userId,
          senderName: client.username,
          receiverId: message.receiverId,
        });
      } else if (message.groupId) {
        broadcastToGroup(message.groupId, {
          type: "typing",
          senderId: client.userId,
          senderName: client.username,
          groupId: message.groupId,
        });
      }
      break;

    case "stop-typing":
      if (message.receiverId) {
        broadcastToUser(message.receiverId, {
          type: "stop-typing",
          senderId: client.userId,
          senderName: client.username,
        });
      } else if (message.groupId) {
        broadcastToGroup(message.groupId, {
          type: "stop-typing",
          senderId: client.userId,
          senderName: client.username,
          groupId: message.groupId,
        });
      }
      break;

    default:
      console.log("Unknown message type:", message.type);
  }
};

// Broadcast to all connected clients
export const broadcastToAll = (data: any) => {
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  });
};

// Broadcast to a specific user (by userId)
export const broadcastToUser = (userId: string, data: any) => {
  clients.forEach((client) => {
    if (
      client.userId === String(userId) &&
      client.ws.readyState === WebSocket.OPEN
    ) {
      client.ws.send(JSON.stringify(data));
    }
  });
};

// Broadcast to all members of a group (need member user ids from caller)
export const broadcastToGroup = (groupId: string, data: any) => {
  // This is for typing indicators—actual messages go through REST→broadcastToUser
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN && client.userId) {
      client.ws.send(JSON.stringify(data));
    }
  });
};

// Get all connected clients
export const getConnectedClients = () => {
  return Array.from(clients.values()).map((client) => ({
    userId: client.userId,
    username: client.username,
    connected: client.ws.readyState === WebSocket.OPEN,
  }));
};

// Helper to generate unique client IDs
const generateClientId = (): string => {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
