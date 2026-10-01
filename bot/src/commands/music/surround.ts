import { ChatInputCommandInteraction, GuildMember, MessageFlags, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js";
import { SlashCommand } from "../../interfaces/slashInterface.js";
import { Player } from "discord-player";

export class SurroundCommand implements SlashCommand {
    public readonly commandName: string = "surround";

    public readonly data = new SlashCommandBuilder()
        .setName(this.commandName)
        .setDescription("Toggle 8D audio without re-encoding everything :)");
    
    public async execute(interaction: ChatInputCommandInteraction, player: Player): Promise<void> {
        const queue = player.nodes.get<{
            filters: string[],
            changeFilter?: (filterString?: string) => void;
        }>(interaction.guild.id);

        if(!queue) {
            interaction.reply({
                content: "There is no queue in this server.",
                flags: MessageFlags.Ephemeral
            })
            return;
        }

        const changeFilter = queue.metadata.changeFilter

        if(!changeFilter) {
            interaction.reply({
                content: "No audio is playing right now.",
                flags: MessageFlags.Ephemeral
            })
            return;
        }

        const member = interaction.member instanceof GuildMember ? interaction.member : await interaction.guild.members.fetch(interaction.user.id);

        if(!member.voice.channelId || member.voice.channelId !== interaction.guild.members.me.voice.channelId) {
            interaction.reply({
                content: "You are not in my voice channel",
                flags: MessageFlags.Ephemeral
            })
        }

        await interaction.deferReply();

        const isToggled = queue.metadata.filters.indexOf("apulsator=hz=0.09");

        if(isToggled !== -1) {
            queue.metadata.filters.splice(isToggled, 1);
            changeFilter(queue.metadata.filters.join(","));
            interaction.followUp("🎧 Disabled 8D audio");
        } else {
            queue.metadata.filters.push("apulsator=hz=0.09");
            changeFilter(queue.metadata.filters.join(","));
            interaction.followUp("🎧 Enabled 8D audio");
        }
    }
}