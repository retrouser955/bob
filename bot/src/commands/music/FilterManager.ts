import { GuildQueue } from "discord-player";

export const FFMPEG_AUDIO_FILTERS = {
    "Surround": [
        "apulsator=hz=0.09"
    ],

    "8D": [
        "apulsator=mode=sine:hz=0.125:amount=0.6",
        "crossfeed=strength=0.4",
        "aecho=0.9:0.9:40|70:0.15|0.1",
    ],

    "16D": [
        "acrossover=split=250 2500:order=4th[lo][mid][hi];" +
        "[lo]apulsator=mode=sine:hz=0.05:amount=0.3[lo2];" +
        "[mid]apulsator=mode=sine:hz=0.11:amount=0.6:offset_l=0:offset_r=0.5[mid2];" +
        "[hi]apulsator=mode=sine:hz=0.17:amount=0.6:offset_l=0.25:offset_r=0.75[hi2];" +
        "[lo2][mid2][hi2]amix=inputs=3:normalize=0",
        "crossfeed=strength=0.4",
        "lowpass=f=4000",
        "aecho=0.9:0.9:40|70:0.15|0.1",
        "bass=g=2:f=100:w=0.6"
    ],

    Vaporwave: [
        "asetrate=38400",
        "aresample=48000",
        "aecho=0.8:0.88:60:0.4"
    ],

    Nightcore: [
        "asetrate=60000",
        "aresample=48000"
    ],

    LoFi: [
        "asetrate=43200",
        "aresample=48000",
        "extrastereo=m=2.5:c=disabled"
    ],

    Underwater: [
        "lowpass=f=600",
        "aecho=0.8:0.7:40:0.5"
    ]
} as const;

export class FilterManager {
    private _volume = 0.5;

    constructor(private queue: GuildQueue<{ changeFilter?: (filter?: string) => void }>) { };
    
    enabledFilters = new Map<keyof typeof FFMPEG_AUDIO_FILTERS, string>();

    _buildFilterChain() {
        const finalChain = [...this.enabledFilters.values()];

        if (this._volume < 1) finalChain.push(`volume=${this._volume}`)

        return finalChain.join(",");
    }

    isToggled(key: keyof typeof FFMPEG_AUDIO_FILTERS) {
        return this.enabledFilters.has(key);
    }

    toggle(key: keyof typeof FFMPEG_AUDIO_FILTERS) {
        const isToggled = this.enabledFilters.has(key);

        if (isToggled) {
            this.enabledFilters.delete(key);
        } else {
            const filterProperties = FFMPEG_AUDIO_FILTERS[key];
            const joined = filterProperties.join(",");
            this.enabledFilters.set(key, joined);
        }

        if (!this.queue.metadata.changeFilter) throw new Error("No track is currently playing");

        const finalFilterChain = this._buildFilterChain();

        this.queue.metadata.changeFilter(finalFilterChain);

        return isToggled;
    }

    setVolume(volume: number) {
        if (volume < 0 || volume > 100) throw new Error("Volume must be between 1 and 100");

        this._volume = volume / 100;

        if (!this.queue.metadata.changeFilter) throw new Error("No track is currently playing");

        const finalFilterChain = this._buildFilterChain();

        this.queue.metadata.changeFilter(finalFilterChain);
    }

    get volume() {
        return Math.round(this._volume * 100);
    }

    getEnabled() {
        return [...this.enabledFilters.keys()];
    }
}