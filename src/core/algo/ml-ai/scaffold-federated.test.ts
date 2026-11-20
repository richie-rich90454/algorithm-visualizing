/** scaffold-federated.test.ts - Convergence, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { scaffoldRun } from "./scaffold-federated";
import type { VisualFrame } from "@/types";

interface Input {
    x0: number[];
    clients: Array<{ H: number[][]; b: number[] }>;
    localSteps: number;
    lr: number;
    rounds: number;
}

function checkFrames(frames: VisualFrame[], rounds: number, d: number): void {
    expect(frames.length).toBe(rounds + 2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rounds * d);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(rounds);
    });
}

describe("SCAFFOLD Federated Optimization", () => {
    const input = mod.defaultInput as Input;

    it("converges to the analytic minimizer of the averaged quadratic", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.rounds, input.x0.length);
        const heterogeneous: Input = {
            x0: [0],
            clients: [
                { H: [[2]], b: [4] },
                { H: [[2]], b: [0] },
            ],
            localSteps: 5,
            lr: 0.05,
            rounds: 200,
        };
        const log = scaffoldRun(heterogeneous);
        const finalX = log[log.length - 1]?.x[0] ?? 0;
        // sum H = 4, sum b = 4, so the global optimum is x = 1
        expect(finalX).toBeCloseTo(1, 3);
        const frameFinal = [...mod.run(heterogeneous)].at(-1)?.meta["x"] as number[];
        expect(frameFinal[0]).toBeCloseTo(finalX, 12);
    });

    it("produces one log entry per round with finite values", () => {
        const log = scaffoldRun(input);
        expect(log.length).toBe(input.rounds);
        log.forEach((entry, i) => {
            expect(entry.round).toBe(i + 1);
            expect(entry.x.every(Number.isFinite)).toBe(true);
            expect(entry.c.every(Number.isFinite)).toBe(true);
            expect(Number.isFinite(entry.objective)).toBe(true);
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
