// ---------------------------------------------------------------
// Data layer (MySQL version)
//
// Same exported functions as the in-memory version, so index.js and
// the views did not need to change. Only the insides are different:
// every function now sends a SQL query through the connection pool.
// ---------------------------------------------------------------

const pool = require("../db/pool");

const PRIORITIES = ["Low", "Medium", "High"];
const STATUSES = ["Pending", "In Progress", "Completed"];

// ---------- date helpers ----------

function toISODate(d) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
}

function today() {
    return toISODate(new Date());
}

function daysBetween(fromISO, toISO) {
    const from = new Date(fromISO + "T00:00:00");
    const to = new Date(toISO + "T00:00:00");
    return Math.round((to - from) / 86400000);
}

// Accepts "2026-10-14" or a full ISO timestamp
function formatDate(value) {
    if (!value) return "";
    const d = new Date(value.length === 10 ? value + "T00:00:00" : value);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ---------- helpers ----------

const slugify = (status) => status.toLowerCase().replace(/\s+/g, "-"); // "In Progress" -> "in-progress"

function isOverdue(task) {
    return Boolean(task.dueDate) && task.status !== "Completed" && task.dueDate < today();
}

function dueInfo(task) {
    if (!task.dueDate) return { text: "", tone: "none" };
    if (task.status === "Completed") return { text: "Due " + formatDate(task.dueDate), tone: "done" };

    const diff = daysBetween(today(), task.dueDate);
    if (diff < 0) return { text: `${-diff} ${-diff === 1 ? "day" : "days"} overdue`, tone: "overdue" };
    if (diff === 0) return { text: "Due today", tone: "today" };
    if (diff === 1) return { text: "Due tomorrow", tone: "soon" };
    if (diff <= 7) return { text: `Due in ${diff} days`, tone: "soon" };
    return { text: "Due " + formatDate(task.dueDate), tone: "normal" };
}

// Adds the extra fields the views need (status slug, overdue flag, due label)
function decorate(task) {
    return {
        ...task,
        statusSlug: slugify(task.status),
        overdue: isOverdue(task),
        due: dueInfo(task)
    };
}

// Turns a database row (snake_case) into the object the views expect (camelCase)
function fromRow(row) {
    return decorate({
        id: row.id,
        title: row.title,
        description: row.description,
        subject: row.subject,
        priority: row.priority,
        status: row.status,
        dueDate: row.due_date || "",                       // NULL in the database -> "" in the app
        createdAt: String(row.created_at).replace(" ", "T") // "2026-10-14 09:30:00" -> ISO style
    });
}

// IDs are numbers now. Anything else (like /tasks/abc) simply means "not found".
function toId(id) {
    return /^\d+$/.test(String(id)) ? Number(id) : null;
}

// ---------- validation (unchanged: runs before anything touches the database) ----------

function validate(body = {}) {
    const values = {
        title: String(body.title || "").trim(),
        description: String(body.description || "").trim(),
        subject: String(body.subject || "").trim(),
        priority: body.priority,
        status: body.status,
        dueDate: String(body.dueDate || "").trim()
    };

    const errors = [];

    if (!values.title) errors.push("Give the task a title.");
    else if (values.title.length > 100) errors.push("Keep the title under 100 characters.");

    if (values.subject.length > 40) errors.push("Keep the subject under 40 characters.");
    if (values.description.length > 500) errors.push("Keep the notes under 500 characters.");
    if (!PRIORITIES.includes(values.priority)) errors.push("Choose a priority.");
    if (!STATUSES.includes(values.status)) errors.push("Choose a status.");

    if (values.dueDate) {
        const valid = /^\d{4}-\d{2}-\d{2}$/.test(values.dueDate) && !isNaN(Date.parse(values.dueDate));
        if (!valid) errors.push("Enter the due date as a valid date.");
    }

    return { values, errors };
}

// ---------- CRUD ----------

// ORDER BY cannot use "?" placeholders, so we map the user's choice to a fixed
// SQL fragment. Only text from THIS object ever reaches the query (a "whitelist").
const SORTS = {
    newest:   "created_at DESC, id DESC",
    due:      "due_date IS NULL, due_date ASC, id DESC",                       // tasks without a date go last
    priority: "FIELD(priority, 'High', 'Medium', 'Low'), due_date IS NULL, due_date ASC",
    title:    "title ASC"
};

async function findAll({ status = "all", priority = "all", q = "", sort = "newest" } = {}) {
    const where = [];
    const params = [];

    if (status === "overdue") {
        where.push("due_date IS NOT NULL AND due_date < ? AND status <> 'Completed'");
        params.push(today()); // today's date comes from the app, so "overdue" matches the labels in the views
    } else if (status !== "all") {
        const label = STATUSES.find((s) => slugify(s) === status); // "in-progress" -> "In Progress"
        if (!label) return [];
        where.push("status = ?");
        params.push(label);
    }

    if (priority !== "all") {
        where.push("priority = ?");
        params.push(priority);
    }

    if (q) {
        where.push("CONCAT_WS(' ', title, subject, description) LIKE ?"); // case-insensitive thanks to the collation
        params.push(`%${q}%`);
    }

    const sql = `
        SELECT * FROM tasks
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY ${SORTS[sort] || SORTS.newest}`;

    const [rows] = await pool.execute(sql, params);
    return rows.map(fromRow);
}

async function findById(id) {
    const taskId = toId(id);
    if (taskId === null) return null;

    const [rows] = await pool.execute("SELECT * FROM tasks WHERE id = ?", [taskId]);
    return rows.length ? fromRow(rows[0]) : null;
}

async function create(values) {
    const [result] = await pool.execute(
        `INSERT INTO tasks (title, description, subject, priority, status, due_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [values.title, values.description, values.subject, values.priority, values.status, values.dueDate || null]
    );
    return findById(result.insertId); // insertId = the AUTO_INCREMENT id MySQL just generated
}

async function update(id, values) {
    const taskId = toId(id);
    if (taskId === null) return null;

    await pool.execute(
        `UPDATE tasks
         SET title = ?, description = ?, subject = ?, priority = ?, status = ?, due_date = ?
         WHERE id = ?`,
        [values.title, values.description, values.subject, values.priority, values.status, values.dueDate || null, taskId]
    );
    return findById(taskId); // null if the task does not exist
}

async function toggleComplete(id) {
    const taskId = toId(id);
    if (taskId === null) return null;

    // One statement flips the status inside the database, so there is no read-then-write gap
    await pool.execute(
        "UPDATE tasks SET status = IF(status = 'Completed', 'Pending', 'Completed') WHERE id = ?",
        [taskId]
    );
    return findById(taskId);
}

async function remove(id) {
    const taskId = toId(id);
    if (taskId === null) return false;

    const [result] = await pool.execute("DELETE FROM tasks WHERE id = ?", [taskId]);
    return result.affectedRows > 0; // rows actually deleted
}

async function getStats() {
    // One query computes every number. SUM() comes back as a string from mysql2
    // (MySQL returns it as DECIMAL), and SUM of zero rows is NULL, so we wrap in Number().
    const [[row]] = await pool.execute(
        `SELECT COUNT(*)                                                     AS total,
                SUM(status = 'Completed')                                    AS completed,
                SUM(status = 'In Progress')                                  AS in_progress,
                SUM(status = 'Pending')                                      AS pending,
                SUM(due_date IS NOT NULL AND due_date < ? AND status <> 'Completed') AS overdue
         FROM tasks`,
        [today()]
    );

    const total = Number(row.total);
    const completed = Number(row.completed);
    const inProgress = Number(row.in_progress);
    const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

    return {
        total,
        completed,
        inProgress,
        pending: Number(row.pending),
        overdue: Number(row.overdue),
        pctDone: pct(completed),
        pctDoing: pct(inProgress)
    };
}

module.exports = {
    PRIORITIES,
    STATUSES,
    formatDate,
    validate,
    findAll,
    findById,
    create,
    update,
    toggleComplete,
    remove,
    getStats
};
