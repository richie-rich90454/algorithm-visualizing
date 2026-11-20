/**
 * session-window.ts - Session Window (Event Sessionization)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A session window groups a stream of events into bursts separated by a gap of
 * inactivity. Events are processed in timestamp order: if the next event falls
 * within the allowed gap of the previous one it joins the current session,
 * otherwise a new session begins. This is the standard way to turn clickstreams
 * into user sessions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(e log e) for the initial timestamp sort of e events
 *   Space: O(e) for the ordered events and their session labels
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each event is a cell labeled with its id and timestamp.
 *   - Events in the same session share an active-state color and a session id.
 *   - A gap boundary is highlighted when a new session starts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Event = { id: string; time: number };

/** Build event cells with a session label per event. */
function buildEntities(events: Event[], labels: number[], upto: number, boundary: boolean): VisualEntity[] {
    return events.map((event, col) => {
        const revealed = col <= upto;
        const label = labels[col];
        const state: EntityState = !revealed
            ? "idle"
            : boundary && col === upto
                ? "pivot"
                : label === undefined
                    ? "idle"
                    : "active";
        return {
            id: `ev-${event.id}-${col}`,
            type: "cell" as const,
            label: `${event.id}@${event.time}`,
            value: event.time,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col, session: label ?? -1, time: event.time },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { events?: Event[]; gap?: number } | null) ?? {};
    const raw: Event[] = Array.isArray(task.events)
        ? task.events
        : [
              { id: "a", time: 1 },
              { id: "b", time: 4 },
              { id: "c", time: 20 },
              { id: "d", time: 23 },
              { id: "e", time: 25 },
              { id: "f", time: 50 },
          ];
    const sorted = raw.slice().sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
    const gap = Math.max(0, task.gap ?? 5);
    const labels = new Array<number>(sorted.length).fill(-1);
    const sessions: Event[][] = [];
    let current = -1;
    let previousTime: number | null = null;
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities(sorted, labels, -1, false),
        edges: [],
        description: `Sessionizing ${sorted.length} event(s) with an inactivity gap of ${gap}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: sorted.length, gap, sessions: [], phase: "start" },
    };

    for (let i = 0; i < sorted.length; i += 1) {
        const event = sorted[i];
        if (!event) continue;
        const newSession = previousTime === null || event.time - previousTime > gap;
        let boundary = false;
        if (newSession) {
            current += 1;
            sessions.push([]);
            boundary = current > 0;
        }
        labels[i] = current;
        const bucket = sessions[current];
        if (bucket) bucket.push(event);
        previousTime = event.time;
        yield {
            stepNumber: step++,
            entities: buildEntities(sorted, labels, i, boundary),
            edges: [],
            description: newSession
                ? `Event ${event.id} at ${event.time} starts session ${current} after a gap.`
                : `Event ${event.id} at ${event.time} joins session ${current}.`,
            codeLineNumber: newSession ? 4 : 6,
            layout: "grid",
            meta: {
                rows: 1,
                cols: sorted.length,
                gap,
                sessions: sessions.map((session) => session.map((e) => e.id)),
                phase: "assign",
                index: i,
                session: current,
            },
        };
    }

    yield {
        stepNumber: step++,
        entities: buildEntities(sorted, labels, sorted.length - 1, false),
        edges: [],
        description: `Sessionization complete: ${sessions.length} session(s) found.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 1,
            cols: sorted.length,
            gap,
            sessions: sessions.map((session) => session.map((e) => e.id)),
            sessionCount: sessions.length,
            phase: "done",
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Group events that are close together in time, and split the groups wherever there is a long pause. Sort the events by time, then walk through them: a small time difference means the event belongs to the current group, while a difference larger than the gap opens a new group.",
        invariants: [
            "Events are processed in nondecreasing timestamp order.",
            "Two consecutive events in the same session are never more than gap apart.",
            "Every event belongs to exactly one session, and sessions are contiguous in time order.",
        ],
        correctness:
            "Sorting first guarantees that each event is compared only with its immediate predecessor in time. The rule starts a new session exactly when that predecessor is more than gap away, which is precisely the definition of a session boundary. Because each event is appended to the current session or to a freshly created one, sessions partition the events and no event can appear twice.",
        complexityRationale:
            "Sorting the events dominates at O(e log e), and the single assignment pass is O(e). Storing the events, their labels and the session lists uses O(e) space.",
        uses: [
            "Turning clickstreams into browsing sessions in web analytics",
            "Grouping log entries into incident windows",
            "Segmenting sensor bursts separated by idle periods",
        ],
        references: [
            "Apache Flink documentation, session windows",
            "Akidau et al., The Dataflow Model, VLDB 2015",
        ],
        workedExample:
            "Events at times 1, 4, 20, 23, 25, 50 with gap 5 form sessions [1,4], [20,23,25] and [50], because the jumps from 4 to 20 and from 25 to 50 both exceed the gap.",
    },
    id: "session-window",
    name: "Session Window (Sessionization)",
    category: "production-systems",
    complexity: { time: "O(e log e)", space: "O(e)" },
    defaultInput: {
        events: [
            { id: "a", time: 1 },
            { id: "b", time: 4 },
            { id: "c", time: 20 },
            { id: "d", time: 23 },
            { id: "e", time: 25 },
            { id: "f", time: 50 },
        ],
        gap: 5,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "sort the events by timestamp",
        "start with no current session and no previous time",
        "for each event in sorted order",
        "if it is more than the gap after the previous event, open a new session",
        "otherwise append it to the current session",
        "record the session label for this event",
        "done: return all sessions as lists of event ids",
    ],
};

export default module;
