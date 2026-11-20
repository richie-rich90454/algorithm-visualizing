/**
 * spanner-true-time.test.ts - External-consistency property and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./spanner-true-time";
import type { VisualFrame } from "@/types";

interface Spec {
    start: number;
    duration: number;
    skew: number;
}

function simulate(epsilon: number, specs: Spec[]) {
    return specs.map((s) => ({
        start: s.start,
        commit: s.start + s.duration,
        stamp: s.start + s.duration + s.skew + epsilon,
        visible: s.start + s.duration + 2 * epsilon,
    }));
}

function verify(epsilon: number, specs: Spec[]): { checks: number; violations: number } {
    const txs = simulate(epsilon, specs);
    let checks = 0;
    let violations = 0;
    for (let i = 0; i < txs.length; i += 1) {
        for (let j = 0; j < txs.length; j += 1) {
            if (txs[i]!.visible < txs[j]!.start) {
                checks += 1;
                if (txs[i]!.stamp >= txs[j]!.stamp) {
                    violations += 1;
                }
            }
        }
    }
    return { checks, violations };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Spanner TrueTime and commit wait", () => {
    it("matches an independent simulation on the default input", () => {
        const input = mod.defaultInput as { epsilon: number; transactions: Spec[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const expected = verify(input.epsilon, input.transactions);
        expect(final["checks"]).toBe(expected.checks);
        expect(final["violations"]).toBe(expected.violations);
        expect(final["consistent"]).toBe(true);
    });

    it("preserves external consistency on randomized schedules", () => {
        let seed = 31;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483647;
            return seed / 2147483647;
        };
        for (let t = 0; t < 10; t += 1) {
            const epsilon = 1 + Math.floor(rand() * 4);
            const specs: Spec[] = Array.from({ length: 5 }, (_, i) => ({
                start: i * 3 + Math.floor(rand() * 2),
                duration: 1 + Math.floor(rand() * 4),
                skew: Math.round((rand() * 2 - 1) * epsilon * 100) / 100,
            }));
            const frames = [...mod.run({ epsilon, transactions: specs })];
            checkFrames(frames);
            const expected = verify(epsilon, specs);
            const final = frames[frames.length - 1]!.meta;
            expect(final["violations"]).toBe(expected.violations);
            expect(final["consistent"]).toBe(true);
        }
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
