import { describe, expect, test } from "bun:test";

import {
  incrementCounter,
  observeDuration,
  renderPrometheus,
  resetMetrics,
  setGauge,
} from "../../src/observability/metrics.ts";

describe("metrics registry", () => {
  test("renders counters, gauges, and duration histograms", () => {
    resetMetrics();
    incrementCounter("keking_requests_total", { model: "a", status: "ok" }, 2);
    incrementCounter("keking_requests_total", { model: "a", status: "error" });
    setGauge("keking_queue_tracks", 3, { guild: "123" });
    observeDuration("keking_request_duration_seconds", 0.5, { model: "a" });
    observeDuration("keking_request_duration_seconds", 1.5, { model: "a" });

    const output = renderPrometheus();

    expect(output).toContain(`keking_requests_total{model="a",status="ok"} 2`);
    expect(output).toContain(`keking_requests_total{model="a",status="error"} 1`);
    expect(output).toContain(`keking_queue_tracks{guild="123"} 3`);
    expect(output).toContain(`# TYPE keking_request_duration_seconds histogram`);
    expect(output).toContain(`keking_request_duration_seconds_sum{model="a"} 2`);
    expect(output).toContain(`keking_request_duration_seconds_count{model="a"} 2`);
  });

  test("accumulates histogram buckets so percentiles are computable", () => {
    resetMetrics();
    observeDuration("keking_latency_seconds", 0.05, { route: "a" });
    observeDuration("keking_latency_seconds", 0.4, { route: "a" });
    observeDuration("keking_latency_seconds", 4, { route: "a" });

    const output = renderPrometheus();

    expect(output).toContain(`keking_latency_seconds_bucket{le="0.05",route="a"} 1`);
    expect(output).toContain(`keking_latency_seconds_bucket{le="0.1",route="a"} 1`);
    expect(output).toContain(`keking_latency_seconds_bucket{le="0.5",route="a"} 2`);
    expect(output).toContain(`keking_latency_seconds_bucket{le="1",route="a"} 2`);
    expect(output).toContain(`keking_latency_seconds_bucket{le="5",route="a"} 3`);
    expect(output).toContain(`keking_latency_seconds_bucket{le="+Inf",route="a"} 3`);
  });

  test("declares each metric type only once", () => {
    resetMetrics();
    incrementCounter("keking_requests_total", { status: "ok" });
    incrementCounter("keking_requests_total", { status: "error" });
    observeDuration("keking_latency_seconds", 1, { status: "ok" });
    observeDuration("keking_latency_seconds", 2, { status: "error" });

    const output = renderPrometheus();

    expect(output.match(/# TYPE keking_requests_total counter/g)?.length).toBe(1);
    expect(output.match(/# TYPE keking_latency_seconds histogram/g)?.length).toBe(1);
  });

  test("ignores invalid metric values", () => {
    resetMetrics();
    incrementCounter("invalid", {}, Number.NaN);
    observeDuration("invalid", Number.NaN);
    setGauge("invalid", Number.NaN);

    expect(renderPrometheus()).toBe("");
  });
});
