/** kto-alignment.test.ts - Independent KTO reference, monotonicity, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./kto-alignment";
import type { VisualFrame } from "@/types";

interface Input {
    policyLogp: number[];
    referenceLogp: number[];
    desirable: boolean[];
    beta: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

const sigmoid = (v: number): number => (v >= 0 ? 1 / (1 + Math.exp(-v)) : Math.exp(v) / (1 + Math.exp(v)));

/** Independent reference for the KTO batch objective. */
function reference(input: Input) {
    const ratio = (i: number): number => {
        const raw = (input.policyLogp[i] ?? 0) - (input.referenceLogp[i] ?? 0);
        return Math.max(-20, Math.min(20, raw));
    };
    const baseline = (flag: boolean): number => {
        const values: number[] = [];
        for (let i = 0; i < input.policyLogp.length; i += 1) if ((input.desirable[i] ?? false) === flag) values.push(ratio(i));
        return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
    };
    const good = baseline(true);
    const bad = baseline(false);
    const losses = input.policyLogp.map((_, i) => {
        const flag = input.desirable[i] ?? false;
        const value = flag ? ratio(i) - good : bad - ratio(i);
        return 1 - sigmoid(input.beta * value);
    });
    return { baselines: { good, bad }, losses, total: losses.reduce((a, b) => a + b, 0) / losses.length };
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

describe("KTO alignment loss", () => {
    it("matches an independent reference on the default input", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const losses = frames[frames.length - 1]?.meta["losses"] as number[];
        const total = frames[frames.length - 1]?.meta["total"] as number;
        losses.forEach((v, i) => expect(close(v, expected.losses[i]!)).toBe(true));
        expect(close(total, expected.total)).toBe(true);
    });

    it("rewards raising a desirable example and penalizes raising an undesirable one", () => {
        const input = mod.defaultInput as Input;
        const original = reference(input);
        const raisedGood: Input = { ...input, policyLogp: [1.5, -0.3, -1.1, -0.5] };
        const raisedBad: Input = { ...input, policyLogp: [-0.8, -0.3, 1.2, -0.5] };
        expect(reference(raisedGood).losses[0]!).toBeLessThan(original.losses[0]!);
        expect(reference(raisedBad).losses[2]!).toBeGreaterThan(original.losses[2]!);
    });

    it("matches the reference on a second batch with a different beta", () => {
        const input: Input = {
            policyLogp: [0.2, -0.6, -2, 0.1, -0.4],
            referenceLogp: [-0.5, -0.5, -0.5, -0.5, -0.5],
            desirable: [true, false, false, true, false],
            beta: 1.3,
        };
        const expected = reference(input);
        const frames = [...mod.run(input)];
        const total = frames[frames.length - 1]?.meta["total"] as number;
        const losses = frames[frames.length - 1]?.meta["losses"] as number[];
        losses.forEach((v, i) => expect(close(v, expected.losses[i]!)).toBe(true));
        expect(close(total, expected.total)).toBe(true);
    });

    it("keeps all losses between zero and one and terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        let last: VisualFrame | undefined;
        for (const frame of generator) {
            last = frame;
            count += 1;
        }
        expect(count).toBe((mod.defaultInput as Input).policyLogp.length + 2);
        expect(generator.next().done).toBe(true);
        const losses = last?.meta["losses"] as number[];
        losses.forEach((v) => {
            expect(v).toBeGreaterThan(0);
            expect(v).toBeLessThan(1);
        });
    });
});
