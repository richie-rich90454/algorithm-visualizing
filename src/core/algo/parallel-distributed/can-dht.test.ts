/**
 * can-dht.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./can-dht";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("CAN DHT Routing", () => {
    it("arrives at the owning zone in exactly the Manhattan hop count", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["arrived"]).toBe(true);
        expect(Number(final?.["hops"])).toBe(5);
    });

    it("reduces the remaining distance by one on every hop", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const distances = frames.map((frame) => Number(frame.meta["distance"]));
        for (let i = 1; i < frames.length - 1; i += 1) {
            expect(distances[i]!).toBe(distances[i - 1]! - 1);
        }
        expect(distances[distances.length - 1]).toBe(0);
    });

    it("matches a brute-force target zone for several keys", () => {
        const cases = [
            { gridX: 4, gridY: 4, key: [0.02, 0.02], start: [3, 3] },
            { gridX: 8, gridY: 8, key: [0.99, 0.01], start: [0, 7] },
            { gridX: 4, gridY: 4, key: [0.5, 0.5], start: [0, 0] },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const final = frames[frames.length - 1]?.meta;
            const expectedX = Math.min(input.gridX - 1, Math.floor(input.key[0]! * input.gridX));
            const expectedY = Math.min(input.gridY - 1, Math.floor(input.key[1]! * input.gridY));
            const expectedHops = Math.abs(expectedX - input.start[0]) + Math.abs(expectedY - input.start[1]);
            expect(final?.["arrived"]).toBe(true);
            expect(Number(final?.["hops"])).toBe(expectedHops);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
