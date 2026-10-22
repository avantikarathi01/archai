import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

test('GET /api/health returns status 200 and expected JSON payload', async (t) => {
  // Start server on an ephemeral port (0 selects any free port)
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200, 'Expected status code 200');

    const data = await response.json();
    assert.equal(data.status, 'ok', 'Expected status to be "ok"');
    assert.equal(data.service, 'archai-server', 'Expected service name to match');
    assert.ok(data.timestamp, 'Expected timestamp to be present');
    assert.ok(typeof data.uptimeSeconds === 'number', 'Expected uptimeSeconds to be a number');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET / returns status 200 and root welcome payload', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200, 'Expected status code 200');

    const data = await response.json();
    assert.equal(data.name, 'ArchAI API');
    assert.equal(data.status, 'online');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
