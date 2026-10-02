import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../../interfaces/slashInterface.js";
import { FFMPEG_AUDIO_FILTERS, FilterManager } from "./FilterManager.js";
import { Player } from "discord-player";

export class Filter implements SlashCommand {
    commandName: string = "filter";

    data = new SlashCommandBuilder()
        .setName(this.commandName)
        .setDescription("Change FFmpeg filters without re-encoding :)")
        .addStringOption((opt) =>
            opt
                .setName("name")
                .setDescription("The name of the filter")
                .setChoices(
                    Object.keys(FFMPEG_AUDIO_FILTERS).map(v => ({
                        name: v,
                        value: v
                    }))
                )
                .setRequired(true)
        )

    async execute(interaction: ChatInputCommandInteraction, player: Player): Promise<void> {
        const queue = player.nodes.get<{
            changeFilter?: (filterString?: string) => void;
            filterManager: FilterManager
        }>(interaction.guild.id);

        if (!queue) {
            void interaction.reply({
                content: "There is no queue in this server.",
                flags: MessageFlags.Ephemeral
            })
            return;
        }

        const changeFilter = queue.metadata.changeFilter

        if (!changeFilter) {
            void interaction.reply({
                content: "No audio is playing right now.",
                flags: MessageFlags.Ephemeral
            })
            return;
        }

        const member = await interaction.guild.members.fetch(interaction.user.id);

        if (!member.voice.channelId || member.voice.channelId !== interaction.guild.members.me.voice.channelId) {
            interaction.reply({
                content: "You are not in my voice channel",
                flags: MessageFlags.Ephemeral
            })
        }

        await interaction.deferReply();

        const filterName = interaction.options.getString("name", true) as keyof typeof FFMPEG_AUDIO_FILTERS;

        const wasEnabled = queue.metadata.filterManager.toggle(filterName);

        void interaction.followUp(
            `🎧 ${wasEnabled ? "Disabled" : "Enabled"} ${filterName} audio filter`
        )
    }
}