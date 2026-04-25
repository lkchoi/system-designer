export interface PayloadField {
  name: string;
  type: "string" | "number" | "boolean" | "uuid" | "timestamp" | "nested";
  avgLength?: number; // for strings
  count?: number; // for arrays/nested
}

export interface PayloadResult {
  jsonBytes: number;
  protobufBytes: number;
  msgpackBytes: number;
  gzipJsonBytes: number;
  savingsProtobuf: number; // percent vs JSON
  savingsMsgpack: number;
  savingsGzip: number;
}

const TYPE_SIZES = {
  string: (len: number) => len + 2, // quotes
  number: () => 8, // avg numeric value
  boolean: () => 5, // "true" or "false"
  uuid: () => 38, // "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" + quotes
  timestamp: () => 26, // "2025-01-01T00:00:00.000Z" + quotes
  nested: (count: number) => count * 50, // rough nested object estimate
};

const PROTOBUF_TYPE_SIZES = {
  string: (len: number) => len + 2, // varint tag + length prefix
  number: () => 8, // double
  boolean: () => 2, // tag + 1 byte
  uuid: () => 18, // 16 bytes + tag + length
  timestamp: () => 10, // 8 bytes + tag + length
  nested: (count: number) => count * 30,
};

const MSGPACK_TYPE_SIZES = {
  string: (len: number) => len + 2,
  number: () => 5, // typical fixext or float32
  boolean: () => 1,
  uuid: () => 18,
  timestamp: () => 10,
  nested: (count: number) => count * 35,
};

export function estimatePayloadSize(fields: PayloadField[]): PayloadResult {
  let jsonBytes = 2; // {}
  let protobufBytes = 0;
  let msgpackBytes = 1; // map header

  for (const field of fields) {
    const avgLen = field.avgLength ?? 20;
    const count = field.count ?? 1;

    // JSON: key + colon + value + comma overhead
    const keyOverhead = field.name.length + 3; // "key":
    const jsonValue = TYPE_SIZES[field.type](field.type === "string" ? avgLen : count);
    jsonBytes += keyOverhead + jsonValue + 1; // comma

    // Protobuf: no key names, just tags + values
    const protoValue = PROTOBUF_TYPE_SIZES[field.type](field.type === "string" ? avgLen : count);
    protobufBytes += protoValue;

    // MsgPack: compact key + value
    const msgpackKey = Math.min(field.name.length, 31) + 1;
    const msgpackValue = MSGPACK_TYPE_SIZES[field.type](field.type === "string" ? avgLen : count);
    msgpackBytes += msgpackKey + msgpackValue;
  }

  // Gzip typically achieves ~60-70% compression on JSON
  const gzipRatio = 0.35;
  const gzipJsonBytes = Math.ceil(jsonBytes * gzipRatio);

  return {
    jsonBytes,
    protobufBytes,
    msgpackBytes,
    gzipJsonBytes,
    savingsProtobuf: jsonBytes > 0 ? ((1 - protobufBytes / jsonBytes) * 100) : 0,
    savingsMsgpack: jsonBytes > 0 ? ((1 - msgpackBytes / jsonBytes) * 100) : 0,
    savingsGzip: jsonBytes > 0 ? ((1 - gzipJsonBytes / jsonBytes) * 100) : 0,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
