/**
 * horizontal-pod-autoscaler.test.ts - Independent reconciliation reference,
 * bounds and tolerance properties, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./horizontal-pod-autoscaler";
import type { VisualFrame } from "@/types";

interface Config {
    values: number[];
    target: number;
    current: number;
    minReplicas: number;
    maxReplicas: number;
    tolerance: number;
    recent: number[];
    window: number;
}

function checkFrames(frames: VisualFrame[], pods: number): void {
    expect(frames.length).toBe(pods + 5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(pods);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(pods);
    });
}

/** A separate implementation of the same controller decision rules. */
function reference(cfg: Config) {
    const clamp = (v: number): number => Math.max(cfg.minReplicas, Math.min(cfg.maxReplicas, v));
    const total = cfg.values.reduce((a, b) => a + b, 0);
    const rawDesired = Math.ceil(total / cfg.target);
    const afterTolerance = Math.abs(rawDesired - cfg.current) <= cfg.tolerance * cfg.current ? cfg.current : rawDesired;
    const afterClamp = clamp(afterTolerance);
    const candidates = [...cfg.recent.slice(-cfg.window).map(clamp), afterClamp];
    const finalReplicas = afterClamp > cfg.current
        ? Math.min(...candidates)
        : afterClamp < cfg.current
            ? Math.max(...candidates)
            : afterClamp;
    const action = finalReplicas > cfg.current ? "scale-up" : finalReplicas < cfg.current ? "scale-down" : "none";
    return { total, rawDesired, afterTolerance, afterClamp, finalReplicas, action };
}

function finalMeta(frames: VisualFrame[]) {
    return frames[frames.length - 1]!.meta;
}

describe("HorizontalPodAutoscaler", () => {
    it("matches an independent controller on several configurations", () => {
        const base = mod.defaultInput as Config;
        const cases: Config[] = [
            base,
            { ...base, values: [10, 12, 9], current: 5, target: 20, recent: [3, 4, 4], window: 2 },
            { ...base, values: [200, 180, 220, 190], current: 2, target: 60, recent: [8, 9, 10], window: 3, maxReplicas: 8 },
            { ...base, values: [], current: 3, target: 50, recent: [2], window: 1 },
        ];
        for (const cfg of cases) {
            const frames = [...mod.run(cfg)];
            checkFrames(frames, cfg.values.length);
            const meta = finalMeta(frames);
            const expected = reference(cfg);
            for (const key of ["total", "rawDesired", "afterTolerance", "afterClamp", "finalReplicas", "action"] as const) {
                expect(meta[key]).toEqual(expected[key]);
            }
        }
    });

    it("never leaves the replica bounds and respects the tolerance band", () => {
        const cfg: Config = {
            values: [70, 70, 70, 70], target: 70, current: 4,
            minReplicas: 2, maxReplicas: 6, tolerance: 0.1, recent: [4], window: 1,
        };
        const meta = finalMeta([...mod.run(cfg)]);
        expect(meta["rawDesired"]).toBe(4);
        expect(meta["action"]).toBe("none");

        const heavy: Config = { ...cfg, values: [700, 700, 700, 700], recent: [6, 6, 6], window: 3 };
        const heavyMeta = finalMeta([...mod.run(heavy)]);
        const final = heavyMeta["finalReplicas"] as number;
        expect(final).toBeGreaterThanOrEqual(heavy.minReplicas);
        expect(final).toBeLessThanOrEqual(heavy.maxReplicas);
    });

    it("keeps scale-down at least as large as the most conservative recent proposal", () => {
        const cfg: Config = {
            values: [10, 10], target: 70, current: 8,
            minReplicas: 1, maxReplicas: 12, tolerance: 0.1, recent: [6, 7, 7], window: 3,
        };
        const meta = finalMeta([...mod.run(cfg)]);
        expect(meta["action"]).toBe("scale-down");
        expect(meta["finalReplicas"]).toBe(Math.max(6, 7, 7, meta["afterClamp"] as number));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(9);
        expect(generator.next().done).toBe(true);
    });
});
