
const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "campusconnect.db");
const db = new Database(dbPath);

// Enable foreign key constraints
db.pragma("foreign_keys = ON");

// Create the events table
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    event_date TEXT NOT NULL,
    venue TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0 CHECK(price >= 0),
    capacity INTEGER NOT NULL CHECK(capacity > 0),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Create the registrations table
db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL,
    student_email TEXT NOT NULL,
    event_id INTEGER NOT NULL,
    registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id),
    UNIQUE (student_email, event_id)
  );
`);

const sampleEvents = [
  {
    title: "Build Your First AI App",
    description: "A beginner-friendly workshop on building AI-powered applications.",
    category: "Technology",
    event_date: "2026-11-05T10:00",
    venue: "College Seminar Hall",
    price: 199,
    capacity: 50
  },
  {
    title: "Web Development Bootcamp",
    description: "Learn HTML, CSS and JavaScript by building a website.",
    category: "Web Development",
    event_date: "2026-11-10T11:00",
    venue: "Computer Lab 2",
    price: 99,
    capacity: 40
  },
  {
    title: "Resume and Career Workshop",
    description: "Improve your resume and prepare for technical interviews.",
    category: "Career",
    event_date: "2026-11-15T14:00",
    venue: "Auditorium",
    price: 0,
    capacity: 100
  }
];

const insertEvent = db.prepare(`
  INSERT INTO events (
    title, description, category, event_date,
    venue, price, capacity
  )
  SELECT
    @title, @description, @category, @event_date,
    @venue, @price, @capacity
  WHERE NOT EXISTS (
    SELECT 1 FROM events WHERE title = @title
  )
`);

const seedEvents = db.transaction(() => {
  for (const event of sampleEvents) {
    insertEvent.run(event);
  }
});

seedEvents();

console.log("SQLite database initialized successfully!");

module.exports = db;

db.pragma("foreign_keys = ON");


db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student'
      CHECK (role IN ('student', 'admin')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);
