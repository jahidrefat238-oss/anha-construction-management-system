CREATE DATABASE anhaa_construction_dbms;
USE anhaa_construction_dbms;

-- Table 1: clients
CREATE TABLE clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact VARCHAR(20) NOT NULL,
    address VARCHAR(255) NOT NULL,
    email VARCHAR(100)
);

-- Table 2: employees
CREATE TABLE employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    post VARCHAR(50) NOT NULL,
    contact VARCHAR(20) NOT NULL,
    address VARCHAR(255),
    salary DECIMAL(10,2) DEFAULT 0.00 NOT NULL
);

-- Table 3: users
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

-- Table 4: projects
CREATE TABLE projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    budget DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
    location VARCHAR(150) NOT NULL,
    status VARCHAR(20) DEFAULT 'Running',
    client_id INT NOT NULL,
    user_id INT,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
);

-- Table 5: transactions
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(10) NOT NULL,
    project_id INT NOT NULL,
    amount DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
    note TEXT,
    date DATE NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Table 6: project_employee
CREATE TABLE project_employee (
    project_id INT NOT NULL,
    employee_id INT NOT NULL,
    PRIMARY KEY (project_id, employee_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE
);


-- Insert Data into clients
INSERT INTO clients (id, name, contact, address, email) VALUES
(1, 'ram', '2344444444', 'dhaka', NULL),
(2, 'mir', '55555555', 'jamalpur', NULL);

-- Insert Data into users
INSERT INTO users (id, username, password) VALUES
(1, 'refat', 'refat'),
(2, 'rafil', '1111');

-- Insert Data into projects
INSERT INTO projects (id, name, budget, location, status, client_id, user_id) VALUES
(1, 'rampura brize', 0.00, 'dhaka', 'Running', 1, NULL),
(2, 'mirpur zoo', 0.00, 'jamalpur', 'Running', 2, NULL);

-- Insert Data into transactions
INSERT INTO transactions (id, type, project_id, amount, note, date) VALUES
(1, 'Receive', 1, 44444.00, 'buy', '2026-08-23');