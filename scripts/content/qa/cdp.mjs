// Minimal Chrome DevTools Protocol driver for the visual/UX audit.
// Uses only Node globals (WebSocket, timers) - no new dependencies.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = (e) => reject(new Error(`CDP websocket error: ${e.message || e}`));
    });

    let nextId = 0;
    const pending = new Map();
    const listeners = new Set();
    const events = [];

    ws.onmessage = (evt) => {
        let msg;
        try {
            msg = JSON.parse(evt.data);
        } catch {
            return;
        }
        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) reject(new Error(`${msg.method}: ${JSON.stringify(msg.error)}`));
            else resolve(msg.result);
        } else if (msg.method) {
            events.push(msg);
            for (const fn of listeners) fn(msg);
        }
    };

    function send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = ++nextId;
            pending.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    function onEvent(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    }

    async function evaluate(expression, { awaitPromise = true } = {}) {
        const res = await send("Runtime.evaluate", {
            expression,
            awaitPromise,
            returnByValue: true,
            userGesture: true,
        });
        if (res.exceptionDetails) {
            const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
            throw new Error(`Runtime.evaluate threw: ${desc}`);
        }
        return res.result.value;
    }

    async function waitFor(fn, { timeout = 15000, interval = 100, label = "condition" } = {}) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            let value;
            try {
                value = await fn();
            } catch {
                value = false;
            }
            if (value) return value;
            await sleep(interval);
        }
        throw new Error(`Timed out waiting for ${label}`);
    }

    async function goto(url) {
        await send("Page.navigate", { url });
        await waitFor(() => evaluate("document.readyState === 'complete'"), {
            label: `page load ${url}`,
        });
        await waitFor(() => evaluate("!!document.querySelector('.visual-canvas')"), {
            label: `app mount ${url}`,
        });
    }

    async function key(keyDef) {
        await send("Input.dispatchKeyEvent", { type: "keyDown", ...keyDef });
        await sleep(20);
        await send("Input.dispatchKeyEvent", { type: "keyUp", ...keyDef });
    }

    async function screenshot(path, options = {}) {
        const res = await send("Page.captureScreenshot", {
            format: options.format || "jpeg",
            quality: options.quality || 60,
            captureBeyondViewport: false,
            ...(options.clip ? { clip: options.clip } : {}),
        });
        const { writeFileSync } = await import("node:fs");
        writeFileSync(path, Buffer.from(res.data, "base64"));
    }

    function close() {
        try {
            ws.close();
        } catch {
            /* ignore */
        }
    }

    return {
        send,
        evaluate,
        waitFor,
        goto,
        key,
        screenshot,
        onEvent,
        events,
        close,
        sleep,
    };
}
