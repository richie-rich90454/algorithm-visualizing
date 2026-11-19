/** isolation-forest.test.ts - Independent tree traversal, scoring formula, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { buildForest, expectedPathLength } from "./isolation-forest";
import type { VisualFrame } from "@/types";
import type { IsolationNode } from "./isolation-forest";

interface Input {
    points: number[];
    trees: number;
    heightLimit: number;
    seed: number;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["n"]).toBe(n);
    });
}

/** Independent root-to-leaf walk that does not call the module's helper. */
function walk(node: IsolationNode, value: number): number {
    let count = 0;
    let current = node;
    while (current.left && current.right && current.split !== undefined) {
        current = value <= current.split ? current.left : current.right;
        count += 1;
    }
    return count;
}

describe("Isolation Forest", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent traversal of the seeded trees for every path length", () => {
        const frames = [...mod.run(input)];
        expect(frames.length).toBe(input.trees + 2);
        checkFrames(frames, input.points.length);
        const forest = buildForest(input);
        const reported = [...mod.run(input)].at(-1)!.meta["pathLengths"] as number[];
        input.points.forEach((point, i) => {
            const mean = forest.reduce((sum, tree) => sum + walk(tree, point), 0) / forest.length;
            expect(reported[i]!).toBeCloseTo(mean, 10);
        });
    });

    it("uses the standard c(n) normalization and the inverse exponential score", () => {
        const final = [...mod.run(input)].at(-1)!;
        const n = input.points.length;
        const harmonic = Math.log(n - 1) + 0.5772156649015329;
        const c = 2 * harmonic - (2 * (n - 1)) / n;
        expect(expectedPathLength(n)).toBeCloseTo(c, 12);
        expect(Number(final.meta["cFactor"])).toBeCloseTo(c, 12);
        const lengths = final.meta["pathLengths"] as number[];
        const scores = final.meta["scores"] as number[];
        lengths.forEach((h, i) => expect(scores[i]!).toBeCloseTo(Math.pow(2, -h / c), 10));
    });

    it("ranks the far outlier above the tight cluster", () => {
        const final = [...mod.run(input)].at(-1)!;
        const scores = final.meta["scores"] as number[];
        const outlier = Number(final.meta["outlier"]);
        expect(input.points[outlier]).toBe(50);
        for (let i = 0; i < input.points.length; i += 1) {
            if (i !== outlier) {
                expect(scores[outlier]!).toBeGreaterThan(scores[i]!);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(input.trees + 2);
        expect(generator.next().done).toBe(true);
    });
});
