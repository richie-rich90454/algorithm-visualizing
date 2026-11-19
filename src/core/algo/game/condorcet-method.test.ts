import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./condorcet-method";

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

// Independent pairwise count using explicit rank lookup per ballot.
function brutePairwise(ballots: number[][], m: number): number[][] {
    const matrix = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    for (let a = 0; a < m; a += 1) {
        for (let b = 0; b < m; b += 1) {
            if (a === b) continue;
            for (const ballot of ballots) {
                const ra = ballot.findIndex((c) => c === a);
                const rb = ballot.findIndex((c) => c === b);
                if (ra >= 0 && rb >= 0 && ra < rb) matrix[a][b] += 1;
            }
        }
    }
    return matrix;
}

function makeRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) >>> 0;
        return s / 4294967296;
    };
}

describe("CondorcetMethod", () => {
    it("matches an independent pairwise matrix and winner check", () => {
        const rng = makeRandom(13131);
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
            const expected = brutePairwise(ballots, m);
            const last = fs[fs.length - 1];
            const got = last?.meta.pairwise as number[];
            for (let i = 0; i < m; i += 1) for (let j = 0; j < m; j += 1) expect(got[i * m + j]).toBe(expected[i][j]);

            let winner = -1;
            for (let i = 0; i < m && winner < 0; i += 1) {
                let all = true;
                for (let j = 0; j < m; j += 1) if (i !== j && expected[i][j] <= voters / 2) all = false;
                if (all) winner = i;
            }
            expect(last?.meta.winner).toBe(winner);
            if (winner >= 0) expect(last?.meta.cycle).toEqual([]);
            else {
                const cycle = last?.meta.cycle as number[];
                if (cycle.length === 3) {
                    const beats = (x: number, y: number): boolean => expected[x][y] > expected[y][x];
                    expect(beats(cycle[0], cycle[1])).toBe(true);
                    expect(beats(cycle[1], cycle[2])).toBe(true);
                    expect(beats(cycle[2], cycle[0])).toBe(true);
                }
            }
        }
    });

    it("detects the textbook cycle and the clear winner, and terminates", () => {
        const cyc = frames({ ballots: [[0, 1, 2], [1, 2, 0], [2, 0, 1]], candidates: 3 });
        shapes(cyc);
        expect(cyc[cyc.length - 1]?.meta.winner).toBe(-1);
        expect((cyc[cyc.length - 1]?.meta.cycle as number[]).length).toBe(3);

        const win = frames(mod.defaultInput);
        shapes(win);
        expect(win[win.length - 1]?.meta.winner).toBe(0);
        expect(win.length).toBeLessThan(12);
    });
});
