// ---------------------------------------------------------------
// Database connection
//
// We create ONE pool when the app starts and share it everywhere.
// A pool keeps several connections open and hands them out per query,
// which is much faster than connecting to MySQL on every request.
// ---------------------------------------------------------------

const mysql = require("mysql2/promise"); // the /promise version lets us use async/await

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true, // if all connections are busy, queue the query instead of failing
    connectionLimit: 10,

    // Return DATE / TIMESTAMP columns as plain strings ("2026-10-14")
    // instead of JavaScript Date objects. This avoids timezone shifts,
    // and our views and helpers already work with date strings.
    dateStrings: true
});

module.exports = pool;
