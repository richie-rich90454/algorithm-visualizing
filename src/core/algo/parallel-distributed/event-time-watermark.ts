/**
 * event-time-watermark.ts - Event-Time Watermarks for Late Data and Windows
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a stream processor, a watermark is a promise that no future event will
 * carry an event time below a threshold. This module uses the common
 * bounded-out-of-orderness rule: the watermark is the greatest event time seen
 * minus a fixed lateness allowance. Events older than the watermark are late
 * and are dropped; tumbling windows fire when the watermark passes their end.
 * At end of stream the watermark advances to infinity and all open windows are
 * flushed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log w) for n events and at most w open windows
 *   Space: O(w) for the open tumbling windows
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per open window shows its event count; its label gives the range.
 *   - The window receiving the current event is highlighted, or a dropped
 *     late event is flagged in the description.
 *   - Frame metadata carries the watermark, the greatest event time, the
 *     number of late events, and any window that just fired.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface StreamEvent {
    id: string;
    timestamp: number;
    value: number;
}

interface WindowState {
    start: number;
    end: number;
    count: number;
    sum: number;
}

const SENTINEL = -1e15;

function makeBars(windows: WindowState[], highlightEnd: number | null, state: EntityState): VisualEntity[] {
    return [...windows]
        .sort((a, b) => a.start - b.start)
        .map((w) => ({
            id: `window-${w.start}`,
            type: "bar" as const,
            label: `[${w.start},${w.end}) count=${w.count} sum=${w.sum}`,
            value: w.count,
            state: highlightEnd === w.end ? "comparing" : state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { start: w.start, end: w.end, count: w.count, sum: w.sum },
        }));
}

/** The event-time watermark generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { events?: StreamEvent[]; windowSize?: number; allowedLateness?: number } | null) ?? {};
    const events: StreamEvent[] = Array.isArray(task.events)
        ? task.events.filter((e) => e && typeof e.id === "string").map((e) => ({
              id: String(e.id),
              timestamp: Math.floor(Number(e.timestamp)),
              value: Number(e.value),
          }))
        : [
              { id: "e1", timestamp: 1000, value: 5 },
              { id: "e2", timestamp: 5000, value: 3 },
              { id: "e3", timestamp: 2000, value: 7 },
              { id: "e4", timestamp: 6000, value: 2 },
              { id: "e5", timestamp: 8000, value: 4 },
          ];
    const windowSize = Math.max(1, Math.floor(task.windowSize ?? 4000));
    const allowedLateness = Math.max(0, Math.floor(task.allowedLateness ?? 2000));

    let maxEventTime = SENTINEL;
    let watermark = SENTINEL;
    let lateCount = 0;
    const windows = new Map<number, WindowState>();
    const fired: string[] = [];
    let step = 0;

    const snapshot = (description: string, codeLine: number, extra: object = {}) => {
        const open = [...windows.values()];
        const frame: VisualFrame = {
            stepNumber: step,
            entities: makeBars(open, null, "idle"),
            edges: [],
            description,
            codeLineNumber: codeLine,
            layout: "array",
            meta: {
                watermark,
                maxEventTime,
                lateCount,
                openWindows: open.map((w) => `[${w.start},${w.end})`),
                fired: [...fired],
                ...extra,
            },
        };
        step += 1;
        return frame;
    };

    yield snapshot(`Starting the stream with ${windowSize}-unit windows and ${allowedLateness} units of lateness.`, 0);

    const fireReady = (): VisualFrame[] => {
        const out: VisualFrame[] = [];
        const ready = [...windows.values()]
            .filter((w) => w.end <= watermark)
            .sort((a, b) => a.end - b.end);
        for (const w of ready) {
            windows.delete(w.end);
            const text = `[${w.start},${w.end}) count=${w.count} sum=${w.sum}`;
            fired.push(text);
            out.push(
                snapshot(`Watermark ${watermark} passed window end ${w.end}; firing ${text}.`, 5, {
                    justFired: text,
                    highlightEnd: w.end,
                }),
            );
        }
        return out;
    };

    for (const event of events) {
        if (event.timestamp < watermark) {
            lateCount += 1;
            yield snapshot(
                `Event ${event.id} at ${event.timestamp} is late: its time is below watermark ${watermark}, so it is dropped.`,
                3,
                { lateEvent: event.id },
            );
            continue;
        }

        if (event.timestamp > maxEventTime) {
            maxEventTime = event.timestamp;
        }
        watermark = Math.max(watermark, maxEventTime - allowedLateness);

        const end = Math.ceil(event.timestamp / windowSize) * windowSize;
        let window = windows.get(end);
        if (!window) {
            window = { start: end - windowSize, end, count: 0, sum: 0 };
            windows.set(end, window);
        }
        window.count += 1;
        window.sum += event.value;

        yield snapshot(
            `Event ${event.id} at ${event.timestamp} joins window [${window.start},${end}); watermark is now ${watermark}.`,
            4,
            { activeEnd: end },
        );

        for (const frame of fireReady()) {
            yield frame;
        }
    }

    watermark = Number.POSITIVE_INFINITY;
    for (const frame of fireReady()) {
        yield frame;
    }

    yield snapshot(
        `End of stream: ${fired.length} window(s) fired, ${lateCount} late event(s) dropped.`,
        7,
        { done: true },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A stream has no end, so a processor cannot wait to be sure it has seen every event before closing a time window. A watermark is a moving frontier: it says that event times older than the frontier are finished. With bounded out-of-orderness, the frontier trails the greatest event time seen by a fixed allowance. Events behind it are discarded as late, and a window closes as soon as the frontier passes its end.",
        invariants: [
            "The watermark never decreases during the stream.",
            "An event is assigned to a window only when its time is at least the watermark.",
            "A fired window's count and sum equal the events accepted into that window.",
        ],
        correctness:
            "The watermark is the running maximum event time minus a fixed lateness, so it is monotone and any event below it violated the assumed bound and is correctly discarded. A window can fire only when its end is at or below the watermark, which is the moment no accepted future event can belong to it. Summing accepted events per window and firing once gives exact aggregates; the end-of-stream flush handles the final partial frontier.",
        complexityRationale:
            "Each event updates at most one window and checks windows whose end has passed; firing each window once gives O(n log w) with an ordered window map, or O(n) amortized with a queue. At most w windows are open, so space is O(w).",
        uses: [
            "Exactly-once tumbling aggregations in stream processors",
            "Handling out-of-order sensor or clickstream events",
            "Closing session or time windows with a bounded late-data allowance",
        ],
        references: [
            "Akidau et al., The Dataflow Model, VLDB 2015",
            "Kleppmann, Designing Data-Intensive Applications, Chapter 11",
        ],
        workedExample:
            "With 4000-unit windows, 2000 units of lateness, and events at 1000, 5000, 2000, 6000, 8000, the watermark reaches 3000 after the 5000 event, so the 2000 event is late and dropped. Window [0,4000) fires when the watermark reaches 4000, and the remaining windows flush at end of stream.",
    },
    id: "event-time-watermark",
    name: "Event-Time Watermark",
    category: "parallel-distributed",
    complexity: { time: "O(n log w)", space: "O(w)" },
    defaultInput: {
        events: [
            { id: "e1", timestamp: 1000, value: 5 },
            { id: "e2", timestamp: 5000, value: 3 },
            { id: "e3", timestamp: 2000, value: 7 },
            { id: "e4", timestamp: 6000, value: 2 },
            { id: "e5", timestamp: 8000, value: 4 },
        ],
        windowSize: 4000,
        allowedLateness: 2000,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the greatest event time and the watermark to minus infinity",
        "read the next event from the stream",
        "if the event time is below the watermark, drop it as late",
        "otherwise update the greatest event time and recompute the watermark",
        "add the event to its tumbling window by flooring to the window end",
        "fire every window whose end is at or below the watermark",
        "at end of stream, advance the watermark to infinity and flush all windows",
        "done: report fired aggregates and the number of late events",
    ],
};

export default module;
