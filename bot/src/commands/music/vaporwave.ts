import { ChatInputCommandInteraction, GuildMember, MessageFlags, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js";
import { SlashCommand } from "../../interfaces/slashInterface.js";
import { Player } from "discord-player";

export class Vaporwave implements SlashCommand {
    public readonly commandName: string = "vaporwave";

    public readonly data = new SlashCommandBuilder()
        .setName(this.commandName)
        .setDescription("Toggle Slow+Reverbed audio without re-encoding everything :)");
    
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

        const asetrate = queue.metadata.filters.indexOf("asetrate=48000*0.8");
        const aresample = queue.metadata.filters.indexOf("aresample=48000");
        const echo = queue.metadata.filters.indexOf("aecho=0.8:0.88:60:0.4");

        const isToggled = asetrate !== -1 && aresample !== -1 && echo !== -1;
        
        if(isToggled) {
            queue.metadata.filters.splice(asetrate, 1);
            queue.metadata.filters.splice(aresample, 1);
            queue.metadata.filters.splice(echo, 1);
            changeFilter(queue.metadata.filters.join(","));
            interaction.followUp("🎧 Disabled Slowed+Reverbed");
        } else {
            queue.metadata.filters.push("asetrate=48000*0.8", "aresample=48000", "aecho=0.8:0.88:60:0.4");
            changeFilter(queue.metadata.filters.join(","));
            interaction.followUp("🎧 Enabled Slowed+Reverbed");
        }
    }
}