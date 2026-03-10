const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const CHANNEL_ID = "1478513342376312982";

async function updateCounter(channel) {
  let lastId;
  let total = 0;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const messages = await channel.messages.fetch(options);
    if (messages.size === 0) break;

    const inscriptions = messages.filter(msg =>
      msg.embeds.length > 0 &&
      msg.embeds[0].title?.includes("Nouvelle inscription")
    );

    total += inscriptions.size;
    lastId = messages.last().id;
  }

  await channel.setName(`📋 inscription (${total})`);
}

client.on('messageCreate', async (message) => {
  if (message.channel.id === CHANNEL_ID) {
    await updateCounter(message.channel);
  }
});

client.once('ready', async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);
  await updateCounter(channel);
});

client.login(process.env.TOKEN);