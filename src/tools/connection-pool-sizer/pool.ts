export interface PoolInputs {
  concurrentRequests: number;
  avgQueryMs: number;
  serviceInstances: number;
  maxConnectionsPerDb: number;
  overheadPercent: number; // safety margin
}

export interface PoolResult {
  connectionsPerInstance: number;
  totalConnections: number;
  utilizationPercent: number;
  headroom: number;
  maxQps: number;
  saturated: boolean;
}

export function computePool(inputs: PoolInputs): PoolResult {
  const { concurrentRequests, avgQueryMs, serviceInstances, maxConnectionsPerDb, overheadPercent } =
    inputs;

  // Each request holds a connection for avgQueryMs
  // Connections needed = concurrentRequests * (avgQueryMs / 1000) at any instant
  // But since each request occupies exactly 1 conn, we need ceil(concurrent / instances)
  const connectionsNeeded = concurrentRequests / (serviceInstances || 1);
  const withOverhead = connectionsNeeded * (1 + overheadPercent / 100);
  const connectionsPerInstance = Math.ceil(withOverhead);

  const totalConnections = connectionsPerInstance * serviceInstances;
  const utilizationPercent =
    maxConnectionsPerDb > 0 ? (totalConnections / maxConnectionsPerDb) * 100 : 0;
  const headroom = maxConnectionsPerDb - totalConnections;
  const saturated = totalConnections > maxConnectionsPerDb;

  // Max queries per second per connection
  const qpsPerConn = avgQueryMs > 0 ? 1000 / avgQueryMs : 0;
  const maxQps = qpsPerConn * totalConnections;

  return {
    connectionsPerInstance,
    totalConnections,
    utilizationPercent,
    headroom,
    maxQps,
    saturated,
  };
}

export const DB_CONNECTION_LIMITS: { name: string; maxConnections: number }[] = [
  { name: "PostgreSQL (default)", maxConnections: 100 },
  { name: "MySQL (default)", maxConnections: 151 },
  { name: "PostgreSQL (tuned)", maxConnections: 500 },
  { name: "RDS db.r5.large", maxConnections: 1670 },
  { name: "RDS db.r5.xlarge", maxConnections: 3340 },
  { name: "Cloud SQL (4 vCPU)", maxConnections: 4000 },
  { name: "PgBouncer (pooler)", maxConnections: 10000 },
];
