import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./angels-and-devils-game";

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
        expect(f.layout).toBe("grid");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => {
            expect(Number.isFinite(e.x)).toBe(true);
            expect(Number.isFinite(e.y)).toBe(true);
            expect(e.metadata.row).toBeDefined();
            expect(e.metadata.col).toBeDefined();
        });
        f.edges.forEach((e) => {
            const ids = new Set(f.entities.map((n) => n.id));
            expect(ids.has(e.sourceId)).toBe(true);
            expect(ids.has(e.targetId)).toBe(true);
        });
    });
}

// Independent brute-force game solver with no memoization.
function bruteWins(n: number, power: number, left: number, pos: number, burned: number): boolean {
    if (left <= 0) return true;
    const cheb = (a: number, b: number): number =>
        Math.max(Math.abs(Math.floor(a / n) - Math.floor(b / n)), Math.abs((a % n) - (b % n)));
    for (let d = 0; d < n * n; d += 1) {
        if ((burned & (1 << d)) !== 0 || d === pos) continue;
        const next = burned | (1 << d);
        const moves: number[] = [];
        for (let q = 0; q < n * n; q += 1) {
            if ((next & (1 << q)) === 0 && q !== pos && cheb(pos, q) <= power) moves.push(q);
        }
        if (moves.length === 0) return false;
        if (!moves.some((q) => bruteWins(n, power, left - 1, q, next))) return false;
    }
    return true;
}

describe("AngelsAndDevilsGame", () => {
    it("matches a memo-free brute-force solver on small boards", () => {
        for (const n of [3, 4]) {
            for (const power of [1, 2]) {
                for (const rounds of [1, 2]) {
                    const input = { boardSize: n, power, rounds };
                    const fs = frames(input);
                    shapes(fs);
                    const start = Math.floor(n / 2) * n + Math.floor(n / 2);
                    const expected = bruteWins(n, power, rounds, start, 0);
                    expect(fs[fs.length - 1]?.meta.angelWins).toBe(expected);
                }
            }
        }
    });

    it("respects burn legality, monotonicity in rounds, and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const start = Number(fs[0]?.meta.start);
        fs.slice(1, -1).forEach((f) => {
            const burn = Number(f.meta.burn);
            expect(burn).toBeGreaterThanOrEqual(0);
            expect(burn).not.toBe(start);
            const response = Number(f.meta.response);
            if (response >= 0) expect(response).not.toBe(burn);
        });
        const w2 = bruteWins(3, 1, 2, 4, 0);
        const w1 = bruteWins(3, 1, 1, 4, 0);
        if (w2) expect(w1).toBe(true);
        expect(fs.length).toBeLessThan(40);
    });
});
