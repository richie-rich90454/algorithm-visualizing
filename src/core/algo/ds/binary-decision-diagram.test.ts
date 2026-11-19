import { describe, expect, it } from "vitest";
import mod, { buildBDD, evalBDD, isReduced } from "./binary-decision-diagram";

type Frame = ReturnType<typeof mod.run> extends Generator<infer F> ? F : never;

function checkFrames(frames: Frame[]): void {
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 12);
        expect(frame.meta).toBeDefined();
    });
}

const bitsOf = (index: number, width: number): number[] =>
    Array.from({ length: width }, (_, i) => (index >>> (width - 1 - i)) & 1);

describe("Binary Decision Diagram", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta.result).toBe(1);
    });

    it("evaluates exactly the truth table for every assignment and is reduced", () => {
        for (let trial = 0; trial < 40; trial += 1) {
            const truth = Array.from({ length: 8 }, () => (Math.random() < 0.5 ? 0 : 1));
            const { nodes, root, levels } = buildBDD(truth);
            expect(levels).toBe(3);
            expect(isReduced(nodes)).toBe(true);
            for (let index = 0; index < 8; index += 1) {
                expect(evalBDD(nodes, root, bitsOf(index, 3))).toBe(truth[index]);
            }
        }
    });

    it("is canonical: equal functions produce equal reduced node sets", () => {
        const a = buildBDD([1, 0, 1, 0, 1, 0, 1, 0]);
        const b = buildBDD([1, 0, 1, 0, 1, 0, 1, 0]);
        const serialize = (t: ReturnType<typeof buildBDD>): string =>
            JSON.stringify(t.nodes.filter((n) => n.variable >= 0).map((n) => [n.variable, n.low, n.high]));
        expect(serialize(a)).toBe(serialize(b));
        expect(a.root).toBe(b.root);
    });
});
