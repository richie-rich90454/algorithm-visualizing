/**
 * fasttext.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { fnv1a, subwordFeatures } from "./fasttext";
import type { VisualFrame } from "@/types";

type Input = { word: string; minN: number; maxN: number; buckets: number };

/** Independent FNV-1a reference. */
function referenceHash(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

function referenceFeatures(input: Input) {
    const out: Array<{ padded: string; hash: number; bucket: number }> = [];
    const wrapped = `^${input.word}#`;
    for (let n = input.minN; n <= input.maxN; n += 1) {
        for (let i = 0; i + n <= wrapped.length; i += 1) {
            const padded = wrapped.slice(i, i + n);
            const hash = referenceHash(padded);
            out.push({ padded, hash, bucket: hash % input.buckets });
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("FastText Subword Hashing", () => {
    it("matches an independent FNV-1a and n-gram enumeration", () => {
        const cases: Input[] = [
            { word: "cat", minN: 3, maxN: 4, buckets: 1000 },
            { word: "visualize", minN: 2, maxN: 5, buckets: 256 },
            { word: "abab", minN: 1, maxN: 3, buckets: 97 },
            { word: "abcde", minN: 5, maxN: 5, buckets: 13 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const expected = referenceFeatures(input);
            checkFrames(frames, expected.length, 3);
            const final = frames[frames.length - 1]!.meta;
            expect(final["ngrams"]).toEqual(expected.map((e) => e.padded));
            expect(final["hashes"]).toEqual(expected.map((e) => e.hash));
            expect(final["bucketIds"]).toEqual(expected.map((e) => e.bucket));
            expect(subwordFeatures(input.word, input.minN, input.maxN, input.buckets).map((f) => f.hash))
                .toEqual(expected.map((e) => e.hash));
        }
    });

    it("hash is deterministic and buckets stay in range", () => {
        expect(fnv1a("^cat#")).toBe(referenceHash("^cat#"));
        expect(fnv1a("^cat#")).toBe(fnv1a("^cat#"));
        const input: Input = { word: "elephant", minN: 3, maxN: 5, buckets: 50 };
        const final = [...mod.run(input)][0]!.meta;
        const buckets = final["bucketIds"] as number[];
        expect(buckets.length).toBeGreaterThan(0);
        buckets.forEach((b) => {
            expect(b).toBeGreaterThanOrEqual(0);
            expect(b).toBeLessThan(50);
        });
    });

    it("uses boundary markers so prefix and medial n-grams differ", () => {
        const features = subwordFeatures("cat", 3, 3, 1000);
        const padded = features.map((f) => f.padded);
        expect(padded).toEqual(["^ca", "cat", "at#"]);
        expect(new Set(padded).size).toBe(padded.length);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
