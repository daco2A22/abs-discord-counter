if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  Partials
} = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = (process.env.TOKEN || "").trim();

app.use(cors());
app.use(express.json());

const INSCRIPTION_CHANNEL_ID = "1478513342376312982";
const RECAP_CHANNEL_ID = "1481020395690917971";
const CLASSES_CHANNEL_ID = "1481020577421463712";
const ALERT_CHANNEL_ID = "1481020651044339755";

const DATA_FILE = path.join(__dirname, "registrations.json");

/* ----------------------------- */
/* Liste officielle championnat  */
/* ----------------------------- */
const OFFICIAL_CLASSES = [
  {
    id: "R5Rally2",
    label: "R5/Rally2",
    cars: [
      "Skoda Fabia RS Rally2",
      "Toyota GR Yaris Rally2",
      "Hyundai i20 N Rally2",
      "Ford Fiesta Rally2",
      "Skoda Fabia R5 evo",
      "Citroen C3 R5",
      "Ford Fiesta R5",
      "VW Polo GTI R5",
      "Skoda Fabia R5",
      "Hyundai i20 R5",
      "Peugeot 208 T16 R5",
      "Citroen DS3 R5"
    ]
  },
  {
    id: "SuperS2000",
    label: "Super 2000",
    cars: [
      "Peugeot 207 S2000 Evolution Plus",
      "Skoda Fabia S2000 Evo 2",
      "Ford Fiesta Mk VI S2000",
      "Abarth Grande Punto S2000"
    ]
  },
  {
    id: "RGT",
    label: "RGT",
    cars: [
      "Porsche 911 GT3 RS (2010) RGT",
      "Porsche 911 GT3 RS (2007) RGT",
      "Alpine A110 Rally RGT",
      "Fiat 124 Abarth Rally RGT",
      "Aston Martin Vantage RGT",
      "Lotus Exige S RGT"
    ]
  },
  {
    id: "Rally3",
    label: "Rally 3",
    cars: [
      "Renault Clio Rally3",
      "Ford Fiesta Rally3 evo",
      "Ford Fiesta Rally3"
    ]
  },
  {
    id: "A8",
    label: "A8",
    cars: [
      "Subaru Impreza GC8 555 GrpA",
      "BMW M3 E36 GrpA",
      "BMW M3 E30 GrpA",
      "Mitsubishi Lancer Evo II GrpA",
      "Toyota Celica 2000GT(ST185) GrpA",
      "Volvo 240 Turbo GrpA",
      "Audi 200 quattro GrpA",
      "Ford Escort Mk V RS Cosworth GrpA",
      "Lancia Delta HF 4WD GrpA",
      "Mazda 323 BF 4WD Turbo GrpA"
    ]
  },
  {
    id: "N4",
    label: "N4",
    cars: [
      "Mitsubishi Lancer Evo IX N4",
      "Subaru Impreza N14 N4",
      "Seat Leon Cupra R GrpN"
    ]
  },
  {
    id: "R4",
    label: "R4",
    cars: [
      "Mitsubishi Lancer Evo IX R4",
      "Mitsubishi Lancer Evo X R4",
      "Subaru Impreza N15 R4"
    ]
  },
  {
    id: "Rally4",
    label: "Rally 4",
    cars: [
      "Peugeot 208 Rally4",
      "Renault Clio Rally4",
      "Ford Fiesta Rally4"
    ]
  },
  {
    id: "R3",
    label: "R3",
    cars: [
      "Renault Clio III R3",
      "Honda Civic Type R(FN2) R3",
      "Renault Clio IV R3T",
      "Citroen DS3 R3-MAX",
      "Fiat Abarth 500 R3T"
    ]
  },
  {
    id: "SuperS1600",
    label: "Super 1600",
    cars: [
      "Citroen C2 GT S1600"
    ]
  },
  {
    id: "R2",
    label: "R2",
    cars: [
      "Peugeot 208 R2",
      "Citroen C2 R2 Max",
      "Renault Twingo R2 Evo",
      "Ford Fiesta Mk VIII R2",
      "Opel ADAM R2",
      "Ford Fiesta R2"
    ]
  },
  {
    id: "A7",
    label: "A7",
    cars: [
      "Renault Clio 16S Williams GrpA",
      "Peugeot 306 Maxi Kit Car",
      "VW Golf II GTI 16V GrpA",
      "Citroen Xsara Kit Car",
      "Renault 5 GT Turbo GrpA"
    ]
  },
  {
    id: "A6",
    label: "A6",
    cars: [
      "Peugeot 106 Rallye S20 GrpA",
      "Lada Kalina RC2 GrpA"
    ]
  },
  {
    id: "Rally5",
    label: "Rally 5",
    cars: [
      "Renault Clio Rally5"
    ]
  },
  {
    id: "R1",
    label: "R1",
    cars: [
      "Renault Twingo R1",
      "Citroen DS3 R1"
    ]
  }
];

/* ----------------------------- */
/* Client Discord                */
/* ----------------------------- */
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

/* ----------------------------- */
/* Petit serveur local           */
/* ----------------------------- */
app.get("/", (req, res) => {
  res.send("Bot running");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

/* ----------------------------- */
/* Stockage                      */
/* ----------------------------- */
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
    fs.writeFileSync(DATA_FILE, JSON.stringify({ registrations }, null, 2));
  } catch (error) {
    console.error("Erreur écriture registrations.json :", error);
  }
}

/* ----------------------------- */
/* Outils                        */
/* ----------------------------- */
function normalize(value) {
  return (value || "").trim().toLowerCase();
}

function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeRSF(value) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, "");
}

function getOfficialClassOrder() {
  return OFFICIAL_CLASSES.map((c) => c.label);
}

function findOfficialCar(carName) {
  const target = normalizeText(carName);

  for (const classData of OFFICIAL_CLASSES) {
    for (const car of classData.cars) {
      if (normalizeText(car) === target) {
        return {
          classLabel: classData.label,
          carName: car
        };
      }
    }
  }

  return null;
}

function findClassIdByLabel(label) {
  const target = normalizeText(label);
  const found = OFFICIAL_CLASSES.find((c) => normalizeText(c.label) === target);
  return found ? found.id : "";
}

function isRegistrationMessage(message) {
  if (!message || !message.embeds || message.embeds.length === 0) return false;
  const title = (message.embeds[0]?.title || "").toLowerCase();

  return (
    title.includes("nouvelle inscription") ||
    title.includes("new registration") ||
    title.includes("registration") ||
    title.includes("inscription modifiée") ||
    title.includes("registration updated")
  );
}

function parseRegistrationFromMessage(message) {
  const embed = message.embeds?.[0];
  if (!embed) return null;

  const getField = (names) => {
    const field = embed.fields?.find((f) =>
      names.some((name) => ((f.name || "").toLowerCase().includes(name)))
    );
    return field?.value?.trim() || "";
  };

  const pseudo = getField(["pseudo"]);
  const nom = getField(["nom réel", "real name", "nom"]);
  const discord = getField(["discord"]);
  const nationality = getField(["nationalité", "nationality"]);
  const languagesRaw = getField(["langues", "languages"]);
  const experience = getField(["niveau", "level"]);
  const rawCar = getField(["voiture", "car"]);
  const rawClass = getField(["classe", "class"]);
  const rsfProfile = getField(["profil rsf", "rsf"]);

  if (!pseudo && !discord && !rawCar && !rsfProfile) return null;

  const officialCar = rawCar ? findOfficialCar(rawCar) : null;

  const className = officialCar ? officialCar.classLabel : (rawClass || "Non définie");
  const car = officialCar ? officialCar.carName : rawCar;

  return {
    messageId: message.id,
    pseudo,
    nom,
    discord,
    nationality,
    languages: languagesRaw
      ? languagesRaw.split(",").map((x) => x.trim()).filter(Boolean)
      : [],
    experience,
    className,
    classId: findClassIdByLabel(className),
    car,
    rsfProfile,
    createdAt: message.createdTimestamp || Date.now()
  };
}

function isDuplicate(entry, list = registrations) {
  if (entry.rsfProfile) {
    return list.some((r) =>
      r.rsfProfile && normalizeRSF(r.rsfProfile) === normalizeRSF(entry.rsfProfile)
    );
  }

  return list.some((r) =>
    normalize(r.pseudo) === normalize(entry.pseudo) &&
    normalize(r.discord) === normalize(entry.discord)
  );
}

function findRegistrationByRSF(rsfProfile) {
  return registrations.find(
    (r) => r.rsfProfile && normalizeRSF(r.rsfProfile) === normalizeRSF(rsfProfile)
  );
}

function getCounterChannelName() {
  return `📋 inscription (${registrations.length})`;
}

function splitContentIntoChunks(content, maxLength = 1900) {
  const lines = content.split("\n");
  const chunks = [];
  let currentChunk = "";

  for (const line of lines) {
    const candidate = currentChunk ? `${currentChunk}\n${line}` : line;

    if (candidate.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        let remaining = line;
        while (remaining.length > maxLength) {
          chunks.push(remaining.slice(0, maxLength));
          remaining = remaining.slice(maxLength);
        }
        currentChunk = remaining;
      }
    } else {
      currentChunk = candidate;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/* ----------------------------- */
/* Messages                      */
/* ----------------------------- */
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

  const lines = [...registrations]
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
      "📝 **Inscriptions par classe**",
      "",
      "📊 **Total inscrits : 0**",
      "🏷️ **Classes actives : 0**",
      "",
      "🚗 **Voitures utilisées**",
      "_Aucune inscription pour le moment._",
      "",
      "_Aucune inscription pour le moment._"
    ].join("\n");
  }

  const grouped = {};
  const carsCount = {};

  for (const r of registrations) {
    if (!grouped[r.className]) grouped[r.className] = [];
    grouped[r.className].push(r);

    const carName = r.car || "Non définie";
    if (!carsCount[carName]) carsCount[carName] = 0;
    carsCount[carName]++;
  }

  const classOrder = getOfficialClassOrder();
  const orderMap = {};

  classOrder.forEach((name, index) => {
    orderMap[normalizeText(name)] = index;
  });

  const sortedClassNames = Object.keys(grouped).sort((a, b) => {
    const aKey = normalizeText(a);
    const bKey = normalizeText(b);

    const aIndex = orderMap[aKey];
    const bIndex = orderMap[bKey];

    if (aIndex === undefined && bIndex === undefined) {
      return a.localeCompare(b);
    }
    if (aIndex === undefined) return 1;
    if (bIndex === undefined) return -1;

    return aIndex - bIndex;
  });

  const allCars = Object.entries(carsCount)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([car, count], index) => `${index + 1}. **${car}** — ${count}`);

  const sections = sortedClassNames.map((className) => {
    const drivers = grouped[className]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r, index) => `${index + 1}. **${r.pseudo}** — ${r.car}`);

    const count = grouped[className].length;

    return [`🏁 **${className} (${count})**`, ...drivers].join("\n");
  });

  return [
    "📝 **Inscriptions par classe**",
    "",
    `📊 **Total inscrits : ${registrations.length}**`,
    `🏷️ **Classes actives : ${sortedClassNames.length}**`,
    "",
    "🚗 **Voitures utilisées**",
    ...allCars,
    "",
    ...sections
  ].join("\n\n");
}

async function sendDuplicateAlert(entry) {
  try {
    const channel = await client.channels.fetch(ALERT_CHANNEL_ID);
    if (!channel) return;

    await channel.send(
      `⚠️ Doublon détecté : **${entry.pseudo}** (${entry.discord}) est déjà inscrit.`
    );
  } catch (error) {
    console.error("Erreur alerte doublon :", error);
  }
}

function buildRegistrationEmbed(data, isUpdate = false) {
  return {
    title: isUpdate
      ? "✏️ Inscription modifiée / Registration Updated — ABS French Rally League"
      : "🏁 Nouvelle inscription / New Registration — ABS French Rally League",
    color: isUpdate ? 0x3498db : 0xf0b429,
    fields: [
      { name: "👤 Pseudo", value: data.pseudo || "—", inline: true },
      { name: "📛 Nom réel / Real Name", value: data.nom || "—", inline: true },
      { name: "💬 Discord", value: data.discord || "—", inline: true },
      { name: "🌍 Nationalité / Nationality", value: data.nationality || "—", inline: true },
      {
        name: "🗣️ Langues / Languages",
        value: Array.isArray(data.languages) && data.languages.length
          ? data.languages.join(", ")
          : "—",
        inline: true
      },
      { name: "⭐ Niveau / Level", value: data.experience || "—", inline: true },
      { name: "🏎️ Classe / Class", value: data.className || "—", inline: true },
      { name: "🚗 Voiture / Car", value: data.car || "—", inline: true },
      { name: "🔗 Profil RSF", value: data.rsfProfile || "—", inline: false }
    ],
    footer: {
      text: isUpdate
        ? "ABS French Rally League — Modification"
        : "ABS French Rally League — RBR RSF NGP7"
    },
    timestamp: new Date().toISOString()
  };
}

/* ----------------------------- */
/* Messages gérés par le bot     */
/* ----------------------------- */
async function getManagedMessages(channel, marker) {
  const messages = await channel.messages.fetch({ limit: 100 });

  return [...messages.values()]
    .filter(
      (msg) =>
        msg.author.id === client.user.id &&
        msg.content.startsWith(`<!-- ${marker} -->`)
    )
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

async function sendOrSplitMessages(channel, marker, content) {
  const chunks = splitContentIntoChunks(content);
  const botMessages = await getManagedMessages(channel, marker);

  for (let i = 0; i < chunks.length; i++) {
    const newContent = `<!-- ${marker} -->\n${chunks[i]}`;

    if (botMessages[i]) {
      if (botMessages[i].content !== newContent) {
        await botMessages[i].edit(newContent);
      }
    } else {
      await channel.send(newContent);
    }
  }

  for (let i = chunks.length; i < botMessages.length; i++) {
    await botMessages[i].delete().catch(() => {});
  }
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

    const wantedName = getCounterChannelName();
    if (inscriptionChannel.name !== wantedName) {
      await inscriptionChannel.setName(wantedName);
      console.log(`Salon renommé : ${wantedName}`);
    }

    const recapContent = buildRecapMessage();
    const classesContent = buildClassesMessage();

    await sendOrSplitMessages(
      recapChannel,
      "BOT_RECAP_INSCRIPTIONS",
      recapContent
    );

    await sendOrSplitMessages(
      classesChannel,
      "BOT_CLASSES_INSCRIPTIONS",
      classesContent
    );

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

/* ----------------------------- */
/* Reconstruction complète       */
/* ----------------------------- */
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

        if (!isDuplicate(entry, found)) {
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

/* ----------------------------- */
/* API                           */
/* ----------------------------- */
app.get("/api/registrations", (req, res) => {
  res.json({ registrations });
});

app.post("/api/registration/find-by-rsf", (req, res) => {
  try {
    const { rsfProfile } = req.body || {};

    if (!rsfProfile || !rsfProfile.trim()) {
      return res.status(400).json({ error: "Lien RSF requis" });
    }

    const registration = findRegistrationByRSF(rsfProfile);

    if (!registration) {
      return res.status(404).json({ error: "Inscription introuvable" });
    }

    return res.json({ registration });
  } catch (error) {
    console.error("Erreur /api/registration/find-by-rsf :", error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/update-registration", async (req, res) => {
  try {
    const data = req.body || {};

    if (!data.rsfProfile || !data.rsfProfile.trim()) {
      return res.status(400).json({ error: "RSF requis" });
    }

    const existing = findRegistrationByRSF(data.rsfProfile);

    if (!existing) {
      return res.status(404).json({ error: "Inscription introuvable" });
    }

    const channel = await client.channels.fetch(INSCRIPTION_CHANNEL_ID);
    if (!channel) {
      return res.status(500).json({ error: "Salon introuvable" });
    }

    try {
      if (existing.messageId) {
        const oldMessage = await channel.messages.fetch(existing.messageId);
        if (oldMessage) {
          await oldMessage.delete();
        }
      }
    } catch (err) {
      console.log("Ancien message introuvable ou déjà supprimé");
    }

    const embed = buildRegistrationEmbed({
      pseudo: data.pseudo,
      nom: data.nom,
      discord: data.discord,
      nationality: data.nationality,
      languages: Array.isArray(data.languages) ? data.languages : [],
      experience: data.experience,
      className: data.className,
      car: data.car,
      rsfProfile: data.rsfProfile
    }, true);

    await channel.send({ embeds: [embed] });

    await rebuildFromDiscord();

    return res.json({ success: true });
  } catch (err) {
    console.error("Erreur /api/update-registration :", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ----------------------------- */
/* Événements Discord            */
/* ----------------------------- */
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
    if (message.channel?.id !== INSCRIPTION_CHANNEL_ID) return;

    console.log("Suppression détectée → reconstruction complète");
    await rebuildFromDiscord();
  } catch (error) {
    console.error("Erreur messageDelete :", error);
  }
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  try {
    if (newMessage.channel?.id !== INSCRIPTION_CHANNEL_ID) return;

    console.log("Modification détectée → reconstruction complète");
    await rebuildFromDiscord();
  } catch (error) {
    console.error("Erreur messageUpdate :", error);
  }
});

client.on("error", (error) => {
  console.error("Erreur client Discord :", error);
});

client.on("shardError", (error) => {
  console.error("Erreur shard Discord :", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection :", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception :", error);
});

/* ----------------------------- */
/* Démarrage                     */
/* ----------------------------- */
console.log("TOKEN présent :", !!TOKEN);

if (!TOKEN) {
  console.error("TOKEN manquant dans les variables d'environnement.");
  process.exit(1);
}

client.on("debug", (msg) => {
  console.log("DEBUG :", msg);
});

client.on("shardReady", (id) => {
  console.log(`SHARD READY : ${id}`);
});

client.on("shardDisconnect", (event, id) => {
  console.error(`SHARD DISCONNECT : ${id}`, event?.code, event?.reason);
});

client.on("shardReconnecting", (id) => {
  console.log(`SHARD RECONNECTING : ${id}`);
});

client.on("shardResume", (id, replayedEvents) => {
  console.log(`SHARD RESUME : ${id} (${replayedEvents} events)`);
});

console.log("Tentative de connexion à Discord...");

client.login(TOKEN)
  .then(() => {
    console.log("LOGIN OK");
  })
  .catch((error) => {
    console.error("Erreur login Discord :", error);
  });

setTimeout(() => {
  if (!client.isReady()) {
    console.error("Timeout 70s atteint.");
    console.error("Client ready ?", client.isReady());
    console.error("User ?", client.user ? client.user.tag : "aucun");
  }
}, 70000);
