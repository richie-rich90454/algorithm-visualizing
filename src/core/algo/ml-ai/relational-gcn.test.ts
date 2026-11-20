/** relational-gcn.test.ts - Independent aggregation oracle, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./relational-gcn";
import type { VisualFrame } from "@/types";

interface Input {
    features: number[];
    edges: Array<[number, number, number]>;
    relationWeights: number[];
    relu: boolean;
}

type Edge = [number, number, number];

function reference(input: Input) {
    const hidden = input.features.map(() => 0);
    for (const edge of input.edges) {
        const [source, target, relation] = edge;
        if (target >= 0 && target < hidden.length) {
            hidden[target] = (hidden[target] ?? 0) + (input.relationWeights[relation] ?? 0) * (input.features[source] ?? 0);
        }
    }
    return hidden.map((message, i) => {
        const total = message + (input.relationWeights[0] ?? 0) * (input.features[i] ?? 0);
        return input.relu ? Math.max(0, total) : total;
    });
}

function checkFrames(frames: VisualFrame[], nodes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
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

describe("Relational GCN", () => {
    it("matches an independent typed-edge aggregation", () => {
        const cases: Input[] = [
            { features: [1, 2, 3, 4], edges: [[0, 1, 1], [1, 2, 2], [2, 3, 1], [3, 0, 2]], relationWeights: [1, 0.5, -0.5], relu: true },
            { features: [2, -1, 3], edges: [[0, 1, 1], [0, 2, 1], [2, 1, 2]], relationWeights: [1, 2, -1], relu: false },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.features.length);
            const expected = reference(input);
            const hidden = [...mod.run(input)].at(-1)?.meta?.["hidden"] as number[];
            hidden.forEach((value, i) => expect(value).toBeCloseTo(expected[i] ?? 0, 8));
        }
    });

    it("is independent of edge order", () => {
        const base: Input = { features: [1, 2, 3], edges: [[0, 1, 1], [2, 1, 2], [1, 0, 2]], relationWeights: [1, 0.7, -0.4], relu: false };
        const reversed: Input = { ...base, edges: [...base.edges].reverse() as Edge[] };
        const a = [...mod.run(base)].at(-1)?.meta?.["hidden"];
        const b = [...mod.run(reversed)].at(-1)?.meta?.["hidden"];
        expect(a).toEqual(b);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
