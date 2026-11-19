/**
 * quantum-reservoir-computing.test.ts - Independent circuit simulation and
 * independent ridge solve cross-checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-reservoir-computing";
import type { VisualFrame } from "@/types";

type C = [number, number];

function checkFrames(frames: VisualFrame[], length: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const amps = frame.meta["amplitudes"] as number[];
        expect(amps.reduce((sum, v, i) => (i % 2 === 0 ? sum + v ** 2 + amps[i + 1]! ** 2 : sum), 0)).toBeCloseTo(1, 10);
    });
    expect(frames.length).toBe(length + 2);
}

/** Independent state-vector evolution of the fixed reservoir gates. */
function independentReadouts(length: number): number[][] {
    const state: C[] = Array.from({ length: 8 }, (_, i) => [i === 0 ? 1 : 0, 0] as C);
    const rotateY = (q: number, angle: number): void => {
        const stride = 2 ** q;
        const c = Math.cos(angle / 2);
        const s = Math.sin(angle / 2);
        for (let base = 0; base < 8; base += 2 * stride) {
            for (let offset = 0; offset < stride; offset += 1) {
                const x = base + offset;
                const y = x + stride;
                const a = state[x]!;
                const b = state[y]!;
                state[x] = [c * a[0] - s * b[0], c * a[1] - s * b[1]];
                state[y] = [s * a[0] + c * b[0], s * a[1] + c * b[1]];
            }
        }
    };
    const rotateZ = (q: number, angle: number): void => {
        const cosine = Math.cos(angle / 2);
        const sine = Math.sin(angle / 2);
        for (let index = 0; index < 8; index += 1) {
            const factor = ((index >> q) & 1) === 1 ? [cosine, sine] : [cosine, -sine];
            const z = state[index]!;
            state[index] = [z[0] * factor[0]! - z[1] * factor[1]!, z[0] * factor[1]! + z[1] * factor[0]!];
        }
    };
    const cnot = (control: number, target: number): void => {
        const stride = 2 ** target;
        for (let i = 0; i < 8; i += 1) {
            if (((i >> control) & 1) === 0 || ((i >> target) & 1) === 1) continue;
            const partner = i + stride;
            const tmp = state[partner]!;
            state[partner] = state[i]!;
            state[i] = tmp;
        }
    };
    const readouts: number[][] = [];
    for (let step = 1; step <= length; step += 1) {
        rotateY(0, (Math.PI * step) / (length + 1));
        cnot(0, 1);
        rotateZ(1, 0.7);
        cnot(1, 2);
        rotateZ(2, -0.4);
        const values = [0, 1, 2].map((q) => {
            let value = 0;
            for (let i = 0; i < 8; i += 1) {
                const z = state[i]!;
                const probability = z[0] * z[0] + z[1] * z[1];
                value += ((i >> q) & 1) === 0 ? probability : -probability;
            }
            return value;
        });
        readouts.push([1, ...values]);
    }
    return readouts;
}

/** Independent ridge solution via normal equations and Gauss-Jordan elimination. */
function independentRidge(features: number[][], targets: number[]): number[] {
    const n = 4;
    const gram = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) =>
        features.reduce((sum, row) => sum + row[i]! * row[j]!, 0) + (i === j ? 1e-3 : 0)));
    const moment = Array.from({ length: n }, (_, i) => features.reduce((sum, row, k) => sum + row[i]! * targets[k]!, 0));
    const rows = gram.map((row, i) => [...row, moment[i]!]);
    for (let column = 0; column < n; column += 1) {
        let pivot = column;
        for (let r = column + 1; r < n; r += 1) if (Math.abs(rows[r]![column]!) > Math.abs(rows[pivot]![column]!)) pivot = r;
        [rows[column], rows[pivot]] = [rows[pivot]!, rows[column]!];
        const divisor = rows[column]![column]!;
        for (let j = column; j <= n; j += 1) rows[column]![j] /= divisor;
        for (let r = 0; r < n; r += 1) {
            if (r === column) continue;
            const factor = rows[r]![column]!;
            for (let j = column; j <= n; j += 1) rows[r]![j] -= factor * rows[column]![j]!;
        }
    }
    return rows.map((row) => row[n]!);
}

describe("QuantumReservoirComputing", () => {
    it("matches an independently simulated reservoir and ridge readout", () => {
        const length = 8;
        const frames = [...mod.run({ length })];
        checkFrames(frames, length);
        const features = independentReadouts(length);
        const targets = Array.from({ length }, (_, i) => ((i + 1) / (length + 1)) ** 2);
        const final = frames[frames.length - 1]!.meta;
        const flat = final["featuresFlat"] as number[];
        for (let i = 0; i < features.length; i += 1) {
            for (let j = 0; j < 4; j += 1) expect(flat[4 * i + j]).toBeCloseTo(features[i]![j]!, 10);
        }
        const expectedWeights = independentRidge(features, targets);
        const weights = final["weights"] as number[];
        for (let i = 0; i < 4; i += 1) expect(weights[i]).toBeCloseTo(expectedWeights[i]!, 9);
        const predictions = final["predictions"] as number[];
        for (let i = 0; i < length; i += 1) {
            const expected = features[i]!.reduce((sum, value, j) => sum + value * expectedWeights[j]!, 0);
            expect(predictions[i]).toBeCloseTo(expected, 9);
        }
    });

    it("beats the constant baseline and clamps the sequence length", () => {
        const frames = [...mod.run({ length: 3 })];
        checkFrames(frames, 4);
        const final = frames[frames.length - 1]!.meta;
        expect(final["mse"]).toBeLessThan(final["baselineMse"] as number);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});
