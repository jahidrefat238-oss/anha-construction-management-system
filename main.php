<?php
header('Content-Type: application/json; charset=utf-8');

$host = 'localhost';
$username = 'root';
$password = '';
$dbname = 'anhaa_construction_dbms';

// Database Connection
$conn = new mysqli($host, $username, $password);

if ($conn->connect_error) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed: ' . $conn->connect_error
    ]);
    exit();
}

$conn->set_charset('utf8mb4');

// Create Database
$sql_db = "CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci";
if (!$conn->query($sql_db)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Could not create database: ' . $conn->error
    ]);
    exit();
}

$conn->select_db($dbname);

// Table Creation
$q1 = "CREATE TABLE IF NOT EXISTS users (
    id INT NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY username (username)
)";

$q2 = "CREATE TABLE IF NOT EXISTS clients (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    contact VARCHAR(20) NOT NULL,
    address VARCHAR(255) NOT NULL,
    email VARCHAR(100) DEFAULT NULL,
    PRIMARY KEY (id)
)";

$q3 = "CREATE TABLE IF NOT EXISTS employees (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    post VARCHAR(50) NOT NULL,
    contact VARCHAR(20) NOT NULL,
    address VARCHAR(255) DEFAULT NULL,
    salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (id)
)";

$q4 = "CREATE TABLE IF NOT EXISTS projects (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    budget DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    location VARCHAR(150) NOT NULL,
    status VARCHAR(20) DEFAULT 'Running',
    client_id INT NOT NULL,
    user_id INT DEFAULT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
)";

$q5 = "CREATE TABLE IF NOT EXISTS transactions (
    id INT NOT NULL AUTO_INCREMENT,
    project_id INT NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    note TEXT DEFAULT NULL,
    date DATE NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE CASCADE
)";

$q6 = "CREATE TABLE IF NOT EXISTS project_employee (
    project_id INT NOT NULL,
    employee_id INT NOT NULL,
    PRIMARY KEY (project_id, employee_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE
)";

$conn->query($q1);
$conn->query($q2);
$conn->query($q3);
$conn->query($q4);
$conn->query($q5);
$conn->query($q6);

// Default Admin User Setup
$check_admin = $conn->query("SELECT id FROM users WHERE username = 'admin' LIMIT 1");
if ($check_admin && $check_admin->num_rows == 0) {
    $conn->query("INSERT INTO users (username, password) VALUES ('admin', 'admin123')");
}

// Request Handling
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'status' => 'success',
        'message' => 'Anhaa Construction API is running.',
        'data' => [
            'database' => $dbname,
            'message' => 'Send POST requests with an action.'
        ]
    ]);
    exit();
}

$action = isset($_POST['action']) ? trim($_POST['action']) : '';

if ($action == '') {
    echo json_encode(['status' => 'error', 'message' => 'No action supplied.']);
    exit();
}

// ------------------------------------------------------------
// API ACTIONS
// ------------------------------------------------------------

// LOGIN
if ($action == 'login') {
    if (!isset($_POST['username']) || !isset($_POST['password'])) {
        echo json_encode(['status' => 'error', 'message' => 'Missing username or password']);
        exit();
    }

    $username = trim($_POST['username']);
    $password = trim($_POST['password']);

    $res = $conn->query("SELECT id, username, password FROM users WHERE username = '$username' LIMIT 1");
    $row = $res ? $res->fetch_assoc() : null;

    if (!$row || $row['password'] !== $password) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid username or password.']);
    } else {
        echo json_encode([
            'status' => 'success',
            'message' => 'Login successful.',
            'data' => [
                'id' => (int)$row['id'],
                'username' => $row['username']
            ]
        ]);
    }
    exit();
}

// REGISTER
elseif ($action == 'register') {
    if (!isset($_POST['username']) || !isset($_POST['password'])) {
        echo json_encode(['status' => 'error', 'message' => 'Missing username or password']);
        exit();
    }

    $username = trim($_POST['username']);
    $password = trim($_POST['password']);

    if (strlen($username) < 3 || strlen($password) < 3) {
        echo json_encode(['status' => 'error', 'message' => 'Username and password must be at least 3 characters.']);
        exit();
    }

    $check = $conn->query("SELECT id FROM users WHERE username = '$username'");
    if ($check && $check->num_rows > 0) {
        echo json_encode(['status' => 'error', 'message' => 'Username already exists.']);
        exit();
    }

    $sql = "INSERT INTO users (username, password) VALUES ('$username', '$password')";
    if ($conn->query($sql)) {
        echo json_encode([
            'status' => 'success',
            'message' => 'Registration successful.',
            'data' => [
                'id' => (int)$conn->insert_id,
                'username' => $username
            ]
        ]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Registration failed: ' . $conn->error]);
    }
    exit();
}

// FETCH ALL DATA
elseif ($action == 'fetch_all') {
    $data = [
        'users' => [],
        'clients' => [],
        'projects' => [],
        'transactions' => [],
        'employees' => [],
        'teamAssignments' => []
    ];

    $res = $conn->query('SELECT id, username FROM users ORDER BY id ASC');
    while ($row = $res->fetch_assoc()) {
        $data['users'][] = ['id' => (int)$row['id'], 'username' => $row['username']];
    }

    $res = $conn->query('SELECT id, name, contact, address, email FROM clients ORDER BY id ASC');
    while ($row = $res->fetch_assoc()) {
        $data['clients'][] = [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'contact' => $row['contact'],
            'address' => $row['address'],
            'email' => $row['email']
        ];
    }

    $res = $conn->query('SELECT id, name, budget, location, status, client_id, user_id FROM projects ORDER BY id ASC');
    while ($row = $res->fetch_assoc()) {
        $data['projects'][] = [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'budget' => (float)$row['budget'],
            'location' => $row['location'],
            'status' => $row['status'],
            'client_id' => (int)$row['client_id'],
            'user_id' => $row['user_id'] === null ? null : (int)$row['user_id']
        ];
    }

    $res = $conn->query('SELECT id, project_id, type, amount, note, date FROM transactions ORDER BY date DESC, id DESC');
    while ($row = $res->fetch_assoc()) {
        $data['transactions'][] = [
            'id' => (int)$row['id'],
            'project_id' => (int)$row['project_id'],
            'type' => $row['type'],
            'amount' => (float)$row['amount'],
            'note' => $row['note'],
            'date' => $row['date']
        ];
    }

    $res = $conn->query('SELECT id, name, post, contact, address, salary FROM employees ORDER BY id ASC');
    while ($row = $res->fetch_assoc()) {
        $data['employees'][] = [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'post' => $row['post'],
            'contact' => $row['contact'],
            'address' => $row['address'],
            'salary' => (float)$row['salary']
        ];
    }

    $res = $conn->query('SELECT project_id, employee_id FROM project_employee ORDER BY project_id ASC, employee_id ASC');
    while ($row = $res->fetch_assoc()) {
        $data['teamAssignments'][] = [
            'project_id' => (int)$row['project_id'],
            'employee_id' => (int)$row['employee_id']
        ];
    }

    echo json_encode(['status' => 'success', 'message' => 'All data loaded.', 'data' => $data]);
    exit();
}

// CLIENTS
elseif ($action == 'add_client') {
    $name = trim($_POST['name']);
    $contact = trim($_POST['contact']);
    $address = trim($_POST['address']);
    $email = isset($_POST['email']) ? trim($_POST['email']) : '';

    $sql = "INSERT INTO clients (name, contact, address, email) VALUES ('$name', '$contact', '$address', '$email')";
    if ($conn->query($sql)) {
        echo json_encode(['status' => 'success', 'message' => 'Client added successfully.', 'data' => ['id' => (int)$conn->insert_id]]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Could not add client: ' . $conn->error]);
    }
    exit();
}

elseif ($action == 'update_client') {
    $id = (int)$_POST['id'];
    $name = trim($_POST['name']);
    $contact = trim($_POST['contact']);
    $address = trim($_POST['address']);
    $email = isset($_POST['email']) ? trim($_POST['email']) : '';

    $sql = "UPDATE clients SET name='$name', contact='$contact', address='$address', email='$email' WHERE id=$id";
    if ($conn->query($sql)) {
        echo json_encode(['status' => 'success', 'message' => 'Client updated successfully.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Could not update client: ' . $conn->error]);
    }
    exit();
}

elseif ($action == 'delete_client') {
    $id = (int)$_POST['id'];
    if ($conn->query("DELETE FROM clients WHERE id=$id")) {
        echo json_encode(['status' => 'success', 'message' => 'Client deleted successfully.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Could not delete client. It may still be linked to a project.']);
    }
    exit();
}

// PROJECTS
elseif ($action == 'add_project') {
    $name = trim($_POST['name']);
    $budget = (float)$_POST['budget'];
    $location = trim($_POST['location']);
    $status = isset($_POST['status']) ? trim($_POST['status']) : 'Running';
    $client_id = (int)$_POST['client_id'];

    $sql = "INSERT INTO projects (name, budget, location, status, client_id, user_id) VALUES ('$name', $budget, '$location', '$status', $client_id, NULL)";
    if ($conn->query($sql)) {
        echo json_encode(['status' => 'success', 'message' => 'Project added successfully.', 'data' => ['id' => (int)$conn->insert_id]]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Could not add project: ' . $conn->error]);
    }
    exit();
}

elseif ($action == 'update_project') {
    $id = (int)$_POST['id'];
    $name = trim($_POST['name']);
    $budget = (float)$_POST['budget'];
    $location = trim($_POST['location']);
    $status = isset($_POST['status']) ? trim($_POST['status']) : 'Running';
    $client_id = (int)$_POST['client_id'];

    $sql = "UPDATE projects SET name='$name', budget=$budget, location='$location', status='$status', client_id=$client_id, user_id=NULL WHERE id=$id";
    if ($conn->query($sql)) {
        echo json_encode(['status' => 'success', 'message' => 'Project updated successfully.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Could not update project: ' . $conn->error]);
    }
    exit();
}

elseif ($action == 'delete_project') {
    $id = (int)$_POST['id'];
    if ($conn->query("DELETE FROM projects WHERE id=$id")) {
        echo json_encode(['status' => 'success', 'message' => 'Project deleted successfully.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Could not delete project: ' . $conn->error]);
    }
    exit();
}

elseif ($action == 'complete_project') {
    $id = (int)$_POST['id'];
    if ($conn->query("UPDATE projects SET status='Completed' WHERE id=$id")) {
        echo json_encode(['status' => 'success', 'message' => 'Project marked as completed.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Could not complete project: ' . $conn->error]);
    }
    exit();
}

// TRANSACTIONS
elseif ($action == 'add_transaction' || $action == 'save_transaction') {
    $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
    $project_id = (int)$_POST['project_id'];
    $type = trim($_POST['type']);
    $amount = (float)$_POST['amount'];
    $note = isset($_POST['note']) ? trim($_POST['note']) : '';
    $date = trim($_POST['date']);

    if ($id > 0) {
        $sql = "UPDATE transactions SET project_id=$project_id, type='$type', amount=$amount, note='$note', date='$date' WHERE id=$id";
        if ($conn->query($sql)) {
            echo json_encode(['status' => 'success', 'message' => 'Transaction updated successfully.', 'data' => ['id' => $id]]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Could not update transaction: ' . $conn->error]);
        }
    } else {
        $sql = "INSERT INTO transactions (project_id, type, amount, note, date) VALUES ($project_id, '$type', $amount, '$note', '$date')";
        if ($conn->query($sql)) {
            echo json_encode(['status' => 'success', 'message' => 'Transaction saved successfully.', 'data' => ['id' => (int)$conn->insert_id]]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Could not save transaction: ' . $conn->error]);
        }
    }
    exit();
}

elseif ($action == 'delete_transaction') {
    $id = (int)$_POST['id'];
    if ($conn->query("DELETE FROM transactions WHERE id=$id")) {
        echo json_encode(['status' => 'success', 'message' => 'Transaction deleted successfully.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Could not delete transaction: ' . $conn->error]);
    }
    exit();
}

// EMPLOYEES
elseif ($action == 'add_employee' || $action == 'save_employee') {
    $name = trim($_POST['name']);
    $post = trim($_POST['post']);
    $contact = trim($_POST['contact']);
    $address = isset($_POST['address']) ? trim($_POST['address']) : '';
    $salary = (float)$_POST['salary'];

    $sql = "INSERT INTO employees (name, post, contact, address, salary) VALUES ('$name', '$post', '$contact', '$address', $salary)";
    if ($conn->query($sql)) {
        echo json_encode(['status' => 'success', 'message' => 'Employee saved successfully.', 'data' => ['id' => (int)$conn->insert_id]]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Could not save employee: ' . $conn->error]);
    }
    exit();
}

elseif ($action == 'update_employee') {
    $id = (int)$_POST['id'];
    $name = trim($_POST['name']);
    $post = trim($_POST['post']);
    $contact = trim($_POST['contact']);
    $address = isset($_POST['address']) ? trim($_POST['address']) : '';
    $salary = (float)$_POST['salary'];

    $sql = "UPDATE employees SET name='$name', post='$post', contact='$contact', address='$address', salary=$salary WHERE id=$id";
    if ($conn->query($sql)) {
        echo json_encode(['status' => 'success', 'message' => 'Employee updated successfully.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Could not update employee: ' . $conn->error]);
    }
    exit();
}

elseif ($action == 'delete_employee') {
    $id = (int)$_POST['id'];
    if ($conn->query("DELETE FROM employees WHERE id=$id")) {
        echo json_encode(['status' => 'success', 'message' => 'Employee deleted successfully.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Could not delete employee: ' . $conn->error]);
    }
    exit();
}

// M:N PROJECT <-> EMPLOYEE
elseif ($action == 'assign_employee') {
    $project_id = (int)$_POST['project_id'];
    $employee_id = (int)$_POST['employee_id'];

    $sql = "INSERT INTO project_employee (project_id, employee_id) VALUES ($project_id, $employee_id)";
    if ($conn->query($sql)) {
        echo json_encode(['status' => 'success', 'message' => 'Employee assigned successfully.']);
    } else {
        if ($conn->errno == 1062) {
            echo json_encode(['status' => 'success', 'message' => 'Employee is already assigned to this project.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Could not assign employee: ' . $conn->error]);
        }
    }
    exit();
}

elseif ($action == 'remove_employee' || $action == 'unassign_employee') {
    $project_id = (int)$_POST['project_id'];
    $employee_id = (int)$_POST['employee_id'];

    $sql = "DELETE FROM project_employee WHERE project_id=$project_id AND employee_id=$employee_id";
    if ($conn->query($sql)) {
        echo json_encode(['status' => 'success', 'message' => 'Employee removed from project.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Could not remove employee assignment: ' . $conn->error]);
    }
    exit();
}

// UNKNOWN ACTION
else {
    echo json_encode(['status' => 'error', 'message' => 'Unknown action: ' . $action]);
    exit();
}

$conn->close();
?>