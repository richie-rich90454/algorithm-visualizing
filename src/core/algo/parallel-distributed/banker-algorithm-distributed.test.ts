/**
 * banker-algorithm-distributed.test.ts - Exhaustive permutation safety check,
 * request decisions, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { bankersSafety } from "./banker-algorithm-distributed";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Number(frame.meta["rows"])).toBeGreaterThan(0);
        expect(Number(frame.meta["cols"])).toBeGreaterThan(0);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("cell");
            expect(entity.metadata).toBeDefined();
        }
    });
}

/** Brute force: does any permutation of processes form a safe sequence? */
function bruteSafe(need: number[][], allocation: number[][], available: number[], n: number, m: number): boolean {
    const visit = (used: boolean[], work: number[], count: number): boolean => {
        if (count === n) return true;
        for (let p = 0; p < n; p += 1) {
            if (used[p]) continue;
            let fits = true;
            for (let r = 0; r < m; r += 1) {
                if ((need[p]?.[r] ?? 0) > (work[r] ?? 0)) {
                    fits = false;
                    break;
                }
            }
            if (!fits) continue;
            const next = work.slice();
            for (let r = 0; r < m; r += 1) next[r] = (next[r] ?? 0) + (allocation[p]?.[r] ?? 0);
            used[p] = true;
            if (visit(used, next, count + 1)) return true;
            used[p] = false;
        }
        return false;
    };
    return visit(new Array<boolean>(n).fill(false), available.slice(), 0);
}

function seeded(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 22695477 + 1) >>> 0;
        return s / 0x100000000;
    };
}

describe("BankerAlgorithmDistributed", () => {
    it("agrees with exhaustive permutation search on random states", () => {
        const rand = seeded(23);
        for (let trial = 0; trial < 60; trial += 1) {
            const n = 3 + Math.floor(rand() * 2);
            const m = 3;
            const allocation: number[][] = [];
            const max: number[][] = [];
            for (let p = 0; p < n; p += 1) {
                allocation.push(Array.from({ length: m }, () => Math.floor(rand() * 4)));
                max.push(Array.from({ length: m }, () => 4 + Math.floor(rand() * 4)));
            }
            const available = Array.from({ length: m }, () => Math.floor(rand() * 5));
            const need = max.map((row, p) => row.map((v, r) => Math.max(0, v - (allocation[p]?.[r] ?? 0))));
            const expected = bruteSafe(need, allocation, available, n, m);
            expect(bankersSafety(need, allocation, available, n, m).safe).toBe(expected);
            const frames = [...mod.run({ processes: Array.from({ length: n }, (_, i) => `P${i}`), allocation, max, available })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["safe"]).toBe(expected);
        }
    });

    it("marks the textbook example safe and grants a safe request", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["safe"]).toBe(true);
        expect(final?.["decision"]).toBe("safe");
        expect(final?.["sequence"]).toEqual(["P1", "P3", "P0", "P2", "P4"]);

        const requestFrames = [...mod.run({ ...(mod.defaultInput as object), request: { process: 1, needs: [1, 0, 0] } })];
        checkFrames(requestFrames);
        expect(requestFrames[requestFrames.length - 1]?.meta["decision"]).toBe("granted");
    });

    it("denies an unsafe request", () => {
        const frames = [...mod.run({ ...(mod.defaultInput as object), request: { process: 0, needs: [3, 3, 2] } })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["decision"]).toBe("denied");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
