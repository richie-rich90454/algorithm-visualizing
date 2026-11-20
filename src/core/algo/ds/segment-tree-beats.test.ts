import { describe, expect, it } from "vitest";
import mod, { beatsChmax, beatsSum, createBeats } from "./segment-tree-beats";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 9);
        expect(frame.meta).toBeDefined();
    });
}

describe("Segment Tree Beats", () => {
    it("emits well-formed frames and terminates", () => {
        const input = mod.defaultInput as { values: number[]; ops: Array<{ op: string }> };
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames, input.values.length);
        expect(frames.length).toBe(input.ops.length + 2);
        expect(generator.next().done).toBe(true);
    });

    it("matches brute-force chmax and sum over randomized operation sequences", () => {
        let seed = 778899;
        const rand = (limit: number): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed % limit;
        };
        for (let trial = 0; trial < 80; trial += 1) {
            const n = 1 + rand(18);
            const initial = Array.from({ length: n }, () => rand(25));
            const tree = createBeats(initial);
            const brute = [...initial];
            for (let step = 0; step < 25; step += 1) {
                const l = rand(n);
                const r = Math.min(n - 1, l + rand(n - l));
                if (rand(2) === 0) {
                    const x = rand(30);
                    beatsChmax(tree, l, r, x);
                    for (let i = l; i <= r; i += 1) {
                        brute[i] = Math.max(brute[i] as number, x);
                    }
                    expect(tree.values).toEqual(brute);
                } else {
                    const expected = brute.slice(l, r + 1).reduce((sum, value) => sum + value, 0);
                    expect(beatsSum(tree, l, r)).toBe(expected);
                }
            }
            expect(beatsSum(tree, 0, n - 1)).toBe(brute.reduce((sum, value) => sum + value, 0));
            expect(tree.values).toEqual(brute);
        }
    });

    it("handles a single element and an update that does nothing", () => {
        const tree = createBeats([5]);
        expect(beatsSum(tree, 0, 0)).toBe(5);
        beatsChmax(tree, 0, 0, 3);
        expect(beatsSum(tree, 0, 0)).toBe(5);
        beatsChmax(tree, 0, 0, 9);
        expect(beatsSum(tree, 0, 0)).toBe(9);
    });
});
