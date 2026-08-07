import http from "http";
import { URL } from "url";
import { WebSocketServer } from "ws";
import { runTelephonyBridge } from "./bridge.js";
import { getSessionByStreamToken } from "./session.js";

const port = Number(process.env.PORT ?? 8080);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  if (url.pathname !== "/stream") {
    socket.destroy();
    return;
  }

  const token = url.searchParams.get("token")?.trim();
  if (!token) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    void (async () => {
      try {
        const session = await getSessionByStreamToken(token);
        if (!session || session.status === "ended") {
          ws.close();
          return;
        }
        await runTelephonyBridge(ws, session);
      } catch (error) {
        console.error("Telephony bridge error:", error);
        ws.close();
      }
    })();
  });
});

server.listen(port, () => {
  console.log(`Telephony gateway listening on ${port}`);
});
