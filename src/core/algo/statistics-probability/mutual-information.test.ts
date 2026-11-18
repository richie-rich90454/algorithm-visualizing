import { describe, expect, it } from "vitest";
import mod from "./mutual-information";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent brute-force mutual information in bits. */
function reference(pairs: Array<[number, number]>): number {
    const xs = [...new Set(pairs.map((pair) => pair[0]))].sort((a, b) => a - b);
    const ys = [...new Set(pairs.map((pair) => pair[1]))].sort((a, b) => a - b);
    const counts = new Map<string, number>();
    const px = new Map<number, number>();
    const py = new Map<number, number>();
    for (const [x, y] of pairs) {
        counts.set(`${x},${y}`, (counts.get(`${x},${y}`) ?? 0) + 1);
        px.set(x, (px.get(x) ?? 0) + 1);
        py.set(y, (py.get(y) ?? 0) + 1);
    }
    let mi = 0;
    for (const x of xs) {
        for (const y of ys) {
            const joint = (counts.get(`${x},${y}`) ?? 0) / pairs.length;
            if (joint > 0) {
                const product = ((px.get(x) ?? 0) / pairs.length) * ((py.get(y) ?? 0) / pairs.length);
                mi += joint * Math.log2(joint / product);
            }
        }
    }
    return mi;
}

describe("Mutual Information", () => {
    it("matches an independent brute-force computation and the entropy identity", () => {
        const input = mod.defaultInput as { pairs: Array<[number, number]> };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["mi"] as number).toBeCloseTo(reference(input.pairs), 10);
        expect(meta?.["mi"] as number).toBeCloseTo(
            (meta?.["entropyX"] as number) + (meta?.["entropyY"] as number) - (meta?.["entropyXY"] as number),
            10,
        );
        expect(meta?.["mi"] as number).toBeGreaterThan(0);
        expect((meta?.["joint"] as number[]).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
    });

    it("is zero for independent pairs and equals the entropy for a deterministic map", () => {
        const independent = [...mod.run({ pairs: [[0, 0], [0, 1], [1, 0], [1, 1]] })];
        expect(independent[independent.length - 1]?.meta["mi"] as number).toBeCloseTo(0, 10);

        const deterministic = [...mod.run({ pairs: [[0, 0], [1, 1], [2, 2]] })];
        const dMeta = deterministic[deterministic.length - 1]?.meta;
        expect(dMeta?.["mi"] as number).toBeCloseTo(Math.log2(3), 10);
        expect(dMeta?.["mi"] as number).toBeCloseTo(dMeta?.["entropyX"] as number, 10);
    });

    it("is symmetric under swapping the variables and terminates", () => {
        const pairs: Array<[number, number]> = [[0, 0], [0, 1], [1, 0], [1, 1], [1, 1], [2, 0]];
        const forward = [...mod.run({ pairs })];
        const swapped = [...mod.run({ pairs: pairs.map(([x, y]) => [y, x] as [number, number]) })];
        expect(forward[forward.length - 1]?.meta["mi"] as number).toBeCloseTo(
            swapped[swapped.length - 1]?.meta["mi"] as number,
            10,
        );
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
