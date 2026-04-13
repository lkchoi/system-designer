import { useState, useMemo } from "react";
import { TECHNOLOGY_CATALOG } from "../technologies";
import type { ComponentType, TechnologyInfo } from "../types";
import {
  computeCapacity,
  formatDataSize,
  formatTB,
  formatBandwidth,
  formatNumber,
  formatBytes,
} from "../utils/capacity";
import type { SizeUnit } from "../utils/capacity";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "calculator" | "reference";

interface Constant {
  name: string;
  value: string;
  tags: string;
}

const CONSTANTS: Constant[] = [
  { name: "Seconds per day", value: "86,400", tags: "time seconds day" },
  { name: "Seconds per month", value: "2,592,000", tags: "time seconds month" },
  { name: "Seconds per year", value: "31,536,000", tags: "time seconds year" },
  { name: "Minutes per day", value: "1,440", tags: "time minutes day" },
  { name: "Hours per year", value: "8,760", tags: "time hours year" },
  { name: "Days per year", value: "365", tags: "time days year" },
  { name: "1 million seconds", value: "~11.6 days", tags: "time million" },
  { name: "1 billion seconds", value: "~31.7 years", tags: "time billion" },
  { name: "Bytes in 1 KB", value: "1,024", tags: "size bytes kilobyte" },
  { name: "Bytes in 1 MB", value: "1,048,576", tags: "size bytes megabyte" },
  { name: "Bytes in 1 GB", value: "1,073,741,824", tags: "size bytes gigabyte" },
  { name: "KB in 1 GB", value: "1,048,576", tags: "size kilobyte gigabyte" },
  { name: "MB in 1 TB", value: "1,048,576", tags: "size megabyte terabyte" },
  { name: "Bits per byte", value: "8", tags: "size bits byte bandwidth" },
  { name: "Nanoseconds per second", value: "1,000,000,000", tags: "time nanosecond latency" },
  { name: "Microseconds per second", value: "1,000,000", tags: "time microsecond latency" },
  { name: "Typical SSD IOPS", value: "10K\u2013100K", tags: "disk storage iops ssd" },
  { name: "Typical HDD IOPS", value: "100\u2013200", tags: "disk storage iops hdd" },
  { name: "SSD sequential read", value: "500\u20137,000 MB/s", tags: "disk storage read ssd nvme" },
  { name: "Network RTT (same region)", value: "~1 ms", tags: "network latency region" },
  {
    name: "Network RTT (cross-region)",
    value: "~50\u2013100 ms",
    tags: "network latency cross region",
  },
  {
    name: "Network RTT (cross-continent)",
    value: "~100\u2013300 ms",
    tags: "network latency continent global",
  },
  { name: "p99 latency rule of thumb", value: "~3\u20135x median", tags: "latency percentile p99" },
  { name: "TCP max payload (MTU)", value: "1,460 bytes", tags: "network tcp mtu packet" },
  { name: "1 Gbps throughput", value: "~125 MB/s", tags: "network bandwidth throughput gbps" },
  { name: "10 Gbps throughput", value: "~1.25 GB/s", tags: "network bandwidth throughput" },
];

interface FlatTech {
  name: string;
  category: ComponentType;
  throughput: string;
  limits: string;
}

const ALL_TECHNOLOGIES: FlatTech[] = (Object.keys(TECHNOLOGY_CATALOG) as ComponentType[]).flatMap(
  (category) =>
    TECHNOLOGY_CATALOG[category].map((t: TechnologyInfo) => ({
      name: t.name,
      category,
      throughput: t.throughput,
      limits: t.limits,
    })),
);

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="capacity-result-row">
      <span className="capacity-result-label">{label}</span>
      <span className="capacity-result-value">{value}</span>
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="capacity-result-group">
      <div className="capacity-result-title">{title}</div>
      {children}
    </div>
  );
}

export default function CapacityCalculator({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("calculator");
  const [tps, setTps] = useState("1000");
  const [payloadSize, setPayloadSize] = useState("2");
  const [payloadUnit, setPayloadUnit] = useState<SizeUnit>("KB");
  const [replicationFactor, setReplicationFactor] = useState("3");
  const [readWriteRatio, setReadWriteRatio] = useState("10");
  const [retentionDays, setRetentionDays] = useState("365");
  const [search, setSearch] = useState("");

  const results = useMemo(() => {
    const parsedTps = parseFloat(tps) || 0;
    const parsedPayload = parseFloat(payloadSize) || 0;
    if (parsedTps <= 0 || parsedPayload <= 0) return null;
    return computeCapacity({
      tps: parsedTps,
      payloadSize: parsedPayload,
      payloadUnit,
      replicationFactor: parseInt(replicationFactor) || 1,
      readWriteRatio: parseFloat(readWriteRatio) || 0,
      retentionDays: parseInt(retentionDays) || 365,
    });
  }, [tps, payloadSize, payloadUnit, replicationFactor, readWriteRatio, retentionDays]);

  const filteredConstants = useMemo(() => {
    if (!search) return CONSTANTS;
    const q = search.toLowerCase();
    return CONSTANTS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.tags.includes(q) || c.value.toLowerCase().includes(q),
    );
  }, [search]);

  const filteredTech = useMemo(() => {
    if (!search) return ALL_TECHNOLOGIES;
    const q = search.toLowerCase();
    return ALL_TECHNOLOGIES.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.throughput.toLowerCase().includes(q) ||
        t.limits.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [search]);

  if (!open) return null;

  const rf = parseInt(replicationFactor) || 1;
  const ret = parseInt(retentionDays) || 365;

  return (
    <div className="capacity-overlay" onClick={onClose}>
      <div
        className="capacity-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="capacity-header">
          <div className="capacity-header-left">
            <span className="capacity-title">Capacity Calculator</span>
            <div className="capacity-tabs">
              <button
                className={`capacity-tab${tab === "calculator" ? " active" : ""}`}
                onClick={() => setTab("calculator")}
              >
                Calculator
              </button>
              <button
                className={`capacity-tab${tab === "reference" ? " active" : ""}`}
                onClick={() => setTab("reference")}
              >
                Reference
              </button>
            </div>
          </div>
          <button className="capacity-close" onClick={onClose}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {tab === "calculator" && (
          <div className="capacity-body">
            <div className="capacity-inputs">
              <label className="capacity-field">
                <span className="capacity-field-label">Transactions per second</span>
                <input
                  className="capacity-input"
                  type="number"
                  min="0"
                  value={tps}
                  onChange={(e) => setTps(e.target.value)}
                  placeholder="1000"
                />
              </label>
              <label className="capacity-field">
                <span className="capacity-field-label">Avg payload / record size</span>
                <div className="capacity-field-row">
                  <input
                    className="capacity-input"
                    type="number"
                    min="0"
                    value={payloadSize}
                    onChange={(e) => setPayloadSize(e.target.value)}
                    placeholder="2"
                  />
                  <select
                    className="capacity-select"
                    value={payloadUnit}
                    onChange={(e) => setPayloadUnit(e.target.value as SizeUnit)}
                  >
                    <option value="B">B</option>
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                  </select>
                </div>
              </label>
              <label className="capacity-field">
                <span className="capacity-field-label">Read : Write ratio</span>
                <div className="capacity-field-row">
                  <input
                    className="capacity-input"
                    type="number"
                    min="0"
                    value={readWriteRatio}
                    onChange={(e) => setReadWriteRatio(e.target.value)}
                    placeholder="10"
                  />
                  <span className="capacity-field-hint">: 1</span>
                </div>
              </label>
              <label className="capacity-field">
                <span className="capacity-field-label">Replication factor</span>
                <input
                  className="capacity-input"
                  type="number"
                  min="1"
                  max="10"
                  value={replicationFactor}
                  onChange={(e) => setReplicationFactor(e.target.value)}
                  placeholder="3"
                />
              </label>
              <label className="capacity-field">
                <span className="capacity-field-label">Retention period (days)</span>
                <input
                  className="capacity-input"
                  type="number"
                  min="1"
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                  placeholder="365"
                />
              </label>
            </div>

            <div className="capacity-divider" />

            {results ? (
              <div className="capacity-results">
                <ResultGroup title="Data Volume">
                  <ResultRow label="Per second" value={formatBytes(results.bytesPerSec)} />
                  <ResultRow label="Per day" value={formatDataSize(results.dailyGB)} />
                  <ResultRow label="Per month" value={formatDataSize(results.monthlyGB)} />
                  <ResultRow label="Per year" value={formatTB(results.yearlyTB)} />
                </ResultGroup>

                <ResultGroup title={`With Replication (\u00d7${rf})`}>
                  <ResultRow label="Per day" value={formatDataSize(results.dailyReplicatedGB)} />
                  <ResultRow
                    label="Per month"
                    value={formatDataSize(results.monthlyReplicatedGB)}
                  />
                  <ResultRow label="Per year" value={formatTB(results.yearlyReplicatedTB)} />
                </ResultGroup>

                <ResultGroup title="Bandwidth">
                  <ResultRow label="Raw" value={formatBandwidth(results.bandwidthMbps)} />
                  <ResultRow
                    label={`With replication (\u00d7${rf})`}
                    value={formatBandwidth(results.bandwidthReplicatedMbps)}
                  />
                </ResultGroup>

                <ResultGroup title="Storage Projections">
                  <ResultRow label="1 year" value={formatTB(results.storage1y)} />
                  <ResultRow label="3 years" value={formatTB(results.storage3y)} />
                  <ResultRow label="5 years" value={formatTB(results.storage5y)} />
                  <ResultRow
                    label={`Retention (${ret}d)`}
                    value={formatTB(results.retentionStorageTB)}
                  />
                </ResultGroup>

                <ResultGroup title="Capacity Units (DynamoDB-style)">
                  <ResultRow label="Writes/sec" value={formatNumber(results.writesPerSec)} />
                  <ResultRow label="Reads/sec" value={formatNumber(results.readsPerSec)} />
                  <ResultRow label="WCUs needed" value={formatNumber(results.wcus)} />
                  <ResultRow label="RCUs needed" value={formatNumber(results.rcus)} />
                </ResultGroup>
              </div>
            ) : (
              <div className="capacity-empty">Enter TPS and payload size to see estimates</div>
            )}
          </div>
        )}

        {tab === "reference" && (
          <div className="capacity-body">
            <input
              className="capacity-search"
              type="text"
              placeholder="Search constants, technologies, limits..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />

            {filteredConstants.length > 0 && (
              <div className="capacity-ref-section">
                <div className="capacity-result-title">Constants</div>
                <div className="capacity-ref-list">
                  {filteredConstants.map((c) => (
                    <div key={c.name} className="capacity-ref-row">
                      <span className="capacity-ref-name">{c.name}</span>
                      <span className="capacity-ref-value">{c.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredTech.length > 0 && (
              <div className="capacity-ref-section">
                <div className="capacity-result-title">Technology Limits</div>
                <div className="capacity-ref-list">
                  {filteredTech.map((t) => (
                    <div key={`${t.category}-${t.name}`} className="capacity-ref-tech">
                      <div className="capacity-ref-tech-header">
                        <span className="capacity-ref-tech-name">{t.name}</span>
                        <span className="capacity-ref-tech-category">{t.category}</span>
                      </div>
                      <div className="capacity-ref-tech-detail">
                        <span className="capacity-ref-tech-label">Throughput</span>
                        <span className="capacity-ref-tech-val">{t.throughput}</span>
                      </div>
                      <div className="capacity-ref-tech-detail">
                        <span className="capacity-ref-tech-label">Limits</span>
                        <span className="capacity-ref-tech-val">{t.limits}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredConstants.length === 0 && filteredTech.length === 0 && (
              <div className="capacity-empty">No results for &ldquo;{search}&rdquo;</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
