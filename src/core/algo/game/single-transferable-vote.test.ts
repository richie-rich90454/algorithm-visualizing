/**
 * single-transferable-vote.test.ts - Election results against an independent
 * weighted-ballot replay, plus quota/seat properties, frame shape, and
 * termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./single-transferable-vote";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) {
            continue;
        }
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    }
}

interface BallotState {
    order: number[];
    index: number;
    weight: number;
}

function reference(ballots: number[][], m: number, seats: number): { quota: number; elected: number[] } {
    const s = Math.max(1, Math.min(m, Math.floor(seats)));
    const quota = Math.floor(ballots.length / (s + 1)) + 1;
    const states: BallotState[] = ballots.map((order) => ({ order: [...order], index: 0, weight: 1 }));
    const finished = new Set<number>();
    const elected: number[] = [];
    for (let iteration = 0; iteration < 100 && elected.length < s; iteration += 1) {
        for (const ballot of states) {
            while (ballot.index < ballot.order.length && finished.has(ballot.order[ballot.index] ?? -1)) {
                ballot.index += 1;
            }
        }
        const tally = new Array<number>(m).fill(0);
        for (const ballot of states) {
            if (ballot.index < ballot.order.length) {
                const c = ballot.order[ballot.index] ?? 0;
                tally[c] = (tally[c] ?? 0) + ballot.weight;
            }
        }
        const over = Array.from({ length: m }, (_, c) => c)
            .filter((c) => !finished.has(c) && (tally[c] ?? 0) >= quota - 1e-12)
            .sort((a, b) => (tally[b] ?? 0) - (tally[a] ?? 0));
        if (over.length > 0) {
            const c = over[0] ?? 0;
            const total = tally[c] ?? 0;
            const factor = total > 1e-12 ? Math.max(0, (total - quota) / total) : 0;
            finished.add(c);
            elected.push(c);
            for (const ballot of states) {
                if (ballot.index < ballot.order.length && ballot.order[ballot.index] === c) {
                    ballot.weight *= factor;
                    ballot.index += 1;
                }
            }
            continue;
        }
        const running = Array.from({ length: m }, (_, c) => c).filter((c) => !finished.has(c));
        if (running.length <= s - elected.length) {
            for (const c of running) {
                finished.add(c);
                elected.push(c);
            }
            break;
        }
        const lowest = running.reduce((worst, c) => ((tally[c] ?? 0) < (tally[worst] ?? 0) ? c : worst), running[0] ?? 0);
        finished.add(lowest);
        for (const ballot of states) {
            if (ballot.index < ballot.order.length && ballot.order[ballot.index] === lowest) {
                ballot.index += 1;
            }
        }
    }
    return { quota, elected };
}

describe("Single Transferable Vote", () => {
    it("matches the independent weighted replay on the default and random elections", () => {
        let seed = 73;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        const cases: Array<{ ballots: number[][]; candidates: number; seats: number }> = [
            mod.defaultInput as { ballots: number[][]; candidates: number; seats: number },
        ];
        for (let trial = 0; trial < 30; trial += 1) {
            const m = 3 + Math.floor(rand() * 3);
            const ballots = Array.from({ length: 2 + Math.floor(rand() * 7) }, () =>
                Array.from({ length: m }, (_, k) => k).sort(() => rand() - 0.5),
            );
            const seats = 1 + Math.floor(rand() * m);
            cases.push({ ballots, candidates: m, seats });
        }
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(input.ballots, input.candidates, input.seats);
            expect(final?.["quota"]).toBe(expected.quota);
            expect(final?.["elected"]).toEqual(expected.elected);
        }
    });

    it("fills every seat with distinct candidates and honors the Droop quota", () => {
        let seed = 119;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let trial = 0; trial < 25; trial += 1) {
            const m = 3;
            const ballots = Array.from({ length: 7 }, () =>
                Array.from({ length: m }, (_, k) => k).sort(() => rand() - 0.5),
            );
            const seats = 2;
            const frames = [...mod.run({ ballots, candidates: m, seats })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const elected = final?.["elected"] as number[];
            expect(elected.length).toBe(seats);
            expect(new Set(elected).size).toBe(seats);
            expect(final?.["quota"]).toBe(Math.floor(ballots.length / (seats + 1)) + 1);
            for (const c of elected) {
                expect(c).toBeGreaterThanOrEqual(0);
                expect(c).toBeLessThan(m);
            }
        }
    });

    it("elects a first-round quota winner", () => {
        const ballots = [[0, 1, 2], [0, 2, 1], [0, 1, 2], [0, 2, 1], [1, 2, 0], [2, 1, 0]];
        const frames = [...mod.run({ ballots, candidates: 3, seats: 1 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["elected"]).toEqual([0]);
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
