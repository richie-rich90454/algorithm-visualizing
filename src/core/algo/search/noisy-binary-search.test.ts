import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./noisy-binary-search";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("array");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => {
            expect(Number.isFinite(e.x)).toBe(true);
            expect(Number.isFinite(e.y)).toBe(true);
        });
        f.edges.forEach((e) => {
            const ids = new Set(f.entities.map((n) => n.id));
            expect(ids.has(e.sourceId)).toBe(true);
            expect(ids.has(e.targetId)).toBe(true);
        });
    });
}

function makeRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

describe("NoisyBinarySearch", () => {
    it("finds the target whenever every majority vote is truthful", () => {
        const rng = makeRandom(20261119);
        for (let t = 0; t < 200; t += 1) {
            const n = 3 + Math.floor(rng() * 12);
            const arr = Array.from({ length: n }, (_, i) => i * 2 + 1);
            const target = rng() < 0.85 ? (arr[Math.floor(rng() * n)] ?? 1) : (arr[n - 1] ?? 1) + 3;
            const repeats = 3 + 2 * Math.floor(rng() * 3);
            const tolerance = Math.floor((repeats - 1) / 2);
            const noise = Array.from({ length: n + 2 }, () => Math.floor(rng() * (tolerance + 1)));
            const fs = frames({ array: arr, target, repeats, noise });
            shapes(fs);

            const last = fs[fs.length - 1];
            expect(Number(last?.meta.foundIndex)).toBe(arr.indexOf(target));

            // Independently recompute every majority decision from the noise
            // pattern and the real comparisons along the search path.
            for (let i = 1; i < fs.length - 1; i += 1) {
                const frame = fs[i];
                const mid = Number(frame?.meta.mid);
                const flips = Number(frame?.meta.flips);
                expect(flips).toBeLessThanOrEqual(tolerance);
                const value = arr[mid];
                expect(value).toBeDefined();
                const truth = (value as number) < target;
                const truthfulVotes = repeats - flips;
                expect(Boolean(frame?.meta.decidedLess)).toBe(truth);
                expect(Number(frame?.meta.lessVotes)).toBe(truth ? repeats - flips : flips);
                expect(truthfulVotes).toBeGreaterThan(repeats / 2);
            }
        }
    });

    it("matches the worked example and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(Number(last?.meta.foundIndex)).toBe(6);
        expect(Number(last?.meta.comparisons)).toBeGreaterThan(0);
        expect(fs.length).toBeLessThan(12);
    });
});
