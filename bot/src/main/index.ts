import dotenv from "dotenv";
import { GatewayIntentBits } from "discord.js";
import { PlayerClient } from "./playerClient.js";
dotenv.config();

const BOT_TOKENS = process.env.BOT_TOKENS?.split(',').map(t => t.trim()).filter(Boolean) || [];
const CLIENT_IDS = process.env.CLIENT_IDS?.split(',').map(id => id.trim()).filter(Boolean) || [];

if (BOT_TOKENS.length === 0) {
    console.error("Error: BOT_TOKENS environment variable is not set or is empty.");
    process.exit(1);
}
if (CLIENT_IDS.length === 0) {
    console.error("Error: CLIENT_IDS environment variable is not set or is empty.");
    process.exit(1);
}
if (BOT_TOKENS.length !== CLIENT_IDS.length) {
    console.error("Error: The number of BOT_TOKENS does not match the number of CLIENT_IDS.");
    console.error(`BOT_TOKENS count: ${BOT_TOKENS.length}, CLIENT_IDS count: ${CLIENT_IDS.length}`);
    process.exit(1);
}

async function main() {
    const clients: PlayerClient[] = [];

    for (let i = 0; i < BOT_TOKENS.length; i++) {
        const token = BOT_TOKENS[i];
        const clientId = CLIENT_IDS[i];

        try {
            const client = new PlayerClient({
                intents: [
                    GatewayIntentBits.Guilds,
                    GatewayIntentBits.GuildVoiceStates,
                    GatewayIntentBits.GuildMessages,
                    GatewayIntentBits.MessageContent,
                ]
            });

            await client.start(token);
            clients.push(client);
        } catch (error) {
            console.error(`Failed to start bot ${i + 1}/${BOT_TOKENS.length} (Client ID: ${clientId}):`, error);
        }
    }

    if (clients.length === 0) {
        console.error("No bots were successfully started. Exiting.");
        process.exit(1);
    }
}

await main().catch(error => {
    console.error("Unhandled error during bot startup process:", error);
    process.exit(1);
});