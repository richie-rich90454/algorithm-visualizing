/**
 * bakery-algorithm.test.ts - Mutual exclusion and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./bakery-algorithm";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Bakery algorithm", () => {
    it("never allows two processes inside at once", () => {
        for (const processes of [3, 4, 5]) {
            const frames = [...mod.run({ processes, visits: 2 })];
            checkFrames(frames, processes);
            for (const frame of frames) {
                expect(Number(frame.meta["concurrent"])).toBeLessThanOrEqual(1);
                expect(Number(frame.meta["maxConcurrent"])).toBeLessThanOrEqual(1);
            }
            const final = frames[frames.length - 1]!.meta;
            expect(final["allFinished"]).toBe(true);
            const entries = final["entries"] as number[];
            for (const value of entries) expect(value).toBe(2);
        }
    });

    it("keeps held ticket numbers unique", () => {
        const frames = [...mod.run({ processes: 4, visits: 2 })];
        for (const frame of frames) {
            const tickets = (frame.meta["tickets"] as number[]).filter((ticket) => ticket > 0);
            expect(new Set(tickets).size).toBe(tickets.length);
        }
    });

    it("respects ticket order when entering", () => {
        const frames = [...mod.run({ processes: 4, visits: 1 })];
        const arrivals: Array<{ process: number; ticket: number }> = [];
        for (const frame of frames) {
            const inCS = Number(frame.meta["inCS"]);
            if (inCS >= 0) {
                const process = inCS;
                const ticket = (frame.meta["tickets"] as number[])[process]!;
                if (arrivals.length === 0 || arrivals[arrivals.length - 1]!.process !== process) {
                    arrivals.push({ process, ticket });
                }
            }
        }
        expect(arrivals.length).toBeGreaterThan(1);
        for (let i = 1; i < arrivals.length; i += 1) {
            expect(arrivals[i]!.ticket).toBeGreaterThan(arrivals[i - 1]!.ticket);
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
