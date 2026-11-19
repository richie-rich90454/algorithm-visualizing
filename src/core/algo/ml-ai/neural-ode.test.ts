/** neural-ode.test.ts - Brute-force Euler/RK4, convergence property, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./neural-ode";
import type { VisualFrame } from "@/types";

interface Input {
    z0: number[];
    A: number[];
    t0: number;
    t1: number;
    steps: number;
    method: "euler" | "rk4";
}

function reference(input: Input) {
    const [a, b, c, d] = input.A;
    const f = (s: number[]) => [a! * s[0]! + b! * s[1]!, c! * s[0]! + d! * s[1]!];
    const h = (input.t1 - input.t0) / input.steps;
    let s = input.z0.slice(0, 2);
    while (s.length < 2) {
        s.push(0);
    }
    for (let step = 0; step < input.steps; step += 1) {
        if (input.method === "euler") {
            const k = f(s);
            s = s.map((v, i) => v + h * k[i]!);
        } else {
            const k1 = f(s);
            const k2 = f(s.map((v, i) => v + 0.5 * h * k1[i]!));
            const k3 = f(s.map((v, i) => v + 0.5 * h * k2[i]!));
            const k4 = f(s.map((v, i) => v + h * k3[i]!));
            s = s.map((v, i) => v + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!));
        }
    }
    return s;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const traj = frame.meta["trajectory"] as number[];
        expect(traj.length).toBe(2 * (Number(frame.meta["step"]) + 1));
    });
}

describe("Neural ODE integration", () => {
    const cases: Input[] = [
        { z0: [1, 0], A: [0, -1, 1, 0], t0: 0, t1: 1, steps: 8, method: "rk4" },
        { z0: [2, -1], A: [-1, 0, 0, 0.5], t0: 0, t1: 2, steps: 10, method: "euler" },
        { z0: [0.5, 0.5], A: [-2, 0, 0, -3], t0: 0, t1: 1.5, steps: 12, method: "rk4" },
        mod.defaultInput as Input,
    ];

    it("matches a brute-force Euler or RK4 integration", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            const state = final?.["state"] as number[];
            state.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 6));
        }
    });

    it("RK4 is more accurate than Euler against the exact diagonal solution", () => {
        const base: Input = { z0: [1, 0.5], A: [-1, 0, 0, 0.5], t0: 0, t1: 2, steps: 20, method: "rk4" };
        const euler = [...mod.run({ ...base, method: "euler" })].at(-1)?.meta;
        const rk4 = [...mod.run(base)].at(-1)?.meta;
        expect(Number(rk4?.["error"])).toBeLessThan(Number(euler?.["error"]));
        expect(Number(rk4?.["error"])).toBeLessThan(1e-6);
    });

    it("records a trajectory of length steps plus one", () => {
        const frames = [...mod.run(cases[0]!)];
        const final = frames[frames.length - 1]?.meta;
        expect((final?.["trajectory"] as number[]).length).toBe(2 * (cases[0]!.steps + 1));
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
