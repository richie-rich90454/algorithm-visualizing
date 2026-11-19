/**
 * avalanche-consensus.test.ts - Majority convergence and finality stability checks.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateAvalanche } from "./avalanche-consensus";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], nodes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodes);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Avalanche Consensus", () => {
    it("converges every node to a strict initial majority and finalizes it", () => {
        for (let n = 3; n <= 8; n += 1) {
            const majorityCount = Math.floor(n / 2) + 1;
            const colors = Array.from({ length: n }, (_, i) => (i < majorityCount ? 0 : 1));
            const k = n - 1;
            const alpha = Math.ceil(k / 2);
            const data = simulateAvalanche(colors, 8, k, alpha, 3, 1234);
            expect(data.colors.every((c) => c === 0)).toBe(true);
            expect(data.finalized.every(Boolean)).toBe(true);
            expect(data.confidence.every((c) => c >= 3)).toBe(true);
        }
    });

    it("never changes a finalized color when polling continues", () => {
        const colors = [0, 0, 0, 1, 1];
        const short = simulateAvalanche(colors, 3, 4, 2, 3, 7);
        const long = simulateAvalanche(colors, 12, 4, 2, 3, 7);
        short.finalized.forEach((isFinal, i) => {
            if (isFinal) expect(long.colors[i]).toBe(short.colors[i]);
        });
        expect(long.colors.every((c) => c === 0)).toBe(true);
        expect(short.initialColors).toEqual(colors);
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 5);
        expect(frames.length).toBe(7);
        expect(frames[frames.length - 1]?.meta["finalized"]).toBe(5);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
