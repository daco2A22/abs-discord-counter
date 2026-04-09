if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const cors = require("cors"); // ✅ AJOUT
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

// ✅ CORS (important pour Vercel)
app.use(cors());

// ✅ JSON
app.use(express.json());

const INSCRIPTION_CHANNEL_ID = "1478513342376312982";

const DATA_FILE = path.join(__dirname, "registrations.json");

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

/* ----------------------------- */
/* Serveur                       */
/* ----------------------------- */
app.get("/", (req, res) => {
  res.send("Bot running");
});

/* ----------------------------- */
/* API                           */
/* ----------------------------- */

// 🔥 Liste complète
app.get("/api/registrations", (req, res) => {
  res.json({ registrations });
});

// 🔥 Recherche par RSF
app.post("/api/registration/find-by-rsf", (req, res) => {
  try {
    const { rsfProfile } = req.body || {};

    if (!rsfProfile) {
      return res.status(400).json({ error: "Lien RSF requis" });
    }

    const normalize = (v) =>
      (v || "").trim().toLowerCase().replace(/\/$/, "");

    const found = registrations.find(
      (r) => normalize(r.rsfProfile) === normalize(rsfProfile)
    );

    if (!found) {
      return res.status(404).json({ error: "Introuvable" });
    }

    return res.json({ registration: found });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ----------------------------- */
/* Lecture Discord               */
/* ----------------------------- */

function parseRegistration(message) {
  const embed = message.embeds?.[0];
  if (!embed) return null;

  const getField = (name) => {
    const field = embed.fields?.find((f) =>
      (f.name || "").toLowerCase().includes(name)
    );
    return field?.value || "";
  };

  return {
    pseudo: getField("pseudo"),
    nom: getField("nom"),
    discord: getField("discord"),
    nationality: getField("national"),
    languages: getField("langue"),
    experience: getField("niveau"),
    className: getField("classe"),
    car: getField("voiture"),
    rsfProfile: getField("rsf"),
  };
}

async function rebuild() {
  const channel = await client.channels.fetch(INSCRIPTION_CHANNEL_ID);

  const messages = await channel.messages.fetch({ limit: 100 });

  const list = [];

  messages.forEach((msg) => {
    const data = parseRegistration(msg);
    if (data && data.pseudo) {
      list.push(data);
    }
  });

  registrations = list;
  console.log("Registre chargé :", registrations.length);
}

/* ----------------------------- */
/* Events                        */
/* ----------------------------- */

client.once("clientReady", async () => {
  console.log("Bot connecté :", client.user.tag);
  await rebuild();
});

client.on("messageCreate", async (message) => {
  if (message.channel.id !== INSCRIPTION_CHANNEL_ID) return;

  const data = parseRegistration(message);
  if (!data) return;

  registrations.push(data);
});

/* ----------------------------- */
/* Start                         */
/* ----------------------------- */

app.listen(PORT, () => {
  console.log("Web server OK :", PORT);
});

if (!TOKEN) {
  console.error("TOKEN manquant");
  process.exit(1);
}

client.login(TOKEN);
