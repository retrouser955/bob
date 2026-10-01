import { REST, Routes, Client, GatewayIntentBits } from "discord.js";
import { Player } from "discord-player";
import { SlashHandler } from "../controller/slash.js";

process.loadEnvFile()

const tokens = process.env.BOT_TOKENS?.split(',') || [];
const clientIds = process.env.CLIENT_IDS?.split(',') || [];
const guildIds = process.env.GUILD_IDS?.split(',') || [];

if (tokens.length === 0 || clientIds.length === 0) {
    console.error("Error: BOT_TOKENS and/or CLIENT_IDS environment variables are not set or are empty.");
    process.exit(1);
}
if (tokens.length !== clientIds.length) {
    console.error("Error: The number of BOT_TOKENS does not match the number of CLIENT_IDS.");
    process.exit(1);
}

await (async () => {
    const dummyClient = new Client({ intents: [GatewayIntentBits.Guilds] });
    const player = new Player(dummyClient as any);

    const slashHandler = new SlashHandler(player);
    const commandData = slashHandler.getAllCommandData();

    if (commandData.length === 0) {
        return;
    }

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const clientId = clientIds[i];
        const rest = new REST({ version: '10' }).setToken(token);

        if (guildIds.length > 0) {
            for (const guildId of guildIds) {
                try {
                    await rest.put(
                        Routes.applicationGuildCommands(clientId, guildId),
                        { body: commandData }
                    );
                } catch (error) {
                    console.error(`Failed to register commands for bot ${clientId} in guild ${guildId}`);
                }
            }
        } else {
            try {
                await rest.put(
                    Routes.applicationCommands(clientId),
                    { body: commandData }
                );
            } catch (error) {
                console.error(`Failed to register commands globally for bot ${clientId}`);
            }
        }
    }

    process.exit(0);
})();