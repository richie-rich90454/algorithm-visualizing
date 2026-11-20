/**
 * health-check-probe.test.ts - Reference state machine, anti-flapping
 * properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./health-check-probe";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function reference(results: boolean[], sThresh: number, fThresh: number, initial: boolean) {
    let healthy = initial;
    let s = 0;
    let f = 0;
    const states: number[] = [];
    const transitions: number[] = [];
    for (let i = 0; i < results.length; i += 1) {
        const prev = healthy;
        if (results[i]) {
            s += 1;
            f = 0;
            if (s >= sThresh) {
                healthy = true;
            }
        } else {
            f += 1;
            s = 0;
            if (f >= fThresh) {
                healthy = false;
            }
        }
        states.push(healthy ? 1 : 0);
        if (healthy !== prev) {
            transitions.push(i);
        }
    }
    return { states, transitions, finalHealthy: healthy };
}

describe("HealthCheckProbe", () => {
    it("matches an independent state-machine reference", () => {
        const input = mod.defaultInput as { results: boolean[]; successThreshold: number; failureThreshold: number; initialHealthy: boolean };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.results.length);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input.results, input.successThreshold, input.failureThreshold, input.initialHealthy);
        expect(meta["states"]).toEqual(expected.states);
        expect(meta["transitions"]).toEqual(expected.transitions);
        expect(meta["finalHealthy"]).toBe(expected.finalHealthy);
    });

    it("does not flip on results short of the threshold", () => {
        const meta = [...mod.run({ results: [false, true, false, true], successThreshold: 3, failureThreshold: 3, initialHealthy: true })].pop()!.meta;
        expect(meta["finalHealthy"]).toBe(true);
        expect(meta["transitions"]).toEqual([]);
    });

    it("flips only after a full consecutive streak", () => {
        const meta = [...mod.run({ results: [false, false, false, true, true], successThreshold: 2, failureThreshold: 2, initialHealthy: true })].pop()!.meta;
        expect(meta["states"]).toEqual([1, 0, 0, 0, 1]);
        expect(meta["transitions"]).toEqual([1, 4]);
    });

    it("handles empty input and terminates cleanly", () => {
        const empty = [...mod.run({ results: [] })];
        expect(empty).toHaveLength(1);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe((mod.defaultInput as { results: boolean[] }).results.length + 2);
        expect(generator.next().done).toBe(true);
    });
});
