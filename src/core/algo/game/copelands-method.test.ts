import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./copelands-method";

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
        });
        f.edges.forEach((e) => {
            const ids = new Set(f.entities.map((n) => n.id));
            expect(ids.has(e.sourceId)).toBe(true);
            expect(ids.has(e.targetId)).toBe(true);
        });
    });
}

function bruteScores(ballots: number[][], m: number): { wins: number[]; losses: number[]; scores: number[] } {
    const pairwise = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    for (let a = 0; a < m; a += 1) {
        for (let b = 0; b < m; b += 1) {
            for (const ballot of ballots) {
                const ra = ballot.findIndex((c) => c === a);
                const rb = ballot.findIndex((c) => c === b);
                if (ra >= 0 && rb >= 0 && ra < rb) pairwise[a][b] += 1;
            }
        }
    }
    const wins = new Array<number>(m).fill(0);
    const losses = new Array<number>(m).fill(0);
    for (let i = 0; i < m; i += 1) {
        for (let j = 0; j < m; j += 1) {
            if (i === j) continue;
            if (pairwise[i][j] > pairwise[j][i]) wins[i] += 1;
            else if (pairwise[i][j] < pairwise[j][i]) losses[i] += 1;
        }
    }
    return { wins, losses, scores: wins.map((w, i) => w - losses[i]) };
}

function makeRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) >>> 0;
        return s / 4294967296;
    };
}

describe("CopelandsMethod", () => {
    it("matches an independent pairwise score computation", () => {
        const rng = makeRandom(8888);
        for (let t = 0; t < 90; t += 1) {
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
            expect(last?.meta.wins).toEqual(expected.wins);
            expect(last?.meta.losses).toEqual(expected.losses);
            expect(last?.meta.scores).toEqual(expected.scores);
            expect(expected.scores.reduce((a, b) => a + b, 0)).toBe(0);

            const ranking = last?.meta.ranking as number[];
            for (let k = 1; k < ranking.length; k += 1) {
                const prev = ranking[k - 1] ?? 0;
                const cur = ranking[k] ?? 0;
                expect(expected.scores[prev]).toBeGreaterThanOrEqual(expected.scores[cur]);
            }
        }
    });

    it("is Condorcet consistent on a clear winner and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(last?.meta.scores).toEqual([2, 0, -2]);
        expect(last?.meta.winners).toEqual([0]);
        expect(last?.meta.ranking).toEqual([0, 1, 2]);
        expect(fs.length).toBeLessThan(12);
    });
});
