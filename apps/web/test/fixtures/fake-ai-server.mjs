import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DETECTION_RESPONSE = {
  model: "fake-yolo-local",
  image: { width: 80, height: 60 },
  detections: [
    {
      class_id: 63,
      label: "laptop",
      confidence: 0.93,
      bbox: { x1: 8, y1: 6, x2: 72, y2: 52 },
      suggested_category: "Elektronik",
    },
  ],
  suggested_category: "Elektronik",
  inference_ms: 12.5,
};

const OCR_RESPONSE = {
  engine: "fake-ocr-local",
  language: "en",
  image: { width: 80, height: 60 },
  lines: [
    { text: "LOGITECH", confidence: 0.96 },
    { text: "M331", confidence: 0.92 },
  ],
  full_text: "LOGITECH\nM331",
  average_confidence: 0.94,
  inference_ms: 18.25,
  truncated: false,
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function drainRequest(request) {
  for await (const chunk of request) {
    void chunk;
    // Drain multipart body without logging or writing bytes.
  }
}

export async function startFakeAiServer({ token, port = 0 } = {}) {
  if (!token || token.length < 32) {
    throw new Error("Fake AI server requires a generated bearer token.");
  }

  const server = http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/ready") {
      sendJson(response, 200, { ready: true });
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 404, { detail: "not_found" });
      return;
    }

    if (request.headers.authorization !== `Bearer ${token}`) {
      await drainRequest(request);
      sendJson(response, 401, { detail: "invalid_token" });
      return;
    }

    if (!request.headers["content-type"]?.startsWith("multipart/form-data")) {
      await drainRequest(request);
      sendJson(response, 415, { detail: "multipart_required" });
      return;
    }

    await drainRequest(request);

    if (request.url === "/api/v1/images/detect") {
      sendJson(response, 200, DETECTION_RESPONSE);
      return;
    }

    if (request.url === "/api/v1/images/ocr") {
      sendJson(response, 200, OCR_RESPONSE);
      return;
    }

    sendJson(response, 404, { detail: "not_found" });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  const address = server.address();
  const localPort = typeof address === "object" && address ? address.port : port;

  return {
    url: `http://127.0.0.1:${localPort}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === pathFromArgv(process.argv[1])) {
  const token = process.env.AI_INTERNAL_API_TOKEN;
  const port = Number.parseInt(process.env.FAKE_AI_PORT ?? "18080", 10);
  const server = await startFakeAiServer({ token, port });

  process.stdout.write(`FAKE_AI_READY ${server.url}\n`);

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

function pathFromArgv(value) {
  return path.resolve(value);
}
