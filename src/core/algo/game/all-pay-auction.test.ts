import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./all-pay-auction";

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

describe("AllPayAuction", () => {
    it("matches an independent outcome computation on many inputs", () => {
        const rng = makeRandom(424242);
        for (let t = 0; t < 120; t += 1) {
            const n = 2 + (t % 4);
            const valuations = Array.from({ length: n }, () => Math.round(rng() * 20));
            const bids = valuations.map(() => Math.round(rng() * 20));
            const fs = frames({ valuations, bids });
            shapes(fs);
            const last = fs[fs.length - 1];
            let winner = 0;
            for (let i = 1; i < n; i += 1) if (bids[i] > bids[winner]) winner = i;
            expect(last?.meta.winner).toBe(winner);
            const revenue = bids.reduce((a, b) => a + b, 0);
            const payoffs = bids.map((b, i) => (i === winner ? valuations[i] : 0) - b);
            expect(Number(last?.meta.revenue)).toBe(revenue);
            const gotPayoffs = last?.meta.payoffs as number[];
            const gotPayments = last?.meta.payments as number[];
            for (let i = 0; i < n; i += 1) {
                expect(gotPayoffs[i]).toBe(payoffs[i]);
                expect(gotPayments[i]).toBe(bids[i]);
            }
            expect(Number(last?.meta.totalSurplus)).toBe(payoffs.reduce((a, b) => a + b, 0));
            expect(Number(last?.meta.totalSurplus)).toBe(valuations[winner] - revenue);
            expect(bids[winner]).toBeGreaterThanOrEqual(Math.max(...bids));
        }
    });

    it("deviation scan never beats the recorded best and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const scan = fs[fs.length - 2];
        expect(Number(scan?.meta.bestPayoff)).toBeGreaterThanOrEqual(Number(scan?.meta.currentPayoff) - 1e-9);
        expect(fs.length).toBeLessThan(30);
        const last = fs[fs.length - 1];
        expect(Number(last?.meta.revenue)).toBe(11);
        const payoffs = last?.meta.payoffs as number[];
        expect(payoffs[0]).toBe(3);
        expect(payoffs[1]).toBe(-4);
    });
});
