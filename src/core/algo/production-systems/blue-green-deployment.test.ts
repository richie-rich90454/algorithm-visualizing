/**
 * blue-green-deployment.test.ts - Switchover decisions, router-edge invariants,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./blue-green-deployment";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = frame.entities.map((e) => e.id);
        expect(ids).toContain("router");
        expect(ids).toContain("blue");
        expect(ids).toContain("green");
        expect(frame.edges).toHaveLength(1);
        expect(frame.edges[0]!.sourceId).toBe("router");
        expect(ids).toContain(frame.edges[0]!.targetId);
        expect(frame.edges[0]!.directed).toBe(true);
    });
}

/** Reference decision for the final live environment. */
function reference(greenReady: boolean, smokeTests: boolean[], bakeSucceeded: boolean) {
    const smokePassed = greenReady && smokeTests.length > 0 && smokeTests.every(Boolean);
    if (!smokePassed) {
        return { active: "blue", outcome: "aborted" };
    }
    return bakeSucceeded
        ? { active: "green", outcome: "complete" }
        : { active: "blue", outcome: "rolled-back" };
}

describe("BlueGreenDeployment", () => {
    it("matches the reference across all decision branches", () => {
        const cases: Array<[boolean, boolean[], boolean]> = [
            [true, [true, true], true],
            [true, [true, false], true],
            [false, [true], true],
            [true, [true], false],
        ];
        for (const [ready, tests, bake] of cases) {
            const frames = [...mod.run({ greenReady: ready, smokeTests: tests, bakeSucceeded: bake })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const expected = reference(ready, tests, bake);
            expect(final["active"]).toBe(expected.active);
            expect(final["outcome"]).toBe(expected.outcome);
            expect(frames[frames.length - 1]!.edges[0]!.targetId).toBe(expected.active);
        }
    });

    it("keeps blue live until the switch and points the edge at the active environment", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames) {
            expect(frame.edges[0]!.targetId).toBe(frame.meta["active"]);
        }
        expect(frames[0]!.meta["active"]).toBe("blue");
        expect(frames[3]!.meta["active"]).toBe("green");
    });

    it("aborts before switching when smoke tests fail", () => {
        const frames = [...mod.run({ smokeTests: [false] })];
        expect(frames).toHaveLength(3);
        expect(frames.every((f) => f.meta["active"] === "blue")).toBe(true);
        expect(frames[frames.length - 1]!.meta["outcome"]).toBe("aborted");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThanOrEqual(5);
        expect(generator.next().done).toBe(true);
    });
});
