import { renderPrometheus, setGauge } from "./metrics.js";

export type QueueMetrics = {
  queues: number;
  tracks: number;
  playing: number;
};

export type HealthState = {
  startedAt: number;
  isDiscordReady: () => boolean;
  checkDatabase: () => Promise<void>;
  collectQueueMetrics?: (() => QueueMetrics) | undefined;
  metricsToken?: string | undefined;
  metricsRequireToken?: boolean | undefined;
};

export type HealthServerConfig = {
  healthEnabled: boolean;
  healthHost: string;
  healthPort: number;
};

export type HealthServerHandle = {
  stop: () => Promise<void> | void;
};

type ServeOptions = {
  hostname: string;
  port: number;
  fetch: (request: Request) => Promise<Response>;
};

const defaultServe = Bun.serve;

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "Unknown";
}

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "localhost" || normalized === "::1" || normalized.startsWith("127.");
}

function hasMetricsAccess(request: Request, token: string | undefined): boolean {
  if (!token) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${token}`;
}

export async function handleHealthRequest(
  request: Request,
  state: HealthState,
): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === "/healthz") {
    return Response.json({
      status: "ok",
      uptimeSeconds: Math.round((Date.now() - state.startedAt) / 1000),
    });
  }

  if (pathname === "/readyz") {
    const discordReady = state.isDiscordReady();
    let databaseReady = true;
    let databaseError: string | undefined;

    try {
      await state.checkDatabase();
    } catch (error) {
      databaseReady = false;
      databaseError = errorName(error);
    }

    const ready = discordReady && databaseReady;
    return Response.json(
      {
        status: ready ? "ok" : "unavailable",
        checks: {
          discord: discordReady ? "ok" : "not_ready",
          database: databaseReady ? "ok" : { error: databaseError },
        },
      },
      { status: ready ? 200 : 503 },
    );
  }

  if (pathname === "/metrics") {
    const requiresToken = state.metricsRequireToken ?? true;
    if (requiresToken && !hasMetricsAccess(request, state.metricsToken)) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    const queueMetrics = state.collectQueueMetrics?.();
    if (queueMetrics) {
      setGauge("keking_music_queues", queueMetrics.queues);
      setGauge("keking_music_queue_tracks", queueMetrics.tracks);
      setGauge("keking_music_playing", queueMetrics.playing);
    }

    return new Response(renderPrometheus(), {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return Response.json({ error: "not_found" }, { status: 404 });
}

export function startHealthServer(
  serverConfig: HealthServerConfig,
  state: HealthState,
  serve: (options: ServeOptions) => { stop: (force?: boolean) => Promise<void> | void } = defaultServe,
): HealthServerHandle | null {
  if (!serverConfig.healthEnabled) {
    return null;
  }

  const loopbackOnly = isLoopbackHost(serverConfig.healthHost);
  const effectiveState: HealthState = {
    ...state,
    metricsRequireToken:
      state.metricsRequireToken ?? (Boolean(state.metricsToken) || !loopbackOnly),
  };

  const server = serve({
    hostname: serverConfig.healthHost,
    port: serverConfig.healthPort,
    fetch: (request) => handleHealthRequest(request, effectiveState),
  });

  return {
    stop: () => server.stop(true),
  };
}
