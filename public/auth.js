
const messageBox = document.getElementById("auth-message");

function showAuthMessage(message, type = "error") {
  messageBox.textContent = message;
  messageBox.className = `auth-message visible ${type}`;
}

async function requestJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }

  return data;
}


function redirectAfterAuth(user) {
  if (user.role === "admin") {
    window.location.replace("/admin.html");
  } else {
    window.location.replace("/student.html");
  }

  const requestedPage = new URLSearchParams(
    window.location.search
  ).get("next");

  // Only allow safe, local paths.
  const safePage =
    requestedPage &&
    requestedPage.startsWith("/") &&
    !requestedPage.startsWith("//") &&
    !requestedPage.includes("\\")
      ? requestedPage
      : "/student.html";

  window.location.href = safePage;
}


// If the user already has a session, don't leave them on the auth page.
async function redirectExistingSession() {
  try {
    const data = await requestJSON("/api/auth/me", {
      headers: {},
    });

    if (data.user) {
      redirectAfterAuth(data.user);
    }
  } catch (error) {
    console.warn("Could not check existing session:", error);
  }
}

const registerForm = document.getElementById("register-form");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword =
      document.getElementById("confirm-password").value;

    const submitButton = registerForm.querySelector(
      'button[type="submit"]'
    );

    if (password !== confirmPassword) {
      showAuthMessage("Your passwords don't match.");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Creating your account…";

    try {
      const data = await requestJSON("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });

      showAuthMessage(data.message || "Account created!", "success");

      
        if (data.user) {
            if (data.user.role === "admin") {
                window.location.replace("/admin.html");
            } else {
                window.location.replace("/student.html");
            }
        }

    } catch (error) {
      showAuthMessage(error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Create account <span>↗</span>';
    }
  });
}

const loginForm = document.getElementById("login-form");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const submitButton = loginForm.querySelector(
      'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = "Signing you in…";

    try {
      const data = await requestJSON("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!data.user) {
        throw new Error("Login response did not include a user.");
      }

      showAuthMessage("Login successful! Redirecting…", "success");
      redirectAfterAuth(data.user);
    } catch (error) {
      showAuthMessage(error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Sign in <span>↗</span>';
    }
  });
}

if (registerForm || loginForm) {
  redirectExistingSession();
}
