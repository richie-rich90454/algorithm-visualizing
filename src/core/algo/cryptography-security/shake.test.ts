/**
 * shake.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./shake";
import type { VisualFrame } from "@/types";

const RATE = 4;
const STATE = 8;
function sbox(v: number): number { return (v * 13 + 7) & 0xff; }
function permute(state: number[]): number[] {
    let s = [...state];
    for (let r = 0; r < 3; r += 1) {
        s = s.map((v, i) => (v ^ ((s[(i + 1) % STATE] ?? 0) << 1)) & 0xff);
        s = s.map((v) => sbox(v));
        s = [...s.slice(1), s[0] ?? 0];
    }
    return s;
}
function reference(message: number[], count: number): number[] {
    let state = new Array(STATE).fill(0);
    for (let o = 0; o < message.length; o += RATE) {
        const block = message.slice(o, o + RATE);
        for (let i = 0; i < block.length; i += 1) { state[i] = ((state[i] ?? 0) ^ (block[i] ?? 0)) & 0xff; }
        state = permute(state);
    }
    const out: number[] = [];
    while (out.length < count) {
        out.push(...state.slice(0, RATE));
        state = permute(state);
    }
    return out.slice(0, count);
}
function outputOf(input: unknown): number[] {
    const frames = [...mod.run(input)];
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    return frames[frames.length - 1]?.meta["output"] as number[];
}

describe("SHAKE toy XOF", () => {
    it("matches an independent sponge for several messages and lengths", () => {
        const messages = [[1, 2, 3], [9], [5, 5, 5, 5, 5, 5, 5], [0, 255, 17, 3, 42, 7]];
        for (const message of messages) {
            for (const count of [1, 4, 9, 20, 33]) {
                expect(outputOf({ message, outputBytes: count })).toEqual(reference(message, count));
            }
        }
    });

    it("has the extendable prefix property", () => {
        const message = [3, 1, 4, 1, 5, 9, 2];
        const short = outputOf({ message, outputBytes: 8 });
        const long = outputOf({ message, outputBytes: 40 });
        expect(long.slice(0, 8)).toEqual(short);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
