
require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const db = require("./database");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

if (!process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET === "replace_this_with_a_long_random_secret") {
  throw new Error("Set a unique SESSION_SECRET in your .env file.");
}

// Create the initial admin account if it doesn't exist.
// Admin credentials are read from .env, never from a public form.
const adminName = process.env.ADMIN_NAME;
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;

if (adminName && adminEmail && adminPassword) {
  const existingAdmin = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(adminEmail);

  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync(adminPassword, 12);

    db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, 'admin')
    `).run(adminName.trim(), adminEmail, passwordHash);

    console.log("Initial admin account created.");
  }
} else {
  console.warn(
    "Admin bootstrap skipped. Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in .env."
  );
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "campusconnect.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

// Serve frontend files.
app.use(express.static(path.join(__dirname, "public")));

// Test route.
app.get("/api/test", (req, res) => {
  const result = db.prepare("SELECT 1 AS working").get();

  res.json({
    message: "CampusConnect backend is running!",
    database: result.working === 1 ? "Connected" : "Error"
  });
});

// Public event listing.
app.get("/api/events", (req, res) => {
  try {
    const events = db.prepare(`
      SELECT
        e.id,
        e.title,
        e.description,
        e.category,
        e.event_date,
        e.venue,
        e.price,
        e.capacity,
        COUNT(r.id) AS registered_count,
        MAX(e.capacity - COUNT(r.id), 0) AS seats_remaining
      FROM events e
      LEFT JOIN registrations r ON e.id = r.event_id
      GROUP BY e.id
      ORDER BY e.event_date ASC
    `).all();

    res.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: "Unable to fetch events" });
  }
});

// Student sign-up. Public sign-up always creates a student.
app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({
        error: "Name must be between 2 and 80 characters."
      });
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({
        error: "Enter a valid email address."
      });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        error: "Password must be between 8 and 128 characters."
      });
    }

    const existingUser = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);

    if (existingUser) {
      return res.status(409).json({
        error: "An account with this email already exists."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, 'student')
    `).run(name, email, passwordHash);

    req.session.regenerate((sessionError) => {
      if (sessionError) {
        console.error("Session error:", sessionError);
        return res.status(500).json({
          error: "Account created, but sign-in failed. Please log in."
        });
      }

      req.session.user = {
        id: Number(result.lastInsertRowid),
        name,
        email,
        role: "student"
      };

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session save error:", saveError);
          return res.status(500).json({
            error: "Account created, but sign-in failed. Please log in."
          });
        }

        res.status(201).json({
          message: "Account created successfully.",
          user: req.session.user
        });
      });
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        error: "An account with this email already exists."
      });
    }

    console.error("Registration error:", error);
    res.status(500).json({ error: "Unable to create account." });
  }
});

// Sign in existing student or admin accounts.
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");

    const user = db.prepare(`
      SELECT id, name, email, password_hash, role
      FROM users
      WHERE email = ?
    `).get(email);

    const passwordMatches = user
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    if (!user || !passwordMatches) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    req.session.regenerate((sessionError) => {
      if (sessionError) {
        console.error("Session error:", sessionError);
        return res.status(500).json({
          error: "Unable to start a session."
        });
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session save error:", saveError);
          return res.status(500).json({
            error: "Unable to save your session."
          });
        }

        res.json({
          message: "Login successful.",
          user: req.session.user
        });
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Unable to log in." });
  }
});

// Get the current session's user.
app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.session.user ?? null });
});

// Sign out.
app.post("/api/auth/logout", (req, res) => {
  if (!req.session) {
    return res.json({ message: "Logged out." });
  }

  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);
      return res.status(500).json({
        error: "Unable to log out."
      });
    }

    res.clearCookie("campusconnect.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    res.json({ message: "Logged out successfully." });
  });
});


function requireStudent(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Please log in first." });
  }

  if (req.session.user.role !== "student") {
    return res.status(403).json({ error: "Student access only." });
  }

  next();
}

// List the logged-in student's registrations.
app.get("/api/registrations/mine", requireStudent, (req, res) => {
  try {
    const registrations = db.prepare(`
      SELECT
        r.id AS registration_id,
        r.registered_at,
        e.id AS event_id,
        e.title,
        e.description,
        e.category,
        e.event_date,
        e.venue,
        e.price,
        e.capacity
      FROM registrations r
      JOIN events e ON e.id = r.event_id
      WHERE r.student_email = ?
      ORDER BY e.event_date ASC
    `).all(req.session.user.email);

    res.json(registrations);
  } catch (error) {
    console.error("My registrations error:", error);
    res.status(500).json({ error: "Unable to load your bookings." });
  }
});

// Book a seat. The transaction protects the capacity check and insert.
app.post("/api/registrations", requireStudent, (req, res) => {
  const eventId = Number(req.body.event_id);

  if (!Number.isSafeInteger(eventId) || eventId < 1) {
    return res.status(400).json({ error: "Invalid event ID." });
  }

  try {
    const bookSeat = db.transaction(() => {
      const event = db.prepare(`
        SELECT id, title, capacity
        FROM events
        WHERE id = ?
      `).get(eventId);

      if (!event) {
        return { error: "Event not found.", status: 404 };
      }

      const existing = db.prepare(`
        SELECT id FROM registrations
        WHERE event_id = ? AND student_email = ?
      `).get(eventId, req.session.user.email);

      if (existing) {
        return {
          error: "You are already registered for this event.",
          status: 409
        };
      }

      const count = db.prepare(`
        SELECT COUNT(*) AS total
        FROM registrations
        WHERE event_id = ?
      `).get(eventId).total;

      if (count >= event.capacity) {
        return { error: "Sorry, this event is sold out.", status: 409 };
      }

      const result = db.prepare(`
        INSERT INTO registrations (student_name, student_email, event_id)
        VALUES (?, ?, ?)
      `).run(req.session.user.name, req.session.user.email, eventId);

      return {
        registrationId: Number(result.lastInsertRowid),
        title: event.title
      };
    }).immediate();

    if (bookSeat.error) {
      return res.status(bookSeat.status).json({ error: bookSeat.error });
    }

    res.status(201).json({
      message: "Registration successful!",
      registration: bookSeat
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        error: "You are already registered for this event."
      });
    }

    console.error("Booking error:", error);
    res.status(500).json({ error: "Unable to register for this event." });
  }
});

// Cancel only a registration belonging to the logged-in student.
app.delete("/api/registrations/:id", requireStudent, (req, res) => {
  const registrationId = Number(req.params.id);

  if (!Number.isSafeInteger(registrationId) || registrationId < 1) {
    return res.status(400).json({ error: "Invalid registration ID." });
  }

  try {
    const result = db.prepare(`
      DELETE FROM registrations
      WHERE id = ? AND student_email = ?
    `).run(registrationId, req.session.user.email);

    if (result.changes === 0) {
      return res.status(404).json({
        error: "Registration not found."
      });
    }

    res.json({ message: "Registration cancelled successfully." });
  } catch (error) {
    console.error("Cancellation error:", error);
    res.status(500).json({ error: "Unable to cancel registration." });
  }
});


function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Please log in first." });
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access only." });
  }

  next();
}

// Admin overview: event totals and registration counts.
app.get("/api/admin/summary", requireAdmin, (req, res) => {
  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total_events,
      COALESCE(SUM((
        SELECT COUNT(*) FROM registrations r
        WHERE r.event_id = e.id
      )), 0) AS total_registrations
    FROM events e
  `).get();

  res.json(summary);
});

// Create a workshop.
app.post("/api/admin/events", requireAdmin, (req, res) => {
  const { title, description, category, event_date, venue } = req.body;
  const price = Number(req.body.price);
  const capacity = Number(req.body.capacity);

  if (
    typeof title !== "string" || !title.trim() ||
    typeof description !== "string" || !description.trim() ||
    typeof category !== "string" || !category.trim() ||
    typeof event_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(event_date) ||
    Number.isNaN(new Date(event_date).getTime()) ||
    typeof venue !== "string" || !venue.trim() ||
    !Number.isFinite(price) || price < 0 ||
    !Number.isSafeInteger(capacity) || capacity < 1
  ) {
    return res.status(400).json({
      error: "Enter valid workshop details."
    });
  }

  try {
    const result = db.prepare(`
      INSERT INTO events
        (title, description, category, event_date, venue, price, capacity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      description.trim(),
      category.trim(),
      event_date,
      venue.trim(),
      price,
      capacity
    );

    res.status(201).json({
      message: "Workshop created.",
      id: Number(result.lastInsertRowid)
    });
  } catch (error) {
    console.error("Create event error:", error);
    res.status(500).json({ error: "Unable to create workshop." });
  }
});

// Edit workshop details without reducing capacity below existing bookings.
app.put("/api/admin/events/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { title, description, category, event_date, venue } = req.body;
  const price = Number(req.body.price);
  const capacity = Number(req.body.capacity);

  if (
    !Number.isSafeInteger(id) || id < 1 ||
    typeof title !== "string" || !title.trim() ||
    typeof description !== "string" || !description.trim() ||
    typeof category !== "string" || !category.trim() ||
    typeof event_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(event_date) ||
    Number.isNaN(new Date(event_date).getTime()) ||
    typeof venue !== "string" || !venue.trim() ||
    !Number.isFinite(price) || price < 0 ||
    !Number.isSafeInteger(capacity) || capacity < 1
  ) {
    return res.status(400).json({
      error: "Enter valid workshop details."
    });
  }

  try {
    const updateEvent = db.transaction(() => {
      const existing = db.prepare(`
        SELECT id FROM events WHERE id = ?
      `).get(id);

      if (!existing) return { error: "Workshop not found.", status: 404 };

      const count = db.prepare(`
        SELECT COUNT(*) AS total FROM registrations WHERE event_id = ?
      `).get(id).total;

      if (capacity < count) {
        return {
          error: `Capacity cannot be less than ${count} existing bookings.`,
          status: 409
        };
      }

      db.prepare(`
        UPDATE events
        SET title = ?, description = ?, category = ?, event_date = ?,
            venue = ?, price = ?, capacity = ?
        WHERE id = ?
      `).run(
        title.trim(), description.trim(), category.trim(), event_date,
        venue.trim(), price, capacity, id
      );

      return { success: true };
    }).immediate();

    if (updateEvent.error) {
      return res.status(updateEvent.status).json({
        error: updateEvent.error
      });
    }

    res.json({ message: "Workshop updated successfully." });
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).json({ error: "Unable to update workshop." });
  }
});

// Delete a workshop only when it has no registrations.
app.delete("/api/admin/events/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid event ID." });
  }

  const removeEvent = db.transaction(() => {
    const event = db.prepare(`
      SELECT id FROM events WHERE id = ?
    `).get(id);

    if (!event) return { error: "Workshop not found.", status: 404 };

    const count = db.prepare(`
      SELECT COUNT(*) AS total FROM registrations WHERE event_id = ?
    `).get(id).total;

    if (count > 0) {
      return {
        error: "This workshop has bookings. Cancel or resolve them before deleting it.",
        status: 409
      };
    }

    db.prepare("DELETE FROM events WHERE id = ?").run(id);
    return { success: true };
  }).immediate();

  if (removeEvent.error) {
    return res.status(removeEvent.status).json({
      error: removeEvent.error
    });
  }

  res.json({ message: "Workshop deleted." });
});

// See attendees for a specific workshop.
app.get("/api/admin/events/:id/attendees", requireAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid event ID." });
  }

  const event = db.prepare(`
    SELECT id, title FROM events WHERE id = ?
  `).get(id);

  if (!event) {
    return res.status(404).json({ error: "Workshop not found." });
  }

  const attendees = db.prepare(`
    SELECT id AS registration_id, student_name, student_email, registered_at
    FROM registrations
    WHERE event_id = ?
    ORDER BY registered_at DESC
  `).all(id);

  res.json({ event, attendees });
});


function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Please log in first." });
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access only." });
  }

  next();
}

app.get("/api/admin/summary", requireAdmin, (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM events) AS total_workshops,
        (SELECT COUNT(*) FROM registrations) AS total_registrations
    `).get();

    res.json(summary);
  } catch (error) {
    console.error("Admin summary error:", error);
    res.status(500).json({ error: "Failed to load admin summary." });
  }
});

app.get("/api/admin/events", requireAdmin, (req, res) => {
  try {
    const events = db.prepare(`
      SELECT
        e.*,
        COUNT(r.id) AS registered_count,
        MAX(e.capacity - COUNT(r.id), 0) AS seats_remaining
      FROM events e
      LEFT JOIN registrations r ON r.event_id = e.id
      GROUP BY e.id
      ORDER BY e.event_date ASC
    `).all();

    res.json(events);
  } catch (error) {
    console.error("Admin events error:", error);
    res.status(500).json({ error: "Failed to load admin events." });
  }
});


app.listen(PORT, () => {
  console.log(`CampusConnect running at http://localhost:${PORT}`);
});
