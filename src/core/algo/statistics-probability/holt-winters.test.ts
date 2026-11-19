/**
 * holt-winters.test.ts - Independent recursion, constant-series property, frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./holt-winters";
import type { VisualFrame } from "@/types";

interface Params {
    series: number[];
    period: number;
    alpha: number;
    beta: number;
    gamma: number;
}

/** Independent evaluation of the additive Holt-Winters recursions. */
function reference(params: Params) {
    const { series, period, alpha, beta, gamma } = params;
    const firstAvg = series.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const second = series.slice(period, 2 * period);
    const secondAvg = second.length ? second.reduce((a, b) => a + b, 0) / second.length : firstAvg;
    let level = firstAvg;
    let trend = (secondAvg - firstAvg) / period;
    const seasonal = series.slice(0, period).map((v) => v - firstAvg);
    const fitted = series.slice();
    for (let t = period; t < series.length; t += 1) {
        const slot = t % period;
        fitted[t] = level + trend + seasonal[slot]!;
        const prev = level;
        level = alpha * (series[t]! - seasonal[slot]!) + (1 - alpha) * (level + trend);
        trend = beta * (level - prev) + (1 - beta) * trend;
        seasonal[slot] = gamma * (series[t]! - level) + (1 - gamma) * seasonal[slot]!;
    }
    return { fitted, forecast: level + trend + seasonal[series.length % period]! };
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["family"]).toBe("holt-winters");
    });
}

describe("Holt-Winters", () => {
    it("matches an independent recursion on every fitted value and the forecast", () => {
        const params: Params = {
            series: [7, 10, 13, 16, 11, 14, 17, 20, 15, 18, 21, 24],
            period: 4,
            alpha: 0.4,
            beta: 0.2,
            gamma: 0.5,
        };
        const frames = [...mod.run(params)];
        checkFrames(frames, params.series.length);
        const expected = reference(params);
        const meta = frames[frames.length - 1]?.meta;
        const fitted = meta?.["fitted"] as number[];
        fitted.forEach((value, i) => expect(value).toBeCloseTo(expected.fitted[i]!, 4));
        expect(meta?.["forecast"]).toBeCloseTo(expected.forecast, 4);
    });

    it("reproduces a constant series exactly with full smoothing", () => {
        const params: Params = { series: [5, 5, 5, 5, 5, 5, 5, 5], period: 2, alpha: 1 - 1e-9, beta: 1 - 1e-9, gamma: 1 - 1e-9 };
        const frames = [...mod.run(params)];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["forecast"]).toBeCloseTo(5, 4);
        (meta?.["fitted"] as number[]).forEach((value) => expect(value).toBeCloseTo(5, 4));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
