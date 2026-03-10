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

const INSCRIPTION_CHANNEL_ID = "1478513342376312982";
const RECAP_CHANNEL_ID = "1481020395690917971";
const CLASSES_CHANNEL_ID = "1481020577421463712";
const ALERT_CHANNEL_ID = "1481020651044339755";

const DATA_FILE = path.join(__dirname, "registrations.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

let registrations = [];
let updateTimeout = null;
let updateRunning = false;

/* Render web server */
app.get("/", (req, res) => {
  res.send("Bot running");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

/* Storage */
function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ registrations: [] }, null, 2));
      registrations = [];
      return;
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw);
    registrations = Array.isArray(data.registrations) ? data.registrations : [];
  } catch (error) {
    console.error("Erreur lecture registrations.json :", error);
    registrations = [];
  }
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ registrations }, null, 2)
    );
  } catch (error) {
    console.error("Erreur écriture registrations.json :", error);
  }
}

/* Helpers */
async function safeFetchMessage(message) {
  try {
    if (message.partial) return await message.fetch();
    return message;
  } catch {
    return message;
  }
}

function isRegistrationMessage(message) {
  if (!message || !message.embeds || message.embeds.length === 0) return false;
  const title = message.embeds[0]?.title || "";
  return title.includes("Nouvelle inscription");
}

function normalize(value) {
  return (value || "").trim().toLowerCase();
}

function parseRegistrationFromMessage(message) {
  const embed = message.embeds?.[0];
  if (!embed) return null;

  const getField = (names) => {
    const field = embed.fields?.find(f =>
      names.some(n => f.name.toLowerCase().includes(n))
    );
    return field?.value?.trim() || "";
  };

  const pseudo = getField(["pseudo"]);
  const discord = getField(["discord"]);
  const className = getField(["classe", "class"]);
  const car = getField(["voiture", "car"]);

  if (!pseudo || !discord) return null;

  return {
    messageId: message.id,
    pseudo,
    discord,
    className: className || "Non définie",
    car: car || "Non définie",
    createdAt: message.createdTimestamp || Date.now()
  };
}

function isDuplicate(entry) {
  return registrations.some(r =>
    normalize(r.pseudo) === normalize(entry.pseudo) &&
    normalize(r.discord) === normalize(entry.discord)
  );
}

function getChannelCounterName() {
  return `📋 inscription (${registrations.length})`;
}

function buildRecapMessage() {
  if (registrations.length === 0) {
    return [
      "🏁 **ABS French Rally League**",
      "",
      "📊 **Total inscrits : 0**",
      "",
      "_Aucune inscription pour le moment._"
    ].join("\n");
  }

  const lines = registrations
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r, index) => `${index + 1}. **${r.pseudo}** — ${r.car}`);

  return [
    "🏁 **ABS French Rally League**",
    "",
    `📊 **Total inscrits : ${registrations.length}**`,
    "",
    ...lines
  ].join("\n");
}

function buildClassesMessage() {
  if (registrations.length === 0) {
    return [
      "🏁 **Classement par classe**",
      "",
      "_Aucune inscription pour le moment._"
    ].join("\n");
  }

  const grouped = {};

  for (const r of registrations) {
    if (!grouped[r.className]) grouped[r.className] = [];
    grouped[r.className].push(r);
  }

  const sections = Object.keys(grouped)
    .sort((a, b) => a.localeCompare(b))
    .map(className => {
      const drivers = grouped[className]
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((r, index) => `${index + 1}. **${r.pseudo}** — ${r.car}`);

      return [`🏁 **${className}**`, ...drivers].join("\n");
    });

  return ["🏁 **Classement par classe**", "", ...sections].join("\n\n");
}

async function sendDuplicateAlert(entry) {
  try {
    const channel = await client.channels.fetch(ALERT_CHANNEL_ID);
    if (!channel) return;

    await channel.send(
      `⚠️ Doublon détecté : **${entry.pseudo}** (${entry.discord}) est déjà inscrit.`
    );
  } catch (error) {
    console.error("Erreur envoi alerte doublon :", error);
  }
}

/* Managed messages */
async function getOrCreateManagedMessage(channel, type) {
  const marker = type === "recap"
    ? "BOT_RECAP_INSCRIPTIONS"
    : "BOT_CLASSES_INSCRIPTIONS";

  const messages = await channel.messages.fetch({ limit: 20 });
  const existing = messages.find(
    msg => msg.author.id === client.user.id && msg.content.startsWith(`<!-- ${marker} -->`)
  );

  if (existing) return existing;

  return await channel.send(`<!-- ${marker} -->\nInitialisation...`);
}

async function updateManagedMessages() {
  if (updateRunning) return;
  updateRunning = true;

  try {
    const inscriptionChannel = await client.channels.fetch(INSCRIPTION_CHANNEL_ID);
    const recapChannel = await client.channels.fetch(RECAP_CHANNEL_ID);
    const classesChannel = await client.channels.fetch(CLASSES_CHANNEL_ID);

    if (!inscriptionChannel || !recapChannel || !classesChannel) {
      console.error("Un ou plusieurs salons sont introuvables.");
      return;
    }

    const recapMessage = await getOrCreateManagedMessage(recapChannel, "recap");
    const classesMessage = await getOrCreateManagedMessage(classesChannel, "classes");

    const newCounterName = getChannelCounterName();
    if (inscriptionChannel.name !== newCounterName) {
      await inscriptionChannel.setName(newCounterName);
      console.log(`Salon renommé : ${newCounterName}`);
    }

    const recapContent = `<!-- BOT_RECAP_INSCRIPTIONS -->\n${buildRecapMessage()}`;
    const classesContent = `<!-- BOT_CLASSES_INSCRIPTIONS -->\n${buildClassesMessage()}`;

    if (recapMessage.content !== recapContent) {
      await recapMessage.edit(recapContent);
    }

    if (classesMessage.content !== classesContent) {
      await classesMessage.edit(classesContent);
    }

    console.log("Récap et classement mis à jour.");
  } catch (error) {
    console.error("Erreur updateManagedMessages :", error);
  } finally {
    updateRunning = false;
  }
}

function scheduleManagedUpdate() {
  if (updateTimeout) clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    updateManagedMessages();
  }, 1500);
}

/* Full rebuild from Discord */
async function rebuildFromDiscord() {
  try {
    const channel = await client.channels.fetch(INSCRIPTION_CHANNEL_ID);
    if (!channel) {
      console.error("Salon inscription introuvable.");
      return;
    }

    let lastId;
    const found = [];

    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      const messages = await channel.messages.fetch(options);
      if (messages.size === 0) break;

      for (const [, message] of messages) {
        if (!isRegistrationMessage(message)) continue;

        const entry = parseRegistrationFromMessage(message);
        if (!entry) continue;

        const alreadyExists = found.some(r =>
          normalize(r.pseudo) === normalize(entry.pseudo) &&
          normalize(r.discord) === normalize(entry.discord)
        );

        if (!alreadyExists) {
          found.push(entry);
        }
      }

      lastId = messages.last().id;
    }

    found.sort((a, b) => a.createdAt - b.createdAt);
    registrations = found;
    saveData();

    console.log(`Registre reconstruit depuis Discord : ${registrations.length} inscrit(s).`);
    scheduleManagedUpdate();
  } catch (error) {
    console.error("Erreur rebuildFromDiscord :", error);
  }
}

/* Discord events */
client.once("clientReady", async () => {
  try {
    console.log(`Connecté en tant que ${client.user.tag}`);
    loadData();
    console.log(`Données chargées : ${registrations.length} inscrit(s).`);
    await rebuildFromDiscord();
  } catch (error) {
    console.error("Erreur au démarrage :", error);
  }
});

client.on("messageCreate", async (message) => {
  try {
    if (message.channel?.id !== INSCRIPTION_CHANNEL_ID) return;
    if (!isRegistrationMessage(message)) return;

    const entry = parseRegistrationFromMessage(message);
    if (!entry) return;

    if (isDuplicate(entry)) {
      console.log(`Doublon ignoré : ${entry.pseudo} / ${entry.discord}`);
      await sendDuplicateAlert(entry);
      return;
    }

    registrations.push(entry);
    registrations.sort((a, b) => a.createdAt - b.createdAt);
    saveData();
    scheduleManagedUpdate();

    console.log(`Nouvelle inscription : ${entry.pseudo} / ${entry.discord}`);
  } catch (error) {
    console.error("Erreur messageCreate :", error);
  }
});

client.on("messageDelete", async (message) => {
  try {
    const fullMessage = await safeFetchMessage(message);
    if (fullMessage.channel?.id !== INSCRIPTION_CHANNEL_ID) return;
    if (!isRegistrationMessage(fullMessage)) return;

    const entry = parseRegistrationFromMessage(fullMessage);
    if (!entry) {
      await rebuildFromDiscord();
      return;
    }

    const before = registrations.length;
    registrations = registrations.filter(r => r.messageId !== fullMessage.id);

    if (registrations.length === before) {
      await rebuildFromDiscord();
      return;
    }

    saveData();
    scheduleManagedUpdate();
    console.log(`Inscription supprimée : ${entry.pseudo}`);
  } catch (error) {
    console.error("Erreur messageDelete :", error);
  }
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  try {
    const oldFull = await safeFetchMessage(oldMessage);
    const newFull = await safeFetchMessage(newMessage);

    if (newFull.channel?.id !== INSCRIPTION_CHANNEL_ID) return;

    const wasRegistration = isRegistrationMessage(oldFull);
    const isNowRegistration = isRegistrationMessage(newFull);

    if (!wasRegistration && !isNowRegistration) return;

    registrations = registrations.filter(r => r.messageId !== newFull.id);

    if (isNowRegistration) {
      const entry = parseRegistrationFromMessage(newFull);
      if (entry) {
        if (isDuplicate(entry)) {
          await sendDuplicateAlert(entry);
        } else {
          registrations.push(entry);
          registrations.sort((a, b) => a.createdAt - b.createdAt);
        }
      }
    }

    saveData();
    scheduleManagedUpdate();
    console.log("Message d'inscription modifié, données mises à jour.");
  } catch (error) {
    console.error("Erreur messageUpdate :", error);
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