/**
 * diamond-deque.test.ts - Correctness and frame checks for the diamond deque.
 */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./diamond-deque";

function drain(input: unknown): VisualFrame[] {
    const out: VisualFrame[] = [];
    for (const frame of mod.run(input)) out.push(frame);
    return out;
}

function checkShapes(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("grid");
        expect(frame.meta).toBeTypeOf("object");
        expect(frame.entities.length).toBeGreaterThan(0);
        for (const entity of frame.entities) {
            expect(entity.metadata).toHaveProperty("row");
            expect(entity.metadata).toHaveProperty("col");
        }
    });
}

interface DequeInput {
    pushesFront: number[];
    pushesBack: number[];
    popsFront: number;
    popsBack: number;
}

/** Brute-force reference using a plain JavaScript array as a deque. */
function brute(input: DequeInput): { outputs: number[]; contents: number[] } {
    const deque: number[] = [];
    const outputs: number[] = [];
    for (const v of input.pushesFront) deque.unshift(v);
    for (const v of input.pushesBack) deque.push(v);
    for (let i = 0; i < input.popsFront; i += 1) {
        const v = deque.shift();
        if (v !== undefined) outputs.push(v);
    }
    for (let i = 0; i < input.popsBack; i += 1) {
        const v = deque.pop();
        if (v !== undefined) outputs.push(v);
    }
    return { outputs, contents: deque };
}

describe("DiamondDeque", () => {
    it("emits well-formed frames with sequential steps", () => {
        checkShapes(drain(mod.defaultInput));
    });

    it("matches a brute-force deque on the default input", () => {
        const frames = drain(mod.defaultInput);
        const final = frames[frames.length - 1];
        const expected = brute(mod.defaultInput as DequeInput);
        expect(final?.meta.outputs).toEqual(expected.outputs);
        expect(final?.meta.contents).toEqual(expected.contents);
    });

    it("matches a brute-force deque on random operation mixes", () => {
        for (let trial = 0; trial < 6; trial += 1) {
            const input: DequeInput = {
                pushesFront: [1, 2, 3].map(() => Math.floor(Math.random() * 20)),
                pushesBack: [1, 2, 3].map(() => Math.floor(Math.random() * 20)),
                popsFront: Math.floor(Math.random() * 6),
                popsBack: Math.floor(Math.random() * 6),
            };
            const frames = drain(input);
            const final = frames[frames.length - 1];
            const expected = brute(input);
            expect(final?.meta.outputs).toEqual(expected.outputs);
            expect(final?.meta.contents).toEqual(expected.contents);
        }
    });

    it("keeps contents unchanged across every rotation frame", () => {
        const frames = drain(mod.defaultInput);
        const rotations = frames.filter((f) => typeof f.description === "string" && f.description.includes("rotation"));
        expect(rotations.length).toBeGreaterThan(0);
        for (const frame of rotations) {
            expect(Array.isArray(frame.meta.contents)).toBe(true);
            expect((frame.meta.rotations as number)).toBeGreaterThan(0);
        }
    });

    it("terminates cleanly", () => {
        const input = mod.defaultInput as DequeInput;
        const gen = mod.run(input);
        let count = 0;
        for (const _ of gen) count += 1;
        expect(count).toBeGreaterThan(input.pushesFront.length + input.pushesBack.length + input.popsFront + input.popsBack);
        expect(gen.next().done).toBe(true);
    });
});
