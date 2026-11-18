/**
 * paxos-single-decree.test.ts - Safety, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./paxos-single-decree";
import type { VisualFrame } from "@/types";

interface Ballot {
    number: number;
    value: number;
}
interface Acceptor {
    promised: number;
    acceptedBallot: number;
    acceptedValue: number;
}

/** Independent reference implementation of single-decree Paxos. */
function reference(count: number, ballots: Ballot[]): { chosen: number | null; acceptors: Acceptor[] } {
    const acceptors: Acceptor[] = Array.from({ length: count }, () => ({
        promised: 0,
        acceptedBallot: 0,
        acceptedValue: -1,
    }));
    const majority = Math.floor(count / 2) + 1;
    let chosen: number | null = null;
    for (const ballot of ballots) {
        const promises: Acceptor[] = [];
        for (const acceptor of acceptors) {
            if (ballot.number > acceptor.promised) {
                acceptor.promised = ballot.number;
                promises.push(acceptor);
            }
        }
        if (promises.length < majority) {
            continue;
        }
        let value = ballot.value;
        let highest = -1;
        for (const promise of promises) {
            if (promise.acceptedValue >= 0 && promise.acceptedBallot > highest) {
                highest = promise.acceptedBallot;
                value = promise.acceptedValue;
            }
        }
        let accepts = 0;
        for (const promise of promises) {
            if (ballot.number >= promise.promised) {
                promise.acceptedBallot = ballot.number;
                promise.acceptedValue = value;
                accepts += 1;
            }
        }
        if (accepts >= majority && chosen === null) {
            chosen = value;
        }
    }
    return { chosen, acceptors };
}

/** Deterministic pseudo-random generator for repeatable property tests. */
function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Single-Decree Paxos", () => {
    it("matches an independent reference and never chooses two values", () => {
        const random = makeRandom(7);
        for (let trial = 0; trial < 120; trial += 1) {
            const count = random() < 0.5 ? 3 : 5;
            const ballotCount = 3 + Math.floor(random() * 4);
            const ballots: Ballot[] = [];
            for (let i = 0; i < ballotCount; i += 1) {
                ballots.push({ number: i + 1, value: Math.floor(random() * 4) });
            }
            const frames = [...mod.run({ acceptorCount: count, ballots })];
            checkFrames(frames, count);
            const expected = reference(count, ballots);
            const finalMeta = frames[frames.length - 1]!.meta;
            const chosen = Number(finalMeta["chosenValue"]);

            expect(finalMeta["chosen"]).toBe(expected.chosen !== null);
            if (expected.chosen !== null) {
                expect(chosen).toBe(expected.chosen);
                const majority = Math.floor(count / 2) + 1;
                const acceptedCount = expected.acceptors.filter(
                    (acceptor) => acceptor.acceptedValue === chosen,
                ).length;
                expect(acceptedCount).toBeGreaterThanOrEqual(majority);
            } else {
                expect(chosen).toBe(-1);
            }

            const chosenValues = new Set(
                frames
                    .filter((frame) => frame.meta["phase"] === "done" && frame.meta["chosen"] === true)
                    .map((frame) => Number(frame.meta["chosenValue"])),
            );
            expect(chosenValues.size).toBeLessThanOrEqual(1);
        }
    });

    it("reuses an already chosen value on later ballots", () => {
        const ballots: Ballot[] = [
            { number: 1, value: 42 },
            { number: 2, value: 99 },
            { number: 3, value: 7 },
        ];
        const frames = [...mod.run({ acceptorCount: 5, ballots })];
        const doneFrames = frames.filter((frame) => frame.meta["phase"] === "done" && frame.meta["chosen"] === true);
        expect(doneFrames.length).toBeGreaterThan(1);
        for (const frame of doneFrames) {
            expect(frame.meta["chosenValue"]).toBe(42);
        }
        expect(frames[frames.length - 1]!.meta["chosenValue"]).toBe(42);
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
