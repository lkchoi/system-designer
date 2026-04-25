import { useState, useMemo } from "react";
import { computePartitions, formatRate, formatStorage } from "./partition";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PartitionCalculator({ open, onClose }: Props) {
  const [throughput, setThroughput] = useState("10");
  const [messageSize, setMessageSize] = useState("1024");
  const [consumers, setConsumers] = useState("4");
  const [consumerThroughput, setConsumerThroughput] = useState("2");
  const [retention, setRetention] = useState("72");
  const [rf, setRf] = useState("3");

  const result = useMemo(() => {
    const t = parseFloat(throughput) || 0;
    if (t <= 0) return null;
    return computePartitions({
      throughputMBps: t,
      messageSize: parseFloat(messageSize) || 0,
      consumerCount: parseInt(consumers) || 1,
      consumerThroughputMBps: parseFloat(consumerThroughput) || 1,
      retentionHours: parseFloat(retention) || 0,
      replicationFactor: parseInt(rf) || 1,
    });
  }, [throughput, messageSize, consumers, consumerThroughput, retention, rf]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-[520px] max-w-[90vw] max-h-[85vh] flex flex-col shadow-[0_16px_50px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <div className="flex items-center justify-between px-6 pt-5 shrink-0">
          <span className="text-base font-bold text-text-bright">Partition Calculator</span>
          <button className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim shrink-0 transition-all duration-150 hover:bg-surface-2 hover:text-text-bright" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 pt-5 pb-6 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-3.5">
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Producer throughput (MB/s)</span>
              <input className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent" type="number" min="0" value={throughput} onChange={(e) => setThroughput(e.target.value)} />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Message size (bytes)</span>
              <input className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent" type="number" min="0" value={messageSize} onChange={(e) => setMessageSize(e.target.value)} />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Consumer count</span>
              <input className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent" type="number" min="1" value={consumers} onChange={(e) => setConsumers(e.target.value)} />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Consumer throughput (MB/s)</span>
              <input className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent" type="number" min="0" step="0.1" value={consumerThroughput} onChange={(e) => setConsumerThroughput(e.target.value)} />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Retention (hours)</span>
              <input className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent" type="number" min="0" value={retention} onChange={(e) => setRetention(e.target.value)} />
            </label>
            <label className="flex flex-col gap-[5px]">
              <span className="text-xs font-medium text-text-dim">Replication factor</span>
              <input className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text-bright text-sm font-mono outline-none transition-[border-color] duration-150 focus:border-accent" type="number" min="1" max="10" value={rf} onChange={(e) => setRf(e.target.value)} />
            </label>
          </div>

          <div className="h-px bg-border my-5" />

          {result ? (
            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Recommendation</span>
                <span className="text-xl font-bold font-mono text-text-bright">{result.recommendedPartitions} partitions</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">Breakdown</span>
                <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">Messages/sec</span><span className="font-mono text-sm font-semibold text-text-bright">{formatRate(result.messagesPerSec)}</span></div>
                <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">Min by throughput</span><span className="font-mono text-sm font-semibold text-text-bright">{result.minPartitionsByThroughput}</span></div>
                <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">Min by consumers</span><span className="font-mono text-sm font-semibold text-text-bright">{result.minPartitionsByConsumers}</span></div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1">Storage</span>
                <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">Per partition</span><span className="font-mono text-sm font-semibold text-text-bright">{formatStorage(result.storagePerPartitionGB)}</span></div>
                <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">Total retained</span><span className="font-mono text-sm font-semibold text-text-bright">{formatStorage(result.totalStorageGB)}</span></div>
                <div className="flex items-center justify-between py-[3px]"><span className="text-[13px] text-text">With replication (×{rf})</span><span className="font-mono text-sm font-semibold text-text-bright">{formatStorage(result.replicatedStorageGB)}</span></div>
              </div>
            </div>
          ) : (
            <div className="text-center px-4 py-8 text-text-dim text-[13px]">Enter throughput to see partition recommendations</div>
          )}
        </div>
      </div>
    </div>
  );
}
