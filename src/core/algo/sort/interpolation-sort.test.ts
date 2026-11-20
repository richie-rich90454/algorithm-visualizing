/** interpolation-sort.test.ts - Brute-force sorting check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./interpolation-sort";

function collect(input: unknown) {
    return [...mod.run(input)];
}

function assertFrameShape(frames: ReturnType<typeof collect>): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((f, index) => {
        expect(f.stepNumber).toBe(index);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.layout).toBe("array");
        expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(f.meta).toBeDefined();
        expect(f.entities.every((e) => e.type === "bar")).toBe(true);
        f.entities.forEach((e) => expect(Number.isFinite(e.value as number)).toBe(true));
    });
}

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 22695477 + 1) >>> 0;
        return s / 0x100000000;
    };
}

describe("InterpolationSort", () => {
    it("yields well-formed frames on the default input and terminates", () => {
        const frames = collect(mod.defaultInput);
        assertFrameShape(frames);
    });

    it("sorts random integer arrays including negatives and duplicates", () => {
        const rnd = seeded(90210);
        for (let t = 0; t < 150; t += 1) {
            const n = 1 + Math.floor(rnd() * 18);
            const input = Array.from({ length: n }, () => Math.floor(rnd() * 25) - 12);
            const frames = collect(input);
            const result = frames[frames.length - 1]!.entities.map((e) => e.value as number);
            expect([...input].sort((a, b) => a - b)).toEqual(result);
        }
    });

    it("handles all-equal values and constant arrays", () => {
        for (const input of [[7, 7, 7, 7], [0], [], [-3, -3, -1, -1]]) {
            const frames = collect(input);
            assertFrameShape(frames);
            const result = frames[frames.length - 1]!.entities.map((e) => e.value as number);
            expect([...input].sort((a, b) => a - b)).toEqual(result);
        }
    });

    it("reports the true range in the metadata", () => {
        const frames = collect([8, 3, 9, 1, 6]);
        const rangeFrame = frames[1]!;
        expect(rangeFrame.meta.min).toBe(1);
        expect(rangeFrame.meta.max).toBe(9);
    });
});
