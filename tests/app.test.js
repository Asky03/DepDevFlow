const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../src/server");

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("GET / returns project information", async () => {
  const response = await fetch(`${baseUrl}/`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.project, "DepDevFlow");
});

test("GET /health returns healthy status", async () => {
  const response = await fetch(`${baseUrl}/health`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.status, "healthy");
});

test("GET /api/greet returns a greeting", async () => {
  const response = await fetch(`${baseUrl}/api/greet?name=DevOps`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.message, "Hello, DevOps!");
});

test("GET /api/greet uses a default name", async () => {
  const response = await fetch(`${baseUrl}/api/greet`);
  const data = await response.json();

  assert.equal(data.message, "Hello, Developer!");
});
