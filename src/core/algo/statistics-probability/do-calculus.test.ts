/**
 * do-calculus.test.ts - Back-door criterion cases, adjustment check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./do-calculus";
import type { VisualFrame } from "@/types";

type Edge = [string, string];

function checkFrames(frames: VisualFrame[], nodeCount: number): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodeCount);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function verdict(input: Record<string, unknown>) {
    const frames = [...mod.run(input)];
    checkFrames(frames, new Set((input["edges"] as Edge[]).map(([a, b]) => [a, b]).flat()).size);
    return frames[frames.length - 1]?.meta;
}

describe("DoCalculus", () => {
    it("identifies the effect when a confounder is adjusted for", () => {
        const edges: Edge[] = [["Z", "X"], ["Z", "Y"], ["X", "Y"]];
        const final = verdict({
            edges,
            treatment: "X",
            outcome: "Y",
            adjust: ["Z"],
            pZ: { Z: 1 },
            pYGivenXZ: { "1": { Z: 0.9 }, "0": { Z: 0.3 } },
        });
        expect(final?.["satisfied"]).toBe(true);
        expect(Number(final?.["effect1"])).toBeCloseTo(0.9, 10);
        expect(Number(final?.["effect0"])).toBeCloseTo(0.3, 10);
        expect(Number(final?.["ace"])).toBeCloseTo(0.6, 10);
    });

    it("rejects an empty adjustment set when confounding remains", () => {
        const edges: Edge[] = [["Z", "X"], ["Z", "Y"], ["X", "Y"]];
        const final = verdict({
            edges,
            treatment: "X",
            outcome: "Y",
            adjust: [],
            pZ: { Z: 1 },
            pYGivenXZ: { "1": { Z: 0.9 }, "0": { Z: 0.3 } },
        });
        expect(final?.["satisfied"]).toBe(false);
        expect(Number(final?.["pathCount"])).toBeGreaterThan(0);
    });

    it("rejects adjusting for a descendant and for an opened collider", () => {
        const mediator: Edge[] = [["X", "Z"], ["Z", "Y"], ["X", "Y"]];
        expect(
            verdict({
                edges: mediator,
                treatment: "X",
                outcome: "Y",
                adjust: ["Z"],
                pZ: { Z: 1 },
                pYGivenXZ: { "1": { Z: 1 }, "0": { Z: 0 } },
            })?.["satisfied"],
        ).toBe(false);

        const mbias: Edge[] = [["A", "X"], ["A", "B"], ["Y", "B"], ["X", "Y"]];
        const base = {
            edges: mbias,
            treatment: "X",
            outcome: "Y",
            pZ: { A: 1, B: 1 },
            pYGivenXZ: { "1": { A: 0.8, B: 0.7 }, "0": { A: 0.2, B: 0.1 } },
        };
        expect(verdict({ ...base, adjust: ["B"] })?.["satisfied"]).toBe(false);
        expect(verdict({ ...base, adjust: ["A"] })?.["satisfied"]).toBe(true);
    });

    it("computes the adjustment as a weighted average over covariate states", () => {
        const edges: Edge[] = [["Z", "X"], ["Z", "Y"], ["X", "Y"]];
        const final = verdict({
            edges,
            treatment: "X",
            outcome: "Y",
            adjust: ["Z"],
            pZ: { z1: 0.4, z2: 0.6 },
            pYGivenXZ: { "1": { z1: 0.9, z2: 0.2 }, "0": { z1: 0.3, z2: 0.1 } },
        });
        expect(Number(final?.["effect1"])).toBeCloseTo(0.4 * 0.9 + 0.6 * 0.2, 10);
        expect(Number(final?.["effect0"])).toBeCloseTo(0.4 * 0.3 + 0.6 * 0.1, 10);
        expect(Number(final?.["ace"])).toBeCloseTo(0.3, 10);
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
