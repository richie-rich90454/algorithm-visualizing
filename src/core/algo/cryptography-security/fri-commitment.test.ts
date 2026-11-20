/** fri-commitment.test.ts - Evaluation, tamper, frame and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./fri-commitment";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("FRI Commitment (Toy)", () => {
    it("evaluates the polynomial correctly with an independent Horner loop", () => {
        const input = mod.defaultInput as { coefficients: number[]; modulus: number; domainSize: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const evaluations = frames[0]?.meta["evaluations"] as number[];
        expect(evaluations.length).toBe(input.domainSize);
        for (let i = 0; i < input.domainSize; i += 1) {
            let acc = 0;
            for (let j = input.coefficients.length - 1; j >= 0; j -= 1) {
                acc = (acc * (i + 1) + (input.coefficients[j] as number)) % input.modulus;
            }
            expect(evaluations[i]).toBe(acc);
        }
    });

    it("accepts an honest commitment and rejects every single tampered evaluation", () => {
        const honest = [...mod.run(mod.defaultInput)];
        const honestFinal = honest[honest.length - 1]?.meta;
        expect(honestFinal?.["verified"]).toBe(true);

        const base = mod.defaultInput as { coefficients: number[]; modulus: number; domainSize: number };
        for (let tamper = 0; tamper < base.domainSize; tamper += 1) {
            const frames = [...mod.run({ ...base, tamperIndex: tamper })];
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["verified"]).toBe(false);
        }
    });

    it("folds the layer size in half each round and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const foldFrames = frames.filter((f) => f.meta["phase"] === "fold");
        let expected = 8;
        for (const frame of foldFrames) {
            expect((frame.meta["layer"] as number[]).length).toBe(expected);
            expected /= 2;
        }
        expect(foldFrames.length).toBe(4);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
