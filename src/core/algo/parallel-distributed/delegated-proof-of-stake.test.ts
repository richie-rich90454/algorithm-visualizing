/**
 * delegated-proof-of-stake.test.ts - Election and apportionment property checks.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateDelegatedProofOfStake } from "./delegated-proof-of-stake";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], candidates: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(candidates);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent top-k election and largest-remainder apportionment. */
function reference(stakes: number[], delegates: number, rounds: number) {
    const d = Math.min(stakes.length, Math.max(1, Math.floor(delegates)));
    const elected = stakes.map((_, i) => i)
        .sort((a, b) => (stakes[b] ?? 0) - (stakes[a] ?? 0) || a - b)
        .slice(0, d);
    const weights = elected.map((i) => Math.max(0, stakes[i] ?? 0));
    const total = weights.reduce((s, w) => s + w, 0);
    const raw = weights.map((w) => (total > 0 ? (w * rounds) / total : rounds / Math.max(1, d)));
    const counts = raw.map(Math.floor);
    let remaining = rounds - counts.reduce((s, c) => s + c, 0);
    const order = raw.map((_, k) => k)
        .sort((a, b) => ((raw[b] ?? 0) - (counts[b] ?? 0)) - ((raw[a] ?? 0) - (counts[a] ?? 0)) || a - b);
    for (let k = 0; k < order.length && remaining > 0; k += 1, remaining -= 1) {
        const idx = order[k] ?? 0;
        counts[idx] = (counts[idx] ?? 0) + 1;
    }
    const schedule: number[] = [];
    counts.forEach((c, k) => { for (let j = 0; j < c; j += 1) schedule.push(elected[k]); });
    return { elected, counts, schedule };
}

describe("Delegated Proof of Stake", () => {
    it("matches an independent election and largest-remainder schedule", () => {
        for (let n = 1; n <= 6; n += 1) {
            for (let delegates = 1; delegates <= n + 1; delegates += 1) {
                for (let rounds = 1; rounds <= 12; rounds += 1) {
                    for (let trial = 0; trial < 15; trial += 1) {
                        const stakes = Array.from({ length: n }, (_, i) => (trial * 3 + i * 7) % 13);
                        const expected = reference(stakes, delegates, rounds);
                        const data = simulateDelegatedProofOfStake(stakes, delegates, rounds);
                        expect(data.elected).toEqual(expected.elected);
                        expect(data.counts).toEqual(expected.counts);
                        expect(data.schedule).toEqual(expected.schedule);
                        expect(data.schedule.length).toBe(rounds);
                        expect(data.counts.reduce((s, c) => s + c, 0)).toBe(rounds);
                    }
                }
            }
        }
    });

    it("elects the top three and produces a ten-block schedule by default", () => {
        const data = simulateDelegatedProofOfStake([40, 30, 20, 10, 5], 3, 10);
        expect(data.elected).toEqual([0, 1, 2]);
        expect(data.schedule.length).toBe(10);
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 5);
        expect(frames[frames.length - 1]?.meta["schedule"]).toEqual(data.schedule);
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 5);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
