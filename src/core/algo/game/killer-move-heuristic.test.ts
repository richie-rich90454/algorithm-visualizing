import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./killer-move-heuristic";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapeCheck(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("tree");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
        const ids = new Set(f.entities.map((e) => e.id));
        f.edges.forEach((ed) => {
            expect(ids.has(ed.sourceId)).toBe(true);
            expect(ids.has(ed.targetId)).toBe(true);
        });
    });
}

/** Independent exhaustive minimax; index leaves in depth-first order. */
function bruteMinimax(leaves: number[], depth: number, branch: number): number {
    let cursor = 0;
    const rec = (ply: number, maximizing: boolean): number => {
        if (ply === depth) return leaves[cursor++] ?? 0;
        let best = maximizing ? -Infinity : Infinity;
        for (let m = 0; m < branch; m += 1) {
            const v = rec(ply + 1, !maximizing);
            best = maximizing ? Math.max(best, v) : Math.min(best, v);
        }
        return best;
    };
    return rec(0, true);
}

describe("KillerMoveHeuristic", () => {
    it("returns the brute-force minimax value on many random trees", () => {
        for (let seed = 1; seed <= 12; seed += 1) {
            const depth = 3;
            const branch = 3;
            const fs = frames({ depth, branch, seed });
            shapeCheck(fs);
            // Regenerate the exact leaves the module generated from the seed.
            const leaves: number[] = [];
            let state = seed >>> 0 || 1;
            for (let i = 0; i < branch ** depth; i += 1) {
                state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
                leaves.push((state % 21) - 10);
            }
            const last = fs[fs.length - 1];
            expect(last?.meta.finalValue).toBe(bruteMinimax(leaves, depth, branch));
            expect(last?.meta.converged).toBe(true);
        }
    });

    it("stores only quiet cutoff moves and keeps at most two killers per ply", () => {
        const fs = frames({ depth: 3, branch: 3, seed: 11 });
        shapeCheck(fs);
        for (const f of fs) {
            const killerText = String(f.meta.killerAtPly);
            const killers = killerText === "" ? [] : killerText.split(",");
            expect(killers.length).toBeLessThanOrEqual(2);
            for (const k of killers) expect(Number(k) % 2).toBe(0);
        }
        const last = fs[fs.length - 1];
        expect(Number(last?.meta.cutoffs)).toBeGreaterThan(0);
        expect(Number(last?.meta.visited)).toBeLessThanOrEqual(40);
    });

    it("respects an explicit leaf array and terminates on the smallest tree", () => {
        const leaves = [5, -3, 2, 9, 1, -7, 4, 0, 6];
        const fs = frames({ leaves, depth: 2, branch: 3 });
        shapeCheck(fs);
        const last = fs[fs.length - 1];
        // Root maximizes, then minimizes: max(min of each triple).
        expect(last?.meta.finalValue).toBe(bruteMinimax(leaves, 2, 3));
    });
});
