import { describe, expect, it } from "vitest";
import mod from "./arima-model";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function difference(series: number[]): number[] {
    const out: number[] = [];
    for (let i = 0; i + 1 < series.length; i += 1) {
        out.push(series[i + 1] - series[i]);
    }
    return out;
}

function closeArray(actual: unknown, expected: number[]): void {
    const values = actual as number[];
    expect(values).toHaveLength(expected.length);
    values.forEach((value, index) => expect(value).toBeCloseTo(expected[index] ?? 0, 8));
}

describe("ARIMA Model", () => {
    it("matches an independent recursion for differencing, fit, residuals, and forecasts", () => {
        const input = mod.defaultInput as { series: number[]; d: number; phi: number[]; theta: number[]; steps: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const series = input.series;
        const d = input.d;
        const phi = input.phi;
        const theta = input.theta;
        const steps = input.steps;
        const eps = meta?.["eps"] as number[];

        // Independently recompute every intermediate series.
        const levels: number[][] = [[...series]];
        for (let level = 1; level <= d; level += 1) {
            levels.push(difference(levels[level - 1]));
        }
        const w = levels[d];
        const m = w.length;
        const start = Math.max(phi.length, theta.length);
        const fitted = new Array<number>(m).fill(0);
        const residuals = new Array<number>(m).fill(0);
        for (let t = start; t < m; t += 1) {
            let value = 0;
            for (let i = 1; i <= phi.length; i += 1) {
                value += phi[i - 1] * w[t - i];
            }
            for (let j = 1; j <= theta.length; j += 1) {
                value += theta[j - 1] * eps[t - j];
            }
            fitted[t] = value;
            residuals[t] = w[t] - value;
        }
        const forecastDiffed: number[] = [];
        for (let h = 1; h <= steps; h += 1) {
            const t = m + h - 1;
            let value = 0;
            for (let i = 1; i <= phi.length; i += 1) {
                const lag = t - i;
                value += phi[i - 1] * (lag < m ? w[lag] : forecastDiffed[lag - m]);
            }
            for (let j = 1; j <= theta.length; j += 1) {
                const lag = t - j;
                if (lag < m) {
                    value += theta[j - 1] * eps[lag];
                }
            }
            forecastDiffed.push(value);
        }
        let reconstructed = [...w, ...forecastDiffed];
        for (let level = d; level >= 1; level -= 1) {
            const next = [levels[level - 1][0]];
            for (const value of reconstructed) {
                next.push(next[next.length - 1] + value);
            }
            reconstructed = next;
        }

        closeArray(meta?.["diffed"], w);
        closeArray(meta?.["fitted"], fitted);
        closeArray(meta?.["residuals"], residuals);
        closeArray(meta?.["forecastDiffed"], forecastDiffed);
        closeArray(meta?.["reconstructed"], reconstructed);
        closeArray(meta?.["forecast"], reconstructed.slice(series.length));
    });

    it("reconstructs the original series exactly and handles zero differencing", () => {
        const input = { series: [4, 7, 6, 9, 11], d: 1, phi: [0], theta: [0], steps: 0 };
        const frames = [...mod.run(input)];
        const meta = frames[frames.length - 1]?.meta;
        closeArray((meta?.["reconstructed"] as number[]).slice(0, input.series.length), input.series);
        expect(meta?.["forecast"]).toHaveLength(0);

        const flat = [...mod.run({ series: [4, 7, 6, 9, 11], d: 0, phi: [0], theta: [0], steps: 0 })];
        const flatMeta = flat[flat.length - 1]?.meta;
        closeArray(flatMeta?.["diffed"], [4, 7, 6, 9, 11]);
        closeArray((flatMeta?.["reconstructed"] as number[]).slice(0, 5), input.series);
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
