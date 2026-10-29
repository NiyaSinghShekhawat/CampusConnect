
const adminGrid = document.getElementById("admin-event-grid");
const adminMessage = document.getElementById("admin-message");
const eventForm = document.getElementById("event-form");

let adminEvents = [];

function htmlSafe(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function adminAPI(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      window.location.replace("/login.html");
    }

    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function adminNotice(message, error = false) {
  adminMessage.textContent = message;
  adminMessage.className = error
    ? "status-message error"
    : "status-message";
}

function adminDate(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? htmlSafe(value)
    : date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
}

function adminPrice(value) {
  const price = Number(value);

  return price === 0
    ? "Free"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
      }).format(price);
}

function clearEventForm() {
  eventForm.reset();
  document.getElementById("event-id").value = "";
  document.getElementById("form-heading").textContent = "Create a workshop";
  document.getElementById("save-event").textContent = "Create workshop";
}

function editEvent(id) {
  const event = adminEvents.find((item) => Number(item.id) === id);
  if (!event) return;

  document.getElementById("event-id").value = event.id;
  document.getElementById("title").value = event.title;
  document.getElementById("description").value = event.description;
  document.getElementById("category").value = event.category;
  document.getElementById("event-date").value = event.event_date;
  document.getElementById("venue").value = event.venue;
  document.getElementById("price").value = event.price;
  document.getElementById("capacity").value = event.capacity;

  document.getElementById("form-heading").textContent = "Edit workshop";
  document.getElementById("save-event").textContent = "Save changes";

  document.getElementById("create-event").scrollIntoView({
    behavior: "smooth"
  });
}

function renderAdminEvents() {
  adminGrid.innerHTML = adminEvents.map((event) => `
    <article class="event-card">
      <div class="event-cover blue">
        <span class="cover-label">${htmlSafe(event.category)}</span>
        <div class="cover-symbol" aria-hidden="true">✦</div>
      </div>
      <div class="event-body">
        <h3 class="event-title">${htmlSafe(event.title)}</h3>
        <p class="event-description">${htmlSafe(event.description)}</p>
        <div class="event-details">
          <div class="detail-row">▦ &nbsp; ${adminDate(event.event_date)}</div>
          <div class="detail-row">⌖ &nbsp; ${htmlSafe(event.venue)}</div>
          <div class="detail-row">₹ &nbsp; ${adminPrice(event.price)}</div>
          <div class="detail-row">♧ &nbsp; ${event.registered_count} registered · ${event.seats_remaining} seats left</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button class="register-button" data-edit="${event.id}">Edit</button>
          <button class="secondary-button" data-attendees="${event.id}">Attendees</button>
          <button class="secondary-button" data-delete="${event.id}">Delete</button>
        </div>
      </div>
    </article>
  `).join("");

  document.getElementById("admin-event-count").textContent =
    `${adminEvents.length} workshops`;
}

async function loadAdminDashboard() {
  const session = await adminAPI("/api/auth/me");

  if (!session.user) {
    window.location.replace("/login.html");
    return;
  }

  if (session.user.role !== "admin") {
    window.location.replace("/student.html");
    return;
  }

  const [summary, events] = await Promise.all([
    adminAPI("/api/admin/summary"),
    adminAPI("/api/events")
  ]);

  document.getElementById("total-events").textContent =
    summary.total_events;

  document.getElementById("total-registrations").textContent =
    summary.total_registrations;

  adminEvents = events;
  renderAdminEvents();
}

eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = document.getElementById("event-id").value;

  const payload = {
    title: document.getElementById("title").value.trim(),
    description: document.getElementById("description").value.trim(),
    category: document.getElementById("category").value.trim(),
    event_date: document.getElementById("event-date").value,
    venue: document.getElementById("venue").value.trim(),
    price: Number(document.getElementById("price").value),
    capacity: Number(document.getElementById("capacity").value)
  };

  try {
    const result = await adminAPI(
      id ? `/api/admin/events/${id}` : "/api/admin/events",
      {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload)
      }
    );

    adminNotice(result.message);
    clearEventForm();
    await loadAdminDashboard();
  } catch (error) {
    adminNotice(error.message, true);
  }
});

document.getElementById("reset-form").addEventListener("click", clearEventForm);

adminGrid.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  const attendeeButton = event.target.closest("[data-attendees]");

  try {
    if (editButton) {
      editEvent(Number(editButton.dataset.edit));
      return;
    }

    if (deleteButton) {
      const id = Number(deleteButton.dataset.delete);

      if (!confirm("Delete this workshop? Workshops with bookings cannot be deleted.")) {
        return;
      }

      const result = await adminAPI(`/api/admin/events/${id}`, {
        method: "DELETE"
      });

      adminNotice(result.message);
      await loadAdminDashboard();
    }

    if (attendeeButton) {
      const id = Number(attendeeButton.dataset.attendees);
      const data = await adminAPI(`/api/admin/events/${id}/attendees`);

      document.getElementById("attendee-heading").textContent =
        `Attendees — ${data.event.title}`;

      const attendeeList = document.getElementById("attendee-list");
      const section = document.getElementById("attendee-section");

      if (data.attendees.length === 0) {
        attendeeList.textContent = "No registrations yet.";
      } else {
        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.marginTop = "18px";

        const header = table.createTHead().insertRow();

        ["Student", "Email", "Registered at"].forEach((label) => {
          const cell = document.createElement("th");
          cell.textContent = label;
          cell.style.textAlign = "left";
          cell.style.padding = "12px";
          header.appendChild(cell);
        });

        const body = table.createTBody();

        data.attendees.forEach((attendee) => {
          const row = body.insertRow();

          [
            attendee.student_name,
            attendee.student_email,
            attendee.registered_at
          ].forEach((value) => {
            const cell = row.insertCell();
            cell.textContent = value ?? "";
            cell.style.padding = "12px";
            cell.style.borderBottom = "1px solid #ece8f5";
          });
        });

        attendeeList.replaceChildren(table);
      }

      section.hidden = false;
      section.scrollIntoView({ behavior: "smooth" });
    }
  } catch (error) {
    adminNotice(error.message, true);
  }
});

document.getElementById("admin-logout").addEventListener("click", async () => {
  try {
    await adminAPI("/api/auth/logout", { method: "POST" });
    window.location.replace("/login.html");
  } catch (error) {
    adminNotice(error.message, true);
  }
});

loadAdminDashboard().catch((error) => adminNotice(error.message, true));
