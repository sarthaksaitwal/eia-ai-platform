const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { fetchEnvironmentalData, AnalyticsServiceError } = require("../src/clients/analyticsClient");

function setEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previousUrl = process.env.ANALYTICS_SERVICE_URL;
  setEnv("ANALYTICS_SERVICE_URL", `http://127.0.0.1:${server.address().port}/`);
  try {
    await run(server);
  } finally {
    setEnv("ANALYTICS_SERVICE_URL", previousUrl);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

test("posts the payload as JSON to /api/environmental/fetch", async () => {
  let received;
  await withServer(
    async (req, res) => {
      received = { method: req.method, url: req.url, type: req.headers["content-type"], body: JSON.parse(await readBody(req)) };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ observations: [], providers: [] }));
    },
    async () => {
      const body = await fetchEnvironmentalData({ assessment_id: "a-1", location: { latitude: 28.6, longitude: 77.2 } });
      assert.deepEqual(body, { observations: [], providers: [] });
    }
  );

  assert.deepEqual(received, {
    method: "POST",
    url: "/api/environmental/fetch",
    type: "application/json",
    body: { assessment_id: "a-1", location: { latitude: 28.6, longitude: 77.2 } },
  });
});

test("non-2xx responses become AnalyticsServiceError with status and detail", async () => {
  await withServer(
    (req, res) => {
      res.writeHead(422, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: [{ msg: "Field required" }] }));
    },
    async () => {
      await assert.rejects(fetchEnvironmentalData({}), (err) => {
        assert.ok(err instanceof AnalyticsServiceError);
        assert.equal(err.status, 422);
        assert.deepEqual(err.detail, [{ msg: "Field required" }]);
        return true;
      });
    }
  );
});

test("a slow analytics service times out", async () => {
  const previousTimeout = process.env.ANALYTICS_TIMEOUT_MS;
  setEnv("ANALYTICS_TIMEOUT_MS", "50");
  try {
    await withServer(
      () => {}, // never responds
      async () => {
        await assert.rejects(fetchEnvironmentalData({}), /did not respond within 0.05 s/);
      }
    );
  } finally {
    setEnv("ANALYTICS_TIMEOUT_MS", previousTimeout);
  }
});

test("an unreachable or unconfigured analytics service is reported", async () => {
  let port;
  await withServer(
    () => {},
    async (server) => {
      port = server.address().port;
    }
  );
  const previousUrl = process.env.ANALYTICS_SERVICE_URL;
  try {
    setEnv("ANALYTICS_SERVICE_URL", `http://127.0.0.1:${port}`);
    await assert.rejects(fetchEnvironmentalData({}), /unreachable/);

    setEnv("ANALYTICS_SERVICE_URL", undefined);
    await assert.rejects(fetchEnvironmentalData({}), /ANALYTICS_SERVICE_URL is not configured/);
  } finally {
    setEnv("ANALYTICS_SERVICE_URL", previousUrl);
  }
});
