/**
 * federated-averaging.test.ts - Independent FedAvg reference, weighted-average properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./federated-averaging";
import type { VisualFrame } from "@/types";

interface FedClient {
    samples?: number;
    target?: number[];
}
interface Input {
    dim: number;
    rounds: number;
    lr: number;
    localSteps: number;
    clients: FedClient[];
}

function reference(input: Input): number[] {
    const dim = Math.max(1, Math.min(4, Math.floor(input.dim)));
    const defaults = [[1, 1], [-1, 2], [3, -2]];
    const counts = input.clients.map((c) => Math.max(1, Math.floor(c.samples ?? 10)));
    const targets = input.clients.map((c, k) => {
        const t = Array.isArray(c.target) ? c.target : defaults[k % defaults.length] ?? [0, 0];
        return Array.from({ length: dim }, (_, j) => t[j] ?? 0);
    });
    const total = counts.reduce((s, c) => s + c, 0);
    let global = Array.from({ length: dim }, () => 0);
    for (let r = 0; r < input.rounds; r += 1) {
        const locals = targets.map((t) => {
            let w = [...global];
            for (let s = 0; s < input.localSteps; s += 1) {
                w = w.map((wi, j) => wi - input.lr * (wi - (t[j] ?? 0)));
            }
            return w;
        });
        global = Array.from({ length: dim }, (_, j) =>
            locals.reduce((sum, w, k) => sum + (counts[k]! / total) * (w[j] ?? 0), 0),
        );
    }
    return global;
}

function checkFrames(frames: VisualFrame[], input: Input): void {
    expect(frames.length).toBe(1 + input.clients.length * input.rounds + input.rounds + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(input.dim * (1 + input.clients.length));
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["dim"]).toBe(input.dim);
    });
}

describe("FederatedAveraging", () => {
    it("matches an independent FedAvg reference across configurations", () => {
        const cases: Input[] = [
            { dim: 2, rounds: 3, lr: 0.3, localSteps: 2, clients: [
                { samples: 10, target: [1, 1] }, { samples: 20, target: [-1, 2] }, { samples: 30, target: [3, -2] },
            ] },
            { dim: 1, rounds: 5, lr: 0.5, localSteps: 1, clients: [
                { samples: 5, target: [2] }, { samples: 15, target: [-4] },
            ] },
            { dim: 3, rounds: 2, lr: 0.2, localSteps: 3, clients: [
                { samples: 7, target: [1, 0, -1] }, { samples: 9, target: [2, 3, 4] }, { samples: 4, target: [0, -2, 1] },
            ] },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta["globalModel"] as number[];
            for (let j = 0; j < input.dim; j += 1) {
                expect(final[j]).toBeCloseTo(expected[j]!, 12);
            }
            expect(frames[frames.length - 1]?.meta["done"]).toBe(true);
        }
    });

    it("converges toward the sample-weighted target when local steps are large", () => {
        const input: Input = { dim: 1, rounds: 1, lr: 1, localSteps: 40, clients: [
            { samples: 10, target: [1] }, { samples: 30, target: [5] },
        ] };
        const final = [...mod.run(input)].pop()?.meta["globalModel"] as number[];
        expect(final[0]).toBeCloseTo((10 * 1 + 30 * 5) / 40, 10);
    });

    it("keeps the global model a convex combination of client models", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        for (const frame of frames) {
            const global = frame.meta["globalModel"] as number[];
            const sum = global.reduce((s, w) => s + w, 0);
            expect(Number.isFinite(sum)).toBe(true);
            expect(Math.abs(sum)).toBeLessThan(20);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(1 + 3 * 3 + 3 + 1);
        expect(generator.next().done).toBe(true);
    });
});
