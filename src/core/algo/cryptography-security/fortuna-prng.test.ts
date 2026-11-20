/**
 * fortuna-prng.test.ts - Independent generator reference, determinism and reseed sensitivity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { mix32 } from "./fortuna-prng";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("bar");
            const w = entity.value as number;
            expect(Number.isInteger(w)).toBe(true);
            expect(w).toBeGreaterThanOrEqual(0);
            expect(w).toBeLessThanOrEqual(0xffffffff);
        }
    });
}

interface Op { type: "reseed" | "generate"; entropy?: number; count?: number }

/** Independent reimplementation of the toy Fortuna rules. */
function reference(seed: number, ops: Op[]): number[] {
    const mix = (v: number): number => {
        let x = v >>> 0;
        x = (x ^ (x >>> 16)) >>> 0;
        x = Math.imul(x, 0x85ebca6b) >>> 0;
        x = (x ^ (x >>> 13)) >>> 0;
        x = Math.imul(x, 0xc2b2ae35) >>> 0;
        return (x ^ (x >>> 16)) >>> 0;
    };
    const pools = new Array<number>(32).fill(0);
    const state = Array.from({ length: 8 }, (_, i) => mix((seed >>> 0) + Math.imul(i + 1, 0x9e3779b9)) >>> 0);
    let reseeds = 0;
    let counter = 0;
    const out: number[] = [];
    ops.forEach((op) => {
        if (op.type === "reseed") {
            reseeds += 1;
            for (let p = 0; p < 32; p += 1) pools[p] = mix(pools[p]! ^ mix(((op.entropy ?? 0) >>> 0) + reseeds * 0x9e3779b9 + p)) >>> 0;
            for (let j = 0; j < 8; j += 1) state[j] = mix(state[j]! ^ pools[j]!) >>> 0;
            counter = 0;
        } else {
            for (let i = 0; i < (op.count ?? 0); i += 1) {
                const index = counter % 8;
                counter += 1;
                const value = mix((state[index]! + counter) >>> 0) >>> 0;
                state[index] = value;
                out.push(value);
            }
        }
    });
    return out;
}

describe("FortunaPrng", () => {
    it("matches an independent generator on the default operations", () => {
        const input = mod.defaultInput as { seed: number; operations: Op[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["outputs"]).toEqual(reference(input.seed, input.operations));
    });

    it("is deterministic and reseed-sensitive", () => {
        const ops: Op[] = [{ type: "generate", count: 5 }, { type: "reseed", entropy: 42 }, { type: "generate", count: 5 }];
        const a = reference(1234, ops);
        const b = reference(1234, ops);
        expect(a).toEqual(b);
        expect(reference(9999, ops)).not.toEqual(a);
        const noReseed = reference(1234, [{ type: "generate", count: 10 }]);
        expect(a).not.toEqual(noReseed);
        const frames = [...mod.run({ seed: 1234, operations: ops })];
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["outputs"]).toEqual(a);
        expect(frames[frames.length - 1]!.meta["reseeds"]).toBe(1);
    });

    it("has an avalanche mixer and produces 32-bit words", () => {
        expect(mix32(0)).toBe(mix32(0));
        const a = mix32(1);
        const b = mix32(2);
        expect(a).not.toBe(b);
        let diff = 0;
        let x = a ^ b;
        while (x) { diff += x & 1; x >>>= 1; }
        expect(diff).toBeGreaterThan(4);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(0xffffffff);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
