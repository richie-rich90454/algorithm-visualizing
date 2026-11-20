/** center-loss.test.ts - Independent loss and center-update oracle, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./center-loss";
import type { VisualFrame } from "@/types";

interface Input {
    features: number[][];
    labels: number[];
    centers: number[][];
    learningRate: number;
}

function reference(input: Input) {
    const counts = input.centers.map(() => 0);
    const sums = input.centers.map((c) => c.map(() => 0));
    let loss = 0;
    for (let i = 0; i < input.features.length; i += 1) {
        const label = Math.max(0, Math.min(input.centers.length - 1, input.labels[i] ?? 0));
        counts[label] = (counts[label] ?? 0) + 1;
        const dim = Math.max(input.features[i]?.length ?? 0, input.centers[label]?.length ?? 0);
        let squared = 0;
        for (let d = 0; d < dim; d += 1) {
            const value = input.features[i]?.[d] ?? 0;
            squared += (value - (input.centers[label]?.[d] ?? 0)) ** 2;
            sums[label]![d] = (sums[label]![d] ?? 0) + value;
        }
        loss += 0.5 * squared;
    }
    const updated = input.centers.map((center, j) =>
        counts[j] === 0
            ? center.slice()
            : center.map((value, d) => value + input.learningRate * ((sums[j]?.[d] ?? 0) / (counts[j] ?? 1) - value)),
    );
    return { loss, updated, counts };
}

function checkFrames(frames: VisualFrame[], nodes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(nodes);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        frame.edges.forEach((edge) => {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        });
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Center Loss", () => {
    it("matches an independent center-update oracle", () => {
        const cases: Input[] = [
            { features: [[0, 0], [2, 0], [4, 4]], labels: [0, 0, 1], centers: [[1, 0], [3, 3]], learningRate: 0.25 },
            { features: [[1, 2, 3], [-1, 0, 2]], labels: [1, 1], centers: [[0, 0, 0], [0, 0, 0]], learningRate: 0.5 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.features.length + input.centers.length);
            const expected = reference(input);
            const meta = frames[frames.length - 1]?.meta;
            expect(Number(meta?.["loss"])).toBeCloseTo(expected.loss, 8);
            const updated = meta?.["updatedCenters"] as number[][];
            updated.forEach((center, j) => center.forEach((value, d) => expect(value).toBeCloseTo(expected.updated[j]?.[d] ?? 0, 8)));
            expect(meta?.["counts"]).toEqual(expected.counts);
        }
    });

    it("leaves empty-class centers unchanged", () => {
        const input: Input = { features: [[1, 1]], labels: [0], centers: [[0, 0], [10, 10]], learningRate: 0.5 };
        const meta = [...mod.run(input)].at(-1)?.meta;
        const updated = meta?.["updatedCenters"] as number[][];
        expect(updated[1]).toEqual([10, 10]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
