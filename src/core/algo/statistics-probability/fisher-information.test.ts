/**
 * fisher-information.test.ts - Direct-sum, closed-form, and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./fisher-information";
import type { VisualFrame } from "@/types";

type Family = "bernoulli" | "poisson";

/** Independent brute-force summation of Fisher information over the support. */
function bruteForce(family: Family, theta: number): number {
    if (family === "bernoulli") {
        const p = theta;
        const out1 = p * (1 / p) ** 2;
        const out0 = (1 - p) * (1 / (1 - p)) ** 2;
        return out1 + out0;
    }
    let total = 0;
    let pmf = Math.exp(-theta);
    for (let x = 0; x <= 400; x += 1) {
        const score = x / theta - 1;
        total += score * score * pmf;
        pmf = (pmf * theta) / (x + 1);
    }
    return total;
}

function checkFrames(frames: VisualFrame[], expectedRows: number, family: Family): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(expectedRows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["family"]).toBe(family);
    });
}

describe("Fisher Information", () => {
    it("matches a brute-force sum and the closed form for Bernoulli", () => {
        const input = { family: "bernoulli", thetas: [0.2, 0.35, 0.5, 0.65, 0.8] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.thetas.length, "bernoulli");
        const meta = frames[frames.length - 1]?.meta;
        const summed = meta?.["summed"] as number[];
        input.thetas.forEach((theta, i) => {
            expect(summed[i]).toBeCloseTo(bruteForce("bernoulli", theta), 4);
            expect(summed[i]).toBeCloseTo(1 / (theta * (1 - theta)), 4);
        });
        expect(meta?.["maxAbsError"]).toBeLessThan(1e-5);
    });

    it("matches a brute-force sum and the closed form for Poisson", () => {
        const input = { family: "poisson", thetas: [0.5, 1, 2, 4, 8] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.thetas.length, "poisson");
        const meta = frames[frames.length - 1]?.meta;
        const summed = meta?.["summed"] as number[];
        input.thetas.forEach((theta, i) => {
            expect(summed[i]).toBeCloseTo(bruteForce("poisson", theta), 4);
            expect(summed[i]).toBeCloseTo(1 / theta, 3);
        });
        expect(Number(meta?.["result"])).toBeGreaterThan(0);
    });

    it("terminates cleanly on a single value", () => {
        const generator = mod.run({ family: "bernoulli", thetas: [0.4] });
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
