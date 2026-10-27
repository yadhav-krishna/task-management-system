require('dotenv').config();
const assert = require('node:assert/strict');

const port = Number(process.env.PORT) || 3000;
const baseUrl = `http://127.0.0.1:${port}/api/tasks`;
let createdId = '';
let wasDeleted = false;

async function request(path, method = 'GET', body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error(`${method} ${path} did not return JSON (HTTP ${response.status}).`); }
  return { response, payload };
}

async function runSmokeTest() {
  try {
    const unique = `Taskflow API smoke ${Date.now()}`;
    const create = await request('', 'POST', {
      title: unique, description: 'Temporary API test record; safe to delete.',
      category: 'Projects', priority: 'Low', dueDate: '', status: 'Pending'
    });
    assert.equal(create.response.status, 201, 'POST should create a task with HTTP 201.');
    createdId = create.payload.data._id;
    assert.ok(createdId, 'created task should have a MongoDB ID.');
    console.log('PASS POST /api/tasks creates a MongoDB task.');

    const list = await request('');
    assert.equal(list.response.status, 200);
    assert.ok(list.payload.data.some((task) => task._id === createdId));
    console.log('PASS GET /api/tasks includes the new task.');

    const get = await request(`/${createdId}`);
    assert.equal(get.response.status, 200);
    assert.equal(get.payload.data.title, unique);
    console.log('PASS GET /api/tasks/:id retrieves the task.');

    const updated = await request(`/${createdId}`, 'PUT', {
      title: `${unique} edited`, description: 'Updated by smoke test.',
      category: 'Projects', priority: 'High', dueDate: '', status: 'In Progress'
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.data.title, `${unique} edited`);
    console.log('PASS PUT /api/tasks/:id updates the same record.');

    const patched = await request(`/${createdId}/status`, 'PATCH', { status: 'Completed' });
    assert.equal(patched.response.status, 200);
    assert.equal(patched.payload.data.status, 'Completed');
    console.log('PASS PATCH /api/tasks/:id/status persists status.');

    const invalidId = await request('/not-an-object-id');
    assert.equal(invalidId.response.status, 400);
    console.log('PASS malformed IDs return HTTP 400.');

    const invalidBody = await request('', 'POST', { title: ' ', category: 'Projects', priority: 'Low', status: 'Pending' });
    assert.equal(invalidBody.response.status, 400);
    console.log('PASS invalid create body returns HTTP 400.');

    const missing = await request('/671f00000000000000000001');
    assert.equal(missing.response.status, 404);
    console.log('PASS missing task returns HTTP 404.');

    const deleted = await request(`/${createdId}`, 'DELETE');
    assert.equal(deleted.response.status, 200);
    wasDeleted = true;
    const afterDelete = await request(`/${createdId}`);
    assert.equal(afterDelete.response.status, 404);
    console.log('PASS DELETE removes the task; subsequent read returns HTTP 404.');
  } finally {
    if (createdId && !wasDeleted) {
      const cleanup = await request(`/${createdId}`, 'DELETE');
      if (![200, 404].includes(cleanup.response.status)) throw new Error('Could not clean up the temporary smoke-test task.');
      console.log('CLEANUP removed the temporary smoke-test record.');
    }
  }
}

runSmokeTest().catch((error) => { console.error(`Smoke test failed: ${error.message}`); process.exitCode = 1; });
