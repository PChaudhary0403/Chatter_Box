import express, { Request, Response } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import auth from "./middleware/auth";
import { createServer } from "http";
import {
  initializeWebSocketServer,
  broadcastToUser,
  broadcastToGroup,
  broadcastToAll,
  getConnectedClients,
} from "./Websockets";

dotenv.config({ path: "../.env" });
const app = express();
const port = process.env.PORT || 4000;
const httpServer = createServer(app);
const prisma = new PrismaClient();
const JWT_SECRET = "Pankaj@0403";

app.use(
  cors({
    origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : "*",
    credentials: true,
  })
);
app.use(express.json());

// ─── Auth Types ──────────────────────────────────────────────
export interface AuthRequest extends Request {
  user: {
    id: number;
    username: string;
  };
}

// ─── LOGIN ───────────────────────────────────────────────────
type loginRequest = { username: string; password: string };
app.post("/login", async (req: Request<{}, {}, loginRequest>, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ message: "User Not Found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid Credentials" });

    const token = jwt.sign(
      { id: user.user_id, username: user.username },
      JWT_SECRET,
      { expiresIn: "24h" }
    );
    return res.status(200).json({
      message: "Login Successful",
      token,
      user: { id: user.user_id, username: user.username },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error during login" });
  }
});

// ─── SIGNUP ──────────────────────────────────────────────────
type signupRequest = { username: string; password: string };
app.post("/signup", async (req: Request<{}, {}, signupRequest>, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return res.status(409).json({ message: "User already exists" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hashedPassword },
    });
    const token = jwt.sign(
      { id: user.user_id, username: user.username },
      JWT_SECRET,
      { expiresIn: "24h" }
    );
    res.json({
      message: "Signup Successful",
      token,
      user: { id: user.user_id, username: user.username },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Error creating user" });
  }
});

// ─── SEARCH HELPER FUNCTIONS ──────────────────────────────────
function getLevenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    const row = dp[i];
    if (row) row[0] = i;
  }
  const firstRow = dp[0];
  if (firstRow) {
    for (let j = 0; j <= n; j++) {
      firstRow[j] = j;
    }
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = dp[i];
      const prevRow = dp[i - 1];
      if (row && prevRow) {
        const valDele = (prevRow[j] ?? 0) + 1;
        const valInst = (row[j - 1] ?? 0) + 1;
        const valSub = (prevRow[j - 1] ?? 0) + cost;
        row[j] = Math.min(valDele, valInst, valSub);
      }
    }
  }

  const finalRow = dp[m];
  return finalRow ? (finalRow[n] ?? m) : m;
}

function calculateSearchScore(username: string, query: string): number {
  const u = username.toLowerCase();
  const q = query.toLowerCase();

  if (u === q) return 100; // Exact match
  if (u.startsWith(q)) return 80 + (q.length / u.length) * 10; // Prefix match
  if (u.includes(q)) return 50 + (q.length / u.length) * 10; // Substring match

  // Levenshtein distance for fuzzy matching (typos)
  const distance = getLevenshteinDistance(u, q);
  const maxLength = Math.max(u.length, q.length);
  const similarity = maxLength === 0 ? 1.0 : 1.0 - distance / maxLength;

  return similarity * 40; // Fuzzy score (max 40)
}

// ─── SEARCH USERS (Fuzzy matching) ───────────────────────────
app.get("/users/search", auth, async (req, res) => {
  const r = req as unknown as AuthRequest;
  const query = (req.query.q as string || "").trim();
  try {
    const allUsers = await prisma.user.findMany({
      where: { user_id: { not: r.user.id } },
      select: { user_id: true, username: true }
    });

    if (!query) {
      return res.json([]);
    }

    const scoredUsers = allUsers.map(user => {
      const score = calculateSearchScore(user.username, query);
      return { ...user, score };
    });

    const results = scoredUsers
      .filter(u => u.score > 15)
      .sort((a, b) => b.score - a.score)
      .map(({ score, ...user }) => user);

    res.json(results);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Error searching users" });
  }
});

// ─── GET ALL USERS ───────────────────────────────────────────
app.get("/users", auth, async (req, res) => {
  const r = req as unknown as AuthRequest;
  try {
    const users = await prisma.user.findMany({
      where: { user_id: { not: r.user.id } },
      select: { user_id: true, username: true },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

// ─── SEND MESSAGE (individual) ──────────────────────────────
app.post("/send", auth, async (req, res) => {
  const r = req as unknown as AuthRequest;
  const { message, receiverId } = req.body;
  if (!message || !receiverId) {
    return res.status(400).json({ message: "Message and receiverId required" });
  }
  try {
    const rxId = parseInt(receiverId);

    // Enforce ChatRequest status is ACCEPTED
    const connection = await prisma.chatRequest.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { senderId: r.user.id, receiverId: rxId },
          { senderId: rxId, receiverId: r.user.id }
        ]
      }
    });

    if (!connection) {
      return res.status(403).json({ message: "You must have an accepted chat request to message this user." });
    }

    const saved = await prisma.message.create({
      data: {
        content: message,
        senderId: r.user.id,
        receiverId: rxId,
      },
      include: { sender: { select: { username: true } } },
    });

    const payload = {
      type: "dm",
      message_id: saved.message_id,
      content: saved.content,
      senderId: saved.senderId,
      senderName: saved.sender.username,
      receiverId: saved.receiverId,
      timestamp: saved.timestamp.toISOString(),
    };

    // Send to both sender and receiver
    broadcastToUser(String(r.user.id), payload);
    broadcastToUser(String(receiverId), payload);

    res.json({ message: "Sent", data: payload });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Error sending message" });
  }
});

// ─── GET DM HISTORY ─────────────────────────────────────────
app.get("/messages/:userId", auth, async (req, res) => {
  const r = req as unknown as AuthRequest;
  const otherUserId = parseInt(req.params.userId);
  try {
    // Only return message history if connected
    const connection = await prisma.chatRequest.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { senderId: r.user.id, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: r.user.id }
        ]
      }
    });

    if (!connection) {
      return res.json([]);
    }

    const messages = await prisma.message.findMany({
      where: {
        groupId: null,
        OR: [
          { senderId: r.user.id, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: r.user.id },
        ],
      },
      include: { sender: { select: { username: true } } },
      orderBy: { timestamp: "asc" },
      take: 200,
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Error fetching messages" });
  }
});

// ─── GET CHAT REQUESTS ───────────────────────────────────────
app.get("/chat-requests", auth, async (req, res) => {
  const r = req as unknown as AuthRequest;
  try {
    const requests = await prisma.chatRequest.findMany({
      where: {
        OR: [
          { senderId: r.user.id },
          { receiverId: r.user.id }
        ]
      }
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: "Error fetching chat requests" });
  }
});

// ─── SEND CHAT REQUEST ───────────────────────────────────────
app.post("/chat-requests", auth, async (req, res) => {
  const r = req as unknown as AuthRequest;
  const { receiverId } = req.body;
  if (!receiverId) {
    return res.status(400).json({ message: "receiverId required" });
  }
  const rxId = parseInt(receiverId);
  if (r.user.id === rxId) {
    return res.status(400).json({ message: "Cannot send request to yourself" });
  }

  try {
    // Check if request already exists in either direction
    const existing = await prisma.chatRequest.findFirst({
      where: {
        OR: [
          { senderId: r.user.id, receiverId: rxId },
          { senderId: rxId, receiverId: r.user.id }
        ]
      }
    });

    if (existing) {
      if (existing.status === "ACCEPTED") {
        return res.status(400).json({ message: "Already connected" });
      }

      // If pending or declined, let's reset to PENDING from current sender
      const updated = await prisma.chatRequest.update({
        where: { request_id: existing.request_id },
        data: {
          senderId: r.user.id,
          receiverId: rxId,
          status: "PENDING"
        }
      });

      // Notify receiver via WebSocket
      broadcastToUser(String(rxId), {
        type: "chat-request-updated",
        request: updated
      });

      return res.json(updated);
    }

    const created = await prisma.chatRequest.create({
      data: {
        senderId: r.user.id,
        receiverId: rxId,
        status: "PENDING"
      }
    });

    // Notify receiver via WebSocket
    broadcastToUser(String(rxId), {
      type: "chat-request-updated",
      request: created
    });

    res.json(created);
  } catch (err) {
    console.error("Send chat request error:", err);
    res.status(500).json({ message: "Error sending chat request" });
  }
});

// ─── RESPOND TO CHAT REQUEST ─────────────────────────────────
app.put("/chat-requests/:requestId", auth, async (req, res) => {
  const r = req as unknown as AuthRequest;
  const requestId = parseInt(req.params.requestId);
  const { status } = req.body; // "ACCEPTED" or "DECLINED"
  if (status !== "ACCEPTED" && status !== "DECLINED") {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    const request = await prisma.chatRequest.findUnique({
      where: { request_id: requestId }
    });

    if (!request) {
      return res.status(404).json({ message: "Chat request not found" });
    }

    if (request.receiverId !== r.user.id) {
      return res.status(403).json({ message: "Not authorized to respond to this request" });
    }

    const updated = await prisma.chatRequest.update({
      where: { request_id: requestId },
      data: { status }
    });

    // Notify sender and receiver via WebSocket
    const payload = {
      type: "chat-request-updated",
      request: updated
    };
    broadcastToUser(String(request.senderId), payload);
    broadcastToUser(String(request.receiverId), payload);

    res.json(updated);
  } catch (err) {
    console.error("Respond chat request error:", err);
    res.status(500).json({ message: "Error updating chat request" });
  }
});

// ─── CREATE GROUP ────────────────────────────────────────────
app.post("/groups", auth, async (req, res) => {
  const r = req as unknown as AuthRequest;
  const { name, description, memberIds } = req.body;
  if (!name) return res.status(400).json({ message: "Group name required" });

  try {
    // Always include creator as a member
    const allMemberIds: number[] = [
      r.user.id,
      ...(memberIds || []).map((id: any) => parseInt(id)),
    ];
    const uniqueIds = [...new Set(allMemberIds)];

    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        createdById: r.user.id,
        members: {
          create: uniqueIds.map((uid) => ({ user_id: uid })),
        },
      },
      include: {
        members: { include: { user: { select: { user_id: true, username: true } } } },
      },
    });

    // Notify all members via websocket
    uniqueIds.forEach((uid) => {
      broadcastToUser(String(uid), {
        type: "group-created",
        group: {
          group_id: group.group_id,
          name: group.name,
          description: group.description,
          members: group.members.map((m) => ({
            user_id: m.user.user_id,
            username: m.user.username,
          })),
        },
      });
    });

    res.json(group);
  } catch (err) {
    console.error("Create group error:", err);
    res.status(500).json({ message: "Error creating group" });
  }
});

// ─── GET MY GROUPS ───────────────────────────────────────────
app.get("/groups", auth, async (req, res) => {
  const r = req as unknown as AuthRequest;
  try {
    const groups = await prisma.group.findMany({
      where: { members: { some: { user_id: r.user.id } } },
      include: {
        members: { include: { user: { select: { user_id: true, username: true } } } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: "Error fetching groups" });
  }
});

// ─── SEND GROUP MESSAGE ──────────────────────────────────────
app.post("/groups/:groupId/messages", auth, async (req, res) => {
  const r = req as unknown as AuthRequest;
  const groupId = parseInt(req.params.groupId);
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: "Message required" });

  try {
    // Verify membership
    const membership = await prisma.groupMember.findUnique({
      where: { group_id_user_id: { group_id: groupId, user_id: r.user.id } },
    });
    if (!membership) return res.status(403).json({ message: "Not a group member" });

    const saved = await prisma.message.create({
      data: { content: message, senderId: r.user.id, groupId },
      include: { sender: { select: { username: true } } },
    });

    const payload = {
      type: "group-message",
      message_id: saved.message_id,
      content: saved.content,
      senderId: saved.senderId,
      senderName: saved.sender.username,
      groupId,
      timestamp: saved.timestamp.toISOString(),
    };

    // Get all members and broadcast
    const members = await prisma.groupMember.findMany({ where: { group_id: groupId } });
    members.forEach((m) => broadcastToUser(String(m.user_id), payload));

    res.json({ message: "Sent", data: payload });
  } catch (err) {
    console.error("Group message error:", err);
    res.status(500).json({ message: "Error sending group message" });
  }
});

// ─── GET GROUP MESSAGE HISTORY ───────────────────────────────
app.get("/groups/:groupId/messages", auth, async (req, res) => {
  const r = req as unknown as AuthRequest;
  const groupId = parseInt(req.params.groupId);
  try {
    const messages = await prisma.message.findMany({
      where: { groupId },
      include: { sender: { select: { username: true } } },
      orderBy: { timestamp: "asc" },
      take: 200,
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Error fetching group messages" });
  }
});

// ─── AI SUMMARIZE MESSAGES (LangChain) ───────────────────────
app.post("/summarize", auth, async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ message: "Messages array required" });
  }

  // Fallback summary helper
  const getFallbackSummary = (note: string) => {
    const usernames = [...new Set(messages.map((m: any) => m.senderName))];
    const msgCount = messages.length;
    const firstTime = messages[0]?.timestamp;
    const lastTime = messages[messages.length - 1]?.timestamp;
    const timeStr = firstTime && lastTime
      ? `${new Date(firstTime).toLocaleTimeString()} — ${new Date(lastTime).toLocaleTimeString()}`
      : "N/A";
    return `📊 **Chat Summary (Statistics)**\n\n• **${msgCount}** messages exchanged between **${usernames.join(", ")}**\n• Time span: ${timeStr}\n• Key topics discussed in the conversation.\n\n_${note}_`;
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({
      summary: getFallbackSummary("Set GEMINI_API_KEY in .env for AI-powered summaries."),
    });
  }

  try {
    const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      apiKey,
      maxRetries: 2,
    });

    const chatText = messages
      .map((m: any) => `${m.senderName}: ${m.content}`)
      .join("\n");

    const prompt = `You are a chat summarizer. Summarize this chat conversation concisely. Highlight key topics, decisions, action items, and important points. Use bullet points and markdown formatting. Keep it under 150 words.\n\nChat:\n${chatText}`;

    const response = await model.invoke(prompt);
    const summary = typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

    res.json({ summary });
  } catch (err: any) {
    console.warn("LangChain summarize failed, using fallback:", err?.message || err);
    res.json({
      summary: getFallbackSummary("AI summarization temporarily unavailable. Showing basic chat statistics."),
    });
  }
});

// ─── ONLINE USERS ────────────────────────────────────────────
app.get("/online", auth, async (req, res) => {
  const clients = getConnectedClients();
  res.json(clients);
});

// ─── START SERVER ────────────────────────────────────────────
httpServer.listen(port, async () => {
  console.log(`🚀 Server is running`);
  initializeWebSocketServer(httpServer);
  console.log("✅ WebSocket server initialized");
});