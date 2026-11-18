/**
 * tendermint-consensus.test.ts - Brute-force quorum intersection, independent arithmetic, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { tendermintQuorum } from "./tendermint-consensus";
import type { VisualFrame } from "@/types";

type Input = { validators: number; faulty: number; block: string };

function reference(n: number, f: number, block: string) {
    const quorum = Math.floor((2 * n) / 3) + 1;
    const honest = n - f;
    const safe = n >= 3 * f + 1;
    const locked = honest >= quorum;
    return { quorum, honest, safe, locked, committed: locked && safe, decision: locked && safe ? block : "" };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(n);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** All subsets of [0..n-1] with exactly k members. */
function subsets(n: number, k: number): number[][] {
    const out: number[][] = [];
    const combine = (start: number, chosen: number[]) => {
        if (chosen.length === k) {
            out.push(chosen.slice());
            return;
        }
        for (let i = start; i < n; i += 1) {
            chosen.push(i);
            combine(i + 1, chosen);
            chosen.pop();
        }
    };
    combine(0, []);
    return out;
}

describe("Tendermint consensus (one height)", () => {
    it("matches independent quorum and decision arithmetic", () => {
        const cases: Input[] = [
            { validators: 4, faulty: 1, block: "BLK-42" },
            { validators: 7, faulty: 2, block: "v" },
            { validators: 1, faulty: 0, block: "solo" },
            { validators: 3, faulty: 1, block: "x" },
            { validators: 10, faulty: 3, block: "z" },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.validators);
            const expected = reference(input.validators, input.faulty, input.block);
            const final = frames[frames.length - 1]?.meta ?? {};
            expect(final["quorum"]).toBe(expected.quorum);
            expect(final["honest"]).toBe(expected.honest);
            expect(final["safe"]).toBe(expected.safe);
            expect(final["decision"]).toBe(expected.decision);
            expect(final["locked"]).toBe(expected.locked ? input.block : "");
            expect(tendermintQuorum(input.validators)).toBe(expected.quorum);
        }
    });

    it("brute-force checks that any two quorums overlap in at least f+1 validators", () => {
        for (const [n, f] of [[4, 1], [7, 2], [10, 3]] as Array<[number, number]>) {
            const q = tendermintQuorum(n);
            expect(q).toBeGreaterThan((2 * n) / 3);
            const all = subsets(n, q);
            for (let a = 0; a < all.length; a += 1) {
                for (let b = a + 1; b < all.length; b += 1) {
                    const overlap = all[a]!.filter((v) => all[b]!.includes(v)).length;
                    expect(overlap).toBeGreaterThanOrEqual(f + 1);
                }
            }
        }
    });

    it("shows faulty validators as errors that never commit", () => {
        const frames = [...mod.run({ validators: 7, faulty: 2, block: "v" })];
        const final = frames[frames.length - 1];
        const faulty = final?.entities.filter((e) => e.metadata["faulty"] === true) ?? [];
        expect(faulty.length).toBe(2);
        expect(faulty.every((e) => e.state === "error")).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
