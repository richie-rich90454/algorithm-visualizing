/**
 * canary-release.test.ts - Reference rollout simulation, gate properties,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./canary-release";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function reference(stages: number[], rates: number[], threshold: number) {
    let finalStage = -1;
    let outcome = "complete";
    for (let i = 0; i < stages.length; i += 1) {
        finalStage = i;
        if (rates[i]! > threshold) {
            outcome = "rolled-back";
            break;
        }
    }
    const traffic = outcome === "rolled-back" ? 0 : stages[stages.length - 1]!;
    return { outcome, finalStage, traffic, stable: outcome === "complete" && traffic >= 100 ? "v2" : "v1" };
}

describe("CanaryRelease", () => {
    it("matches an independent rollout simulation", () => {
        const input = mod.defaultInput as { stages: number[]; errorRates: number[]; threshold: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.stages.length);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input.stages, input.errorRates, input.threshold);
        expect(meta["outcome"]).toBe(expected.outcome);
        expect(meta["finalStage"]).toBe(expected.finalStage);
        expect(meta["canaryTraffic"]).toBe(expected.traffic);
        expect(meta["stableVersion"]).toBe(expected.stable);
    });

    it("rolls back at the first breaching stage and promotes when all are healthy", () => {
        const bad = [...mod.run({ stages: [10, 20, 30], errorRates: [0.01, 0.1, 0.01], threshold: 0.05 })].pop()!.meta;
        expect(bad["outcome"]).toBe("rolled-back");
        expect(bad["finalStage"]).toBe(1);
        expect(bad["canaryTraffic"]).toBe(0);
        const good = [...mod.run({ stages: [10, 20, 100], errorRates: [0.01, 0.02, 0.03], threshold: 0.05 })].pop()!.meta;
        expect(good["outcome"]).toBe("complete");
        expect(good["stableVersion"]).toBe("v2");
    });

    it("never promotes on a partial rollout", () => {
        const meta = [...mod.run({ stages: [10, 50], errorRates: [0, 0], threshold: 0.05 })].pop()!.meta;
        expect(meta["outcome"]).toBe("complete");
        expect(meta["stableVersion"]).toBe("v1");
    });

    it("handles empty input and terminates cleanly", () => {
        const empty = [...mod.run({ stages: [] })];
        expect(empty).toHaveLength(1);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe((mod.defaultInput as { stages: number[] }).stages.length + 2);
        expect(generator.next().done).toBe(true);
    });
});
