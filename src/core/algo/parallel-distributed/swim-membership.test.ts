/**
 * swim-membership.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./swim-membership";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(n);
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

describe("SWIM membership", () => {
    it("keeps every member alive when no failure is injected", () => {
        const frames = [...mod.run({ nodes: 5, failed: -1, flaky: -1, rounds: 15, indirectK: 2 })];
        checkFrames(frames, 5);
        const statuses = finalMeta(frames)["statuses"] as string[];
        expect(statuses.every((s) => s === "alive")).toBe(true);
    });

    it("converges every live member on the death of a failed node", () => {
        const n = 8;
        const failed = 5;
        const frames = [...mod.run({ nodes: n, failed, flaky: -1, rounds: 200, indirectK: 2, suspectThreshold: 2 })];
        checkFrames(frames, n);
        const metaFrame = finalMeta(frames);
        expect(metaFrame["deadKnown"]).toBe(n - 1);
        expect(metaFrame["converged"]).toBe(true);
        const statuses = metaFrame["statuses"] as string[];
        // The failed member's own row is irrelevant; every other member knows the death.
        for (let observer = 0; observer < n; observer += 1) {
            if (observer !== failed) {
                expect(statuses[observer * n + failed]).toBe("dead");
            }
        }
    });

    it("never marks a flaky member dead when indirect relays answer", () => {
        const n = 6;
        const flaky = 2;
        const frames = [...mod.run({ nodes: n, failed: -1, flaky, rounds: 30, indirectK: 2, suspectThreshold: 2 })];
        checkFrames(frames, n);
        const statuses = finalMeta(frames)["statuses"] as string[];
        for (let observer = 0; observer < n; observer += 1) {
            expect(statuses[observer * n + flaky]).toBe("alive");
        }
    });

    it("reports indirect probes and terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const frame of generator) {
            count += 1;
            expect(Number(frame.meta["indirectProbes"])).toBeGreaterThanOrEqual(0);
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
