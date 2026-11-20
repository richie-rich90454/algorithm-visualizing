/**
 * junction-tree-algorithm.test.ts - Exact marginal cross-check by enumeration.
 */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./junction-tree-algorithm";

type Factor = { scope: string[]; table: number[] };
type Model = { variables: string[]; factors: Factor[] };

function bruteMarginals(model: Model): number[] {
    const { variables, factors } = model;
    const result = variables.map(() => 0);
    let total = 0;
    for (let assignment = 0; assignment < 1 << variables.length; assignment += 1) {
        let weight = 1;
        for (const factor of factors) {
            let index = 0;
            for (let k = 0; k < factor.scope.length; k += 1) {
                const position = variables.indexOf(factor.scope[k] ?? "");
                index |= (((assignment >> position) & 1) << k);
            }
            weight *= factor.table[index] ?? 0;
        }
        total += weight;
        for (let i = 0; i < variables.length; i += 1) {
            if (((assignment >> i) & 1) === 1) result[i] = (result[i] ?? 0) + weight;
        }
    }
    return result.map((value) => (total > 0 ? value / total : 0));
}

function verifyFrameShapes(frames: VisualFrame[]): void {
    const lineCount = module.pseudocode?.length ?? 1;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lineCount);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Junction Tree Algorithm", () => {
    it("matches enumeration on the default chain", () => {
        const model = (module.defaultInput as { model: Model }).model;
        const frames = [...module.run(module.defaultInput)];
        verifyFrameShapes(frames);
        const final = frames[frames.length - 1];
        const actual = final?.meta.marginals as number[];
        const expected = bruteMarginals(model);
        expect(actual).toHaveLength(expected.length);
        actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i] ?? 0, 9));
    });

    it("matches enumeration on cyclic and random binary models", () => {
        const cycle: Model = {
            variables: ["A", "B", "C", "D"],
            factors: [
                { scope: ["A", "B"], table: [0.9, 0.1, 0.2, 0.8] },
                { scope: ["B", "C"], table: [0.7, 0.3, 0.4, 0.6] },
                { scope: ["C", "D"], table: [0.5, 0.5, 0.2, 0.8] },
                { scope: ["D", "A"], table: [0.6, 0.4, 0.3, 0.7] },
            ],
        };
        const models: Model[] = [cycle];
        for (let trial = 0; trial < 12; trial += 1) {
            const variables = ["A", "B", "C", "D"];
            const factors: Factor[] = variables.map(() => ({
                scope: [variables[trial % 4] ?? "A"],
                table: [0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6],
            }));
            factors.push({
                scope: ["A", "B"],
                table: [0.4 + Math.random(), 0.1 + Math.random() * 0.5, 0.1 + Math.random() * 0.5, 0.4 + Math.random()],
            });
            factors.push({
                scope: ["C", "D"],
                table: [0.4 + Math.random(), 0.1 + Math.random() * 0.5, 0.1 + Math.random() * 0.5, 0.4 + Math.random()],
            });
            models.push({ variables, factors });
        }
        for (const model of models) {
            const frames = [...module.run({ model })];
            const final = frames[frames.length - 1];
            const actual = final?.meta.marginals as number[];
            const expected = bruteMarginals(model);
            actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i] ?? 0, 9));
        }
    });

    it("terminates with sequential step numbers", () => {
        const frames = [...module.run(module.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((frame, index) => expect(frame.stepNumber).toBe(index));
    });
});
