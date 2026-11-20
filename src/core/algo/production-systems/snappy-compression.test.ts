/**
 * snappy-compression.test.ts - Independent format decoder, round-trip property,
 * frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./snappy-compression";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], byteCount: number): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(byteCount);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(byteCount);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent Snappy raw-block decoder used as a test oracle. */
function decode(stream: number[]): number[] {
    let pos = 0;
    let expected = 0;
    let shift = 0;
    let byte;
    do {
        byte = stream[pos++] ?? 0;
        expected += (byte & 0x7f) * 2 ** shift;
        shift += 7;
    } while ((byte & 0x80) !== 0);
    const out: number[] = [];
    while (pos < stream.length) {
        const tag = stream[pos++] ?? 0;
        const type = tag & 3;
        if (type === 0) {
            const len = (tag >> 2) + 1;
            for (let k = 0; k < len; k += 1) {
                out.push(stream[pos++] ?? 0);
            }
        } else if (type === 1) {
            const len = ((tag >> 2) & 7) + 4;
            const offset = ((tag >> 5) << 8) | (stream[pos++] ?? 0);
            for (let k = 0; k < len; k += 1) {
                out.push(out[out.length - offset] ?? 0);
            }
        } else if (type === 2) {
            const len = (tag >> 2) + 1;
            const offset = (stream[pos++] ?? 0) | ((stream[pos++] ?? 0) << 8);
            for (let k = 0; k < len; k += 1) {
                out.push(out[out.length - offset] ?? 0);
            }
        } else {
            const offset =
                (stream[pos++] ?? 0) |
                ((stream[pos++] ?? 0) << 8) |
                ((stream[pos++] ?? 0) << 16) |
                ((stream[pos++] ?? 0) << 24);
            out.push(out[out.length - offset] ?? 0);
        }
    }
    expect(out.length).toBe(expected);
    return out;
}

function bytesOf(text: string): number[] {
    return Array.from(text, (c) => c.charCodeAt(0) & 0xff);
}

describe("SnappyCompression", () => {
    it("round-trips many inputs through an independent decoder", () => {
        const inputs = [
            "",
            "a",
            "abc",
            "aaaaa",
            "aaaaaaaaaaabbbbbbbbbbcccccccccc",
            "the quick brown fox jumps over the lazy dog the quick brown fox",
            "abracadabra abracadabra abracadabra",
            Array.from({ length: 200 }, (_, i) => String.fromCharCode(97 + (i % 5))).join(""),
        ];
        for (const text of inputs) {
            const frames = [...mod.run({ text })];
            const original = bytesOf(text);
            checkFrames(frames, original.length);
            const meta = frames[frames.length - 1]?.meta;
            const stream = meta?.["compressed"] as number[];
            expect(decode(stream)).toEqual(original);
            expect(meta?.["decompressed"]).toEqual(original);
            expect(meta?.["originalLength"]).toBe(original.length);
        }
    });

    it("writes a varint length prefix, zero for empty input", () => {
        const empty = [...mod.run({ text: "" })].at(-1)?.meta;
        expect(empty?.["compressed"]).toEqual([0]);
        const small = [...mod.run({ text: "abcd" })].at(-1)?.meta;
        expect((small?.["compressed"] as number[])[0]).toBe(4);
        const long = [...mod.run({ bytes: new Array(200).fill(65) })].at(-1)?.meta;
        expect((long?.["compressed"] as number[])[0]).toBe(0xc8);
        expect((long?.["compressed"] as number[])[1]).toBe(0x01);
    });

    it("compresses repetitive data below its original size", () => {
        const frames = [...mod.run({ text: "x".repeat(300) })];
        checkFrames(frames, 300);
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["compressedLength"])).toBeLessThan(300);
        expect(Number(meta?.["ratio"])).toBeLessThan(1);
    });

    it("handles explicit byte arrays", () => {
        const bytes = [0, 1, 2, 3, 4, 5, 255, 128];
        const frames = [...mod.run({ bytes })];
        checkFrames(frames, bytes.length);
        const meta = frames[frames.length - 1]?.meta;
        expect(decode(meta?.["compressed"] as number[])).toEqual(bytes);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
