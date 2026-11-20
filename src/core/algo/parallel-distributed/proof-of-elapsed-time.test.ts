/**
 * proof-of-elapsed-time.test.ts - Shortest-wait election property, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateProofOfElapsedTime } from "./proof-of-elapsed-time";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], participants: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(participants);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Proof of Elapsed Time", () => {
    it("matches an independent argmin and ignores invalid waits", () => {
        for (let n = 1; n <= 7; n += 1) {
            for (let trial = 0; trial < 120; trial += 1) {
                const waits = Array.from({ length: n }, (_, i) => (trial === 0 && i === 0 ? -1 : ((trial * 7 + i * 3) % 11) / 4));
                const data = simulateProofOfElapsedTime(waits);
                const valid = waits.map((w) => Number.isFinite(w) && w >= 0);
                let expected = -1;
                waits.forEach((w, i) => {
                    if (valid[i] && (expected < 0 || w < (waits[expected] ?? Infinity))) expected = i;
                });
                expect(data.verified).toEqual(valid);
                expect(data.winner).toBe(expected);
                if (expected >= 0) {
                    waits.forEach((w, i) => {
                        if (valid[i]) expect((waits[expected] ?? 0) <= w).toBe(true);
                    });
                }
            }
        }
    });

    it("elects the shortest verified wait and rejects a negative proof", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 5);
        expect(frames[frames.length - 1]?.meta["winner"]).toBe(1);
        const bad = simulateProofOfElapsedTime([-1, 2, 3]);
        expect(bad.winner).toBe(1);
        const none = simulateProofOfElapsedTime([-1, -2]);
        expect(none.winner).toBe(-1);
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
