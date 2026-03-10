const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const TOKEN = (process.env.TOKEN || "").trim();
const PORT = process.env.PORT || 3000;

const app = express();

app.get("/", (req, res) => {
  res.send("Bot running");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

console.log("TOKEN présent :", !!TOKEN);
console.log("Longueur TOKEN :", TOKEN.length);

if (!TOKEN) {
  console.error("TOKEN manquant.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log(`✅ BOT CONNECTÉ : ${client.user.tag}`);
});

client.on("error", (error) => {
  console.error("Erreur client Discord :", error);
});

client.on("shardError", (error) => {
  console.error("Erreur shard Discord :", error);
});

client.on("warn", (info) => {
  console.warn("WARN Discord :", info);
});

client.on("debug", (msg) => {
  if (
    msg.includes("Preparing") ||
    msg.includes("Identifying") ||
    msg.includes("WebSocket") ||
    msg.includes("session") ||
    msg.includes("heartbeat")
  ) {
    console.log("DEBUG Discord :", msg);
  }
});

client.on("invalidated", () => {
  console.error("Session Discord invalidée.");
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection :", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception :", error);
});

console.log("Tentative de connexion à Discord...");

client.login(TOKEN).then(() => {
  console.log("Login Discord accepté.");
}).catch((error) => {
  console.error("Erreur login Discord :", error);
});

setTimeout(() => {
  console.log("⏱️ Timeout 20s atteint.");
  console.log("Client ready ?", client.isReady());
  console.log("User ?", client.user ? client.user.tag : "aucun");
}, 20000);