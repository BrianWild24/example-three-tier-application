const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const MAX_TITLE_LENGTH = 200;

app.use(express.json());

// Validates a task title. Returns { value } (trimmed) or { error }.
function validateTitle(title) {
  if (typeof title !== 'string') {
    return { error: 'title is required and must be a string' };
  }
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return { error: 'title must not be empty' };
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return { error: `title must be at most ${MAX_TITLE_LENGTH} characters` };
  }
  return { value: trimmed };
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// GET /tasks — list all tasks
app.get('/tasks', async (_req, res) => {
  const { rows } = await db.query('SELECT * FROM tasks ORDER BY created_at ASC');
  res.json(rows);
});

// POST /tasks — create a task
app.post('/tasks', async (req, res) => {
  const { title } = req.body || {};
  const { error, value: trimmedTitle } = validateTitle(title);
  if (error) return res.status(400).json({ error });
  const { rows } = await db.query(
    'INSERT INTO tasks (title) VALUES ($1) RETURNING *',
    [trimmedTitle]
  );
  res.status(201).json(rows[0]);
});

// PATCH /tasks/:id — update a task (complete/uncomplete or rename)
app.patch('/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { completed, title } = req.body || {};

  let validatedTitle;
  if (title !== undefined) {
    const result = validateTitle(title);
    if (result.error) return res.status(400).json({ error: result.error });
    validatedTitle = result.value;
  }

  const { rows } = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

  const current = rows[0];
  const newCompleted = completed !== undefined ? Boolean(completed) : current.completed;
  const newTitle = validatedTitle !== undefined ? validatedTitle : current.title;

  const { rows: updated } = await db.query(
    'UPDATE tasks SET completed = $1, title = $2 WHERE id = $3 RETURNING *',
    [newCompleted, newTitle, id]
  );
  res.json(updated[0]);
});

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
