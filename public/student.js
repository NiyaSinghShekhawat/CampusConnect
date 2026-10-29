
const workshopGrid = document.getElementById("workshop-grid");
const bookingGrid = document.getElementById("booking-grid");
const dashboardMessage = document.getElementById("dashboard-message");

let currentUser = null;
let workshops = [];
let bookings = [];

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function dateLabel(value) {
  if (!value) return "Date to be announced";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function priceLabel(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price === 0) return "Free";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(price);
}

function showMessage(message, error = false) {
  dashboardMessage.textContent = message;
  dashboardMessage.className = error
    ? "status-message error"
    : "status-message";
}

async function api(url, options = {}) {
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

function workshopCard(event) {
  const full = Number(event.seats_remaining) <= 0;
  const alreadyBooked = bookings.some(
    (booking) => Number(booking.event_id) === Number(event.id)
  );

  return `
    <article class="event-card">
      <div class="event-cover blue">
        <span class="cover-label">${safeText(event.category)}</span>
        <div class="cover-symbol" aria-hidden="true">✦</div>
      </div>
      <div class="event-body">
        <h3 class="event-title">${safeText(event.title)}</h3>
        <p class="event-description">${safeText(event.description)}</p>
        <div class="event-details">
          <div class="detail-row">▦ &nbsp; ${dateLabel(event.event_date)}</div>
          <div class="detail-row">⌖ &nbsp; ${safeText(event.venue)}</div>
          <div class="detail-row">♧ &nbsp; ${Number(event.seats_remaining)} seats remaining</div>
        </div>
        <div class="event-bottom">
          <div>
            <div class="price-label">ENTRY FEE</div>
            <div class="event-price ${Number(event.price) === 0 ? "free" : ""}">
              ${priceLabel(event.price)}
            </div>
          </div>
          <button
            type="button"
            class="register-button"
            data-book="${Number(event.id)}"
            ${full || alreadyBooked ? "disabled" : ""}
          >
            ${alreadyBooked ? "Registered ✓" : full ? "Sold out" : "Book seat ↗"}
          </button>
        </div>
      </div>
    </article>
  `;
}

function bookingCard(booking) {
  return `
    <article class="event-card">
      <div class="event-cover mint">
        <span class="cover-label">YOUR BOOKING</span>
        <div class="cover-symbol" aria-hidden="true">✓</div>
      </div>
      <div class="event-body">
        <span class="category-pill">${safeText(booking.category)}</span>
        <h3 class="event-title" style="margin-top:12px">
          ${safeText(booking.title)}
        </h3>
        <div class="event-details">
          <div class="detail-row">▦ &nbsp; ${dateLabel(booking.event_date)}</div>
          <div class="detail-row">⌖ &nbsp; ${safeText(booking.venue)}</div>
          <div class="detail-row">♧ &nbsp; ${priceLabel(booking.price)}</div>
        </div>
        <p class="auth-help">
          Registered ${safeText(booking.registered_at)}
        </p>
        <button
          type="button"
          class="secondary-button"
          data-cancel="${Number(booking.registration_id)}"
        >
          Cancel booking
        </button>
      </div>
    </article>
  `;
}

function renderDashboard() {
  workshopGrid.innerHTML = workshops.map(workshopCard).join("");
  bookingGrid.innerHTML = bookings.map(bookingCard).join("");

  document.getElementById("workshop-count").textContent =
    `${workshops.length} workshops`;

  document.getElementById("booking-count").textContent =
    `${bookings.length} booking${bookings.length === 1 ? "" : "s"}`;

  document.getElementById("no-bookings").hidden = bookings.length > 0;
}

async function refreshDashboard() {
  const [eventData, bookingData] = await Promise.all([
    api("/api/events"),
    api("/api/registrations/mine")
  ]);

  workshops = eventData;
  bookings = bookingData;
  renderDashboard();
}

async function initDashboard() {
  try {
    const session = await api("/api/auth/me");

    if (!session.user) {
      window.location.replace("/login.html");
      return;
    }

    if (session.user.role !== "student") {
      window.location.replace("/admin.html");
      return;
    }

    currentUser = session.user;
    document.getElementById("student-name").textContent =
      currentUser.name;

    await refreshDashboard();
  } catch (error) {
    showMessage(error.message, true);
  }
}

workshopGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-book]");
  if (!button || button.disabled) return;

  button.disabled = true;

  try {
    const result = await api("/api/registrations", {
      method: "POST",
      body: JSON.stringify({
        event_id: Number(button.dataset.book)
      })
    });

    showMessage(result.message || "Booking successful!");
    await refreshDashboard();
  } catch (error) {
    showMessage(error.message, true);
    button.disabled = false;
  }
});

bookingGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-cancel]");
  if (!button) return;

  if (!window.confirm("Are you sure you want to cancel this booking?")) {
    return;
  }

  button.disabled = true;

  try {
    const result = await api(
      `/api/registrations/${Number(button.dataset.cancel)}`,
      { method: "DELETE" }
    );

    showMessage(result.message || "Booking cancelled.");
    await refreshDashboard();
  } catch (error) {
    showMessage(error.message, true);
    button.disabled = false;
  }
});

document.getElementById("logout-button").addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
    window.location.replace("/login.html");
  } catch (error) {
    showMessage(error.message, true);
  }
});

initDashboard();
