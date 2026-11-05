export type MetricLabels = Record<string, string | number | undefined>;

export const DEFAULT_DURATION_BUCKETS: readonly number[] = [
  0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30,
];

type CounterRecord = {
  name: string;
  labelText: string;
  value: number;
};

type HistogramRecord = {
  name: string;
  labelText: string;
  labels: MetricLabels;
  buckets: readonly number[];
  bucketCounts: number[];
  sum: number;
  count: number;
};

type GaugeRecord = {
  name: string;
  labelText: string;
  value: number;
};

const counters = new Map<string, CounterRecord>();
const histograms = new Map<string, HistogramRecord>();
const gauges = new Map<string, GaugeRecord>();

function formatLabels(labels: MetricLabels): string {
  const entries = Object.entries(labels)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  if (entries.length === 0) {
    return "";
  }

  const rendered = entries
    .map(([key, value]) => `${key.replaceAll(/[^a-zA-Z0-9_]/g, "_")}="${String(value)}"`)
    .join(",");
  return `{${rendered}}`;
}

function metricKey(name: string, labelText: string): string {
  return `${name}${labelText}`;
}

export function incrementCounter(
  name: string,
  labels: MetricLabels = {},
  amount = 1,
): void {
  if (!Number.isFinite(amount)) {
    return;
  }

  const labelText = formatLabels(labels);
  const key = metricKey(name, labelText);
  const existing = counters.get(key);
  counters.set(key, {
    name,
    labelText,
    value: (existing?.value ?? 0) + amount,
  });
}

export function observeDuration(
  name: string,
  seconds: number,
  labels: MetricLabels = {},
  buckets: readonly number[] = DEFAULT_DURATION_BUCKETS,
): void {
  if (!Number.isFinite(seconds)) {
    return;
  }

  const labelText = formatLabels(labels);
  const key = metricKey(name, labelText);
  const existing = histograms.get(key) ?? {
    name,
    labelText,
    labels,
    buckets,
    bucketCounts: buckets.map(() => 0),
    sum: 0,
    count: 0,
  };

  existing.sum += seconds;
  existing.count += 1;
  existing.bucketCounts = existing.buckets.map((boundary, index) => {
    const current = existing.bucketCounts[index] ?? 0;
    return seconds <= boundary ? current + 1 : current;
  });

  histograms.set(key, existing);
}

export function setGauge(
  name: string,
  value: number,
  labels: MetricLabels = {},
): void {
  if (!Number.isFinite(value)) {
    return;
  }

  const labelText = formatLabels(labels);
  gauges.set(metricKey(name, labelText), {
    name,
    labelText,
    value,
  });
}

export function resetMetrics(): void {
  counters.clear();
  histograms.clear();
  gauges.clear();
}

function sorted<T extends { name: string; labelText: string }>(map: Map<string, T>): T[] {
  return [...map.values()].sort((left, right) =>
    `${left.name}${left.labelText}`.localeCompare(`${right.name}${right.labelText}`),
  );
}

export function renderPrometheus(): string {
  const lines: string[] = [];
  const declaredTypes = new Set<string>();

  const declareType = (name: string, type: string): void => {
    if (declaredTypes.has(name)) {
      return;
    }
    declaredTypes.add(name);
    lines.push(`# TYPE ${name} ${type}`);
  };

  for (const counter of sorted(counters)) {
    declareType(counter.name, "counter");
    lines.push(`${counter.name}${counter.labelText} ${counter.value}`);
  }

  for (const histogram of sorted(histograms)) {
    declareType(histogram.name, "histogram");

    histogram.buckets.forEach((boundary, index) => {
      const bucketLabels = formatLabels({ ...histogram.labels, le: String(boundary) });
      lines.push(`${histogram.name}_bucket${bucketLabels} ${histogram.bucketCounts[index] ?? 0}`);
    });

    const infinityLabels = formatLabels({ ...histogram.labels, le: "+Inf" });
    lines.push(`${histogram.name}_bucket${infinityLabels} ${histogram.count}`);
    lines.push(`${histogram.name}_sum${histogram.labelText} ${histogram.sum}`);
    lines.push(`${histogram.name}_count${histogram.labelText} ${histogram.count}`);
  }

  for (const gauge of sorted(gauges)) {
    declareType(gauge.name, "gauge");
    lines.push(`${gauge.name}${gauge.labelText} ${gauge.value}`);
  }

  return `${lines.join("\n")}${lines.length > 0 ? "\n" : ""}`;
}
