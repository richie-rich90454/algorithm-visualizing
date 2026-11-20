/** noncentral-t.test.ts - Density reduction, normalization, and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./noncentral-t";
import type { VisualFrame } from "@/types";

const LANCZOS = [
    0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.1385710952657201, 9.984369578019572e-6,
    1.5056327351493116e-7,
];
function logGamma(z: number): number {
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    const t = z - 1;
    let x = LANCZOS[0] as number;
    for (let i = 1; i < 9; i += 1) x += (LANCZOS[i] as number) / (t + i);
    const arg = t + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (t + 0.5) * Math.log(arg) - arg + Math.log(x);
}
function centralTDensity(t: number, nu: number): number {
    const coeff = Math.exp(logGamma((nu + 1) / 2) - logGamma(nu / 2)) / Math.sqrt(nu * Math.PI);
    return coeff * Math.pow(1 + (t * t) / nu, -(nu + 1) / 2);
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    });
}

describe("Noncentral Student's t Distribution", () => {
    it("reduces to the central t density when noncentrality is zero", () => {
        const frames = [...mod.run({ nu: 10, delta: 0, points: 61 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const xs = final["xs"] as number[];
        const pdf = final["pdf"] as number[];
        for (let i = 0; i < xs.length; i += 1) {
            expect(Math.abs(pdf[i]! - centralTDensity(xs[i]!, 10))).toBeLessThan(1e-3);
        }
    });

    it("produces a density that integrates to approximately one", () => {
        const frames = [...mod.run({ nu: 10, delta: 2, points: 301 })];
        const final = frames[frames.length - 1]!.meta;
        const xs = final["xs"] as number[];
        const pdf = final["pdf"] as number[];
        let total = 0;
        for (let i = 1; i < xs.length; i += 1) {
            total += 0.5 * (pdf[i - 1]! + pdf[i]!) * (xs[i]! - xs[i - 1]!);
        }
        expect(Math.abs(total - 1)).toBeLessThan(0.02);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
