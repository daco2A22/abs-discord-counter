const express = require("express");
const { Client, GatewayIntentBits, Partials } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = "1478513342376312982";

app.get("/", (req, res) => {
  res.send("Bot running");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

let counter = 0;

function isRegistrationMessage(message) {
  if (!message) return false;
  if (!message.embeds || message.embeds.length === 0) return false;

  const title = message.embeds[0]?.title || "";
  return title.includes("Nouvelle inscription");
}

async function initializeCounter(channel) {
  let lastId;
  let total = 0;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const messages = await channel.messages.fetch(options);
    if (messages.size === 0) break;

    const inscriptions = messages.filter(isRegistrationMessage);
    total += inscriptions.size;
    lastId = messages.last().id;
  }

  counter = total;
  await channel.setName(`📋 inscription (${counter})`);
  console.log(`Compteur initialisé à ${counter}`);
}

client.once("clientReady", async () => {
  try {
    console.log(`Connecté en tant que ${client.user.tag}`);

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error("Salon introuvable.");
      return;
    }

    await initializeCounter(channel);
  } catch (error) {
    console.error("Erreur au démarrage :", error);
  }
});

client.on("messageCreate", async (message) => {
  try {
    if (message.channel?.id !== CHANNEL_ID) return;
    if (!isRegistrationMessage(message)) return;

    counter += 1;
    await message.channel.setName(`📋 inscription (${counter})`);
    console.log(`Nouvelle inscription détectée. Total = ${counter}`);
  } catch (error) {
    console.error("Erreur sur messageCreate :", error);
  }
});

client.on("messageDelete", async (message) => {
  try {
    if (message.partial) {
      try {
        await message.fetch();
      } catch {
        console.log("Impossible de récupérer le message supprimé.");
      }
    }

    if (message.channel?.id !== CHANNEL_ID) return;
    if (!isRegistrationMessage(message)) return;

    counter = Math.max(0, counter - 1);
    const channel = await client.channels.fetch(CHANNEL_ID);
    await channel.setName(`📋 inscription (${counter})`);
    console.log(`Inscription supprimée. Total = ${counter}`);
  } catch (error) {
    console.error("Erreur sur messageDelete :", error);
  }
});

client.on("error", (error) => {
  console.error("Erreur client Discord :", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection :", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception :", error);
});

if (!TOKEN) {
  console.error("TOKEN manquant dans les variables d'environnement.");
  process.exit(1);
}

client.login(TOKEN);