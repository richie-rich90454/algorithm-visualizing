import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./borda-count";

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
            expect(e.metadata.row).toBeDefined();
            expect(e.metadata.col).toBeDefined();
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

// Independent scoring: count, for each candidate, how many rivals appear after
// it on each ballot, without using ballot.indexOf or the module's formula.
function bruteScores(ballots: number[][], m: number): number[] {
    const scores = new Array<number>(m).fill(0);
    for (const ballot of ballots) {
        for (const c of ballot) {
            let below = 0;
            for (const other of ballot) if (other !== c && ballot.indexOf(other) > ballot.indexOf(c)) below += 1;
            scores[c] = (scores[c] ?? 0) + below;
        }
    }
    return scores;
}

function makeRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) >>> 0;
        return s / 4294967296;
    };
}

describe("BordaCount", () => {
    it("matches an independent point count on random ballots", () => {
        const rng = makeRandom(6161);
        for (let t = 0; t < 100; t += 1) {
            const m = 2 + (t % 4);
            const voters = 1 + (t % 5);
            const ballots = Array.from({ length: voters }, () => {
                const order = Array.from({ length: m }, (_, i) => i);
                for (let i = m - 1; i > 0; i -= 1) {
                    const j = Math.floor(rng() * (i + 1));
                    const tmp = order[i];
                    order[i] = order[j];
                    order[j] = tmp;
                }
                return order;
            });
            const fs = frames({ ballots, candidates: m });
            shapes(fs);
            const expected = bruteScores(ballots, m);
            const last = fs[fs.length - 1];
            const got = last?.meta.scores as number[];
            for (let c = 0; c < m; c += 1) expect(got[c]).toBe(expected[c]);
            const best = Math.max(...expected);
            const winners = expected.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0);
            expect(last?.meta.winners).toEqual(winners);
            for (const ballot of ballots) {
                expect(ballot.reduce((s, _c, p) => s + (ballot.length - 1 - p), 0)).toBe((m * (m - 1)) / 2);
            }
        }
    });

    it("matches the worked example and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(last?.meta.scores).toEqual([5, 3, 1]);
        expect(last?.meta.winners).toEqual([0]);
        expect(fs.length).toBeLessThan(12);
    });
});
