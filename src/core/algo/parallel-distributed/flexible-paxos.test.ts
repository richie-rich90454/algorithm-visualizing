/**
 * flexible-paxos.test.ts - Quorum-intersection property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateFlexiblePaxos } from "./flexible-paxos";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], acceptors: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(acceptors + 1);
        expect(frame.entities[0]?.id).toBe("proposer");
        expect(frame.edges.length).toBe(acceptors);
        expect(frame.edges.every((e) => e.directed && e.sourceId === "proposer")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(frame.edges.every((e) => ids.has(e.sourceId) && ids.has(e.targetId))).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Flexible Paxos", () => {
    it("learns the highest value in Q1 and decides exactly when quorums intersect", () => {
        for (let n = 1; n <= 6; n += 1) {
            for (let q1 = 1; q1 <= n; q1 += 1) {
                for (let q2 = 1; q2 <= n; q2 += 1) {
                    for (let mask = 0; mask < 1 << n; mask += 1) {
                        const accepted = Array.from({ length: n }, (_, i) => ((mask >> i) & 1) * (i + 3));
                        const data = simulateFlexiblePaxos(n, q1, q2, accepted, 99);
                        let highest = -1;
                        for (let i = 0; i < q1; i += 1) highest = Math.max(highest, accepted[i] ?? -1);
                        const expectedLearned = highest === -1 ? 99 : highest;
                        expect(data.learnedValue).toBe(expectedLearned);
                        expect(data.safe).toBe(q1 + q2 > n);
                        expect(data.chosen).toBe(q1 + q2 > n);
                        expect(data.chosenValue).toBe(data.chosen ? expectedLearned : -1);
                    }
                }
            }
        }
    });

    it("preserves an already chosen value under any later intersecting quorum", () => {
        for (let n = 3; n <= 6; n += 1) {
            for (let q2 = 1; q2 <= n; q2 += 1) {
                const accepted = Array<number>(n).fill(-1);
                const first = simulateFlexiblePaxos(n, n, q2, accepted, 7);
                if (!first.chosen) continue;
                const after = [...accepted];
                for (let i = 0; i < q2; i += 1) after[i] = first.chosenValue;
                for (let q1b = 1; q1b <= n; q1b += 1) {
                    if (q1b + q2 <= n) continue;
                    const second = simulateFlexiblePaxos(n, q1b, q2, after, 123);
                    expect(second.chosenValue).toBe(first.chosenValue);
                }
            }
        }
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 5);
        expect(frames[frames.length - 1]?.meta["chosenValue"]).toBe(9);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
