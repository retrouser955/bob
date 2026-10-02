import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../../interfaces/slashInterface.js";
import { FilterManger } from "./FilterManager.js";
import { Player } from "discord-player";

export class VolumeCommand implements SlashCommand {
    commandName: string = "volume";

    data = new SlashCommandBuilder()
        .setName(this.commandName)
        .setDescription("Really efficiently change the volume")
        .addIntegerOption((opts) =>
            opts
                .setName("percentage")
                .setDescription("The volume you want from 1 to 100")
                .setMaxValue(100)
                .setMinValue(0)
                .setRequired(true)
        )

    async execute(interaction: ChatInputCommandInteraction, player: Player): Promise<void> {
        const queue = player.nodes.get<{
            changeFilter?: (filterString?: string) => void;
            filterManager: FilterManger
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

        const percentage = interaction.options.getInteger("percentage", true);

        queue.metadata.filterManager.setVolume(percentage);

        void interaction.followUp(
            `🔊 Set the volume ${percentage}%`
        )
    }
}