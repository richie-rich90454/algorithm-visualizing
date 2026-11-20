import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./dutch-auction";

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
        s = (s * 1103515245 + 12345) >>> 0;
        return s / 4294967296;
    };
}

describe("DutchAuction", () => {
    it("finds the highest feasible price and first willing bidder", () => {
        const rng = makeRandom(2727);
        for (let t = 0; t < 120; t += 1) {
            const n = 2 + (t % 4);
            const valuations = Array.from({ length: n }, () => Math.round(rng() * 20));
            const startPrice = 1 + Math.floor(rng() * 20);
            const decrement = 1 + Math.floor(rng() * 4);
            const fs = frames({ valuations, startPrice, decrement });
            shapes(fs);

            let expectedWinner = -1;
            let expectedPrice = 0;
            for (let p = startPrice; p > 0; p -= decrement) {
                const idx = valuations.findIndex((v) => v >= p);
                if (idx >= 0) {
                    expectedWinner = idx;
                    expectedPrice = p;
                    break;
                }
            }
            const last = fs[fs.length - 1];
            expect(last?.meta.winner).toBe(expectedWinner);
            expect(Number(last?.meta.price)).toBe(expectedPrice);
            if (expectedWinner >= 0) {
                expect(valuations[expectedWinner]).toBeGreaterThanOrEqual(expectedPrice);
                expect(Number(last?.meta.payoff)).toBe(valuations[expectedWinner] - expectedPrice);
                const path = last?.meta.pricePath as number[];
                expect(path[path.length - 1]).toBe(expectedPrice);
                path.forEach((p) => expect(p).toBeGreaterThan(expectedPrice - 1e-9));
            }
        }
    });

    it("matches the descending example and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(last?.meta.winner).toBe(3);
        expect(Number(last?.meta.price)).toBe(12);
        expect(Number(last?.meta.payoff)).toBe(0);
        expect(fs.length).toBeLessThan(30);
    });
});
