let clients = [];
let projects = [];
let transactions = [];
let activeTransactionListType = "Receive";
let employees = [];

// In the database this relationship is stored in project_employee.
// In the current front-end it is kept in memory as a junction map.
let teamAssignments = {};

// --- AUTHENTICATION / USER ENTITY ---
let currentUser = null;

// ==================== DATABASE API ====================
const API_URL = "main.php";

// ============================================================
// DATABASE CONNECTION HELPER
// This function sends a request from JavaScript to main.php.
// ============================================================
async function apiRequest(action, fields = {}) {
  if (window.location.protocol === "file:") {
    const error = new Error(
      "Open this project through a PHP server, not by double-clicking index.html.",
    );
    toast(error.message, "warning");
    throw error;
  }

  const formData = new FormData();
  formData.append("action", action);
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== null && value !== undefined) formData.append(key, value);
  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: formData,
    });
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(
        responseText.trim().startsWith("<?php")
          ? "PHP is not being executed. Start Apache/PHP and open the project with an http:// URL."
          : `Server returned an invalid response (HTTP ${response.status}).`,
      );
    }
    if (!response.ok || result.status !== "success") {
      throw new Error(result.message || "Server request failed.");
    }
    return result;
  } catch (error) {
    console.error("API Error:", error);
    toast(error.message || "Could not connect to the database.", "warning");
    throw error;
  }
}

function rebuildProjectTotals() {
  projects.forEach((project) => {
    project.received = 0;
    project.paid = 0;
  });
  transactions.forEach((t) => {
    const project = projects.find((p) => Number(p.id) === Number(t.projectId));
    if (!project) return;
    if (t.type === "Receive") project.received += Number(t.amount) || 0;
    if (t.type === "Pay") project.paid += Number(t.amount) || 0;
  });
}

// ============================================================
// LOAD DATA FROM MYSQL
// main.php returns clients, projects, transactions, employees,
// clients, projects, transactions, employees and project_employee data as JSON.
// ============================================================
async function loadDatabaseData() {
  const result = await apiRequest("fetch_all");
  const data = result.data || {};

  clients = (data.clients || []).map((c) => ({
    id: Number(c.id),
    name: c.name || "",
    contact: c.contact || "",
    address: c.address || "",
    email: c.email || "",
  }));

  projects = (data.projects || []).map((p) => ({
    id: Number(p.id),
    name: p.name || "",
    status: p.status || "Running",
    received: 0,
    paid: 0,
    clientId: Number(p.client_id),
    location: p.location || "",
    workType: "",
    budget: Number(p.budget) || 0,
    date: "",
  }));

  transactions = (data.transactions || []).map((t) => ({
    id: Number(t.id),
    projectId: Number(t.project_id),
    type: t.type,
    amount: Number(t.amount) || 0,
    note: t.note || "",
    date: t.date,
  }));

  employees = (data.employees || []).map((e) => ({
    id: Number(e.id),
    name: e.name || "",
    phone: e.contact || "",
    post: e.post || "",
    address: e.address || "",
    salary: Number(e.salary) || 0,
    salaryType: "Monthly",
  }));

  teamAssignments = {};
  (data.teamAssignments || []).forEach((a) => {
    const projectId = Number(a.project_id);
    if (!teamAssignments[projectId]) teamAssignments[projectId] = [];
    teamAssignments[projectId].push(Number(a.employee_id));
  });

  rebuildProjectTotals();
  updateDashboard();
  populateClientDropdown();
  renderClientList();
  renderEmployeeList();
}

function showAuthTab(tab) {
  document.getElementById("loginForm").style.display =
    tab === "login" ? "block" : "none";
  document.getElementById("registerForm").style.display =
    tab === "register" ? "block" : "none";
  document
    .getElementById("tabLoginBtn")
    .classList.toggle("active", tab === "login");
  document
    .getElementById("tabRegisterBtn")
    .classList.toggle("active", tab === "register");
}

function togglePassword(fieldId, btn) {
  const field = document.getElementById(fieldId);
  const isHidden = field.type === "password";
  field.type = isHidden ? "text" : "password";
  btn.innerText = isHidden ? "HIDE" : "SHOW";
}
async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById("regUsername").value.trim();
  const gmail = document.getElementById("regGmail").value.trim().toLowerCase();
  const password = document.getElementById("regPassword").value;
  const confirmPassword = document.getElementById("regConfirmPassword").value;

  if (!username) {
    toast("Please enter a username.", "warning");
    return;
  }
  if (password !== confirmPassword) {
    toast("Passwords do not match.", "warning");
    return;
  }
  if (password.length < 4) {
    toast("Password should be at least 4 characters.", "warning");
    return;
  }
  if (gmail && !gmail.endsWith("@gmail.com")) {
    toast("Please use a valid Gmail address.", "warning");
    return;
  }

  try {
    await apiRequest("register", { username, password });
    toast("Registration successful! Please log in.", "success");
    document.getElementById("registerForm").reset();
    showAuthTab("login");
    document.getElementById("loginIdentifier").value = username;
    await loadDatabaseData();
  } catch {}
}
async function handleLogin(e) {
  e.preventDefault();
  const identifier = document.getElementById("loginIdentifier").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!identifier || !password) {
    toast("Please enter username and password.", "warning");
    return;
  }

  try {
    const result = await apiRequest("login", {
      username: identifier,
      password,
    });
    currentUser = result.data;
    document.getElementById("authScreen").style.display = "none";
    document.getElementById("appContainer").style.display = "flex";
    document.getElementById("headerProfileName").innerText =
      currentUser.username;
    document.getElementById("headerAvatar").innerText = currentUser.username
      .charAt(0)
      .toUpperCase();
    document.getElementById("loginForm").reset();
    await loadDatabaseData();
  } catch {}
}

function handleLogout() {
  if (!confirm("Are you sure you want to log out?")) return;
  currentUser = null;
  document
    .querySelectorAll(".modal")
    .forEach((m) => (m.style.display = "none"));
  closeSidebar();
  document.getElementById("profileDropdown").classList.remove("open");
  document.getElementById("profileTrigger").classList.remove("open");
  document.getElementById("appContainer").style.display = "none";
  document.getElementById("authScreen").style.display = "flex";
  showAuthTab("login");
  document.getElementById("loginForm").reset();
  toast("You have been logged out.", "warning");
}

// --- TOAST NOTIFICATIONS ---
function toast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// --- SIDEBAR NAVIGATION ---
function isDesktop() {
  return window.innerWidth >= 901;
}

function toggleSidebar() {
  if (isDesktop()) {
    document.getElementById("sidebar").classList.toggle("collapsed");
    document.getElementById("mainWrapper").classList.toggle("expanded");
  } else {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("sidebarOverlay").classList.toggle("open");
  }
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("open");
}

function goHome() {
  document
    .querySelectorAll(".modal")
    .forEach((m) => (m.style.display = "none"));
  closeSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleProfileMenu() {
  document.getElementById("profileDropdown").classList.toggle("open");
  document.getElementById("profileTrigger").classList.toggle("open");
}

document.addEventListener("click", function (e) {
  const wrap = document.querySelector(".profile-wrap");
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById("profileDropdown").classList.remove("open");
    document.getElementById("profileTrigger").classList.remove("open");
  }
});

// --- REPORTS ---
function openReportsModal(tab) {
  document
    .querySelectorAll("#reportsModal .auth-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .getElementById("reportTab" + tab.charAt(0).toUpperCase() + tab.slice(1))
    .classList.add("active");

  const summaryBox = document.getElementById("reportSummaryBox");
  const list = document.getElementById("reportListDisplay");
  list.innerHTML = "";

  if (tab === "revenue") {
    const entries = transactions.filter((t) => t.type === "Receive");
    const total = entries.reduce((s, t) => s + t.amount, 0);
    summaryBox.innerHTML = `Total Revenue: <span style="color:var(--green);">৳${formatMoney(total)}</span>`;
    if (entries.length === 0) {
      list.innerHTML =
        '<p style="color:var(--steel); padding:5px;">No revenue bills recorded.</p>';
    } else {
      entries.forEach((t) => {
        const proj = projects.find((p) => p.id === t.projectId);
        list.innerHTML += `
                            <div class="transaction-log">
                                <b>Date:</b> ${formatDate(t.date)} | <b>Project:</b> ${proj ? proj.name : "Unknown"}<br>
                                <b>Purpose:</b> ${t.note} | <b>Amount:</b> <span style="color:var(--green); font-weight:700;">৳${formatMoney(t.amount)}</span>
                            </div>
                        `;
      });
    }
  } else if (tab === "expense") {
    const entries = transactions.filter((t) => t.type === "Pay");
    const total = entries.reduce((s, t) => s + t.amount, 0);
    summaryBox.innerHTML = `Total Expense: <span style="color:var(--red);">৳${formatMoney(total)}</span>`;
    if (entries.length === 0) {
      list.innerHTML =
        '<p style="color:var(--steel); padding:5px;">No expense bills recorded.</p>';
    } else {
      entries.forEach((t) => {
        const proj = projects.find((p) => p.id === t.projectId);
        list.innerHTML += `
                            <div class="transaction-log">
                                <b>Date:</b> ${formatDate(t.date)} | <b>Project:</b> ${proj ? proj.name : "Unknown"}<br>
                                <b>Purpose:</b> ${t.note} | <b>Amount:</b> <span style="color:var(--red); font-weight:700;">৳${formatMoney(t.amount)}</span>
                            </div>
                        `;
      });
    }
  } else {
    const totalReceived = transactions.reduce(
      (sum, t) => (t.type === "Receive" ? sum + t.amount : sum),
      0,
    );
    const totalPaid = transactions.reduce(
      (sum, t) => (t.type === "Pay" ? sum + t.amount : sum),
      0,
    );
    const net = totalReceived - totalPaid;
    summaryBox.innerHTML = `Net Profit: <span style="color:${net >= 0 ? "var(--green)" : "var(--red)"};">৳${formatMoney(net)}</span>`;
    if (projects.length === 0) {
      list.innerHTML =
        '<p style="color:var(--steel); padding:5px;">No projects added yet.</p>';
    } else {
      projects.forEach((p) => {
        const pNet = p.received - p.paid;
        const color = pNet >= 0 ? "var(--green)" : "var(--red)";
        list.innerHTML += `
                            <div class="transaction-log">
                                <b>${p.name}</b> <span style="color:var(--steel); font-size:11px;">(${p.status})</span><br>
                                Received: ৳${formatMoney(p.received)} &nbsp;|&nbsp; Paid: ৳${formatMoney(p.paid)}<br>
                                <b>Net:</b> <span style="color:${color}; font-weight:700;">৳${formatMoney(pNet)}</span>
                            </div>
                        `;
      });
    }
  }

  document.getElementById("reportsModal").style.display = "flex";
}

// --- SIMPLE FORMATTING HELPERS ---
function formatMoney(n) {
  n = Number(n) || 0;
  return n.toLocaleString("en-US");
}
function formatDate(d) {
  if (!d) return "N/A";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
}

function updateDashboard() {
  let totalReceived = transactions.reduce(
    (sum, t) => (t.type === "Receive" ? sum + t.amount : sum),
    0,
  );
  let totalPaid = transactions.reduce(
    (sum, t) => (t.type === "Pay" ? sum + t.amount : sum),
    0,
  );
  let completedCount = projects.filter((p) => p.status === "Completed").length;
  let runningCount = projects.filter((p) => p.status === "Running").length;
  let netProfit = totalReceived - totalPaid;

  document.getElementById("dash-receive").innerText =
    formatMoney(totalReceived);
  document.getElementById("dash-pay").innerText = formatMoney(totalPaid);
  document.getElementById("dash-complete-projects-count").innerText =
    completedCount;
  document.getElementById("dash-running-projects-count").innerText =
    runningCount;
  document.getElementById("dash-projects-count").innerText = projects.length;
  document.getElementById("dash-employees-count").innerText = employees.length;
  document.getElementById("dash-net-profit").innerText = formatMoney(netProfit);
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

// --- BILL TRANSACTIONS ---
function openTransactionModal(type, transId = null) {
  const running = projects.filter((p) => p.status === "Running");
  if (running.length === 0) {
    toast("Please add an active running project first.", "warning");
    return;
  }

  const dropdown = document.getElementById("transProject");
  dropdown.innerHTML = "";
  running.forEach((p) => {
    dropdown.innerHTML += `<option value="${p.id}">${p.name}</option>`;
  });

  let listType = type;

  if (transId) {
    const t = transactions.find((item) => item.id === transId);
    if (!t) return;
    document.getElementById("transId").value = t.id;
    document.getElementById("transType").value = t.type;
    document.getElementById("transDate").value = t.date;
    document.getElementById("transProject").value = t.projectId;
    document.getElementById("transPurposeNotes").value = t.note || "";
    document.getElementById("transAmount").value = t.amount;
    document.getElementById("transactionModalTitle").innerText =
      `Edit Bill ${t.type}`;
    document.getElementById("transactionCancelBtn").style.display =
      "inline-block";
    listType = t.type;
  } else {
    document.getElementById("transactionForm").reset();
    document.getElementById("transId").value = "";
    document.getElementById("transType").value = type;
    document.getElementById("transDate").valueAsDate = new Date();
    document.getElementById("transactionModalTitle").innerText = `Bill ${type}`;
    document.getElementById("transactionCancelBtn").style.display = "none";
  }

  activeTransactionListType = listType;
  document.getElementById("transactionHistoryTitle").innerText =
    listType === "Receive" ? "Bill Receive Records" : "Bill Pay Records";
  renderTransactionHistoryList(listType);

  document.getElementById("transactionModal").style.display = "flex";
}

function cancelTransactionEdit() {
  openTransactionModal(activeTransactionListType, null);
}

function renderTransactionHistoryList(type) {
  const container = document.getElementById("transactionHistoryList");
  if (!container) return;

  const entries = transactions
    .filter((t) => t.type === type)
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.id - a.id);

  if (entries.length === 0) {
    container.innerHTML = `<p style="color:var(--steel); padding:5px; font-size:12px;">No ${type === "Receive" ? "bill receive" : "bill pay"} records yet.</p>`;
    return;
  }

  const amountColor = type === "Receive" ? "var(--green)" : "var(--red)";

  container.innerHTML = entries
    .map((t) => {
      const proj = projects.find((p) => p.id === t.projectId);
      return `
                    <div class="transaction-log">
                        <b>Date:</b> ${formatDate(t.date)} | <b>Project:</b> ${proj ? proj.name : "Unknown"}<br>
                        <b>Purpose:</b> ${t.note || "N/A"} | <b>Amount:</b> <span style="color:${amountColor}; font-weight:700;">৳${formatMoney(t.amount)}</span>
                        <div class="actions-right">
                            <button type="button" class="action-btn edit-btn" onclick="openTransactionModal(null, ${t.id})">Edit</button>
                            <button type="button" class="action-btn delete-btn" onclick="deleteTransaction(${t.id})">Delete</button>
                        </div>
                    </div>
                `;
    })
    .join("");
}

// ============================================================
// TRANSACTION FORM → main.php → transactions table
// ============================================================
document
  .getElementById("transactionForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    const id = document.getElementById("transId").value;
    const type = document.getElementById("transType").value;
    const projectId = parseInt(document.getElementById("transProject").value);
    const note = document.getElementById("transPurposeNotes").value.trim();
    const amount = parseFloat(document.getElementById("transAmount").value);
    const date = document.getElementById("transDate").value;

    const savedNote = note || "Bill entry";

    if (!projectId || !type || !amount || !date) {
      toast("Please complete the transaction information.", "warning");
      return;
    }

    try {
      const result = await apiRequest("save_transaction", {
        ...(id ? { id } : {}),
        project_id: projectId,
        type,
        amount,
        note: savedNote,
        date,
      });

      if (id) {
        const old = transactions.find((t) => t.id === Number(id));
        if (old)
          Object.assign(old, {
            projectId,
            type,
            amount,
            note: savedNote,
            date,
          });
      } else {
        transactions.push({
          id: Number(result.data.id),
          projectId,
          type,
          amount,
          note: savedNote,
          date,
        });
      }
      rebuildProjectTotals();
      updateDashboard();
      toast(id ? "Bill updated." : "Bill saved.", "success");

      // Keep the modal open so the person can keep editing/deleting
      // bill records, but reset back to a fresh "add" form and
      // refresh the list underneath so the change is visible.
      openTransactionModal(type, null);

      if (document.getElementById("perProjectModal").style.display === "flex")
        openPerProjectIncomeModal();
    } catch {}
  });
async function deleteTransaction(transId) {
  if (!confirm("Are you sure you want to delete this bill record?")) return;
  try {
    await apiRequest("delete_transaction", { id: transId });
    transactions = transactions.filter((t) => t.id !== transId);
    rebuildProjectTotals();
    updateDashboard();

    const transactionModalOpen =
      document.getElementById("transactionModal").style.display === "flex";
    const detailsOpen =
      document.getElementById("detailsModal").style.display === "flex";
    const perProjectOpen =
      document.getElementById("perProjectModal").style.display === "flex";

    if (transactionModalOpen)
      renderTransactionHistoryList(activeTransactionListType);
    if (detailsOpen) closeModal("detailsModal");
    if (perProjectOpen || detailsOpen) openPerProjectIncomeModal();

    toast("Bill record removed.", "warning");
  } catch {}
}

// --- PROJECTS MANAGEMENT ---
function openPerProjectIncomeModal() {
  const list = document.getElementById("projectList");
  list.innerHTML = "";

  if (projects.length === 0) {
    list.innerHTML =
      '<li style="color:var(--steel); display:block; padding:14px 4px;">No projects added yet. Click "+ Add Project" to create one.</li>';
  }

  projects.forEach((p) => {
    let profitLoss = p.received - p.paid;
    let statusColor = p.status === "Running" ? "var(--green)" : "var(--steel)";
    list.innerHTML += `
                    <li style="align-items:flex-start;">
                        <div>
                            <span class="clickable-item" onclick="viewProjectDetails(${p.id})">${p.name}</span>
                            <br><small style="color:var(--steel); font-size:12px;">${getClient(p)?.name || "No customer"} • ${p.workType || "N/A"} • ${p.location || "No location"}</small>
                            <br><small style="color:#fff; background:var(--ink); padding:2px 8px; border-radius:4px; display:inline-block; margin-top:5px; font-family:var(--font-mono); font-size:11px;">Balance: ৳${formatMoney(profitLoss)}</small>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size:11px; font-weight:700; color:#fff; padding: 3px 8px; background:${statusColor}; border-radius:20px;">${p.status}</span>
                            ${p.status === "Running" ? `<button class="action-btn complete-btn" onclick="markProjectAsDone(${p.id})">Mark Complete</button>` : ""}
                            <button class="action-btn edit-btn" onclick="closeModal('perProjectModal'); editProject(${p.id})">Edit</button>
                            <button class="action-btn delete-btn" onclick="deleteProject(${p.id})">Delete</button>
                        </div>
                    </li>
                `;
  });

  document.getElementById("perProjectModal").style.display = "flex";
}

function openAddProjectModal() {
  cancelProjectEdit();
  populateClientDropdown();
  document.getElementById("addProjectModal").style.display = "flex";
}

// ==================== CLIENT DROPDOWN HELPERS ====================
function populateClientDropdown(selectedId = "") {
  const select = document.getElementById("clientId");
  if (!select) return;

  const previous = selectedId !== "" ? String(selectedId) : select.value;
  select.innerHTML = '<option value="">Select Client</option>';
  clients.forEach((client) => {
    select.innerHTML += `<option value="${client.id}">${client.name} — ${client.contact || "No contact"}</option>`;
  });
  if (previous) select.value = previous;
}

// ==================== SAVE PROJECT ====================
// The project form now uses only the fields needed by our UI:
// Project Name, Work Type, Client, Budget, Location and Date.
// There is NO Project Manager field anymore.

async function saveProject(e) {
  e.preventDefault();

  const name = document.getElementById("projName").value.trim();
  const workType = document.getElementById("projWorkType").value;
  const clientId = parseInt(document.getElementById("clientId").value);
  const location = document.getElementById("projLocation").value.trim();
  const budget =
    parseFloat(document.getElementById("projTotalCost").value) || 0;
  const date = document.getElementById("projDate").value;

  if (!name || !clientId || !location || !date) {
    toast("Please complete the project information.", "warning");
    return;
  }

  const editId = document.getElementById("editProjectId").value;
  const oldProject = editId
    ? projects.find((p) => p.id === parseInt(editId))
    : null;
  const status = oldProject ? oldProject.status : "Running";

  try {
    const result = await apiRequest(editId ? "update_project" : "add_project", {
      ...(editId ? { id: editId } : {}),
      name,
      budget,
      location,
      status,
      client_id: clientId,
    });

    if (editId && oldProject) {
      oldProject.name = name;
      oldProject.clientId = clientId;
      oldProject.location = location;
      oldProject.budget = budget;
      oldProject.workType = workType;
      oldProject.date = date;
    } else {
      projects.push({
        id: Number(result.data.id),
        name,
        status,
        received: 0,
        paid: 0,
        clientId,
        workType,
        location,
        budget,
        date,
      });
    }

    updateDashboard();
    populateClientDropdown();
    toast(editId ? "Project updated." : "Project added.", "success");
    closeModal("addProjectModal");
    openPerProjectIncomeModal();
  } catch {}
}

function getClient(project) {
  if (!project) return null;
  return clients.find((c) => c.id === Number(project.clientId)) || null;
}

function getProjectEmployees(projectId) {
  const ids = teamAssignments[projectId] || [];
  return employees.filter((emp) => ids.includes(emp.id));
}

function editProject(id) {
  const p = projects.find((item) => item.id === id);
  if (!p) return;

  const client = getClient(p);
  document.getElementById("editProjectId").value = p.id;
  document.getElementById("projName").value = p.name;
  document.getElementById("projWorkType").value = p.workType || "Road";
  populateClientDropdown(p.clientId || "");
  document.getElementById("projLocation").value = p.location || "";
  document.getElementById("projTotalCost").value = p.budget || 0;
  document.getElementById("projDate").value = p.date || "";
  document.getElementById("projectFormTitle").innerText =
    "Edit Project Details";
  document.getElementById("projectSubmitBtn").innerText = "Update Project";
  document.getElementById("projectCancelBtn").style.display = "inline-block";
  document.getElementById("addProjectModal").style.display = "flex";
}

function cancelProjectEdit() {
  document.getElementById("projectForm").reset();
  document.getElementById("editProjectId").value = "";
  document.getElementById("projDate").valueAsDate = new Date();
  document.getElementById("projectFormTitle").innerText = "Add New Project";
  document.getElementById("projectSubmitBtn").innerText = "Add Project";
  document.getElementById("projectCancelBtn").style.display = "none";
}
async function deleteProject(id) {
  if (
    !confirm(
      "Deleting this project will clean up linked assignments and transactions. Proceed?",
    )
  )
    return;
  try {
    await apiRequest("delete_project", { id });
    projects = projects.filter((p) => p.id !== id);
    delete teamAssignments[id];
    transactions = transactions.filter((t) => t.projectId !== id);
    rebuildProjectTotals();
    updateDashboard();
    closeModal("perProjectModal");
    toast("Project deleted.", "warning");
  } catch {}
}

function viewProjectDetails(id) {
  const project = projects.find((p) => p.id === id);
  if (!project) return;

  const client = getClient(project);
  const assignedEmployees = getProjectEmployees(id);

  document.getElementById("detailsProjectName").innerText = project.name;
  document.getElementById("detailsStatus").innerText =
    `Current Status: ${project.status}`;

  const employeeText = assignedEmployees.length
    ? assignedEmployees.map((e) => e.name).join(", ")
    : "No employees assigned";

  document.getElementById("detailsInfo").innerHTML = `
                <b>Client:</b> ${client?.name || "N/A"} &nbsp;|&nbsp; <b>Phone:</b> ${client?.contact || "N/A"}<br>
                <b>Address:</b> ${client?.address || "N/A"}<br>
                <b>Project Location:</b> ${project.location || "N/A"} &nbsp;|&nbsp; <b>Work Type:</b> ${project.workType || "N/A"}<br>
                <b>Budget:</b> ৳${formatMoney(project.budget)} &nbsp;|&nbsp; <b>Date:</b> ${formatDate(project.date)}<br>
                <b>Employees:</b> ${employeeText}
            `;

  document.getElementById("detailsEditProjectBtn").onclick = function () {
    closeModal("detailsModal");
    editProject(id);
  };

  const profitLoss = project.received - project.paid;
  const balanceColor = profitLoss >= 0 ? "var(--green)" : "var(--red)";
  document.getElementById("detailsCalculations").innerHTML = `
                Total Received: ৳${formatMoney(project.received)}<br>
                Total Paid: ৳${formatMoney(project.paid)}<br>
                <strong style="color:${balanceColor};">Net Balance: ৳${formatMoney(profitLoss)} (${profitLoss >= 0 ? "Profit" : "Loss"})</strong>
            `;

  const historyDiv = document.getElementById("detailsHistory");
  historyDiv.innerHTML = "";
  const filteredTrans = transactions.filter((t) => t.projectId === id);

  if (filteredTrans.length === 0) {
    historyDiv.innerHTML =
      '<p style="color:var(--steel); padding: 5px;">No transactions reported.</p>';
  } else {
    filteredTrans.forEach((t) => {
      historyDiv.innerHTML += `
                        <div class="transaction-log">
                            <b>Date:</b> ${formatDate(t.date)} | <b>Type:</b> ${t.type} | <b>Amount:</b> ৳${formatMoney(t.amount)} <br>
                            <b>Purpose Details:</b> ${t.note}
                            <div class="actions-right">
                                <button class="action-btn edit-btn" onclick="closeModal('detailsModal'); openTransactionModal(null, ${t.id})">Edit</button>
                                <button class="action-btn delete-btn" onclick="deleteTransaction(${t.id})">Delete</button>
                            </div>
                        </div>
                    `;
    });
  }

  const doneContainer = document.getElementById("projectDoneContainer");
  if (project.status === "Running") {
    doneContainer.innerHTML = `<button class="project-done-btn" onclick="markProjectAsDone(${id})">Project Done (Mark as Complete)</button>`;
  } else {
    doneContainer.innerHTML =
      '<p style="color: var(--green); font-weight: 700; margin-top:15px; text-align:center;">✓ Project Completed</p>';
  }

  document.getElementById("detailsModal").style.display = "flex";
}
async function markProjectAsDone(id) {
  const project = projects.find((p) => p.id === id);
  if (!project || project.status === "Completed") return;
  if (
    !confirm(
      `Mark "${project.name}" as completed? It will move to the Completed Projects list on the dashboard.`,
    )
  )
    return;
  try {
    await apiRequest("complete_project", { id });
    project.status = "Completed";
    updateDashboard();
    toast("Project marked as completed.", "success");
    if (document.getElementById("perProjectModal").style.display === "flex")
      openPerProjectIncomeModal();
  } catch {}
}

function openTotalCompleteProjectModal() {
  let completedCount = projects.filter((p) => p.status === "Completed").length;
  document.getElementById("modalCompleteProjectsCount").innerText =
    completedCount;

  const list = document.getElementById("completedProjectsList");
  list.innerHTML = "";
  const completed = projects.filter((p) => p.status === "Completed");

  if (completed.length === 0) {
    list.innerHTML =
      '<li style="color:var(--steel);">No completed projects recorded.</li>';
  } else {
    completed.forEach((p) => {
      let net = p.received - p.paid;
      let netColor = net >= 0 ? "var(--green)" : "var(--red)";

      let projectBills = transactions.filter((t) => t.projectId === p.id);
      let billsHtml = "";

      if (projectBills.length === 0) {
        billsHtml =
          '<p style="color:var(--steel); font-size:12px; margin-top:5px;">No bills recorded.</p>';
      } else {
        projectBills.forEach((b) => {
          let badge =
            b.type === "Receive"
              ? '<span class="bill-badge-receive">RECEIVE</span>'
              : '<span class="bill-badge-pay">PAY</span>';
          billsHtml += `
                                <div style="font-size:12px; border-bottom:1px solid var(--border); padding:8px 0; display:flex; justify-content:space-between; align-items:center;">
                                    <span>${badge} <small>${formatDate(b.date)}</small> - ${b.note}</span>
                                    <strong style="color:var(--ink); font-family:var(--font-mono);">৳${formatMoney(b.amount)}</strong>
                                </div>
                            `;
        });
      }

      list.innerHTML += `
                        <li style="display:block; border-bottom:1px solid var(--border); padding:15px 10px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleCompletedProjectBills(${p.id})">
                                <span style="font-weight:700; color:var(--blue); border-bottom:1px dashed var(--blue);">${p.name} ▾</span>
                                <span style="font-weight:700; font-family:var(--font-mono); color:${netColor};">
                                    Balance: ${net >= 0 ? "+" : ""}৳${formatMoney(net)}
                                </span>
                            </div>
                            <div id="completed-project-bills-${p.id}" class="bill-breakdown-box">
                                <h5 style="margin-bottom:8px; color:var(--steel); font-size:11px; text-transform:uppercase; letter-spacing:.5px;">Statement Logs:</h5>
                                ${billsHtml}
                            </div>
                        </li>
                    `;
    });
  }
  document.getElementById("totalCompleteProjectModal").style.display = "flex";
}

function toggleCompletedProjectBills(projectId) {
  const container = document.getElementById(
    `completed-project-bills-${projectId}`,
  );
  if (container.style.display === "block") {
    container.style.display = "none";
  } else {
    container.style.display = "block";
  }
}

// ==================== CLIENT MANAGEMENT ====================
function openClientModal(showFormFirst = false) {
  renderClientList();
  resetClientForm();
  document.getElementById("clientModal").style.display = "flex";
}

function resetClientForm() {
  const form = document.getElementById("clientForm");
  if (form) form.reset();
  const id = document.getElementById("editClientId");
  if (id) id.value = "";
  const btn = document.getElementById("clientSubmitBtn");
  if (btn) btn.innerText = "Add Client";
}
async function saveClient(event) {
  event.preventDefault();
  const id = document.getElementById("editClientId").value;
  const name = document.getElementById("clientName").value.trim();
  const contact = document.getElementById("clientPhone").value.trim();
  const address = document.getElementById("clientAddress").value.trim();
  const email = document.getElementById("clientEmail").value.trim();

  if (!name || !contact || !address) {
    toast("Please complete the client information.", "warning");
    return;
  }

  try {
    const result = await apiRequest(id ? "update_client" : "add_client", {
      ...(id ? { id } : {}),
      name,
      contact,
      address,
      email,
    });
    if (id) {
      const client = clients.find((c) => c.id === Number(id));
      if (client) Object.assign(client, { name, contact, address, email });
    } else {
      clients.push({
        id: Number(result.data.id),
        name,
        contact,
        address,
        email,
      });
    }
    populateClientDropdown();
    resetClientForm();
    renderClientList();
    toast(id ? "Client updated." : "Client added.", "success");
  } catch {}
}

function editClient(id) {
  const client = clients.find((c) => c.id === id);
  if (!client) return;
  document.getElementById("editClientId").value = client.id;
  document.getElementById("clientName").value = client.name || "";
  document.getElementById("clientPhone").value = client.contact || "";
  document.getElementById("clientAddress").value = client.address || "";
  document.getElementById("clientEmail").value = client.email || "";
  document.getElementById("clientSubmitBtn").innerText = "Update Client";
}
async function deleteClient(id) {
  const linkedProjects = projects.filter(
    (p) => Number(p.clientId) === Number(id),
  );
  if (linkedProjects.length) {
    toast(
      `Cannot delete this client. ${linkedProjects.length} project(s) are linked to it.`,
      "warning",
    );
    return;
  }
  if (!confirm("Are you sure you want to remove this client?")) return;
  try {
    await apiRequest("delete_client", { id });
    clients = clients.filter((c) => c.id !== id);
    populateClientDropdown();
    renderClientList();
    toast("Client removed.", "warning");
  } catch {}
}

function renderClientList() {
  const displayDiv = document.getElementById("clientListDisplay");
  if (!displayDiv) return;
  displayDiv.innerHTML = "";

  if (clients.length === 0) {
    displayDiv.innerHTML =
      '<p style="color:var(--steel); padding:5px;">No client records stored yet.</p>';
    return;
  }

  clients.forEach((client) => {
    const projectCount = projects.filter(
      (p) => Number(p.clientId) === Number(client.id),
    ).length;
    displayDiv.innerHTML += `
                    <div class="employee-details">
                        <strong>Name:</strong> ${client.name} | <strong>Phone:</strong> ${client.contact || "N/A"}<br>
                        <b>Address:</b> ${client.address || "N/A"} | <b>Email:</b> ${client.email || "N/A"}<br>
                        <span style="color:var(--blue); font-weight:700;">Projects: ${projectCount}</span>
                        <div class="actions-right">
                            <button class="action-btn edit-btn" onclick="editClient(${client.id})">Edit</button>
                            <button class="action-btn delete-btn" onclick="deleteClient(${client.id})">Remove</button>
                        </div>
                    </div>
                `;
  });
}

// --- EMPLOYEE MANAGEMENT ---
function openEmployeeModal(showFormFirst = false) {
  renderEmployeeList();
  resetEmployeeForm();
  document.getElementById("employeeModal").style.display = "flex";
}

function resetEmployeeForm() {
  document.getElementById("employeeForm").reset();
  document.getElementById("editEmpId").value = "";
  document.getElementById("employeeFormTitle").innerText = "Add New Employee";
  document.getElementById("employeeSubmitBtn").innerText = "Submit Data";
}
async function saveEmployee(event) {
  event.preventDefault();
  const id = document.getElementById("editEmpId").value;
  const name = document.getElementById("empName").value.trim();
  const phone = document.getElementById("empPhone").value.trim();
  const post = document.getElementById("empPost").value;
  const salary = parseFloat(document.getElementById("empSalary").value) || 0;
  const addressField = document.getElementById("empAddress");
  const address = addressField ? addressField.value.trim() : "";

  if (!name || !phone || !post) {
    toast("Please complete the employee information.", "warning");
    return;
  }

  try {
    const result = await apiRequest(id ? "update_employee" : "add_employee", {
      ...(id ? { id } : {}),
      name,
      post,
      contact: phone,
      address,
      salary,
    });
    if (id) {
      const emp = employees.find((e) => e.id === Number(id));
      if (emp) Object.assign(emp, { name, phone, post, salary, address });
    } else {
      employees.push({
        id: Number(result.data.id),
        name,
        phone,
        post,
        salary,
        address,
        salaryType: "Monthly",
      });
    }
    resetEmployeeForm();
    renderEmployeeList();
    updateDashboard();
    toast(id ? "Employee updated." : "Employee added.", "success");
  } catch {}
}

function editEmployee(id) {
  const emp = employees.find((e) => e.id === id);
  if (!emp) return;
  document.getElementById("editEmpId").value = emp.id;
  document.getElementById("empName").value = emp.name;
  document.getElementById("empPhone").value = emp.phone ? emp.phone : "";
  document.getElementById("empPost").value = emp.post;
  document.getElementById("empSalaryType").value = emp.salaryType
    ? emp.salaryType
    : "Monthly";
  document.getElementById("empSalary").value = emp.salary;
  const addressField = document.getElementById("empAddress");
  if (addressField) addressField.value = emp.address || "";

  document.getElementById("employeeFormTitle").innerText =
    "Edit Employee Details";
  document.getElementById("employeeSubmitBtn").innerText = "Update Data";
}
async function deleteEmployee(id) {
  if (!confirm("Are you sure you want to remove this employee?")) return;
  try {
    await apiRequest("delete_employee", { id });
    employees = employees.filter((e) => e.id !== id);
    for (const projectId in teamAssignments) {
      teamAssignments[projectId] = (teamAssignments[projectId] || []).filter(
        (empId) => Number(empId) !== Number(id),
      );
    }
    renderEmployeeList();
    updateDashboard();
    toast("Employee removed.", "warning");
  } catch {}
}

function getAssignedProjectIds(empId) {
  const assigned = [];
  for (const projId in teamAssignments) {
    if ((teamAssignments[projId] || []).map(Number).includes(Number(empId))) {
      assigned.push(Number(projId));
    }
  }
  return assigned;
}

function getAssignedProjectName(empId) {
  const assignedProjects = getAssignedProjectIds(empId)
    .map((projId) => projects.find((p) => Number(p.id) === projId))
    .filter(Boolean)
    .map((p) => p.name);
  return assignedProjects.length
    ? assignedProjects.join(", ")
    : "Unassigned / No Project";
}

// Final ERD M:N relationship: Project <-> Employee.
// Each checkbox updates the junction map immediately.
async function toggleEmployeeProject(employeeId, projectId, checked) {
  employeeId = Number(employeeId);
  projectId = Number(projectId);
  try {
    if (checked) {
      await apiRequest("assign_employee", {
        project_id: projectId,
        employee_id: employeeId,
      });
      if (!teamAssignments[projectId]) teamAssignments[projectId] = [];
      if (!teamAssignments[projectId].map(Number).includes(employeeId)) {
        teamAssignments[projectId].push(employeeId);
      }
    } else {
      await apiRequest("remove_employee", {
        project_id: projectId,
        employee_id: employeeId,
      });
      if (teamAssignments[projectId]) {
        teamAssignments[projectId] = teamAssignments[projectId].filter(
          (id) => Number(id) !== employeeId,
        );
      }
    }
    renderEmployeeList();
  } catch (error) {
    renderEmployeeList();
  }
}

function renderEmployeeList() {
  const displayDiv = document.getElementById("employeeListDisplay");
  if (!displayDiv) return;
  displayDiv.innerHTML = "";

  if (employees.length === 0) {
    displayDiv.innerHTML =
      '<p style="color:var(--steel); padding: 5px;">No employee records stored yet.</p>';
    return;
  }

  employees.forEach((emp) => {
    const assignedIds = getAssignedProjectIds(emp.id);
    const projectOptions = projects.length
      ? projects
          .map(
            (project) => `
                        <label style="display:block; margin:6px 0; cursor:pointer;">
                            <input type="checkbox"
                                   ${assignedIds.includes(Number(project.id)) ? "checked" : ""}
                                   onchange="toggleEmployeeProject(${emp.id}, ${project.id}, this.checked)">
                            ${project.name} <small style="color:var(--steel);">(${project.status})</small>
                        </label>
                      `,
          )
          .join("")
      : '<small style="color:var(--steel);">No projects available.</small>';

    displayDiv.innerHTML += `
                    <div class="employee-details" style="margin-bottom:12px;">
                        <strong>Name:</strong> ${emp.name} | <strong>Phone:</strong> ${emp.phone || "N/A"}<br>
                        <b>Address:</b> ${emp.address || "N/A"}<br>
                        <b>Post:</b> ${emp.post} | <b>Salary:</b> ৳${formatMoney(emp.salary)} (${emp.salaryType || "Monthly"})<br>
                        <span style="color:var(--blue); font-weight:700;">Project Assigned: ${getAssignedProjectName(emp.id)}</span>

                        <details style="margin-top:10px;">
                            <summary style="cursor:pointer; font-weight:700; color:var(--blue);">Assign / Manage Projects</summary>
                            <div style="margin-top:8px; padding:8px 10px; border:1px solid var(--steel); border-radius:6px;">
                                ${projectOptions}
                            </div>
                        </details>

                        <div class="actions-right">
                            <button class="action-btn edit-btn" onclick="editEmployee(${emp.id})">Edit</button>
                            <button class="action-btn delete-btn" onclick="deleteEmployee(${emp.id})">Remove</button>
                        </div>
                    </div>
                `;
  });
}

// Initial dropdown population (script is loaded at the end of the HTML body).
// Database data is loaded after successful login.

// --- ESCAPE KEY CLOSES OPEN MODAL / SIDEBAR ---
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal").forEach((m) => {
      if (m.style.display === "flex") m.style.display = "none";
    });
    closeSidebar();
  }
});

updateDashboard();
