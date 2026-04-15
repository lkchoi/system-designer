import { describe, it, expect } from "vitest";
import { displayType } from "./data";

describe("displayType", () => {
  it("capitalizes simple words", () => {
    expect(displayType("database")).toBe("Database");
    expect(displayType("service")).toBe("Service");
  });

  it("capitalizes each word in hyphenated types", () => {
    expect(displayType("load-balancer")).toBe("Load Balancer");
    expect(displayType("message-queue")).toBe("Message Queue");
    expect(displayType("search-engine")).toBe("Search Engine");
    expect(displayType("stream-processor")).toBe("Stream Processor");
    expect(displayType("data-warehouse")).toBe("Data Warehouse");
  });

  it("uppercases known acronyms", () => {
    expect(displayType("api-gateway")).toBe("API Gateway");
    expect(displayType("cdn")).toBe("CDN");
    expect(displayType("dns")).toBe("DNS");
    expect(displayType("etl")).toBe("ETL");
    expect(displayType("cqrs")).toBe("CQRS");
    expect(displayType("cdc")).toBe("CDC");
  });

  it("handles acronyms in compound types", () => {
    expect(displayType("etl-pipeline")).toBe("ETL Pipeline");
  });
});
