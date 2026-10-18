-- ---------------------------------------------------------------
-- Schema for the Student Task Manager (MySQL 8)
-- Run this in MySQL Workbench (File > Open SQL Script, then the lightning bolt).
-- Column sizes match the validation rules in models/taskModel.js.
-- ---------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS student_tasks
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE student_tasks;

CREATE TABLE IF NOT EXISTS tasks (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  title       VARCHAR(100)  NOT NULL,
  description VARCHAR(500)  NOT NULL DEFAULT '',
  subject     VARCHAR(40)   NOT NULL DEFAULT '',
  priority    ENUM('Low', 'Medium', 'High')                 NOT NULL DEFAULT 'Medium',
  status      ENUM('Pending', 'In Progress', 'Completed')   NOT NULL DEFAULT 'Pending',
  due_date    DATE          NULL,                -- NULL = "no due date"
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_tasks_status (status),               -- speeds up status filters and stats
  INDEX idx_tasks_due_date (due_date)            -- speeds up due-date sorting and overdue checks
);

-- ---------------------------------------------------------------
-- Sample data: run this part ONCE so the app is not empty at first.
-- Dates are relative to today, so the demo always looks right.
-- ---------------------------------------------------------------

INSERT INTO tasks (title, description, subject, priority, status, due_date, created_at) VALUES
('Submit physics lab report',
 'Include the error analysis table and the graph of voltage vs current.',
 'Physics', 'High', 'In Progress', CURDATE() - INTERVAL 1 DAY, NOW() - INTERVAL 5 DAY),

('Finish Java assignment 3',
 'Inheritance and interfaces. Push the final version to GitHub before submitting.',
 'Java', 'High', 'Pending', CURDATE() + INTERVAL 2 DAY, NOW() - INTERVAL 4 DAY),

('Revise database normalization',
 '1NF to BCNF with two worked examples each.',
 'Databases', 'Medium', 'In Progress', CURDATE() + INTERVAL 5 DAY, NOW() - INTERVAL 3 DAY),

('Plan group project meeting',
 '',
 'Software Engineering', 'Low', 'Pending', CURDATE() + INTERVAL 7 DAY, NOW() - INTERVAL 2 DAY),

('Read operating systems chapter 4',
 'Process scheduling. Make short notes on round robin.',
 'Operating Systems', 'Medium', 'Completed', CURDATE() - INTERVAL 2 DAY, NOW() - INTERVAL 6 DAY);
