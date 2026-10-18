# Student Task Manager

A full-stack web app for students to organise assignments, exams and readings.
Add, edit, complete and delete tasks, and filter or search them by status, priority and keyword.

**Live demo:** 

## Features

- Create, view, edit and delete tasks (full CRUD)
- One-click complete and reopen
- Fields for title, subject, notes, priority, status and due date
- Server-side validation with clear error messages
- Search, filter by status or priority, and sort by newest, due date, priority or title
- Progress bar and overdue detection ("2 days overdue", "Due tomorrow")
- Custom 404 and error pages, responsive layout

## Tech stack

- **Backend:** Node.js, Express
- **Database:** MySQL, accessed with the mysql2 driver
- **Frontend:** EJS templates, HTML, CSS
- **Other:** method-override (PATCH and DELETE from HTML forms), dotenv (configuration)

## How it works

Tasks are stored in a MySQL `tasks` table. The app connects through a mysql2
connection pool configured via environment variables. All queries are
parameterized to prevent SQL injection. Sorting uses a whitelist because
ORDER BY can't take placeholders. A mapping function converts snake_case
database columns to the camelCase fields the views use.

All database code lives in `models/taskModel.js`, so the routes in `index.js`
and the views don't know SQL exists.

## Project structure

```
index.js              routes and server setup
db/pool.js            MySQL connection pool
db/schema.sql         table definition and sample data
models/taskModel.js   all data logic and validation
views/                EJS templates (tasks/, partials/, error page)
public/css/style.css  styles
```

## Run it locally

1. Install Node.js (v18 or newer) and MySQL.
2. Clone the repo and install dependencies:
```
   git clone [your repo URL]
   cd student-task-manager
   npm install
```
3. Create the database by running `db/schema.sql` in MySQL Workbench or the MySQL CLI.
4. Copy `.env.example` to `.env` and fill in your MySQL password.
5. Start the app:
```
   npm run dev
```
6. Open http://localhost:8080

## Built with AI assistance

I wrote the first version myself: routes, EJS views and the add/view functionality.
I then used AI to help restructure it and add validation, filtering, styling and the
SQL data layer. I wrote and tested the SQL queries by hand in MySQL Workbench, set up
the database and configuration, tested every feature, and went through the code to
understand how it works.