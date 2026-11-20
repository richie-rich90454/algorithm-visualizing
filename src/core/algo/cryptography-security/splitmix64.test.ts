/** splitmix64.test.ts - BigInt reference, published vectors, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./splitmix64";
import type { VisualFrame } from "@/types";

const MASK64 = (1n << 64n) - 1n;
const GOLDEN = 0x9e3779b97f4a7c15n;
const MIX1 = 0xbf58476d1ce4e5b9n;
const MIX2 = 0x94d049bb133111ebn;

function reference(seed: number, draws: number): string[] {
    let state = BigInt(seed);
    const out: string[] = [];
    for (let i = 0; i < draws; i += 1) {
        state = (state + GOLDEN) & MASK64;
        let z = state;
        z = ((z ^ (z >> 30n)) * MIX1) & MASK64;
        z = ((z ^ (z >> 27n)) * MIX2) & MASK64;
        out.push((z ^ (z >> 31n)).toString());
    }
    return out;
}

function checkFrames(frames: VisualFrame[], length: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(length);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("splitmix64", () => {
    it("matches an independent BigInt SplitMix64 implementation", () => {
        const input = mod.defaultInput as { seed: number; draws: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.draws);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["outputs"]).toEqual(reference(input.seed, input.draws));
    });

    it("reproduces known SplitMix64 output vectors", () => {
        const frames = [...mod.run({ seed: 0, draws: 4 })];
        const outputs = frames[frames.length - 1]?.meta["outputs"] as string[];
        expect(outputs).toEqual([
            "16294208416658607535",
            "7960286522194355700",
            "487617019471545679",
            "17909611376780542444",
        ]);
    });

    it("is deterministic across runs", () => {
        const a = [...mod.run({ seed: 123, draws: 10 })];
        const b = [...mod.run({ seed: 123, draws: 10 })];
        expect(a[a.length - 1]?.meta["outputs"]).toEqual(b[b.length - 1]?.meta["outputs"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
