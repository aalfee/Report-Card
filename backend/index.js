const fs = require('node:fs/promises');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
require('dotenv').config();

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'replace-with-a-strong-secret';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'replace-with-admin-secret';
const CLIENT_API_KEY = process.env.CLIENT_API_KEY || 'replace-with-client-api-key';
const documentsIndexPath = path.join(__dirname, 'data', 'documents.json');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);
const supabase = hasSupabase ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;
const WORKOS_API_KEY = process.env.WORKOS_API_KEY;
const WORKOS_AUDIENCE = process.env.WORKOS_AUDIENCE;
const WORKOS_DOMAIN = process.env.WORKOS_DOMAIN;

const app = express();
app.use(cors());
app.use(express.json());
app.use('/documents', express.static(path.join(__dirname, 'documents')));

const dbPath = process.env.VERCEL ? path.join('/tmp', 'data.db') : path.join(__dirname, 'data.db');
const db = new Database(dbPath);

async function loadDocumentIndex() {
  const raw = await fs.readFile(documentsIndexPath, 'utf8');
  return JSON.parse(raw);
}

function initializeDatabase() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'walker',
      client_email TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS walks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      walker_id INTEGER NOT NULL,
      client_email TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes INTEGER,
      distance_meters INTEGER,
      route_json TEXT,
      events_json TEXT,
      poop_count INTEGER DEFAULT 0,
      pee_count INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (walker_id) REFERENCES users(id)
    )
  `).run();

  const walkColumns = db.prepare('PRAGMA table_info(walks)').all();
  const columnNames = walkColumns.map((col) => col.name);
  if (!columnNames.includes('distance_meters')) {
    db.prepare('ALTER TABLE walks ADD COLUMN distance_meters INTEGER').run();
  }
  if (!columnNames.includes('events_json')) {
    db.prepare('ALTER TABLE walks ADD COLUMN events_json TEXT').run();
  }
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

async function getUserByEmail(email) {
  const normalized = email.toLowerCase();
  if (hasSupabase) {
    const { data, error } = await supabase.from('users').select('*').eq('email', normalized).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }
  return db.prepare('SELECT * FROM users WHERE email = ?').get(normalized);
}

async function getUserById(id) {
  if (hasSupabase) {
    const { data, error } = await supabase.from('users').select('id, email, name, role, client_email').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }
  return db.prepare('SELECT id, email, name, role, client_email FROM users WHERE id = ?').get(id);
}

async function createUser({ email, passwordHash, name, clientEmail }) {
  const normalized = email.toLowerCase();
  if (hasSupabase) {
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: normalized,
        password_hash: passwordHash,
        name: name || '',
        role: 'walker',
        client_email: clientEmail || null,
      })
      .select('id, email, name')
      .single();
    if (error) throw error;
    return data;
  }

  const result = db
    .prepare('INSERT INTO users (email, password_hash, name, client_email) VALUES (?, ?, ?, ?)')
    .run(normalized, passwordHash, name || '', clientEmail || null);
  return { id: result.lastInsertRowid, email: normalized, name: name || '' };
}

async function createWalk({ walkerId, clientEmail, startTime, endTime, durationMinutes, distanceMeters, route, events, poopCount, peeCount, notes }) {
  const routeJson = route ? JSON.stringify(route) : null;
  const eventsJson = events ? JSON.stringify(events) : null;

  if (hasSupabase) {
    const { data, error } = await supabase
      .from('walks')
      .insert({
        walker_id: walkerId,
        client_email: clientEmail || null,
        start_time: startTime,
        end_time: endTime || null,
        duration_minutes: durationMinutes || null,
        distance_meters: distanceMeters || null,
        route_json: routeJson,
        events_json: eventsJson,
        poop_count: poopCount || 0,
        pee_count: peeCount || 0,
        notes: notes || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const result = db
    .prepare(
      `INSERT INTO walks (
        walker_id,
        client_email,
        start_time,
        end_time,
        duration_minutes,
        distance_meters,
        route_json,
        events_json,
        poop_count,
        pee_count,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(walkerId, clientEmail || null, startTime, endTime || null, durationMinutes || null, distanceMeters, routeJson, eventsJson, poopCount || 0, peeCount || 0, notes || null);

  const walk = db.prepare('SELECT * FROM walks WHERE id = ?').get(result.lastInsertRowid);
  return walk;
}

async function getWalksByWalker(walkerId) {
  if (hasSupabase) {
    const { data, error } = await supabase
      .from('walks')
      .select('*')
      .eq('walker_id', walkerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
  return db.prepare('SELECT * FROM walks WHERE walker_id = ? ORDER BY created_at DESC').all(walkerId);
}

async function getWalksByClientEmail(clientEmail) {
  const normalized = clientEmail.toLowerCase();
  if (hasSupabase) {
    const { data, error } = await supabase
      .from('walks')
      .select('*')
      .ilike('client_email', normalized)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
  return db.prepare('SELECT * FROM walks WHERE lower(client_email) = ? ORDER BY created_at DESC').all(normalized);
}

function normalizeWalk(walk) {
  if (!walk) return walk;
  return {
    ...walk,
    route: walk.route_json ? JSON.parse(walk.route_json) : null,
    events: walk.events_json ? JSON.parse(walk.events_json) : [],
    distanceMeters: walk.distance_meters || null,
    route_json: undefined,
    events_json: undefined,
  };
}

app.get('/', (req, res) => {
  res.json({ message: 'Walker backend is running' });
});

app.post('/api/auth/register-walker', async (req, res) => {
  const { adminSecret, email, password, name, clientEmail } = req.body;
  if (adminSecret !== ADMIN_SECRET) {
    return res.status(403).json({ message: 'Invalid admin secret' });
  }
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const created = await createUser({ email, passwordHash, name, clientEmail });
    res.status(201).json({ id: created.id, email: created.email, name: created.name });
  } catch (error) {
    console.error('register-walker error:', error);
    res.status(500).json({ message: 'Server error creating user', details: String(error) });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const user = await getUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.user.sub);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching user' });
  }
});

app.post('/api/walks', requireAuth, async (req, res) => {
  console.log('POST /api/walks', req.body);
  const {
    start_time,
    end_time,
    duration_minutes,
    distance_meters,
    route,
    events,
    poop_count,
    pee_count,
    notes,
    client_email,
    startTime,
    endTime,
    durationMinutes,
    distanceMeters,
    clientEmail,
  } = req.body;

  const resolvedStartTime = start_time || startTime;
  const resolvedEndTime = end_time || endTime;
  const resolvedDuration = duration_minutes || durationMinutes;
  const resolvedDistance = distance_meters || distanceMeters;
  const resolvedClientEmail = client_email || clientEmail;
  const resolvedPoop = poop_count ?? req.body.poopCount ?? 0;
  const resolvedPee = pee_count ?? req.body.peeCount ?? 0;

  console.log('resolvedStartTime', resolvedStartTime, 'body start_time', start_time, 'body startTime', startTime);

  if (!resolvedStartTime) {
    console.error('missing start_time field in body', req.body);
    return res.status(400).json({ message: 'start_time is required' });
  }

  try {
    const newWalk = await createWalk({
      walkerId: req.user.sub,
      clientEmail: resolvedClientEmail,
      startTime: resolvedStartTime,
      endTime: resolvedEndTime,
      durationMinutes: resolvedDuration,
      distanceMeters: resolvedDistance,
      route,
      events,
      poopCount: resolvedPoop,
      peeCount: resolvedPee,
      notes,
    });

    res.status(201).json({ walk: normalizeWalk(newWalk) });
  } catch (error) {
  console.error("SAVE WALK ERROR:", error);
  res.status(500).json({ 
    message: 'Server error saving walk',
    details: error.message 
  });
}
});

app.get('/api/walks', requireAuth, async (req, res) => {
  try {
    const rows = await getWalksByWalker(req.user.sub);
    res.json({ walks: rows.map(normalizeWalk) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error listing walks' });
  }
});

app.get('/api/reports/clients/:clientEmail', async (req, res) => {
  const clientKey = req.headers['x-client-key'];
  if (clientKey !== CLIENT_API_KEY) {
    return res.status(401).json({ message: 'Invalid client API key' });
  }

  try {
    const rows = await getWalksByClientEmail(req.params.clientEmail);
    res.json({ walks: rows.map(normalizeWalk) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching reports' });
  }
});

app.get('/api/documents', async (req, res) => {
  try {
    const index = await loadDocumentIndex();
    const documents = (index.documents || []).filter((doc) => doc.visibility === 'public' && doc.status === 'active');
    res.json({ schemaVersion: index.schemaVersion || '1.0', documents });
  } catch (error) {
    console.error('documents index error:', error);
    res.status(500).json({ message: 'Unable to load document index' });
  }
});

app.get('/api/documents/:id', async (req, res) => {
  try {
    const index = await loadDocumentIndex();
    const document = (index.documents || []).find((doc) => doc.id === req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const filePath = path.join(__dirname, document.file);
    const content = await fs.readFile(filePath, 'utf8');
    res.json({ document, content });
  } catch (error) {
    console.error('document read error:', error);
    res.status(500).json({ message: 'Unable to load document content', details: String(error) });
  }
});

app.listen(PORT, () => {
  if (!hasSupabase) {
    initializeDatabase();
    console.log(`Walker backend with SQLite listening on http://localhost:${PORT}`);
  } else {
    console.log(`Walker backend with Supabase listening on http://localhost:${PORT}`);
  }
  if (WORKOS_CLIENT_ID && WORKOS_API_KEY) {
    console.log('WorkOS credentials detected. The backend is ready for future WorkOS integration.');
  }
});
