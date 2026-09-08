/**
 * lamport-clock.ts – Lamport Logical Clocks.
 * Three processes tick on every event; a receive takes max(local,
 * message)+1, so causally ordered events always carry ordered stamps.
 * Script: P0 works, sends to P1; P1 receives, sends to P2; P2 receives.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Ev = { p: number; kind: string; to?: number; msg?: number };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    void input;
    const clock = [0, 0, 0];
    const script: Ev[] = [
        { p: 0, kind: "internal" },
        { p: 0, kind: "send", to: 1, msg: 0 },
        { p: 1, kind: "receive" },
        { p: 1, kind: "send", to: 2, msg: 0 },
        { p: 2, kind: "receive" },
        { p: 2, kind: "internal" },
    ];
    const inbox = new Map<number, number>();
    let step = 0;
    const frame = (active: number, desc: string): VisualFrame => {
        const entities: VisualEntity[] = clock.map((c, i) => ({
            id: `p-${i}`,
            type: "cell" as const,
            label: `P${i}=${c}`,
            value: c,
            state: (i === active ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: step,
            layout: "grid",
            meta: { clocks: [...clock] },
        };
    };
    yield frame(-1, "Three processes start at logical time 0.");
    step += 1;
    for (const ev of script) {
        let desc = "";
        if (ev.kind === "internal") {
            clock[ev.p] = (clock[ev.p] ?? 0) + 1;
            desc = `P${ev.p} internal event: tick to ${clock[ev.p]}.`;
        } else if (ev.kind === "send") {
            clock[ev.p] = (clock[ev.p] ?? 0) + 1;
            inbox.set(ev.to ?? 0, clock[ev.p] ?? 0);
            desc = `P${ev.p} sends (stamp ${clock[ev.p]}) to P${ev.to}.`;
        } else {
            const m = inbox.get(ev.p) ?? 0;
            clock[ev.p] = Math.max(clock[ev.p] ?? 0, m) + 1;
            desc = `P${ev.p} receives (stamp ${m}): clock jumps to ${clock[ev.p]}.`;
        }
        yield frame(ev.p, desc);
        step += 1;
    }
    const ordered = (clock[0] ?? 0) < (clock[1] ?? 0) && (clock[1] ?? 0) <= (clock[2] ?? 0);
    yield frame(
        -1,
        `Final [${clock.join(",")}]: send→receive stamps rise (${ordered ? "causal order preserved" : "concurrent events only"}).`,
    );
}

const module: AlgorithmModule = {
    id: "lamport-clock",
    name: "Lamport Clock",
    category: "data-structures",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { processes: 3 },
    visualType: "grid",
    run,
};

export default module;
