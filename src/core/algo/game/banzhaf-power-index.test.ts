import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./banzhaf-power-index";

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

// Independent enumeration over all 2^n coalitions and all players not in them.
function bruteSwings(weights: number[], quota: number): number[] {
    const n = weights.length;
    const value = (mask: number): number => {
        let sum = 0;
        for (let i = 0; i < n; i += 1) if ((mask & (1 << i)) !== 0) sum += weights[i];
        return sum >= quota ? 1 : 0;
    };
    const swings = new Array<number>(n).fill(0);
    for (let mask = 0; mask < 2 ** n; mask += 1) {
        for (let i = 0; i < n; i += 1) {
            if ((mask & (1 << i)) !== 0) continue;
            if (value(mask) === 0 && value(mask | (1 << i)) === 1) swings[i] += 1;
        }
    }
    return swings;
}

function makeRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) >>> 0;
        return s / 4294967296;
    };
}

describe("BanzhafPowerIndex", () => {
    it("matches an independent coalition enumeration", () => {
        const rng = makeRandom(5150);
        for (let t = 0; t < 80; t += 1) {
            const n = 2 + (t % 4);
            const weights = Array.from({ length: n }, () => Math.floor(rng() * 6));
            const total = weights.reduce((a, b) => a + b, 0);
            const quota = 1 + Math.floor(rng() * Math.max(1, total));
            const fs = frames({ weights, quota });
            shapes(fs);
            const expected = bruteSwings(weights, quota);
            const last = fs[fs.length - 1];
            const got = last?.meta.swings as number[];
            for (let i = 0; i < n; i += 1) expect(got[i]).toBe(expected[i]);
            const totalSwings = expected.reduce((a, b) => a + b, 0);
            const norm = last?.meta.normalized as number[];
            if (totalSwings > 0) {
                expect(norm.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
                for (let i = 0; i < n; i += 1) expect(norm[i]).toBeCloseTo((expected[i] ?? 0) / totalSwings, 9);
            }
            for (let i = 0; i < n; i += 1) if (weights[i] === 0) expect(got[i]).toBe(0);
        }
    });

    it("matches the textbook weighted game and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(last?.meta.swings).toEqual([3, 1, 1]);
        expect(Number(last?.meta.sum)).toBeCloseTo(1, 9);
        expect(fs.length).toBeLessThan(12);
    });
});
