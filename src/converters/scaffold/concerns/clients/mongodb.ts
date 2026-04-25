import type { ClientConcern } from "../types";

export const mongodbConcern: ClientConcern = {
  targetTechId: "mongodb",
  envVars: ["MONGO_URL"],
  snippet: {
    node: {
      deps: { mongodb: "^6.12.0" },
      imports: ['import { MongoClient } from "mongodb";'],
      globals: [
        "const mongoClient = new MongoClient(process.env.MONGO_URL ?? \"mongodb://localhost:27017\");",
      ],
      init: ["await mongoClient.connect();"],
      shutdown: ["await mongoClient.close();"],
      healthChecks: ['await mongoClient.db().command({ ping: 1 });'],
    },
    python: {
      deps: { pymongo: "4.10.1" },
      imports: ["import os", "from pymongo import MongoClient"],
      globals: ['_mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))'],
      init: [],
      shutdown: ["_mongo.close()"],
      healthChecks: ['_mongo.admin.command("ping")'],
    },
    go: {
      deps: { "go.mongodb.org/mongo-driver": "v1.17.1" },
      imports: [
        '"context"',
        '"go.mongodb.org/mongo-driver/mongo"',
        '"go.mongodb.org/mongo-driver/mongo/options"',
      ],
      globals: ["var mongoClient *mongo.Client"],
      init: [
        'client, err := mongo.Connect(context.Background(), options.Client().ApplyURI(os.Getenv("MONGO_URL")))',
        'if err != nil { log.Fatalf("mongo: %v", err) }',
        "mongoClient = client",
      ],
      shutdown: ["mongoClient.Disconnect(context.Background())"],
      healthChecks: ["mongoClient.Ping(context.Background(), nil)"],
    },
  },
};
