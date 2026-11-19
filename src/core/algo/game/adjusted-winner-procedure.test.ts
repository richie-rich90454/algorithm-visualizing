import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./adjusted-winner-procedure";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThanOrEqual(2);
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

// Deterministic pseudo-random generator so the property sweep is reproducible.
function makeRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function fairSplit(rng: () => number, k: number): number[] {
    const points = [0, ...Array.from({ length: k - 1 }, () => rng()), 1].sort((a, b) => a - b);
    const raw = points.map((p, i) => p - (points[i - 1] ?? 0));
    return raw.map((v) => Math.round(v * 100));
}

describe("AdjustedWinnerProcedure", () => {
    it("produces an equitable, envy-free allocation on random fair splits", () => {
        const rng = makeRandom(20261119);
        for (let t = 0; t < 120; t += 1) {
            const k = 2 + (t % 4);
            const bob = fairSplit(rng, k);
            const carol = fairSplit(rng, k);
            const fs = frames({ bob, carol });
            shapes(fs);
            const last = fs[fs.length - 1];
            expect(last?.meta.envyFree).toBe(true);
            expect(Number(last?.meta.bobPoints)).toBeCloseTo(Number(last?.meta.carolPoints), 6);
            const b = last?.meta.bob as number[];
            const c = last?.meta.carol as number[];
            const bShare = last?.meta.bobShare as number[];
            const cShare = last?.meta.carolShare as number[];
            for (let i = 0; i < k; i += 1) {
                expect((bShare[i] ?? 0) + (cShare[i] ?? 0)).toBeCloseTo(1, 9);
                expect(bShare[i] ?? 0).toBeGreaterThanOrEqual(-1e-9);
                expect(cShare[i] ?? 0).toBeGreaterThanOrEqual(-1e-9);
                expect(bShare[i] ?? 0).toBeLessThanOrEqual(1 + 1e-9);
            }
            const bobBundle = b.reduce((s, v, i) => s + v * (bShare[i] ?? 0), 0);
            const carolBundle = c.reduce((s, v, i) => s + v * (cShare[i] ?? 0), 0);
            const bobOfCarol = b.reduce((s, v, i) => s + v * (cShare[i] ?? 0), 0);
            const carolOfBob = c.reduce((s, v, i) => s + v * (bShare[i] ?? 0), 0);
            expect(bobBundle).toBeCloseTo(Number(last?.meta.bobPoints), 6);
            expect(carolBundle).toBeCloseTo(Number(last?.meta.carolPoints), 6);
            expect(bobBundle).toBeGreaterThanOrEqual(bobOfCarol - 1e-6);
            expect(carolBundle).toBeGreaterThanOrEqual(carolOfBob - 1e-6);
        }
    });

    it("matches the known worked example and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(last?.meta.leader).toBe("carol");
        expect(Number(last?.meta.initialBob)).toBeCloseTo(50, 6);
        expect(Number(last?.meta.initialCarol)).toBeCloseTo(80, 6);
        expect(Number(last?.meta.bobPoints)).toBeCloseTo(Number(last?.meta.carolPoints), 6);
        expect(Number(last?.meta.bobPoints)).toBeCloseTo(62.857, 2);
        expect(fs.length).toBeLessThan(20);
    });
});
