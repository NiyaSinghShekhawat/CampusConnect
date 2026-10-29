# CampusConnect 🎓

A full-stack campus workshop management system that helps students discover workshops, register for events, and manage their bookings, while administrators manage workshops and track attendees.

## ✨ Features

### 👩‍🎓 Student
- Create an account and log in securely.
- Browse available workshops and event details.
- Register for workshops.
- View registered workshops in the student dashboard.
- Cancel bookings.
- Prevent duplicate registrations and respect workshop capacity limits.

### 🛠️ Administrator
- Secure admin login.
- View workshop and registration statistics.
- Create and edit workshops.
- View registered attendees.
- Delete eligible workshops.

### 🔐 Authentication and Security
- Password hashing with bcrypt.
- Session-based authentication.
- Role-based access control for students and administrators.
- Server-side validation for registration operations.
- SQLite database constraints to help prevent duplicate bookings.

## 🧰 Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | SQLite, better-sqlite3 |
| Authentication | express-session, bcryptjs |
| Configuration | dotenv |

## 📁 Project Structure

```text
CampusConnect/
├── public/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── student.html
│   ├── admin.html
│   ├── script.js
│   ├── auth.js
│   ├── student.js
│   ├── admin.js
│   ├── style.css
│   └── auth.css
├── database.js
├── server.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md
```

*The exact files may vary with the current project version.*

## ⚙️ Run Locally

### Prerequisites
- Node.js and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/YOUR-USERNAME/CampusConnect.git
cd CampusConnect
```

Replace `YOUR-USERNAME` with your GitHub username.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root using the required variables:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=replace_with_a_long_random_secret
ADMIN_NAME=CampusConnect Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace_with_a_strong_password
```

Use strong, private values for your own environment. Never commit `.env` or share real credentials publicly.

### 4. Start the application

```bash
node server.js
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🗄️ Database

CampusConnect uses SQLite for persistent application data. The database stores workshop information, student accounts, and registrations.

The database schema is initialized by `database.js`. Keep the SQLite database file private and out of version control.

## 🚀 Deployment

CampusConnect requires a hosting environment that supports Node.js, Express sessions, and persistent SQLite storage.

Before deploying:
- Configure environment variables in your hosting provider.
- Use a persistent volume for the SQLite database.
- Use HTTPS in production.
- Configure secure session cookies.
- Keep credentials and database files out of the public repository.
- Test registration, login, booking, cancellation, and admin permissions after deployment.

## 🔮 Future Improvements

- Email confirmations and reminders.
- Search, category filters, and workshop sorting.
- Registration export to CSV.
- Workshop attendance tracking.
- Automated tests and improved production security.

## 👩‍💻 Author

**Niya Singh | L. Hasini Reddy**

GitHub: [Niya Singh](https://github.com/NiyaSinghShekhawat)

---

*CampusConnect is an educational project demonstrating full-stack web development, authentication, database integration, and role-based application workflows.*
