
const eventGrid = document.getElementById("event-grid");
const eventStatus = document.getElementById("event-status");
const eventCount = document.getElementById("event-count");
const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const sortFilter = document.getElementById("sort-filter");
const emptyState = document.getElementById("empty-state");
const clearFiltersButton = document.getElementById("clear-filters");

let events = [];


async function requireStudentLogin() {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "same-origin"
    });

    if (!response.ok) {
      window.location.href =
        "/login.html?next=" + encodeURIComponent("/index.html");
      return false;
    }

    const data = await response.json();

    if (!data.user) {
      window.location.href =
        "/login.html?next=" + encodeURIComponent("/index.html");
      return false;
    }

    if (data.user.role !== "student") {
      alert("Please log in with a student account to register for workshops.");
      return false;
    }

    return true;
  } catch (error) {
    console.error("Could not verify login:", error);
    alert("Unable to verify your login. Please try again.");
    return false;
  }
}


document.getElementById("current-year").textContent =
  new Date().getFullYear();

// Accept common field names so the frontend can work with
// different naming conventions used by the API.
function getEventValue(event, keys, fallback = "") {
  for (const key of keys) {
    if (
      event[key] !== undefined &&
      event[key] !== null &&
      event[key] !== ""
    ) {
      return event[key];
    }
  }

  return fallback;
}


function normalizeEvent(event) {
  const priceValue = Number(event.price ?? 0);
  const seatsValue = Number(
    event.seats_remaining ?? event.available_seats ?? 0
  );
  const totalSeatsValue = Number(
    event.capacity ?? event.total_seats ?? seatsValue
  );

  return {
    id: event.id,
    title: event.title ?? "Untitled event",
    description: event.description ?? "Discover this event and learn something new.",
    category: event.category ?? "Workshop",
    date: event.event_date ?? event.date ?? "",
    time: event.time ?? "",
    price: Number.isFinite(priceValue) ? Math.max(0, priceValue) : 0,
    availableSeats: Number.isFinite(seatsValue)
      ? Math.max(0, seatsValue)
      : 0,
    totalSeats: Number.isFinite(totalSeatsValue)
      ? Math.max(0, totalSeatsValue)
      : 0,
    location: event.venue ?? event.location ?? "Venue to be announced",
    original: event,
  };
}


function formatDate(value) {
  if (!value) return "Date to be announced";

  // Handle YYYY-MM-DD as a local calendar date to avoid
  // timezone shifts moving the displayed day backwards.
  const dateText = String(value);
  const dateOnlyMatch = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  let date;

  if (dateOnlyMatch) {
    date = new Date(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3])
    );
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatPrice(price) {
  if (price === 0) return "Free";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(price);
}

function formatTime(value) {
  if (!value) return "";

  const text = String(value);

  // Convert HH:mm or HH:mm:ss to a readable 12-hour time.
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (!match) return text;

  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getSeatPercentage(event) {
  if (event.totalSeats <= 0) return 0;

  return Math.min(
    100,
    Math.max(0, (event.availableSeats / event.totalSeats) * 100)
  );
}

function getCategoryStyle(category) {
  const value = String(category).toLowerCase();

  if (/design|art|creative/.test(value)) {
    return { color: "pink", symbol: "✿" };
  }

  if (/business|finance|entrepreneur/.test(value)) {
    return { color: "gold", symbol: "↗" };
  }

  if (/career|coding|tech|program|data|ai|web/.test(value)) {
    return { color: "blue", symbol: "⌘" };
  }

  if (/health|wellness|fitness/.test(value)) {
    return { color: "mint", symbol: "♡" };
  }

  return { color: "purple", symbol: "✦" };
}

function populateCategories() {
  const selectedCategory = categoryFilter.value;
  const categories = [
    ...new Set(events.map((event) => String(event.category))),
  ].sort((a, b) => a.localeCompare(b));

  categoryFilter.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All categories";
  categoryFilter.appendChild(allOption);

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });

  if (categories.includes(selectedCategory)) {
    categoryFilter.value = selectedCategory;
  }
}

function getFilteredEvents() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;

  const filtered = events.filter((event) => {
    const searchableText = [
      event.title,
      event.description,
      event.category,
      event.location,
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = searchableText.includes(searchTerm);

    const matchesCategory =
      selectedCategory === "all" ||
      event.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const sortBy = sortFilter.value;

  filtered.sort((a, b) => {
    if (sortBy === "price-low") return a.price - b.price;
    if (sortBy === "price-high") return b.price - a.price;

    if (sortBy === "seats") {
      return b.availableSeats - a.availableSeats;
    }

    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();

    if (Number.isNaN(dateA)) return 1;
    if (Number.isNaN(dateB)) return -1;

    return dateA - dateB;
  });

  return filtered;
}


function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}


function createEventCard(event, index) {
  const style = getCategoryStyle(event.category);
  const soldOut = event.availableSeats <= 0;
  const lowSeats =
    !soldOut &&
    event.totalSeats > 0 &&
    event.availableSeats / event.totalSeats <= 0.2;

  const availabilityClass = soldOut
    ? "sold-out"
    : lowSeats
      ? "low"
      : "";

  const availabilityText = soldOut
    ? "Sold out"
    : lowSeats
      ? "Almost full"
      : "Seats available";

  const progressClass = soldOut
    ? "sold-out"
    : lowSeats
      ? "low"
      : "";

  const timeText = formatTime(event.time || event.date);
  const dateTimeText = timeText
    ? `${formatDate(event.date)} · ${timeText}`
    : formatDate(event.date);

  const seatText =
    event.totalSeats > 0
      ? `${event.availableSeats} of ${event.totalSeats} seats left`
      : `${event.availableSeats} seats left`;

  const priceClass = event.price === 0 ? "free" : "";
  const eventId = escapeHTML(event.id);

  return `
    <article class="event-card">
      <div class="event-cover ${style.color}">
        <span class="cover-label">${escapeHTML(event.category)}</span>
        <div class="cover-symbol" aria-hidden="true">${style.symbol}</div>
      </div>

      <div class="event-body">
        <div class="event-meta">
          <span class="category-pill">${escapeHTML(event.category)}</span>
          <span class="availability-pill ${availabilityClass}">
            ${availabilityText}
          </span>
        </div>

        <h3 class="event-title">${escapeHTML(event.title)}</h3>

        <p class="event-description">
          ${escapeHTML(event.description)}
        </p>

        <div class="event-details">
          <div class="detail-row">
            <span class="detail-icon" aria-hidden="true">▦</span>
            <span>${escapeHTML(dateTimeText)}</span>
          </div>

          <div class="detail-row">
            <span class="detail-icon" aria-hidden="true">⌖</span>
            <span>${escapeHTML(event.location)}</span>
          </div>
        </div>

        <div class="seat-block">
          <div class="seat-labels">
            <span>Seat availability</span>
            <strong>${event.availableSeats} left</strong>
          </div>

          <div
            class="seat-track"
            role="progressbar"
            aria-label="Seats remaining"
            aria-valuemin="0"
            aria-valuemax="${Math.max(event.totalSeats, 1)}"
            aria-valuenow="${Math.min(event.availableSeats, Math.max(event.totalSeats, 1))}"
          >
            <div
              class="seat-progress ${progressClass}"
              style="width: ${getSeatPercentage(event)}%"
            ></div>
          </div>
        </div>

        <div class="event-bottom">
          <div>
            <div class="price-label">ENTRY FEE</div>
            <div class="event-price ${priceClass}">
              ${formatPrice(event.price)}
            </div>
          </div>

          <button
            class="register-button"
            type="button"
            data-event-id="${eventId}"
            ${soldOut ? "disabled" : ""}
          >
            ${soldOut ? "Sold out" : "Register now"}
            ${soldOut ? "" : "<span aria-hidden=\"true\">↗</span>"}
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderEvents() {
  const filteredEvents = getFilteredEvents();

  eventGrid.innerHTML = filteredEvents
    .map(createEventCard)
    .join("");

  eventCount.textContent =
    `${filteredEvents.length} event${filteredEvents.length === 1 ? "" : "s"} found`;

  emptyState.hidden = filteredEvents.length !== 0;
}

async function loadEvents() {
  eventStatus.className = "status-message";
  eventStatus.textContent = "Loading workshops from the server…";

  try {
    const response = await fetch("/api/events", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();

    // Supports either an array or a wrapped response such as
    // { events: [...] } or { data: [...] }.
    const eventList = Array.isArray(data)
      ? data
      : Array.isArray(data.events)
        ? data.events
        : Array.isArray(data.data)
          ? data.data
          : null;

    if (!eventList) {
      throw new Error(
        "The API response is not an event array. Check /api/events."
      );
    }

    events = eventList.map(normalizeEvent);

    populateCategories();
    renderEvents();

    eventStatus.textContent = events.length
      ? `Showing ${events.length} event${events.length === 1 ? "" : "s"} loaded from the server.`
      : "There are no events available yet.";

  } catch (error) {
    console.error("Unable to load events:", error);

    eventGrid.innerHTML = "";
    eventCount.textContent = "Events unavailable";
    eventStatus.className = "status-message error";
    eventStatus.textContent =
      "We couldn't load the events. Make sure the server is running and /api/events is working, then refresh this page.";
    emptyState.hidden = true;
  }
}

searchInput.addEventListener("input", renderEvents);
categoryFilter.addEventListener("change", renderEvents);
sortFilter.addEventListener("change", renderEvents);

clearFiltersButton.addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "all";
  sortFilter.value = "date";
  renderEvents();
});


eventGrid.addEventListener("click", async (clickEvent) => {
  const button = clickEvent.target.closest(".register-button");

  if (!button || button.disabled) return;

  const allowed = await requireStudentLogin();
  if (!allowed) return;

  const eventId = button.dataset.eventId;

  const selectedEvent = events.find(
    (event) => String(event.id) === String(eventId)
  );

  if (!selectedEvent) return;

  try {
    button.disabled = true;
    button.textContent = "Registering...";

    const response = await fetch("/api/registrations", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_id: Number(eventId),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || "Could not register for this workshop."
      );
    }

    alert(`Successfully registered for "${selectedEvent.title}"!`);

    // Refresh events to update available seats.
    await loadEvents();
  } catch (error) {
    alert(error.message || "Something went wrong. Please try again.");
  } finally {
    button.disabled = false;
    button.textContent = "Register now";
  }
});


// Keyboard shortcut: press / to focus the search field.
document.addEventListener("keydown", (event) => {
  const activeTag = document.activeElement?.tagName;

  if (
    event.key === "/" &&
    !event.ctrlKey &&
    !event.metaKey &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)
  ) {
    event.preventDefault();
    searchInput.focus();
  }
});

loadEvents();
