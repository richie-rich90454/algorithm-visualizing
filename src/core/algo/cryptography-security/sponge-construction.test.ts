/**
 * sponge-construction.test.ts - Absorb/squeeze reference, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./sponge-construction";
import type { VisualFrame } from "@/types";

const LANES = 4;
const RATE = 2;

function permute(state: number[]): number[] {
    const mixed = state.map((value, i) => {
        let x = (value ^ ((i + 1) * 0x11111111)) >>> 0;
        x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0;
        const shift = (i + 1) % 32;
        return ((x << shift) | (x >>> (32 - shift))) >>> 0;
    });
    return mixed.map((value, i) => (value + (mixed[(i + 1) % LANES] ?? 0)) >>> 0);
}

function sponge(message: number[], outputBlocks: number, domain: number): number[] {
    const padded = [...message, domain >>> 0];
    while (padded.length % RATE !== 0) {
        padded.push(0);
    }
    let state = new Array<number>(LANES).fill(0);
    for (let i = 0; i < padded.length; i += RATE) {
        state = state.slice();
        state[0] = (state[0]! ^ (padded[i] ?? 0)) >>> 0;
        state[1] = (state[1]! ^ (padded[i + 1] ?? 0)) >>> 0;
        state = permute(state);
    }
    const output: number[] = [];
    for (let b = 0; b < outputBlocks; b += 1) {
        output.push(state[0] ?? 0, state[1] ?? 0);
        state = permute(state);
    }
    return output;
}

function checkFrames(frames: VisualFrame[], rounds: number): void {
    expect(frames.length).toBe(rounds + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2 * rounds);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("SpongeConstruction", () => {
    it("matches an independent absorb-and-squeeze reference", () => {
        const cases = [
            { message: [65, 66, 67, 68, 69], outputBlocks: 2, domain: 1 },
            { message: [1, 2, 3, 4], outputBlocks: 3, domain: 0 },
            { message: [255], outputBlocks: 1, domain: 7 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const blocks = Math.ceil((input.message.length + 1) / RATE);
            checkFrames(frames, blocks + input.outputBlocks);
            const expected = sponge(input.message, input.outputBlocks, input.domain);
            const digest = (frames[frames.length - 1]?.meta["digest"] as string[]).map(Number);
            expect(digest).toEqual(expected);
        }
    });

    it("produces different output lanes for different messages", () => {
        const a = [...mod.run({ message: [1, 2, 3], outputBlocks: 2 })].at(-1)?.meta["digest"];
        const b = [...mod.run({ message: [1, 2, 4], outputBlocks: 2 })].at(-1)?.meta["digest"];
        expect(a).not.toEqual(b);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
