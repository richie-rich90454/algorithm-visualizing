/** round-robin-dns.test.ts - Independent modulo replay, fairness bound, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./round-robin-dns";
import type { VisualFrame } from "@/types";

interface DnsInput { servers: string[]; requests: number; }

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Round-Robin DNS", () => {
    it("matches an independent modulo loop on the default input", () => {
        const input = mod.defaultInput as DnsInput;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = Array.from({ length: input.requests }, (_, i) => i % input.servers.length);
        expect(frames[frames.length - 1]?.meta["assignments"]).toEqual(expected);
        const counts = input.servers.map((_, i) => expected.filter((s) => s === i).length);
        expect(frames[frames.length - 1]?.meta["counts"]).toEqual(counts);
    });

    it("keeps per-server counts within one of each other", () => {
        const servers = ["a", "b", "c", "d", "e"];
        for (const requests of [1, 7, 10, 11, 100]) {
            const frames = [...mod.run({ servers, requests })];
            const counts = frames[frames.length - 1]?.meta["counts"] as number[];
            expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
            expect(counts.reduce((sum, value) => sum + value, 0)).toBe(requests);
        }
    });

    it("uses every server when there are enough requests", () => {
        const servers = ["a", "b", "c"];
        const frames = [...mod.run({ servers, requests: 9 })];
        const counts = frames[frames.length - 1]?.meta["counts"] as number[];
        expect(counts).toEqual([3, 3, 3]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
