/** fedadam.test.ts - Adam reference cross-check, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod, { averageClientDeltas, fedAdamStep, initFedAdamState } from "./fedadam";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("FedAdam", () => {
    it("matches a hand-written Adam reference over several rounds", () => {
        const global = [0, 0];
        let w = [...global];
        let m = [0, 0];
        let v = [0, 0];
        let state = initFedAdamState(2);
        const deltas = [
            [0.4, -0.6],
            [0.2, 0.1],
            [-0.3, 0.5],
        ];
        const lr = 0.1;
        const b1 = 0.9;
        const b2 = 0.999;
        const tau = 1e-8;
        for (let t = 1; t <= 4; t += 1) {
            const delta = deltas[(t - 1) % deltas.length]!;
            // Reference Adam.
            m = m.map((mv, i) => b1 * mv + (1 - b1) * delta[i]!);
            v = v.map((vv, i) => b2 * vv + (1 - b2) * delta[i]! ** 2);
            const expected = w.map(
                (wv, i) =>
                    wv + (lr * (m[i]! / (1 - b1 ** t))) / (Math.sqrt(v[i]! / (1 - b2 ** t)) + tau),
            );
            // Module FedAdam.
            const result = fedAdamStep(w, delta, state, lr, b1, b2, tau);
            result.weights.forEach((got, i) => expect(got).toBeCloseTo(expected[i]!, 10));
            w = result.weights;
            state = result.state;
        }
    });

    it("averages client deltas correctly", () => {
        const avg = averageClientDeltas([0, 0], [
            [1, 2],
            [3, 4],
        ]);
        expect(avg[0]).toBeCloseTo(2, 10);
        expect(avg[1]).toBeCloseTo(3, 10);
        expect(averageClientDeltas([1, 1], []).join(",")).toBe("0,0");
    });

    it("takes a learning-rate-sized first step per coordinate", () => {
        const result = fedAdamStep([0], [123], initFedAdamState(1), 0.1, 0.9, 0.999, 1e-8);
        expect(result.weights[0]).toBeCloseTo(0.1, 6);
    });

    it("produces well-formed frames and terminates", () => {
        const input = mod.defaultInput as { globalWeights: number[] };
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, input.globalWeights.length);
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(frames.length);
        expect(gen.next().done).toBe(true);
    });
});
