import { describe, expect, test } from "bun:test";

import {
  handleHealthRequest,
  isLoopbackHost,
  startHealthServer,
  type HealthState,
} from "../../src/observability/health.ts";


function makeState(options: {
  discordReady?: boolean;
  databaseError?: Error;
  token?: string;
  requireToken?: boolean;
} = {}): HealthState {
  return {
    startedAt: Date.now() - 1_000,
    isDiscordReady: () => options.discordReady ?? true,
    checkDatabase: async () => {
      if (options.databaseError) {
        throw options.databaseError;
      }
    },
    collectQueueMetrics: () => ({
      queues: 1,
      tracks: 2,
      playing: 1,
    }),
    metricsToken: options.token,
    metricsRequireToken: options.requireToken,
  };
}

describe("health endpoints", () => {
  test("healthz always reports liveness", async () => {
    const response = await handleHealthRequest(
      new Request("http://localhost/healthz"),
      makeState({ discordReady: false, databaseError: new Error("offline") }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
  });

  test("readyz reports 200 when all checks pass", async () => {
    const response = await handleHealthRequest(
      new Request("http://localhost/readyz"),
      makeState(),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      checks: { discord: "ok", database: "ok" },
    });
  });

  test("readyz reports 503 when a check fails", async () => {
    const response = await handleHealthRequest(
      new Request("http://localhost/readyz"),
      makeState({ discordReady: false, databaseError: new TypeError("db down") }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "unavailable",
      checks: { discord: "not_ready", database: { error: "TypeError" } },
    });
  });

  test("metrics requires the configured token", async () => {
    const request = new Request("http://localhost/metrics", {
      headers: { authorization: "Bearer wrong" },
    });
    const response = await handleHealthRequest(request, makeState({ token: "secret" }));

    expect(response.status).toBe(401);
  });

  test("metrics rejects unauthenticated requests when a token is required", async () => {
    const response = await handleHealthRequest(
      new Request("http://localhost/metrics"),
      makeState({ token: "secret" }),
    );

    expect(response.status).toBe(401);
  });

  test("metrics rejects requests when no token is configured", async () => {
    const response = await handleHealthRequest(
      new Request("http://localhost/metrics"),
      makeState(),
    );

    expect(response.status).toBe(401);
  });

  test("metrics serves openly only when a token is explicitly not required", async () => {
    const response = await handleHealthRequest(
      new Request("http://localhost/metrics"),
      makeState({ requireToken: false }),
    );

    expect(response.status).toBe(200);
  });

  test("detects loopback hosts", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("127.0.0.2")).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("0.0.0.0")).toBe(false);
    expect(isLoopbackHost("10.0.0.5")).toBe(false);
  });

  test("starts and stops an injected server", async () => {
    const handle = startHealthServer({
      healthEnabled: true,
      healthHost: "127.0.0.1",
      healthPort: 3000,
    }, makeState(), (options) => {
      expect(options.hostname).toBe("127.0.0.1");
      expect(options.port).toBe(3000);
      expect(options.fetch).toBeInstanceOf(Function);
      return {
        stop: async () => {
          await Promise.resolve();
        },
      };
    });

    expect(handle).not.toBeNull();
    await handle?.stop();
  });

  test("uses the default Bun server factory", async () => {
    const handle = startHealthServer({
      healthEnabled: true,
      healthHost: "127.0.0.1",
      healthPort: 0,
    }, makeState());


    expect(handle).not.toBeNull();
    await handle?.stop();
  });

  test("requires a metrics token on non-loopback binds", async () => {
    let fetchHandler: ((request: Request) => Promise<Response>) | undefined;

    startHealthServer({
      healthEnabled: true,
      healthHost: "0.0.0.0",
      healthPort: 3000,
    }, makeState(), (options) => {
      fetchHandler = options.fetch;
      return { stop: () => {} };
    });

    const unauthorized = await fetchHandler?.(new Request("http://localhost/metrics"));
    expect(unauthorized?.status).toBe(401);
  });

  test("allows open metrics on loopback binds without a token", async () => {
    let fetchHandler: ((request: Request) => Promise<Response>) | undefined;

    startHealthServer({
      healthEnabled: true,
      healthHost: "127.0.0.1",
      healthPort: 3000,
    }, makeState(), (options) => {
      fetchHandler = options.fetch;
      return { stop: () => {} };
    });

    const response = await fetchHandler?.(new Request("http://localhost/metrics"));
    expect(response?.status).toBe(200);
  });


  test("metrics renders Prometheus output", async () => {
    const request = new Request("http://localhost/metrics", {
      headers: { authorization: "Bearer secret" },
    });
    const response = await handleHealthRequest(request, makeState({ token: "secret" }));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("keking_music_queues 1");
  });

  test("unknown paths return 404", async () => {
    const response = await handleHealthRequest(
      new Request("http://localhost/nope"),
      makeState(),
    );
    expect(response.status).toBe(404);
  });

  test("health server can be disabled", () => {
    const handle = startHealthServer({
      healthEnabled: false,
      healthHost: "127.0.0.1",
      healthPort: 0,
    }, makeState());

    expect(handle).toBeNull();
  });
});
