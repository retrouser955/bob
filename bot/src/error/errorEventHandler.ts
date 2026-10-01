import { Player, GuildQueue } from "discord-player";

/**
 * Event handler for errors
 */
export class PlayerEventHandler {
    constructor(private player: Player) { };

    register() {
        this.player.events.on("error", this.onError);
        this.player.events.on("playerError", this.onPlayerError);

        process.on("unhandledRejection", this.onUnhandledRejection);
        process.on("uncaughtException", this.onUncaughtException);
    }

    private onError(queue: GuildQueue, error: Error) {
        console.error(`[Error] Queue: ${queue.guild.name} | ${error.message}`);
        console.log(error)
        if (queue.tracks.size > 0) queue.node.skip();
        else if (!queue.deleted) queue.delete();
    }

    private onPlayerError(queue: GuildQueue, error: Error) {
        console.error(`[Error] Guild: ${queue.guild.name} | ${error.message}`);
        if (queue.tracks.size > 0) queue.node.skip();
        else if (!queue.deleted) queue.delete();
    }

    private onUnhandledRejection(reason: any, promise: Promise<any>) {
        console.error(`[Unhandled Rejection]`, reason, promise);
    }

    private onUncaughtException(error: Error) {
        console.error(`[Uncaught Exception]`, error);
    }
}