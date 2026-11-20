/** tcp-illinois.test.ts - Independent rate model, window cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./tcp-illinois";
import type { VisualFrame } from "@/types";

type Event = { type: "ack"; rtt: number } | { type: "loss" };

function reference(events: Event[], initialCwnd: number, alphaMax: number, alphaMin: number, betaMin: number, betaMax: number): number[] {
    let cwnd = initialCwnd;
    let minRtt = Number.POSITIVE_INFINITY;
    let avgRtt = 0;
    let alpha = alphaMax;
    let beta = betaMin;
    const windows = [cwnd];
    const rates = (): void => {
        const q = avgRtt - minRtt;
        const threshold = minRtt / 4;
        if (q < threshold) { alpha = alphaMax; beta = betaMin; return; }
        const denom = Math.max(q, 1e-9);
        alpha = Math.max(alphaMin, Math.min(alphaMax, (alphaMin * minRtt) / denom));
        const frac = (q - threshold) / denom;
        beta = Math.max(betaMin, Math.min(betaMax, betaMin + (betaMax - betaMin) * frac));
    };
    for (const e of events) {
        if (e.type === "ack") {
            if (minRtt === Number.POSITIVE_INFINITY) { minRtt = e.rtt; avgRtt = e.rtt; }
            else { minRtt = Math.min(minRtt, e.rtt); avgRtt += (e.rtt - avgRtt) / 16; }
            rates();
            cwnd += alpha / cwnd;
        } else {
            rates();
            cwnd *= 1 - beta;
        }
        cwnd = Math.max(0.1, cwnd);
        windows.push(Number(cwnd.toFixed(6)));
    }
    return windows;
}

function checkFrames(frames: VisualFrame[], events: number): void {
    expect(frames.length).toBe(events + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(Math.min(index + 1, events + 1));
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("TcpIllinois", () => {
    it("matches an independent rate model on fixed traces", () => {
        const traces: Event[][] = [
            [
                { type: "ack", rtt: 20 }, { type: "ack", rtt: 21 }, { type: "ack", rtt: 23 },
                { type: "ack", rtt: 28 }, { type: "ack", rtt: 35 }, { type: "loss" },
                { type: "ack", rtt: 30 }, { type: "ack", rtt: 24 }, { type: "ack", rtt: 21 },
            ],
            [{ type: "ack", rtt: 10 }, { type: "ack", rtt: 10 }, { type: "loss" }, { type: "ack", rtt: 12 }],
            [{ type: "loss" }, { type: "ack", rtt: 50 }, { type: "ack", rtt: 80 }, { type: "loss" }],
        ];
        for (const events of traces) {
            const expected = reference(events, 1, 10, 0.1, 0.125, 0.5);
            const frames = [...mod.run({ events, initialCwnd: 1 })];
            checkFrames(frames, events.length);
            const finalBars = frames[frames.length - 1]?.entities ?? [];
            const actual = finalBars.map((e) => e.value as number);
            expect(actual).toEqual(expected);
        }
    });

    it("never grows faster under a bigger queue and stays deterministic", () => {
        const shallow: Event[] = [{ type: "ack", rtt: 20 }, { type: "ack", rtt: 21 }, { type: "ack", rtt: 22 }];
        const deep: Event[] = [{ type: "ack", rtt: 20 }, { type: "ack", rtt: 50 }, { type: "ack", rtt: 90 }];
        const shallowFinal = [...mod.run({ events: shallow })].at(-1);
        const deepFinal = [...mod.run({ events: deep })].at(-1);
        expect(Number(shallowFinal?.meta["cwnd"])).toBeGreaterThan(Number(deepFinal?.meta["cwnd"]));
        expect([...mod.run({ events: deep })]).toEqual([...mod.run({ events: deep })]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBe(11);
        expect(generator.next().done).toBe(true);
    });
});
