/**
 * circuit-breaker.test.ts - Independent state-machine and property checks.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateCircuitBreaker } from "./circuit-breaker";
import type { VisualFrame } from "@/types";

/** Independent transcription of the breaker state machine. */
function reference(outcomes: string[], threshold: number, timeout: number, successes: number) {
    const states: string[] = [];
    const allowedFlags: boolean[] = [];
    let state = "closed";
    let fails = 0;
    let wins = 0;
    let sinceOpen = 0;
    for (let i = 0; i < outcomes.length; i += 1) {
        const ok = outcomes[i] === "S";
        let allowed = true;
        if (state === "closed") {
            if (ok) {
                fails = 0;
            } else if (++fails >= threshold) {
                state = "open";
                fails = 0;
                sinceOpen = 0;
            }
        } else if (state === "open") {
            if (++sinceOpen < timeout) {
                allowed = false;
            } else {
                state = "half-open";
                wins = 0;
                if (ok) {
                    if (++wins >= successes) {
                        state = "closed";
                        wins = 0;
                    }
                } else {
                    state = "open";
                    sinceOpen = 0;
                }
            }
        } else {
            if (ok) {
                if (++wins >= successes) {
                    state = "closed";
                    wins = 0;
                }
            } else {
                state = "open";
                sinceOpen = 0;
            }
        }
        states.push(state);
        allowedFlags.push(allowed);
    }
    return {
        states,
        allowedFlags,
        finalState: state,
        allowed: allowedFlags.filter(Boolean).length,
        rejected: allowedFlags.filter((v) => !v).length,
    };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2 * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(n);
    });
}

describe("Circuit Breaker", () => {
    it("matches an independently written state machine on several sequences", () => {
        const cases: Array<{ outcomes: string[]; t: number; timeout: number; wins: number }> = [
            {
                outcomes: ["S", "S", "F", "F", "F", "F", "F", "S", "S", "S", "S", "F", "F", "F", "F", "F", "S", "S", "S"],
                t: 3,
                timeout: 3,
                wins: 2,
            },
            { outcomes: ["F", "F", "S", "S", "F", "S", "S", "S"], t: 2, timeout: 2, wins: 2 },
            { outcomes: ["S", "S", "S", "S"], t: 3, timeout: 4, wins: 1 },
            { outcomes: ["F", "F", "F", "F", "F", "F"], t: 1, timeout: 1, wins: 1 },
        ];
        for (const testCase of cases) {
            const result = simulateCircuitBreaker(testCase.outcomes, testCase.t, testCase.timeout, testCase.wins);
            const expected = reference(testCase.outcomes, testCase.t, testCase.timeout, testCase.wins);
            expect(result.calls.map((c) => c.state)).toEqual(expected.states);
            expect(result.calls.map((c) => c.allowed)).toEqual(expected.allowedFlags);
            expect(result.finalState).toBe(expected.finalState);
            expect(result.allowed).toBe(expected.allowed);
            expect(result.rejected).toBe(expected.rejected);
        }
    });

    it("rejects every call while open and recovers after the timeout", () => {
        const outcomes = ["F", "F", "F", "S", "S", "S", "S", "S"];
        const result = simulateCircuitBreaker(outcomes, 2, 3, 2);
        expect(result.calls[0]?.state).toBe("closed");
        expect(result.calls[1]?.state).toBe("open");
        expect(result.calls[2]?.allowed).toBe(false);
        expect(result.calls[3]?.allowed).toBe(false);
        for (let i = 1; i < result.calls.length; i += 1) {
            const call = result.calls[i];
            if (call?.state === "open" && result.calls[i - 1]?.state === "open") {
                expect(call.allowed).toBe(false);
            }
        }
        expect(result.finalState).toBe("closed");
        expect(result.trips).toBe(1);
    });

    it("reports counts and states in well-formed frames", () => {
        const input = mod.defaultInput as {
            outcomes: string[];
            failureThreshold: number;
            resetTimeout: number;
            successThreshold: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.outcomes.length);
        const expected = simulateCircuitBreaker(
            input.outcomes,
            input.failureThreshold,
            input.resetTimeout,
            input.successThreshold,
        );
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["finalState"]).toBe(expected.finalState);
        expect(Number(final?.["allowed"])).toBe(expected.allowed);
        expect(Number(final?.["rejected"])).toBe(expected.rejected);
        expect(Number(final?.["trips"])).toBe(expected.trips);
        expect(final?.["states"]).toEqual(expected.calls.map((c) => c.state));
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
