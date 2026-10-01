import { onStreamExtracted, StreamType, useMainPlayer } from "discord-player";
import { ALL_FORMATS, AudioSample, AudioSampleSink, Input, ReadableStreamSource } from "mediabunny";
import { registerMediabunnyServer, toAvFrame, AvFrameAudioSampleResource } from "@mediabunny/server";
import { PassThrough, Readable } from "stream";
import * as NodeAV from "node-av";

// https://mediabunny.dev/guide/extensions/server#usage
// GPU accelerated decoding only for video >:( Why!!!!
registerMediabunnyServer();

onStreamExtracted(async (stream, _, queue) => {
    if (queue.filters.ffmpeg.filters.length > 0) return stream;
    let webStream: ReadableStream<Uint8Array>;
    let abortController: AbortController;

    if (typeof stream === "string") {
        abortController = new AbortController();
        const response = await fetch(stream, {
            signal: abortController.signal
        });
        if (!response.ok || !response.body) {
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

    let filterApi: NodeAV.FilterAPI = NodeAV.FilterAPI.create([...queue.metadata.filters, "aformat=sample_fmts=s16"].join(","));
    let currentFilterString = "";

    function changeFilter(filterString?: string) {
        const filterStringFmt = !filterString ? "aformat=sample_fmts=s16" : `${filterString},aformat=sample_fmts=s16`;
        if (currentFilterString === filterStringFmt) return;
        const old = filterApi;
        currentFilterString = filterStringFmt;
        filterApi = NodeAV.FilterAPI.create(filterStringFmt);

        setTimeout(() => {
            old?.close()
        }, 200)
    };

    queue.metadata.changeFilter = changeFilter;

    (async () => {
        try {
            for await (const sample of sink.samples()) {
                if (passThrough.destroyed) {
                    sample.close();
                    break;
                }

                const frame = new NodeAV.Frame();
                frame.alloc();

                try {
                    await toAvFrame(sample, frame);

                    for await (const processedFrame of filterApi.frames(frame)) {
                        const mSample = new AudioSample(new AvFrameAudioSampleResource(processedFrame));
                        const pcmBuffer = new Int16Array(mSample.numberOfFrames * mSample.numberOfChannels);
                        try {
                            mSample.copyTo(pcmBuffer, {
                                planeIndex: 0,
                                format: "s16"
                            });
                        } finally {
                            mSample.close();
                        }

                        const isWriteable = passThrough.write(
                            Buffer.from(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength)
                        );

                        if (!isWriteable) {
                            await new Promise((res) => passThrough.once("drain", res));
                        }
                    }
                } catch (err) {
                    frame?.unref();
                } finally {
                    sample.close();
                }
            }
        } catch (error) {
            passThrough.destroy(error);
        } finally {
            passThrough.end();
            filterApi?.close();
        }
    })();

    return {
        stream: passThrough,
        $fmt: StreamType.Raw
    }
})