import assert from "node:assert/strict";
import pg from "pg";

const { Client } = pg;

export async function withDatabase(env, callback) {
  const client = new Client({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
  });

  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

export async function queryOne(client, query, values = []) {
  const result = await client.query(query, values);
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}

export async function queryOptional(client, query, values = []) {
  const result = await client.query(query, values);
  assert.ok(result.rows.length <= 1);
  return result.rows[0] ?? null;
}

export async function queryCount(client, query, values = []) {
  const result = await client.query(query, values);
  return Number(result.rows[0]?.count ?? 0);
}
