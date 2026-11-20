/** visual-cryptography.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./visual-cryptography";
import type { VisualFrame } from "@/types";

/** Check that a frame sequence is well formed. */
function checkFrames(frames: VisualFrame[], expectedCells: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(expectedCells);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

const finalMeta = (image: string, seed?: number) => {
    const frames = [...mod.run({ image, seed })];
    return frames[frames.length - 1]?.meta;
};

describe("Visual Cryptography", () => {
    it("reconstructs the secret by stacking the two shares", () => {
        const image = "11111100110011111111";
        const frames = [...mod.run({ image, seed: 12345 })];
        const size = Math.ceil(Math.sqrt(image.length));
        checkFrames(frames, 2 * image.length * 4);
        const meta = frames[frames.length - 1];
        const share1 = meta?.meta["share1"] as number[];
        const share2 = meta?.meta["share2"] as number[];
        const stacked = meta?.meta["stacked"] as number[];
        expect(stacked.length).toBe(image.length * 4);
        for (let p = 0; p < image.length; p += 1) {
            let dark = 0;
            for (let sub = 0; sub < 4; sub += 1) {
                dark += (share1[p * 4 + sub] as number) | (share2[p * 4 + sub] as number);
                expect(stacked[p * 4 + sub]).toBe((share1[p * 4 + sub] as number) | (share2[p * 4 + sub] as number));
            }
            expect(dark === 4 ? 1 : 0).toBe(image[p] === "1" ? 1 : 0);
        }
        expect(size * size).toBeGreaterThanOrEqual(image.length);
    });

    it("leaks nothing from a single share for randomized images", () => {
        let seed = 555;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % 2;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const image = Array.from({ length: 1 + (trial % 20) }, () => String(next())).join("");
            const meta = finalMeta(image, trial * 7919 + 1);
            const share1 = meta?.["share1"] as number[];
            const share2 = meta?.["share2"] as number[];
            const stacked = meta?.["stacked"] as number[];
            for (let p = 0; p < image.length; p += 1) {
                expect(share1.slice(p * 4, p * 4 + 4).reduce((a, b) => a + b, 0)).toBe(2);
                expect(share2.slice(p * 4, p * 4 + 4).reduce((a, b) => a + b, 0)).toBe(2);
                const dark = stacked.slice(p * 4, p * 4 + 4).reduce((a, b) => a + b, 0);
                expect(dark === 4 ? 1 : 0).toBe(image[p] === "1" ? 1 : 0);
            }
        }
    });

    it("is deterministic for a fixed seed", () => {
        const image = "1010101010101010";
        expect(finalMeta(image, 42)?.["share1"]).toEqual(finalMeta(image, 42)?.["share1"]);
        expect(finalMeta(image, 42)?.["share2"]).toEqual(finalMeta(image, 42)?.["share2"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
