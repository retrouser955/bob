import { GuildQueue, onStreamExtracted, StreamType, useMainPlayer } from "discord-player";
import { ALL_FORMATS, AudioSample, AudioSampleSink, Input, ReadableStreamSource } from "mediabunny";
import { registerMediabunnyServer, toAvFrame, AvFrameAudioSampleResource } from "@mediabunny/server";
import { PassThrough, Readable } from "stream";
import * as NodeAV from "node-av";
import { FilterManager } from "../commands/music/FilterManager.js";

// https://mediabunny.dev/guide/extensions/server#usage
registerMediabunnyServer();

const OUTPUT_FORMAT = "aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo";

const guildQueueIndexTracker = new WeakMap<GuildQueue, number>();

onStreamExtracted(async (stream, _, queue) => {
    if (queue.filters.ffmpeg.filters.length > 0) return stream;

    const currentIndex = (guildQueueIndexTracker.get(queue) ?? 0) + 1
    guildQueueIndexTracker.set(queue, currentIndex);

    let webStream: ReadableStream<Uint8Array>;
    let abortController: AbortController;
    let sourceReadable: Readable | null = null;

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
        sourceReadable = stream instanceof Readable ? stream : stream.stream;

        webStream = Readable.toWeb(sourceReadable);
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

    if (!queue.metadata.filterManager) {
        queue.setMetadata({
            ...(queue.metadata),
            filterManager: new FilterManager(queue)
        })
    }

    const sink = new AudioSampleSink(audioTrack);

    const initialFilters = [];

    try {
        initialFilters.push((queue.metadata.filterManager as FilterManager)._buildFilterChain());
    } catch {
        // no-op
    } finally {
        initialFilters.push(OUTPUT_FORMAT)
    }

    const init = initialFilters.join(",");

    let filterApi: NodeAV.FilterAPI = NodeAV.FilterAPI.create(init);

    let currentFilterString = init;

    function changeFilter(filterString?: string) {
        const filterStringFmt = !filterString ?
            OUTPUT_FORMAT :
            `${filterString},${OUTPUT_FORMAT}`;
        if (currentFilterString === filterStringFmt) return;
        const old = filterApi;
        currentFilterString = filterStringFmt;
        filterApi = NodeAV.FilterAPI.create(filterStringFmt);

        setTimeout(() => {
            old?.close()
        }, 200)
    };

    queue.setMetadata({
        ...queue.metadata,
        changeFilter
    });

    let isNaturalEnd = true;

    function waitForDrainOrClose(): Promise<void> {
        if (passThrough.destroyed || passThrough.writableEnded) return Promise.resolve();

        const isStale = () =>
            passThrough.destroyed ||
            passThrough.writableEnded ||
            guildQueueIndexTracker.get(queue) !== currentIndex;

        return new Promise((resolve) => {
            const finish = () => {
                clearInterval(poll);
                passThrough.off("drain", finish);
                passThrough.off("close", finish);
                passThrough.off("error", finish);
                resolve();
            };

            const poll = setInterval(() => {
                if(isStale()) {
                    isNaturalEnd = false;
                    finish();
                }
            }, 250)

            passThrough.once("drain", finish);
            passThrough.once("close", finish);
            passThrough.once("error", finish);

            if (passThrough.destroyed || passThrough.writableEnded) finish();
        });
    }

    (async () => {
        let bufferCache: Buffer[] = []
        try {
            for await (using sample of sink.samples()) {
                if (passThrough.destroyed) {
                    sample.close();
                    break;
                }

                using frame = new NodeAV.Frame();
                frame.alloc();

                try {
                    await toAvFrame(sample, frame);

                    for await (using processedFrame of filterApi.frames(frame)) {
                        if (passThrough.destroyed) {
                            processedFrame.unref();
                            break;
                        };
                        using mSample = new AudioSample(new AvFrameAudioSampleResource(processedFrame));
                        let finalBuffer: Buffer;
                        try {
                            const pcmBuffer = new Int16Array(mSample.numberOfFrames * mSample.numberOfChannels);
                            mSample.copyTo(pcmBuffer, {
                                planeIndex: 0,
                                format: "s16"
                            });
                            finalBuffer = Buffer.from(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength);
                        } finally {
                            mSample.close();
                        }

                        bufferCache.push(finalBuffer);

                        if (bufferCache.length >= 3) {
                            const concatBuffer = Buffer.concat(bufferCache);
                            bufferCache = []

                            const isWriteable = passThrough.write(
                                concatBuffer
                            );

                            if (!isWriteable) {
                                await waitForDrainOrClose();
                                if (passThrough.destroyed) break;
                            }
                        }
                    }
                } catch (err) {
                    console.error("[Mediabunny Filter Error]", err);
                    console.error("Filter:", currentFilterString);
                    console.error("Frame:", {
                        sampleRate: frame.sampleRate,
                        channels: frame.channels,
                        format: frame.format,
                        pts: frame.pts
                    });
                } finally {
                    frame?.unref();
                    sample.close();
                }
            }
        } catch (error) {
            passThrough.destroy(error);
        } finally {
            if (bufferCache.length > 0) {
                const concatBuffer = Buffer.concat(bufferCache);
                bufferCache = [];
                passThrough.write(concatBuffer);
            }
            abortController?.abort();
            if(sourceReadable && !sourceReadable.destroyed) {
                sourceReadable.destroy();
            }
            if (isNaturalEnd) {
                passThrough.end();
            } else if (!passThrough.destroyed) {
                passThrough.destroy();
            }
            if (!input.disposed) {
                input.dispose();
            }
            filterApi?.close();
        }
    })();

    return {
        stream: passThrough,
        $fmt: StreamType.Raw
    }
})