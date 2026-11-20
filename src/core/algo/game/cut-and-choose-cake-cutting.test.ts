import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./cut-and-choose-cake-cutting";

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

// Independent piecewise-linear integration of a value vector up to position x.
function integrate(points: number[], k: number, x: number): number {
    const seg = Math.max(0, Math.min(k, x * k));
    let total = 0;
    for (let i = 0; i < k; i += 1) {
        const lo = Math.max(0, Math.min(1, seg - i));
        total += (points[i] ?? 0) * lo;
    }
    return total;
}

function makeRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) >>> 0;
        return s / 4294967296;
    };
}

describe("CutAndChooseCakeCutting", () => {
    it("is equitable and envy-free on random value densities", () => {
        const rng = makeRandom(31415);
        for (let t = 0; t < 120; t += 1) {
            const k = 2 + (t % 6);
            const alice = Array.from({ length: k }, () => 1 + Math.floor(rng() * 9));
            const bob = Array.from({ length: k }, () => 1 + Math.floor(rng() * 9));
            const fs = frames({ alice, bob });
            shapes(fs);
            const last = fs[fs.length - 1];
            const cut = Number(last?.meta.cut);
            expect(cut).toBeGreaterThanOrEqual(0);
            expect(cut).toBeLessThanOrEqual(1);
            expect(Boolean(last?.meta.envyFree)).toBe(true);

            const a = last?.meta.alice as number[];
            const b = last?.meta.bob as number[];
            const aLeft = integrate(a, k, cut);
            const bLeft = integrate(b, k, cut);
            expect(aLeft).toBeCloseTo(Number(last?.meta.leftAlice), 6);
            expect(bLeft).toBeCloseTo(Number(last?.meta.leftBob), 6);
            expect(aLeft).toBeCloseTo(50, 6);
            expect(Number(last?.meta.leftBob) + Number(last?.meta.rightBob)).toBeCloseTo(100, 6);

            const chosen = String(last?.meta.chosen);
            if (bLeft >= 100 - bLeft) expect(chosen).toBe("left");
            else expect(chosen).toBe("right");
            expect(Number(last?.meta.bobValue)).toBeGreaterThanOrEqual(Number(last?.meta.bobOther) - 1e-6);
            expect(Number(last?.meta.aliceValue)).toBeGreaterThanOrEqual(Number(last?.meta.aliceOther) - 1e-6);
        }
    });

    it("matches the worked example and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(last?.meta.chosen).toBe("left");
        expect(Number(last?.meta.aliceValue)).toBeCloseTo(50, 6);
        expect(Number(last?.meta.bobValue)).toBeCloseTo(52.5, 6);
        expect(fs.length).toBeLessThan(12);
    });
});
