/**
 * reliable-multicast.test.ts - Exhaustive delivery invariant, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateMulticast } from "./reliable-multicast";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], receivers: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(receivers + 1);
        expect(frame.edges.length).toBe(receivers);
        expect(frame.edges.every((e) => e.directed && e.sourceId === "sender")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Reliable Multicast", () => {
    it("exhaustively checks exact-once in-order delivery for every loss pattern", () => {
        for (let receivers = 1; receivers <= 3; receivers += 1) {
            for (let messages = 1; messages <= 3; messages += 1) {
                const pairs: number[][] = [];
                for (let r = 0; r < receivers; r += 1) {
                    for (let s = 1; s <= messages; s += 1) {
                        pairs.push([r, s]);
                    }
                }
                for (let mask = 0; mask < 1 << pairs.length; mask += 1) {
                    const missed = pairs.filter((_, i) => (mask >> i) & 1);
                    const data = simulateMulticast(receivers, messages, missed);
                    expect(data.allDelivered).toBe(true);
                    for (let r = 0; r < receivers; r += 1) {
                        expect(data.delivered[r]).toEqual(Array.from({ length: messages }, (_, i) => i + 1));
                        const expectedNacks = missed.filter(([mr]) => mr === r).map(([, s]) => s).sort((a, b) => a - b);
                        expect([...data.nacks[r]!].sort((a, b) => a - b)).toEqual(expectedNacks);
                    }
                }
            }
        }
    });

    it("emits well-formed frames ending in full delivery", () => {
        const input = mod.defaultInput as { receivers: number; messages: number; missed: number[][] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.receivers);
        expect(frames[frames.length - 1]?.meta["allDelivered"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
