import { Player } from "discord-player";
import { PlayCommand } from "../commands/music/play.js";
import { SearchCommand } from "../commands/music/search.js";
import type { SlashCommand } from "../interfaces/slashInterface.js";
import { ChatInputCommandInteraction } from "discord.js";
import { SurroundCommand } from "../commands/music/surround.js";
import { Vaporwave } from "../commands/music/vaporwave.js";

/**
 * Slash command handler
 */
export class SlashHandler {
    private commands: Map<string, SlashCommand>
    private player: Player;

    constructor(playerInstance: Player) {
        this.player = playerInstance;
        this.commands = new Map();
        this.loadCommands();
    }

    private loadCommands() {
        const slashCommands: SlashCommand[] = [
            new PlayCommand(),
            new SearchCommand(),
            new SurroundCommand(),
            new Vaporwave()
        ];

        for (const command of slashCommands) {
            this.commands.set(command.commandName, command);
        }
        console.log(`Loaded ${this.commands.size} slash commands.`);
    }

    /**
     * Get data of all commands
     * @returns Array of command data
     */
    public getAllCommandData() {
        return Array.from(this.commands.values()).map(command => command.data.toJSON());
    }

    /**
     * Executes the slash command
     * @param interaction Discord slash command interaction
     * @returns {Promise<void>}
     */
    public async handle(interaction: ChatInputCommandInteraction): Promise<void> {
        const command = this.commands.get(interaction.commandName);

        if (!command) {
            console.warn(`No handler found for slash command: ${interaction.commandName}`);
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({ content: "Unknown command.", flags: "Ephemeral" });
            } else if (interaction.deferred) {
                 await interaction.followUp({ content: "Unknown command.", flags: "Ephemeral" });
            }
            return;
        }

        try {
            await command.execute(interaction, this.player);
        } catch (error) {
            console.error(`Error executing slash command '${interaction.commandName}':`, error);
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({ content: "An unexpected error occurred while processing your command.", flags: "Ephemeral" });
            } else if (interaction.deferred) {
                await interaction.followUp({ content: "An unexpected error occurred.", flags: "Ephemeral" });
            }
        }
    }
}