require("dotenv").config();
const express = require("express");
const path = require("path");
const methodOverride = require("method-override");
const Task = require("./models/taskModel");

const app = express();
const PORT = process.env.PORT || 8080; // hosting platforms set PORT for you

// ---------- setup ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true })); // read form data from POST requests
app.use(methodOverride("_method"));              // lets HTML forms send PATCH and DELETE (?_method=PATCH)

// Available in every EJS file
app.locals.PRIORITIES = Task.PRIORITIES;
app.locals.STATUSES = Task.STATUSES;
app.locals.formatDate = Task.formatDate;

// ---------- small helpers ----------

// Express 4 does not catch errors from async handlers, so we forward them ourselves
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const showError = (res, code, heading, message) =>
    res.status(code).render("error", { code, heading, message });

const blankTask = {
    title: "",
    description: "",
    subject: "",
    priority: "Medium",
    status: "Pending",
    dueDate: ""
};

// ---------- routes ----------

app.get("/", (req, res) => res.redirect("/tasks"));

// List, with search, filters and sorting: /tasks?status=pending&priority=High&q=java&sort=due
app.get("/tasks", wrap(async (req, res) => {
    const filters = {
        status: req.query.status || "all",
        priority: req.query.priority || "all",
        q: String(req.query.q || "").trim(),
        sort: req.query.sort || "newest"
    };
    const [tasks, stats] = await Promise.all([Task.findAll(filters), Task.getStats()]);
    res.render("tasks/index", { tasks, stats, filters });
}));

// New task form (must be declared BEFORE /tasks/:id)
app.get("/tasks/new", (req, res) => {
    res.render("tasks/new", { task: blankTask, errors: [] });
});

// Create
app.post("/tasks", wrap(async (req, res) => {
    const { values, errors } = Task.validate(req.body);
    if (errors.length) return res.status(422).render("tasks/new", { task: values, errors });

    await Task.create(values);
    res.redirect("/tasks");
}));

// Show one task
app.get("/tasks/:id", wrap(async (req, res) => {
    const task = await Task.findById(req.params.id);
    if (!task) return showError(res, 404, "Task not found", "This task does not exist or was deleted.");
    res.render("tasks/show", { task });
}));

// Edit form
app.get("/tasks/:id/edit", wrap(async (req, res) => {
    const task = await Task.findById(req.params.id);
    if (!task) return showError(res, 404, "Task not found", "This task does not exist or was deleted.");
    res.render("tasks/edit", { task, errors: [] });
}));

// Update
app.patch("/tasks/:id", wrap(async (req, res) => {
    const existing = await Task.findById(req.params.id);
    if (!existing) return showError(res, 404, "Task not found", "This task does not exist or was deleted.");

    const { values, errors } = Task.validate(req.body);
    if (errors.length) {
        return res.status(422).render("tasks/edit", { task: { ...values, id: existing.id }, errors });
    }

    await Task.update(req.params.id, values);
    res.redirect(`/tasks/${req.params.id}`);
}));

// Mark complete / reopen with one click
app.patch("/tasks/:id/toggle", wrap(async (req, res) => {
    const task = await Task.toggleComplete(req.params.id);
    if (!task) return showError(res, 404, "Task not found", "This task does not exist or was deleted.");
    res.redirect(req.get("Referer") || "/tasks"); // go back to wherever the click came from
}));

// Delete
app.delete("/tasks/:id", wrap(async (req, res) => {
    await Task.remove(req.params.id);
    res.redirect("/tasks");
}));

// ---------- 404 and error handling ----------
app.use((req, res) => showError(res, 404, "Page not found", "The page you are looking for does not exist."));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error(err);
    showError(res, 500, "Something went wrong", "Please try again in a moment.");
});

const pool = require("./db/pool");

pool.query("SELECT 1")                     // test the DB connection before accepting requests
    .then(() => {
        app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
    })
    .catch((err) => {
        console.error("Cannot connect to MySQL:", err.message);
        process.exit(1);
    });

    module.exports = app;
