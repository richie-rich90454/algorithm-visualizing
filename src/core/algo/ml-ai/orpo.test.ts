/** orpo.test.ts - Independent ORPO reference, margin monotonicity, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./orpo";
import type { VisualFrame } from "@/types";

interface Input {
    chosenLogp: number[];
    rejectedLogp: number[];
    chosenRefLogp: number[];
    rejectedRefLogp: number[];
    beta: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

const sigmoid = (v: number): number => (v >= 0 ? 1 / (1 + Math.exp(-v)) : Math.exp(v) / (1 + Math.exp(v)));

function logOdds(logp: number): number {
    const p = Math.max(1e-6, Math.min(1 - 1e-6, Math.exp(logp)));
    return Math.log(p) - Math.log1p(-p);
}

/** Independent reference for one ORPO pair. */
function one(
    chosen: number,
    rejected: number,
    chosenRef: number,
    rejectedRef: number,
    beta: number,
) {
    const nll = -chosen;
    const margin = (logOdds(chosen) - logOdds(rejected)) - (logOdds(chosenRef) - logOdds(rejectedRef));
    const oddsLoss = -Math.log(Math.max(1e-12, sigmoid(margin)));
    return { nll, margin, oddsLoss, total: nll + beta * oddsLoss };
}

function filled(input: Partial<Input> & Pick<Input, "chosenLogp" | "rejectedLogp">): Input {
    return {
        chosenLogp: input.chosenLogp,
        rejectedLogp: input.rejectedLogp,
        chosenRefLogp: input.chosenRefLogp ?? input.chosenLogp.map(() => -1),
        rejectedRefLogp: input.rejectedRefLogp ?? input.rejectedLogp.map(() => -1),
        beta: input.beta ?? 0.1,
    };
}

function reference(input: Input) {
    const pairs = input.chosenLogp.map((_, i) =>
        one(
            input.chosenLogp[i]!,
            input.rejectedLogp[i]!,
            input.chosenRefLogp[i]!,
            input.rejectedRefLogp[i]!,
            input.beta,
        ),
    );
    return { pairs, mean: pairs.reduce((s, p) => s + p.total, 0) / pairs.length };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("ORPO loss", () => {
    it("matches an independent reference on the default input", () => {
        const raw = mod.defaultInput as Pick<Input, "chosenLogp" | "rejectedLogp"> & { beta: number };
        const input: Input = filled(raw);
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const totals = frames[frames.length - 1]?.meta["total"] as number[];
        const mean = frames[frames.length - 1]?.meta["mean"] as number;
        totals.forEach((v, i) => expect(close(v, expected.pairs[i]!.total)).toBe(true));
        expect(close(mean, expected.mean)).toBe(true);
    });

    it("lowers the odds term as the chosen margin widens", () => {
        const base = one(-0.2, -1.5, -1, -1, 0.1);
        const better = one(-0.05, -2.5, -1, -1, 0.1);
        expect(better.margin).toBeGreaterThan(base.margin);
        expect(better.oddsLoss).toBeLessThan(base.oddsLoss);
    });

    it("matches the reference on a second batch with explicit reference logps", () => {
        const input: Input = {
            chosenLogp: [0.1, -0.4, -1.2],
            rejectedLogp: [-2, -0.9, -0.3],
            chosenRefLogp: [-0.5, -0.5, -0.5],
            rejectedRefLogp: [-1.2, -1.2, -1.2],
            beta: 0.25,
        };
        const expected = reference(input);
        const frames = [...mod.run(input)];
        const totals = frames[frames.length - 1]?.meta["total"] as number[];
        const mean = frames[frames.length - 1]?.meta["mean"] as number;
        totals.forEach((v, i) => expect(close(v, expected.pairs[i]!.total)).toBe(true));
        expect(close(mean, expected.mean)).toBe(true);
    });

    it("terminates cleanly with finite losses", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        let last: VisualFrame | undefined;
        for (const frame of generator) {
            last = frame;
            count += 1;
        }
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
        const totals = last?.meta["total"] as number[];
        totals.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    });
});
