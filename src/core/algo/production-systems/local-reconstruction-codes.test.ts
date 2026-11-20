/**
 * local-reconstruction-codes.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./local-reconstruction-codes";
import type { VisualFrame } from "@/types";

interface Input {
    data: number[];
    groups: number;
    erasures: number[];
}

/** Independent GF(256) multiply by the peasant's algorithm (different from log tables). */
function mul(a: number, b: number): number {
    let x = a & 0xff;
    let y = b & 0xff;
    let result = 0;
    while (y !== 0) {
        if (y & 1) result ^= x;
        const high = x & 0x80;
        x = (x << 1) & 0xff;
        if (high !== 0) x ^= 0x1d;
        y >>= 1;
    }
    return result;
}

/** Independent alpha power (alpha = 2). */
function alpha(n: number): number {
    const count = ((n % 255) + 255) % 255;
    let value = 1;
    for (let i = 0; i < count; i += 1) value = mul(value, 2);
    return value;
}

/** Reference encoder that mirrors the parity equations without sharing code. */
function encode(data: number[], groupCount: number) {
    const locals: number[] = new Array(groupCount).fill(0);
    for (let g = 0; g < groupCount; g += 1) {
        let parity = 0;
        for (let i = g; i < data.length; i += groupCount) parity ^= data[i] ?? 0;
        locals[g] = parity;
    }
    const globals = [0, 0];
    for (let gi = 0; gi < 2; gi += 1) {
        let parity = 0;
        for (let i = 0; i < data.length; i += 1) parity ^= mul(data[i] ?? 0, alpha(gi === 0 ? i : 2 * i));
        globals[gi] = parity;
    }
    return { locals, globals };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Local Reconstruction Codes", () => {
    const input = mod.defaultInput as Input;

    it("computes local and global parities that match an independent encoder", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = encode(input.data, input.groups);
        expect(final?.["groups"]).toEqual(expected.locals);
        expect(final?.["globals"]).toEqual(expected.globals);
    });

    it("recovers every single erasure and every pair of erasures by brute force", () => {
        for (let e = 0; e < input.data.length; e += 1) {
            const frames = [...mod.run({ ...input, erasures: [e] })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["ok"]).toBe(1);
            expect(final?.["recovered"]).toEqual(input.data);
        }
        for (let a = 0; a < input.data.length; a += 1) {
            for (let b = a + 1; b < input.data.length; b += 1) {
                const frames = [...mod.run({ ...input, erasures: [a, b] })];
                checkFrames(frames);
                const final = frames[frames.length - 1]?.meta;
                expect(final?.["ok"]).toBe(1);
                expect(final?.["recovered"]).toEqual(input.data);
            }
        }
    });

    it("restores values that satisfy the original parity equations", () => {
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        const recovered = final?.["recovered"] as number[];
        const rebuilt = encode(recovered, input.groups);
        expect(rebuilt.locals).toEqual(final?.["groups"]);
        expect(rebuilt.globals).toEqual(final?.["globals"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
