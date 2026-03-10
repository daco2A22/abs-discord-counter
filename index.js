const express = require("express");
const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  Partials
} = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TOKEN;
const CHANNEL_ID = "1478513342376312982";

const COUNTER_FILE = path.join(__dirname, "counter.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

let counter = 0;
let renameTimeout = null;
let renameInProgress = false;

/* ---------------------------- */
/* Render web server            */
/* ---------------------------- */
app.get("/", (req, res) => {
  res.send("Bot running");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

/* ---------------------------- */
/* Utils                        */
/* ---------------------------- */
function isRegistrationMessage(message) {
  if (!message) return false;
  if (!message.embeds || message.embeds.length === 0) return false;

  const title = message.embeds[0]?.title || "";
  return title.includes("Nouvelle inscription");
}

function getChannelName(count) {
  return `📋 inscription (${count})`;
}

function loadCounterFromFile() {
  try {
    if (!fs.existsSync(COUNTER_FILE)) {
      fs.writeFileSync(COUNTER_FILE, JSON.stringify({ counter: 0 }, null, 2));
      return 0;
    }

    const raw = fs.readFileSync(COUNTER_FILE, "utf8");
    const data = JSON.parse(raw);

    if (typeof data.counter === "number") {
      return data.counter;
    }

    return 0;
  } catch (error) {
    console.error("Erreur lecture counter.json :", error);
    return 0;
  }
}

function saveCounterToFile() {
  try {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify({ counter }, null, 2));
  } catch (error) {
    console.error("Erreur écriture counter.json :", error);
  }
}

async function safeFetchMessage(message) {
  try {
    if (message.partial) {
      return await message.fetch();
    }
    return message;
  } catch (error) {
    return message;
  }
}

/* ---------------------------- */
/* Renommage salon anti-spam    */
/* ---------------------------- */
async function applyChannelRename() {
  if (renameInProgress) return;

  renameInProgress = true;

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error("Salon introuvable pour renommage.");
      return;
    }

    const newName = getChannelName(counter);

    if (channel.name === newName) {
      return;
    }

    await channel.setName(newName);
    console.log(`Salon renommé : ${newName}`);
  } catch (error) {
    console.error("Erreur renommage salon :", error);
  } finally {
    renameInProgress = false;
  }
}

function scheduleChannelRename() {
  if (renameTimeout) {
    clearTimeout(renameTimeout);
  }

  renameTimeout = setTimeout(() => {
    applyChannelRename();
  }, 1500);
}

/* ---------------------------- */
/* Recalcul complet au démarrage*/
/* ---------------------------- */
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
  saveCounterToFile();

  console.log(`Compteur recalculé depuis Discord : ${counter}`);
  scheduleChannelRename();
}

/* ---------------------------- */
/* Discord events               */
/* ---------------------------- */
client.once("clientReady", async () => {
  try {
    console.log(`Connecté en tant que ${client.user.tag}`);

    counter = loadCounterFromFile();
    console.log(`Compteur chargé depuis le fichier : ${counter}`);

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
    saveCounterToFile();
    scheduleChannelRename();

    console.log(`Nouvelle inscription. Total = ${counter}`);
  } catch (error) {
    console.error("Erreur sur messageCreate :", error);
  }
});

client.on("messageDelete", async (message) => {
  try {
    const fullMessage = await safeFetchMessage(message);

    if (fullMessage.channel?.id !== CHANNEL_ID) return;
    if (!isRegistrationMessage(fullMessage)) return;

    counter = Math.max(0, counter - 1);
    saveCounterToFile();
    scheduleChannelRename();

    console.log(`Inscription supprimée. Total = ${counter}`);
  } catch (error) {
    console.error("Erreur sur messageDelete :", error);
  }
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  try {
    const oldFull = await safeFetchMessage(oldMessage);
    const newFull = await safeFetchMessage(newMessage);

    if (newFull.channel?.id !== CHANNEL_ID) return;

    const wasRegistration = isRegistrationMessage(oldFull);
    const isNowRegistration = isRegistrationMessage(newFull);

    if (!wasRegistration && isNowRegistration) {
      counter += 1;
      saveCounterToFile();
      scheduleChannelRename();
      console.log(`Message modifié -> devient inscription. Total = ${counter}`);
      return;
    }

    if (wasRegistration && !isNowRegistration) {
      counter = Math.max(0, counter - 1);
      saveCounterToFile();
      scheduleChannelRename();
      console.log(`Message modifié -> n'est plus une inscription. Total = ${counter}`);
    }
  } catch (error) {
    console.error("Erreur sur messageUpdate :", error);
  }
});

client.on("error", (error) => {
  console.error("Erreur client Discord :", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection :", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception :", error);
});

if (!TOKEN) {
  console.error("TOKEN manquant dans les variables d'environnement.");
  process.exit(1);
}

client.login(TOKEN);