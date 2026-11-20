/**
 * varint-encoding.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { decodeVarint, encodeVarint } from "./varint-encoding";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(rows);
        expect(frame.meta["cols"]).toBe(cols);
    });
}

describe("Variable-Length Integer Encoding", () => {
    it("encodes to the known byte sequences and decodes back", () => {
        expect(encodeVarint(0)).toEqual([0]);
        expect(encodeVarint(127)).toEqual([127]);
        expect(encodeVarint(128)).toEqual([128, 1]);
        expect(encodeVarint(300)).toEqual([0xac, 0x02]);
        expect(encodeVarint(16384)).toEqual([128, 128, 1]);
    });

    it("round-trips exhaustively over many values", () => {
        for (let value = 0; value < 5000; value += 1) {
            expect(decodeVarint(encodeVarint(value))).toBe(value);
        }
        for (const value of [65535, 1_000_000, 2 ** 28 + 7, 2 ** 31 - 1]) {
            expect(decodeVarint(encodeVarint(value))).toBe(value);
        }
    });

    it("emits well-formed frames whose final meta decodes every stream", () => {
        const input = mod.defaultInput as { values: number[] };
        const frames = [...mod.run(input)];
        const cols = Math.max(...input.values.map((v) => encodeVarint(v).length));
        checkFrames(frames, input.values.length, cols);

        const finalMeta = frames[frames.length - 1]!.meta;
        expect(finalMeta["encoded"]).toEqual(input.values.map((v) => encodeVarint(v).join(",")));
        expect(finalMeta["decoded"]).toEqual(input.values);
        expect(finalMeta["totalBytes"]).toBe(
            input.values.reduce((sum, v) => sum + encodeVarint(v).length, 0),
        );

        // Continuation flags match whether more encoded bytes follow.
        const encoded = (finalMeta["encoded"] as string[]).map((stream) => stream.split(",").map(Number));
        encoded.forEach((bytes) => {
            bytes.forEach((byte, i) => {
                expect(byte >= 128).toBe(i < bytes.length - 1);
                expect(byte % 128).toBeLessThan(128);
            });
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
