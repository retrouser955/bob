import { onStreamExtracted, StreamType, useMainPlayer } from "discord-player";
import { ALL_FORMATS, AudioSampleSink, Input, ReadableStreamSource } from "mediabunny";
import { registerMediabunnyServer } from "@mediabunny/server";
import { PassThrough, Readable } from "stream";

// https://mediabunny.dev/guide/extensions/server#usage
// GPU accelerated decoding only for video >:( Why!!!!
registerMediabunnyServer();

onStreamExtracted(async (stream, _, queue) => {
    if (queue.filters.ffmpeg.filters.length > 0) return stream;
    let webStream: ReadableStream<Uint8Array>;
    let abortController: AbortController;

    if(typeof stream === "string") {
        abortController = new AbortController();
        const response = await fetch(stream, {
            signal: abortController.signal
        });
        if(!response.ok || !response.body) {
            const player = useMainPlayer();

            player.debug(`[Mediabunny]: Failed to fetch web stream using fetch. Status code ${response.status}`);

            return stream;
        }

        webStream = response.body;
    } else {
        const inputStream = stream instanceof Readable ? stream : stream.stream;

        webStream = Readable.toWeb(inputStream);
    }

    const input = new Input({
        source: new ReadableStreamSource(webStream),
        formats: ALL_FORMATS
    })

    const audioTrack = await input.getPrimaryAudioTrack();
    const passThrough = new PassThrough({
        destroy(error, callback) {
            abortController?.abort();
            callback(error);
        }
    });
    const sink = new AudioSampleSink(audioTrack);

    ; (async () => {
        try {
            for await (const sample of sink.samples()) {
                if (passThrough.destroyed) {
                    // downstream has closed. stop decoding
                    sample.close();
                    break;
                }

                const buffer = new Int16Array(sample.numberOfFrames * sample.numberOfChannels);

                try {
                    sample.copyTo(buffer, {
                        planeIndex: 0,
                        format: "s16"
                    })
                } finally {
                    sample.close();
                }

                const isWriteable = passThrough.write(
                    Buffer.from(
                        buffer.buffer,
                        buffer.byteOffset,
                        buffer.byteLength
                    )
                );

                if (!isWriteable) await new Promise((res) => passThrough.once("drain", res));
            }

            passThrough.end();
        } catch (error) {
            passThrough.destroy(error);
        }
    })()

    return {
        stream: passThrough,
        $fmt: StreamType.Raw
    }
})