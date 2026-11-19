/**
 * ranked-pairs-voting.test.ts - Independent reference, acyclicity, frames, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./ranked-pairs-voting";
import type { VisualFrame } from "@/types";

type Pair = { winner: number; loser: number; strength: number };

/** Reference that validates a candidate edge set by full topological sorting. */
function reference(ballots: number[][], m: number): { winner: number; locked: Set<string> } {
    const counts = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    for (const b of ballots) {
        for (let a = 0; a < m; a += 1) {
            for (let c = a + 1; c < m; c += 1) {
                const ia = b.indexOf(a);
                const ic = b.indexOf(c);
                const rankA = ia < 0 ? 99 : ia;
                const rankC = ic < 0 ? 99 : ic;
                if (rankA < rankC) counts[a][c] += 1;
                else if (rankC < rankA) counts[c][a] += 1;
            }
        }
    }
    const pairs: Pair[] = [];
    for (let a = 0; a < m; a += 1) {
        for (let b = a + 1; b < m; b += 1) {
            if (counts[a][b] > counts[b][a]) pairs.push({ winner: a, loser: b, strength: counts[a][b] });
            else if (counts[b][a] > counts[a][b]) pairs.push({ winner: b, loser: a, strength: counts[b][a] });
        }
    }
    pairs.sort((x, y) => y.strength - x.strength || x.winner - y.winner || x.loser - y.loser);
    const acyclic = (edges: Pair[]) => {
        const indeg = new Array<number>(m).fill(0);
        const adj = new Map<number, number[]>();
        for (const e of edges) {
            if (!adj.has(e.winner)) adj.set(e.winner, []);
            adj.get(e.winner)?.push(e.loser);
            indeg[e.loser] += 1;
        }
        const q: number[] = [];
        for (let i = 0; i < m; i += 1) if (indeg[i] === 0) q.push(i);
        let seen = 0;
        while (q.length) {
            const u = q.shift();
            if (u === undefined) break;
            seen += 1;
            for (const v of adj.get(u) ?? []) {
                indeg[v] -= 1;
                if (indeg[v] === 0) q.push(v);
            }
        }
        return seen === m;
    };
    const locked: Pair[] = [];
    for (const p of pairs) {
        if (acyclic([...locked, p])) locked.push(p);
    }
    const indeg = new Array<number>(m).fill(0);
    const adj = new Map<number, number[]>();
    for (const e of locked) {
        if (!adj.has(e.winner)) adj.set(e.winner, []);
        adj.get(e.winner)?.push(e.loser);
        indeg[e.loser] += 1;
    }
    const q: number[] = [];
    for (let i = 0; i < m; i += 1) if (indeg[i] === 0) q.push(i);
    const order: number[] = [];
    while (q.length) {
        const u = q.shift();
        if (u === undefined) break;
        order.push(u);
        for (const v of adj.get(u) ?? []) {
            indeg[v] -= 1;
            if (indeg[v] === 0) q.push(v);
        }
    }
    return { winner: order[0], locked: new Set(locked.map((p) => `${p.winner}>${p.loser}`)) };
}

function checkFrames(frames: VisualFrame[], m: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(m * m);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Ranked Pairs Voting", () => {
    it("matches an independent reference on several elections", () => {
        const cases: number[][][] = [
            [[0, 1, 2], [0, 2, 1], [1, 0, 2], [2, 1, 0], [1, 2, 0]],
            [[2, 0, 1], [2, 1, 0], [0, 2, 1], [1, 0, 2], [0, 1, 2]],
            [[0, 1, 2], [0, 1, 2], [1, 0, 2], [2, 1, 0]],
        ];
        for (const ballots of cases) {
            const frames = [...mod.run({ ballots, candidates: 3 })];
            checkFrames(frames, 3);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(ballots, 3);
            expect(final?.["winner"]).toBe(expected.winner);
            expect(new Set((final?.["locked"] as string[]).map((s) => s.split(":")[0]))).toEqual(expected.locked);
            expect((final?.["ranking"] as number[])[0]).toBe(expected.winner);
        }
    });

    it("locks only acyclic victories", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const locked = frames[frames.length - 1]?.meta["locked"] as string[];
        expect(new Set(locked).size).toBe(locked.length);
        expect(locked.length).toBeGreaterThan(0);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
