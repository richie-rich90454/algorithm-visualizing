/** convolutional-code.test.ts - Brute-force ML check, frame shape and termination. */

import { describe, expect, it } from "vitest";
import mod from "./convolutional-code";
import type { VisualFrame } from "@/types";

/** Same encoder, written independently for the reference search. */
function referenceEncode(bits: number[]): number[] {
    let a = 0;
    let b = 0;
    const out: number[] = [];
    for (const bit of [...bits, 0, 0]) {
        out.push(bit ^ a ^ b, bit ^ b);
        b = a;
        a = bit;
    }
    return out;
}

/** Exhaustive maximum-likelihood search over all messages of a given length. */
function bruteForceDecode(received: number[], length: number): number[] {
    let best: number[] = [];
    let bestDistance = Infinity;
    for (let mask = 0; mask < 2 ** length; mask += 1) {
        const candidate: number[] = [];
        for (let i = 0; i < length; i += 1) candidate.push((mask >> (length - 1 - i)) & 1);
        const code = referenceEncode(candidate);
        let distance = 0;
        for (let i = 0; i < received.length; i += 1) distance += code[i] === received[i] ? 0 : 1;
        if (distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
        }
    }
    return best;
}

function checkFrames(frames: VisualFrame[], bits: number): void {
    expect(frames.length).toBe(bits + 4);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Convolutional Code", () => {
    it("recovers every single-bit channel error for the default message", () => {
        const input = mod.defaultInput as { bits: number[]; flips: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.bits.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["decoded"]).toEqual(input.bits);
        expect(finalMeta?.["errors"]).toBe(0);
        const clean = frames[0]?.meta["clean"] as number[];
        expect(clean.length).toBe((input.bits.length + 2) * 2);
    });

    it("matches exhaustive maximum-likelihood decoding for all single flips", () => {
        const bits = [1, 0, 1, 1, 0, 1];
        const clean = referenceEncode(bits);
        for (let flip = 0; flip < clean.length; flip += 1) {
            const received = [...clean];
            received[flip] = 1 - (received[flip] as number);
            const expected = bruteForceDecode(received, bits.length);
            expect(expected).toEqual(bits);
            const frames = [...mod.run({ bits, flips: [flip] })];
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["decoded"]).toEqual(expected);
            expect(finalMeta?.["errors"]).toBe(0);
        }
    });

    it("handles noiseless and empty messages, and terminates", () => {
        const cleanFrames = [...mod.run({ bits: [1, 1, 0], flips: [] })];
        expect(cleanFrames[cleanFrames.length - 1]?.meta["errors"]).toBe(0);
        const emptyFrames = [...mod.run({ bits: [], flips: [] })];
        expect(emptyFrames.length).toBeGreaterThan(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
