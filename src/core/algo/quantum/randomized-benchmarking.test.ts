/**
 * randomized-benchmarking.test.ts - Clifford group size, decay fit, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./randomized-benchmarking";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(7);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(5);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

type SignedPermutation = { perm: number[]; sign: number[] };

/** Independent closure of H and S over signed permutations of X, Y, Z. */
function independentGroupSize(): number {
    const identity: SignedPermutation = { perm: [0, 1, 2], sign: [1, 1, 1] };
    const h: SignedPermutation = { perm: [2, 1, 0], sign: [1, -1, 1] };
    const s: SignedPermutation = { perm: [1, 0, 2], sign: [1, -1, 1] };
    const compose = (a: SignedPermutation, b: SignedPermutation): SignedPermutation => ({
        perm: a.perm.map((t) => b.perm[t] ?? 0),
        sign: a.perm.map((t, i) => (a.sign[i] ?? 1) * (b.sign[t] ?? 1)),
    });
    const key = (c: SignedPermutation) => `${c.perm.join("")}:${c.sign.join("")}`;
    const seen = new Map([[key(identity), identity]]);
    const queue = [identity];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) break;
        for (const generator of [h, s]) {
            const next = compose(current, generator);
            if (seen.has(key(next))) continue;
            seen.set(key(next), next);
            queue.push(next);
        }
    }
    return seen.size;
}

describe("RandomizedBenchmarking", () => {
    it("uses the full 24-element single-qubit Clifford group", () => {
        expect(independentGroupSize()).toBe(24);
        const frames = [...mod.run({ p: 0.05 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["groupSize"]).toBe(24);
    });

    it("matches the analytic fidelity decay and recovers the error rate", () => {
        const lengths = [1, 2, 4, 8, 16];
        for (const p of [0, 0.01, 0.05, 0.2]) {
            const frames = [...mod.run({ p })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const fidelities = meta?.["fidelities"] as number[];
            for (let i = 0; i < lengths.length; i += 1) {
                expect(fidelities[i]).toBeCloseTo((1 + p ** ((lengths[i] ?? 0) + 1)) / 2, 10);
            }
            expect(meta?.["fittedP"] as number).toBeCloseTo(p, 10);
            expect(meta?.["gateFidelity"] as number).toBeCloseTo((1 + p) / 2, 10);
        }
    });

    it("every sequence inverts to the identity", () => {
        const frames = [...mod.run({ p: 0.03 })];
        for (let i = 1; i < 6; i += 1) {
            expect(frames[i]?.meta["returnsIdentity"]).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
