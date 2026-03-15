const dialog = document.getElementById("connectMenu");
const serverInput = document.getElementById("server");
const nameInput = document.getElementById("name");

const EXTRA_PATTERN = /^[A-Za-z0-9_-]{3,24}$/;

const msgBoard = document.getElementById("msgBoard");
const msgInput = document.getElementById("message");

let ws = null;
let registered = false;
let pendingName = '';

function appendSys(t) {
    const el = document.createElement("div");

    el.className = "sys";
    el.textContent = t;
    msgBoard.appendChild(el);
    msgBoard.scrollTop = msgBoard.scrollHeight;
}

function appendMsg(name, text, deleted = false) {
    const wrap = document.createElement("div");
    wrap.className = "msg";

    const meta = document.createElement("span");
    meta.textContent = name + ':';

    const body = document.createElement("span");

    body.textContent = " " + text;
    if (deleted) body.style.fontStyle = "italic";

    wrap.appendChild(meta);
    wrap.appendChild(body);
    msgBoard.appendChild(wrap);
    msgBoard.scrollTop = msgBoard.scrollHeight;
}

window.addEventListener("load", () => {
    serverInput.value = localStorage.getItem("ircServer") || "";
    nameInput.value = localStorage.getItem("ircName") || "";

    if (typeof dialog.showModal === "function") {
        dialog.style.margin = "auto";

        dialog.showModal();
        nameInput.focus();
    } else {
        appendSys("Dialog not supported by browser.");
    }
});

dialog.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();

    const server = serverInput.value.trim();
    const name = nameInput.value.trim();

    if (!server || !name) {
        appendSys("Server and name required.");
        return;
    }

    localStorage.setItem("ircServer", server);
    localStorage.setItem("ircName", name);
    pendingName = name;

    connect(server);
});

function connect(url) {
    if (ws) try {
        ws.close();
    } catch { }

    let deUrl = String(url || "").trim();

    if (!/^[a-z]+:\/\//i.test(deUrl)) deUrl = "ws://" + deUrl;
    deUrl = deUrl.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");

    const match = deUrl.match(/^([a-z]+:\/\/)([A-Za-z0-9_-])@(.+)$/i);
    const extra = match ? match[2] : null;

    if (extra && !EXTRA_PATTERN.test(extra)) {
        appendSys("Couldn't parse extra info.");
        return;
    }

    if (match) deUrl = match[1] + match[3]; // rebuild url without extra info

    let parsed;
    try {
        parsed = new URL(deUrl);
    } catch {
        appendSys("Bad Websocket URL.");
        return;
    }

    if (!parsed.port) {
        appendSys("Port required (example: ws://localhost:2579)");
        return;
    }

    appendSys("Connecting...");

    try {
        ws = new WebSocket(parsed.toString());
    } catch {
        appendSys("Bad Websocket URL.");
        return;
    }

    ws.addEventListener("open", () => {
        ws.send(JSON.stringify({
            type: "register",
            name: pendingName,
            extra: extra
        }));
    });

    ws.addEventListener("message", (ev) => {
        let msg;
        try {
            msg = JSON.parse(ev.data);
        } catch {
            return;
        }

        if (msg.type === "message") {
            appendMsg(msg.name, msg.text, msg.deleted);
            return;
        }

        if (msg.type === "kick") {
            appendSys("You've been kicked: " + (msg.reason || ""));
            registered = false;

            try {
                ws.close();
            } catch { }

            setTimeout(() => {
                try {
                    dialog.showModal();
                } catch { }
            }, 150);

            return;
        }

        if (msg.type === "welcome") {
            registered = true;

            try {
                dialog.close();
            } catch { }

            return;
        }

        if (msg.type === "server" && msg.text) {
            appendSys(msg.text);

            return;
        }
    });

    ws.addEventListener("close", () => {
        appendSys("Disconnected.");

        registered = false;

        setTimeout(() => {
            try {
                dialog.showModal();
            } catch {}
        }, 150);
    });

    ws.addEventListener("error", () => appendSys("Connection error."));
}

function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        appendSys("Not connected.");

        return;
    }

    if (!registered) {
        appendSys("Not registered yet.");

        return;
    }

    ws.send(JSON.stringify({
        type: "message",
        text
    }));

    msgInput.value = "";
}

msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});