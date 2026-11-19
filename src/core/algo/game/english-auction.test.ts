import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./english-auction";

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

// Independent ascending simulation: rebuild the active set from all bidders
// each round instead of filtering a shrinking list.
function bruteAuction(valuations: number[], increment: number): { winner: number; price: number } {
    let price = 0;
    let previous = valuations.map((_, i) => i);
    for (let guard = 0; guard < 30; guard += 1) {
        const survivors = valuations.map((v, i) => (v >= price ? i : -1)).filter((i) => i >= 0);
        if (survivors.length === 1) return { winner: survivors[0] ?? -1, price };
        if (survivors.length === 0) {
            const winner = previous.reduce(
                (best, i) => ((valuations[i] ?? 0) > (valuations[best] ?? 0) ? i : best),
                previous[0] ?? -1,
            );
            return { winner, price: price - increment };
        }
        previous = survivors;
        price += increment;
        if (price > Math.max(...valuations) + increment) {
            return { winner: valuations.indexOf(Math.max(...valuations)), price: price - increment };
        }
    }
    return { winner: -1, price: 0 };
}

function makeRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) >>> 0;
        return s / 4294967296;
    };
}

describe("EnglishAuction", () => {
    it("matches an independent ascending simulation", () => {
        const rng = makeRandom(4949);
        for (let t = 0; t < 120; t += 1) {
            const n = 2 + (t % 4);
            const valuations = Array.from({ length: n }, () => Math.floor(rng() * 15));
            const increment = 1 + Math.floor(rng() * 3);
            const fs = frames({ valuations, increment });
            shapes(fs);
            const expected = bruteAuction(valuations, increment);
            const last = fs[fs.length - 1];
            expect(last?.meta.winner).toBe(expected.winner);
            expect(Number(last?.meta.price)).toBe(expected.price);
            if (expected.winner >= 0) {
                const best = Math.max(...valuations);
                expect(valuations[expected.winner]).toBe(best);
                expect(valuations.indexOf(best)).toBe(expected.winner);
                expect(Number(last?.meta.payoff)).toBe(best - expected.price);
                expect(Number(last?.meta.payoff)).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it("matches the ascending example and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(last?.meta.winner).toBe(0);
        expect(Number(last?.meta.price)).toBe(8);
        expect(Number(last?.meta.payoff)).toBe(2);
        expect(fs.length).toBeLessThan(30);
    });
});
