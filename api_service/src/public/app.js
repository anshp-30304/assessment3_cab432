// Configuration
const API_BASE_URL = "https://n11857374.cab432.com"; // Your API domain
let currentUser = null;
let authToken = null;
let websocket = null;
let currentFiles = [];
let reportPollingInterval = null;

// Initialize app
document.addEventListener("DOMContentLoaded", function () {
  // Check if user is already logged in
  const savedToken = localStorage.getItem("authToken");
  const savedUser = localStorage.getItem("currentUser");

  if (savedToken && savedUser) {
    authToken = savedToken;
    currentUser = JSON.parse(savedUser);
    showAppSection();
  }
});

// Utility functions
function showAlert(message, type = "info", container = "alertContainer") {
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;

  const containerEl = document.getElementById(container);
  containerEl.innerHTML = "";
  containerEl.appendChild(alertDiv);

  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.parentNode.removeChild(alertDiv);
    }
  }, 5000);
}

function makeApiRequest(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (authToken) {
    options.headers["Authorization"] = `Bearer ${authToken}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  return fetch(`${API_BASE_URL}${endpoint}`, options);
}

// Authentication functions
function switchAuthTab(tab) {
  // Update tabs
  document
    .querySelectorAll(".auth-tab")
    .forEach((t) => t.classList.remove("active"));
  event.target.classList.add("active");

  // Show correct form
  document
    .querySelectorAll(".auth-form")
    .forEach((f) => (f.style.display = "none"));
  document.getElementById(`${tab}Form`).style.display = "block";
}

async function register() {
  const username = document.getElementById("registerUsername").value;
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;

  if (!username || !email || !password) {
    showAlert("Please fill in all fields", "error");
    return;
  }

  try {
    const response = await makeApiRequest("/api/auth/register", "POST", {
      username,
      email,
      password,
    });

    const data = await response.json();

    if (response.ok) {
      showAlert(
        "Registration successful! Check your email for confirmation code.",
        "success"
      );
      switchAuthTab("confirm");
      document.getElementById("confirmUsername").value = username;
    } else {
      showAlert(data.error || "Registration failed", "error");
    }
  } catch (error) {
    showAlert("Registration failed: " + error.message, "error");
  }
}

async function confirmRegistration() {
  const username = document.getElementById("confirmUsername").value;
  const code = document.getElementById("confirmationCode").value;

  if (!username || !code) {
    showAlert("Please fill in all fields", "error");
    return;
  }

  try {
    const response = await makeApiRequest("/api/auth/confirm", "POST", {
      username,
      code,
    });

    const data = await response.json();

    if (response.ok) {
      showAlert(
        "Email confirmed successfully! You can now log in.",
        "success"
      );
      switchAuthTab("login");
      document.getElementById("loginUsername").value = username;
    } else {
      showAlert(data.error || "Confirmation failed", "error");
    }
  } catch (error) {
    showAlert("Confirmation failed: " + error.message, "error");
  }
}

async function login() {
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) {
    showAlert("Please fill in all fields", "error");
    return;
  }

  try {
    const response = await makeApiRequest("/api/auth/login", "POST", {
      username,
      password,
    });

    const data = await response.json();

    if (response.ok) {
      authToken = data.token;
      currentUser = data.user;

      // Save to localStorage
      localStorage.setItem("authToken", authToken);
      localStorage.setItem("currentUser", JSON.stringify(currentUser));

      showAlert("Login successful!", "success");
      showAppSection();
    } else {
      showAlert(data.error || "Login failed", "error");
    }
  } catch (error) {
    showAlert("Login failed: " + error.message, "error");
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem("authToken");
  localStorage.removeItem("currentUser");

  if (websocket) {
    websocket.close();
  }

  document.getElementById("authSection").classList.add("active");
  document.getElementById("appSection").classList.remove("active");

  showAlert("Logged out successfully", "info");
}

function showAppSection() {
  document.getElementById("authSection").classList.remove("active");
  document.getElementById("appSection").classList.add("active");

  // Show user info
  document.getElementById("userInfo").innerHTML = `
    <h3>👤 Welcome, ${currentUser.username}!</h3>
    <p><strong>Email:</strong> ${currentUser.email || "N/A"}</p>
    <p><strong>User ID:</strong> ${currentUser.userId}</p>
  `;

  // Load tasks and start monitoring
  loadTasks();
  loadUserFiles();
  loadRecentReports();
  startWorkerMonitoring();
  connectWebSocket();
}

// ==================== REPORT GENERATION ====================

async function generateReport() {
  const generateBtn = event ? event.target : document.querySelector('button[onclick="generateReport()"]');
  
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ Generating...';
  }

  try {
    const response = await makeApiRequest(
      "/api/reports/generate",
      "POST",
      {
        reportType: "summary",
      }
    );

    const data = await response.json();

    if (response.ok) {
      showAlert(
        `✅ Report queued successfully! Request ID: ${data.requestId}`,
        "success"
      );
      
      // Start polling for report status
      startReportPolling(data.requestId);
      
      // Refresh reports list
      setTimeout(() => loadRecentReports(), 2000);
    } else {
      showAlert(data.error || "Failed to generate report", "error");
    }
  } catch (error) {
    showAlert("Failed to generate report: " + error.message, "error");
  } finally {
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = '📊 Generate Report';
    }
  }
}

async function loadRecentReports() {
  try {
    const response = await makeApiRequest("/api/reports");
    
    if (response.ok) {
      const data = await response.json();
      displayReports(data.reports || []);
    }
  } catch (error) {
    console.error("Failed to load reports:", error);
  }
}

function displayReports(reports) {
  const reportsListDiv = document.getElementById("reportsList");
  
  if (!reports || reports.length === 0) {
    reportsListDiv.innerHTML = '<p class="text-muted">No reports generated yet</p>';
    return;
  }

  reportsListDiv.innerHTML = reports.map(report => `
    <div class="report-item">
      <div class="report-header">
        <h4>📄 ${report.reportType || 'Task Report'}</h4>
        <span class="report-badge status-${report.status}">${report.status}</span>
      </div>
      <div class="report-meta">
        <small>🆔 ${report.reportId}</small><br>
        <small>📅 ${new Date(report.createdAt).toLocaleString()}</small>
      </div>
      ${report.status === 'completed' ? `
        <div class="report-actions">
          <button class="btn btn-small" onclick="downloadReport('${report.reportId}', '${report.s3Key}')">
            ⬇️ Download PDF
          </button>
        </div>
      ` : report.status === 'processing' ? `
        <div class="report-status">
          <div class="loading-spinner"></div>
          <small>Processing...</small>
        </div>
      ` : report.status === 'failed' ? `
        <div class="report-error">
          <small>❌ Generation failed</small>
        </div>
      ` : ''}
    </div>
  `).join('');
}

function startReportPolling(requestId) {
  let attempts = 0;
  const maxAttempts = 60; // 2 minutes max

  if (reportPollingInterval) {
    clearInterval(reportPollingInterval);
  }

  reportPollingInterval = setInterval(async () => {
    attempts++;

    if (attempts >= maxAttempts) {
      clearInterval(reportPollingInterval);
      console.log('Max polling attempts reached');
      return;
    }

    try {
      const response = await makeApiRequest(`/api/reports/status/${requestId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'completed') {
          clearInterval(reportPollingInterval);
          showAlert('✅ Report generated successfully!', 'success');
          loadRecentReports();
        } else if (data.status === 'failed') {
          clearInterval(reportPollingInterval);
          showAlert('❌ Report generation failed', 'error');
          loadRecentReports();
        }
      }
    } catch (error) {
      console.error('Error polling report status:', error);
    }
  }, 2000); // Poll every 2 seconds
}

async function downloadReport(reportId, s3Key) {
  try {
    const response = await makeApiRequest(`/api/reports/${reportId}/download`);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.downloadUrl) {
        // Open download URL in new tab
        window.open(data.downloadUrl, '_blank');
        showAlert('✅ Download started!', 'success');
      } else {
        showAlert('❌ Download URL not available', 'error');
      }
    } else {
      showAlert('Failed to get download URL', 'error');
    }
  } catch (error) {
    showAlert('Failed to download report: ' + error.message, 'error');
  }
}

// ==================== WORKER MONITORING ====================

let workerStatusInterval = null;

function startWorkerMonitoring() {
  // Initial load
  updateWorkerStatus();
  
  // Update every 5 seconds
  workerStatusInterval = setInterval(updateWorkerStatus, 5000);
}

async function updateWorkerStatus() {
  try {
    const response = await makeApiRequest("/api/health");
    
    if (response.ok) {
      const data = await response.json();
      displayWorkerStatus(data);
    }
  } catch (error) {
    console.error("Failed to fetch worker status:", error);
  }
}

function displayWorkerStatus(healthData) {
  const workerStatusDiv = document.getElementById("workerStatus");
  
  if (!workerStatusDiv) return;

  const sqsEnabled = healthData.features && healthData.features.sqs;
  
  workerStatusDiv.innerHTML = `
    <div class="worker-status-card">
      <h4>⚙️ System Status</h4>
      <div class="status-grid">
        <div class="status-item">
          <span class="status-label">API Server:</span>
          <span class="status-badge status-online">✅ Online</span>
        </div>
        <div class="status-item">
          <span class="status-label">SQS Queue:</span>
          <span class="status-badge ${sqsEnabled ? 'status-online' : 'status-offline'}">
            ${sqsEnabled ? '✅ Connected' : '❌ Disconnected'}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">Worker Service:</span>
          <span class="status-badge ${sqsEnabled ? 'status-online' : 'status-offline'}">
            ${sqsEnabled ? '✅ Active' : '⚠️ Inactive'}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">S3 Storage:</span>
          <span class="status-badge status-online">✅ Available</span>
        </div>
      </div>
      <div class="status-timestamp">
        Last updated: ${new Date().toLocaleTimeString()}
      </div>
    </div>
  `;
}

// ==================== TASK FUNCTIONS ====================

async function createTask() {
  const title = document.getElementById("taskTitle").value;
  const description = document.getElementById("taskDescription").value;
  const priority = document.getElementById("taskPriority").value;
  const status = document.getElementById("taskStatus").value;

  if (!title || !description) {
    showAlert("Please fill in title and description", "error", "taskAlertContainer");
    return;
  }

  try {
    const response = await makeApiRequest("/api/tasks", "POST", {
      title,
      description,
      priority,
      status,
    });

    const data = await response.json();

    if (response.ok) {
      showAlert("Task created successfully!", "success", "taskAlertContainer");
      
      // Clear form
      document.getElementById("taskTitle").value = "";
      document.getElementById("taskDescription").value = "";
      document.getElementById("taskPriority").value = "medium";
      document.getElementById("taskStatus").value = "todo";

      // Reload tasks
      loadTasks();
    } else {
      showAlert(data.error || "Failed to create task", "error", "taskAlertContainer");
    }
  } catch (error) {
    showAlert("Failed to create task: " + error.message, "error", "taskAlertContainer");
  }
}

async function loadTasks() {
  const container = document.getElementById("tasksContainer");
  container.innerHTML = '<div class="loading">Loading tasks...</div>';

  try {
    const response = await makeApiRequest("/api/tasks");
    const data = await response.json();

    if (response.ok) {
      displayTasks(data.tasks);
      
      // Update cache indicator
      if (data.source) {
        document.getElementById("cacheIndicator").textContent = 
          `📦 Data source: ${data.source === 'cache' ? 'Cache' : 'Database'}`;
      }
    } else {
      container.innerHTML = '<div class="alert alert-error">Failed to load tasks</div>';
    }
  } catch (error) {
    container.innerHTML = '<div class="alert alert-error">Failed to load tasks: ' + error.message + '</div>';
  }
}

function displayTasks(tasks) {
  const container = document.getElementById("tasksContainer");

  if (!tasks || tasks.length === 0) {
    container.innerHTML = '<p class="loading">No tasks yet. Create your first task!</p>';
    return;
  }

  container.innerHTML = tasks
    .map(
      (task) => `
    <div class="task-item">
      <div class="task-header">
        <div>
          <div class="task-title">${task.title}</div>
          <div class="task-meta">
            <span class="task-badge priority-${task.priority}">${task.priority}</span>
            <span class="task-badge status-${task.status}">${task.status}</span>
          </div>
        </div>
      </div>
      <p style="margin: 10px 0; color: #6b7280;">${task.description}</p>
      <div style="font-size: 12px; color: #9ca3af; margin-top: 10px;">
        Created: ${new Date(task.createdAt).toLocaleString()}
        ${task.updatedAt ? `| Updated: ${new Date(task.updatedAt).toLocaleString()}` : ""}
      </div>
      <div class="task-actions">
        <button class="btn btn-small" onclick="updateTaskStatus('${task.taskId}', '${task.status}')">
          Update Status
        </button>
        <button class="btn btn-small btn-danger" onclick="deleteTask('${task.taskId}')">
          Delete
        </button>
      </div>
    </div>
  `
    )
    .join("");
}

async function updateTaskStatus(taskId, currentStatus) {
  const statusMap = {
    todo: "inprogress",
    inprogress: "completed",
    completed: "todo",
  };

  const newStatus = statusMap[currentStatus];

  try {
    const response = await makeApiRequest(`/api/tasks/${taskId}`, "PUT", {
      status: newStatus,
    });

    if (response.ok) {
      showAlert("Task updated!", "success", "taskAlertContainer");
      loadTasks();
    } else {
      showAlert("Failed to update task", "error", "taskAlertContainer");
    }
  } catch (error) {
    showAlert("Failed to update task: " + error.message, "error", "taskAlertContainer");
  }
}

async function deleteTask(taskId) {
  if (!confirm("Are you sure you want to delete this task?")) {
    return;
  }

  try {
    const response = await makeApiRequest(`/api/tasks/${taskId}`, "DELETE");

    if (response.ok) {
      showAlert("Task deleted!", "success", "taskAlertContainer");
      loadTasks();
    } else {
      showAlert("Failed to delete task", "error", "taskAlertContainer");
    }
  } catch (error) {
    showAlert("Failed to delete task: " + error.message, "error", "taskAlertContainer");
  }
}

// ==================== FILE UPLOAD ====================

async function uploadFile() {
  const fileInput = document.getElementById("fileUpload");
  const file = fileInput.files[0];

  if (!file) {
    showAlert("Please select a file", "error", "taskAlertContainer");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      showAlert("File uploaded successfully!", "success", "taskAlertContainer");
      fileInput.value = "";
      loadUserFiles();
    } else {
      showAlert(data.error || "Upload failed", "error", "taskAlertContainer");
    }
  } catch (error) {
    showAlert("Upload failed: " + error.message, "error", "taskAlertContainer");
  }
}

async function loadUserFiles() {
  try {
    const response = await makeApiRequest("/api/files");
    const data = await response.json();

    if (response.ok) {
      displayFiles(data.files);
    }
  } catch (error) {
    console.error("Failed to load files:", error);
  }
}

function displayFiles(files) {
  const fileListDiv = document.getElementById("fileList");

  if (!files || files.length === 0) {
    fileListDiv.innerHTML = '<p style="font-size: 14px; color: #6b7280;">No files uploaded yet</p>';
    return;
  }

  fileListDiv.innerHTML = `
    <h5 style="margin: 15px 0 10px 0;">Your Files:</h5>
    ${files
      .map(
        (file) => `
      <div class="file-item">
        <span>📎 ${file.originalName}</span>
        <button class="btn btn-small" onclick="downloadFile('${file.s3Key}', '${file.originalName}')">
          Download
        </button>
      </div>
    `
      )
      .join("")}
  `;
}

async function downloadFile(s3Key, originalName) {
  try {
    const response = await makeApiRequest(
      `/api/files/download?key=${encodeURIComponent(s3Key)}`
    );
    const data = await response.json();

    if (response.ok && data.url) {
      window.open(data.url, "_blank");
      showAlert("Download started!", "success", "taskAlertContainer");
    } else {
      showAlert("Failed to get download URL", "error", "taskAlertContainer");
    }
  } catch (error) {
    showAlert("Download failed: " + error.message, "error", "taskAlertContainer");
  }
}

// ==================== WEBSOCKET ====================

function connectWebSocket() {
  const wsUrl = API_BASE_URL.replace("https://", "wss://").replace("http://", "ws://");

  try {
    websocket = new WebSocket(`${wsUrl}/ws?token=${authToken}`);

    websocket.onopen = () => {
      console.log("WebSocket connected");
      updateWebSocketStatus(true);
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      updateWebSocketStatus(false);
    };

    websocket.onclose = () => {
      console.log("WebSocket disconnected");
      updateWebSocketStatus(false);

      // Reconnect after 5 seconds
      setTimeout(connectWebSocket, 5000);
    };
  } catch (error) {
    console.error("Failed to connect WebSocket:", error);
    updateWebSocketStatus(false);
  }
}

function handleWebSocketMessage(data) {
  console.log("WebSocket message:", data);

  if (data.type === "task_update") {
    loadTasks();
    showAlert("Task updated by another user!", "info", "taskAlertContainer");
  } else if (data.type === "report_complete") {
    loadRecentReports();
    showAlert("Report generation completed!", "success");
  }
}

function updateWebSocketStatus(connected) {
  const statusDiv = document.getElementById("websocketStatus");
  
  if (connected) {
    statusDiv.className = "websocket-status websocket-connected";
    statusDiv.textContent = "WebSocket: Connected";
  } else {
    statusDiv.className = "websocket-status websocket-disconnected";
    statusDiv.textContent = "WebSocket: Disconnected";
  }
}

// ==================== DEMO & UTILITY ====================

async function runDemo() {
  showAlert("Running demo... Creating sample tasks", "info", "taskAlertContainer");

  // Create sample tasks
  setTimeout(() => {
    document.getElementById("taskTitle").value = "Demo Task 1";
    document.getElementById("taskDescription").value =
      "This demonstrates DynamoDB integration";
    document.getElementById("taskPriority").value = "high";
    createTask();
  }, 500);

  setTimeout(() => {
    document.getElementById("taskTitle").value = "Demo Task 2";
    document.getElementById("taskDescription").value =
      "This demonstrates caching functionality";
    document.getElementById("taskPriority").value = "medium";
    createTask();
  }, 1500);

  setTimeout(() => {
    document.getElementById("taskTitle").value = "Demo Task 3";
    document.getElementById("taskDescription").value =
      "This demonstrates async report generation";
    document.getElementById("taskPriority").value = "low";
    createTask();
  }, 2500);
}

async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();

    if (response.ok) {
      showAlert(
        `✅ API Health: ${data.status} | Timestamp: ${data.timestamp}`,
        "success"
      );
    } else {
      showAlert("❌ API Health Check: Failed", "error");
    }
  } catch (error) {
    showAlert("❌ API Health Check: Connection failed", "error");
  }
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (websocket) {
    websocket.close();
  }
  if (workerStatusInterval) {
    clearInterval(workerStatusInterval);
  }
  if (reportPollingInterval) {
    clearInterval(reportPollingInterval);
  }
});
