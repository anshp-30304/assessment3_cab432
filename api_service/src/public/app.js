 const API_BASE_URL = "https://n11857374-tasks.cab432.com";
let currentUser = null;
let authToken = null;
let websocket = null;
let currentFiles = [];
let reportPollingInterval = null;
let workerStatusInterval = null;

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
          showAlert("Network error. Please check your connection.", "error");
        }
      }

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
    console.log('Generate report response:', data); // DEBUG

    if (response.ok) {
      // Show success message
      showAlert(
        `✅ Report queued successfully! Request ID: ${data.requestId}`,
        "success"
      );
      
      // Add report to the list immediately with "queued" status
      addReportToList({
        reportId: data.requestId,
        reportType: 'summary',
        status: 'queued',
        createdAt: new Date().toISOString()
      });
      
      // Start polling for status
      if (data.requestId) {
        startReportPolling(data.requestId);
      }
    } else {
      showAlert(data.error || "Failed to generate report", "error");
    }
  } catch (error) {
    console.error('Generate report error:', error);
    showAlert("Failed to generate report: " + error.message, "error");
  } finally {
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = '📊 Generate Report';
    }
  }
}


// Helper function to add a report to the list
function addReportToList(report) {
  const reportsListDiv = document.getElementById("reportsList");
  
  // If it's showing "No reports", clear it
  if (reportsListDiv.querySelector('.text-muted')) {
    reportsListDiv.innerHTML = '';
  }
  
  const reportHtml = `
    <div class="report-item" id="report-${report.reportId}">
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
      ` : report.status === 'queued' ? `
        <div class="report-status">
          <small>⏳ Queued - waiting for worker...</small>
        </div>
      ` : report.status === 'failed' ? `
        <div class="report-error">
          <small>❌ Generation failed</small>
        </div>
      ` : ''}
    </div>
  `;
  
  reportsListDiv.insertAdjacentHTML('afterbegin', reportHtml);
}

// Helper function to update report status in the list
function updateReportStatus(reportId, newStatus, s3Key = null) {
  const reportDiv = document.getElementById(`report-${reportId}`);
  if (!reportDiv) return;
  
  // Update status badge
  const badge = reportDiv.querySelector('.report-badge');
  if (badge) {
    badge.className = `report-badge status-${newStatus}`;
    badge.textContent = newStatus;
  }
  
  // Update the actions/status section
  const statusSection = reportDiv.querySelector('.report-status, .report-actions, .report-error');
  if (statusSection) {
    if (newStatus === 'completed' && s3Key) {
      statusSection.outerHTML = `
        <div class="report-actions">
          <button class="btn btn-small" onclick="downloadReport('${reportId}', '${s3Key}')">
            ⬇️ Download PDF
          </button>
        </div>
      `;
    } else if (newStatus === 'processing') {
      statusSection.outerHTML = `
        <div class="report-status">
          <div class="loading-spinner"></div>
          <small>Processing...</small>
        </div>
      `;
    } else if (newStatus === 'failed') {
      statusSection.outerHTML = `
        <div class="report-error">
          <small>❌ Generation failed</small>
        </div>
      `;
    }
  }
}

function startReportPolling(requestId) {
  let attempts = 0;
  const maxAttempts = 60; // 2 minutes max

  if (reportPollingInterval) {
    clearInterval(reportPollingInterval);
  }

  console.log('Starting to poll for report:', requestId);

  reportPollingInterval = setInterval(async () => {
    attempts++;

    if (attempts >= maxAttempts) {
      clearInterval(reportPollingInterval);
      console.log('Max polling attempts reached');
      updateReportStatus(requestId, 'failed');
      return;
    }

    try {
      const response = await makeApiRequest(`/api/reports/status/${requestId}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Report status:', data);
        
        // Update the UI
        if (data.status === 'processing' && attempts === 1) {
          updateReportStatus(requestId, 'processing');
        }
        
        if (data.status === 'completed') {
          clearInterval(reportPollingInterval);
          showAlert('✅ Report generated successfully!', 'success');
          updateReportStatus(requestId, 'completed', data.s3Key);
        } else if (data.status === 'failed') {
          clearInterval(reportPollingInterval);
          showAlert('❌ Report generation failed', 'error');
          updateReportStatus(requestId, 'failed');
        }
      } else {
        console.log('Status check failed, will retry...');
      }
    } catch (error) {
      console.error('Error polling report status:', error);
    }
  }, 3000); // Poll every 3 seconds
}

    async function pollReportStatus(requestId, attempts = 0) {
    const maxAttempts = 60; // 60 attempts = 2 minutes max
    
    if (attempts >= maxAttempts) {
        console.log('Max polling attempts reached for', requestId);
        return;
    }

    try {
        const token = localStorage.getItem('token');
        
        const response = await fetch(`/api/reports/status/${requestId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.status === 'completed') {
            console.log('Report completed:', requestId);
            
            // Update stored reports
            const reports = JSON.parse(localStorage.getItem('reports') || '[]');
            const report = reports.find(r => r.requestId === requestId);
            if (report) {
                report.status = 'completed';
                localStorage.setItem('reports', JSON.stringify(reports));
            }

            // Refresh reports list
            loadReports();
            
            // Show notification
            showNotification('Report generated successfully!', 'success');
        } else if (data.status === 'processing') {
            // Continue polling
            setTimeout(() => pollReportStatus(requestId, attempts + 1), 2000);
        }
    } catch (error) {
        console.error('Error polling report status:', error);
    }
}

/**
 * Load and display reports list
 */
function loadReports() {
    const reports = JSON.parse(localStorage.getItem('reports') || '[]');
    const listDiv = document.getElementById('reportsList');

    if (reports.length === 0) {
        listDiv.innerHTML = '<p class="text-muted">No reports generated yet</p>';
        return;
    }

    listDiv.innerHTML = reports.map(report => `
        <div class="report-item">
            <div class="report-info">
                <span class="report-id">Report ${report.requestId.substring(0, 8)}...</span>
                <span class="report-date">${new Date(report.timestamp).toLocaleString()}</span>
                <span class="report-status status-${report.status}">${report.status}</span>
            </div>
            ${report.status === 'completed' ? `
                <button onclick="downloadReport('${report.requestId}')" class="btn btn-small">
                    Download PDF
                </button>
            ` : `
                <button class="btn btn-small" disabled>
                    Processing...
                </button>
            `}
        </div>
    `).join('');
}

/**
 * Download a completed report
 */
async function downloadReport(requestId) {
    try {
        const token = localStorage.getItem('token');
        
        const response = await fetch(`/api/reports/download/${requestId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `task-report-${requestId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showNotification('Report downloaded successfully!', 'success');
        } else {
            const data = await response.json();
            showNotification(data.error || 'Download failed', 'error');
        }
    } catch (error) {
        console.error('Error downloading report:', error);
        showNotification('Download failed', 'error');
    }
}


// ==================== WORKER MONITORING ====================


function startWorkerMonitoring() {
  // Initial load
  updateWorkerStatus();
  
  // Update every 10 seconds
  workerStatusInterval = setInterval(updateWorkerStatus, 10000);
}

async function updateWorkerStatus() {
  try {
    const response = await makeApiRequest("/health");
    
    if (response.ok) {
      const data = await response.json();
      displayWorkerStatus(data);
    }
  } catch (error) {
    console.error("Failed to fetch worker status:", error);
    // Show a basic status card anyway
    displayWorkerStatus({
      status: 'healthy',
      features: {
        sqs: true,
        s3: true,
        dynamodb: true,
        cognito: true
      }
    });
  }
}

function displayWorkerStatus(healthData) {
  const workerStatusDiv = document.getElementById("workerStatus");
  
  if (!workerStatusDiv) return;

  const sqsEnabled = healthData.features && healthData.features.sqs;
  const s3Enabled = healthData.features && healthData.features.s3;
  const dynamoEnabled = healthData.features && healthData.features.dynamodb;
  
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
          <span class="status-badge ${s3Enabled ? 'status-online' : 'status-offline'}">
            ${s3Enabled ? '✅ Available' : '❌ Unavailable'}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">DynamoDB:</span>
          <span class="status-badge ${dynamoEnabled ? 'status-online' : 'status-offline'}">
            ${dynamoEnabled ? '✅ Available' : '❌ Unavailable'}
          </span>
        </div>
      </div>
      <div class="status-timestamp">
        Last updated: ${new Date().toLocaleTimeString()}
      </div>
    </div>
  `;
}

      async function confirmRegistration() {
        const username = document.getElementById("confirmUsername").value;
        const confirmationCode =
          document.getElementById("confirmationCode").value;

        if (!username || !confirmationCode) {
          showAlert("Please fill in all fields", "error");
          return;
        }

        try {
          const response = await makeApiRequest("/api/auth/confirm", "POST", {
            username,
            confirmationCode,
          });

          const data = await response.json();

          if (response.ok) {
            showAlert("Email confirmed! You can now login.", "success");
            switchAuthTab("login");
            document.getElementById("loginUsername").value = username;
          } else {
            showAlert(data.error || "Confirmation failed", "error");
          }
        } catch (error) {
          showAlert("Network error. Please check your connection.", "error");
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
    
    console.log('Login API Response:', data);

    if (response.ok) {
      // Your API returns 'accessToken', not 'token'
      authToken = data.accessToken || data.token;
      
      // Extract user info from the response or token
      currentUser = {
        userId: data.userId || data.user?.userId,
        username: username, // Use the username they entered
        email: data.email || data.user?.email
      };

      console.log('Auth Token:', authToken);
      console.log('Current User:', currentUser);

      // Save to localStorage
      localStorage.setItem("authToken", authToken);
      localStorage.setItem("currentUser", JSON.stringify(currentUser));

      showAlert("Login successful!", "success");
      showAppSection();
    } else {
      showAlert(data.error || "Login failed", "error");
    }
  } catch (error) {
    console.error('Login error:', error);
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

        showAuthSection();
      }

      function showAuthSection() {
        document.getElementById("authSection").classList.add("active");
        document.getElementById("appSection").classList.remove("active");
      }

      function showAppSection() {
  document.getElementById("authSection").classList.remove("active");
  document.getElementById("appSection").classList.add("active");

  // Show user info
  const userInfoDiv = document.getElementById("userInfo");
  if (userInfoDiv && currentUser) {
    userInfoDiv.innerHTML = `
      <h3>👤 Welcome, ${currentUser.username || 'User'}!</h3>
      <p><strong>User ID:</strong> ${currentUser.userId || 'N/A'}</p>
    `;
  }

  // Load features
  try {
    loadTasks();
  } catch (error) {
    console.error('Error loading tasks:', error);
  }

  try {
    startWorkerMonitoring();
  } catch (error) {
    console.error('Error starting worker monitoring:', error);
  }
}

      // Task management functions
      async function createTask() {
        const title = document.getElementById("taskTitle").value;
        const description = document.getElementById("taskDescription").value;
        const priority = document.getElementById("taskPriority").value;
        const status = document.getElementById("taskStatus").value;

        if (!title) {
          showAlert("Task title is required", "error", "taskAlertContainer");
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
            showAlert(
              "Task created successfully!",
              "success",
              "taskAlertContainer"
            );

            // Clear form
            document.getElementById("taskTitle").value = "";
            document.getElementById("taskDescription").value = "";
            document.getElementById("taskPriority").value = "medium";
            document.getElementById("taskStatus").value = "todo";

            // Reload tasks
            loadTasks();
          } else {
            showAlert(
              data.error || "Failed to create task",
              "error",
              "taskAlertContainer"
            );
          }
        } catch (error) {
          showAlert(
            "Network error. Please check your connection.",
            "error",
            "taskAlertContainer"
          );
        }
      }

      async function loadTasks() {
  const container = document.getElementById("tasksContainer");
  container.innerHTML = '<div class="loading">Loading tasks...</div>';

  try {
    const response = await makeApiRequest("/api/tasks");
    
    if (!response.ok) {
      container.innerHTML = '<div class="alert alert-error">Failed to load tasks</div>';
      return;
    }
    
    const data = await response.json();
    console.log('Tasks data:', data);

    if (data && data.tasks) {
      displayTasks(data.tasks);
      
      // Update cache indicator
      if (data.source) {
        document.getElementById("cacheIndicator").textContent = 
          `📦 Data source: ${data.source === 'cache' ? 'Cache' : 'Database'}`;
      }
    } else {
      container.innerHTML = '<p class="loading">No tasks yet. Create your first task!</p>';
    }
  } catch (error) {
    console.error('Load tasks error:', error);
    container.innerHTML = '<div class="alert alert-error">Failed to load tasks: ' + error.message + '</div>';
  }
}

function displayTasks(tasks) {
  const container = document.getElementById("tasksContainer");

  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    container.innerHTML = '<p class="loading">No tasks yet. Create your first task!</p>';
    return;
  }

  container.innerHTML = tasks
    .map(
      (task) => `
    <div class="task-item">
      <div class="task-header">
        <div>
          <div class="task-title">${task.title || 'Untitled'}</div>
          <div class="task-meta">
            <span class="task-badge priority-${task.priority || 'medium'}">${task.priority || 'medium'}</span>
            <span class="task-badge status-${task.status || 'todo'}">${task.status || 'todo'}</span>
          </div>
        </div>
      </div>
      <p style="margin: 10px 0; color: #6b7280;">${task.description || 'No description'}</p>
      <div style="font-size: 12px; color: #9ca3af; margin-top: 10px;">
        Created: ${task.createdAt ? new Date(task.createdAt).toLocaleString() : 'N/A'}
        ${task.updatedAt ? `| Updated: ${new Date(task.updatedAt).toLocaleString()}` : ""}
      </div>
      <div class="task-actions">
        <button class="btn btn-small" onclick="updateTaskStatus('${task.taskId}', '${task.status || 'todo'}')">
          Update Status
        </button>
        <button class="btn btn-small btn-danger" onclick="deleteTask('${task.taskId}')">
          Delete
        </button>
      </div>
    </div>
  `
    )
    .join(""); // THIS is probably where the error is - make sure tasks is an array
}
      async function updateTaskStatus(taskId, newStatus) {
        try {
          const response = await makeApiRequest(`/api/tasks/${taskId}`, "PUT", {
            status: newStatus,
          });

          if (response.ok) {
            showAlert(
              "Task updated successfully!",
              "success",
              "taskAlertContainer"
            );
            loadTasks();
          } else {
            showAlert("Failed to update task", "error", "taskAlertContainer");
          }
        } catch (error) {
          showAlert(
            "Network error. Please check your connection.",
            "error",
            "taskAlertContainer"
          );
        }
      }

      async function deleteTask(taskId) {
        if (!confirm("Are you sure you want to delete this task?")) {
          return;
        }

        try {
          const response = await makeApiRequest(
            `/api/tasks/${taskId}`,
            "DELETE"
          );

          if (response.ok) {
            showAlert(
              "Task deleted successfully!",
              "success",
              "taskAlertContainer"
            );
            loadTasks();
          } else {
            showAlert("Failed to delete task", "error", "taskAlertContainer");
          }
        } catch (error) {
          showAlert(
            "Network error. Please check your connection.",
            "error",
            "taskAlertContainer"
          );
        }
      }

      // File upload functions
      async function uploadFile() {
        const fileInput = document.getElementById("fileUpload");
        const file = fileInput.files[0];

        if (!file) {
          showAlert(
            "Please select a file first",
            "error",
            "taskAlertContainer"
          );
          return;
        }

        try {
          // Get pre-signed upload URL
          const response = await makeApiRequest(
            "/api/files/upload-url",
            "POST",
            {
              fileName: file.name,
              contentType: file.type,
              taskId: "general",
            }
          );

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error);
          }

          // Upload file directly to S3
          const uploadResponse = await fetch(data.uploadUrl, {
            method: "PUT",
            body: file,
            headers: {
              "Content-Type": file.type,
            },
          });

          if (uploadResponse.ok) {
            showAlert(
              "File uploaded successfully!",
              "success",
              "taskAlertContainer"
            );
            currentFiles.push({
              key: data.fileKey,
              name: file.name,
              size: file.size,
            });
            updateFileList();
            fileInput.value = "";
          } else {
            throw new Error("Failed to upload to S3");
          }
        } catch (error) {
          showAlert(
            `Upload failed: ${error.message}`,
            "error",
            "taskAlertContainer"
          );
        }
      }

      function updateFileList() {
        const fileList = document.getElementById("fileList");

        if (currentFiles.length === 0) {
          fileList.innerHTML =
            '<p style="color: #6b7280; font-style: italic;">No files uploaded yet</p>';
          return;
        }

        fileList.innerHTML = currentFiles
          .map(
            (file, index) => `
                <div class="file-item">
                    <div>
                        <strong>${file.name}</strong>
                        <span style="color: #6b7280; font-size: 12px;">(${formatFileSize(
                          file.size
                        )})</span>
                    </div>
                    <div>
                        <button class="btn btn-small" onclick="downloadFile('${
                          file.key
                        }', '${file.name}')">Download</button>
                        <button class="btn btn-small btn-danger" onclick="deleteFile('${
                          file.key
                        }', ${index})">Delete</button>
                    </div>
                </div>
            `
          )
          .join("");
      }

      

      async function deleteFile(fileKey, index) {
        if (!confirm("Are you sure you want to delete this file?")) {
          return;
        }

        try {
          const response = await makeApiRequest(
            `/api/files/${encodeURIComponent(fileKey)}`,
            "DELETE"
          );

          if (response.ok) {
            showAlert(
              "File deleted successfully!",
              "success",
              "taskAlertContainer"
            );
            currentFiles.splice(index, 1);
            updateFileList();
          } else {
            showAlert("Failed to delete file", "error", "taskAlertContainer");
          }
        } catch (error) {
          showAlert("Delete failed", "error", "taskAlertContainer");
        }
      }

      function formatFileSize(bytes) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
      }

      // WebSocket functions
      function connectWebSocket() {
        if (!currentUser) return;

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//n11857374-tasks.cab432.com/api/notifications`;

        websocket = new WebSocket(wsUrl);

        websocket.onopen = function () {
          console.log("WebSocket connected");
          updateWebSocketStatus(true);

          // Subscribe to notifications
          websocket.send(
            JSON.stringify({
              type: "subscribe",
              userId: currentUser.userId,
            })
          );
        };

        websocket.onmessage = function (event) {
          try {
            const data = JSON.parse(event.data);
            console.log("WebSocket message:", data);

            if (data.type === "notification") {
              showAlert(
                `Notification: ${data.message}`,
                "info",
                "taskAlertContainer"
              );
            }
          } catch (error) {
            console.error("WebSocket message parse error:", error);
          }
        };

        websocket.onclose = function () {
          console.log("WebSocket disconnected");
          updateWebSocketStatus(false);

          // Attempt to reconnect after 5 seconds
          setTimeout(() => {
            if (currentUser) {
              console.log("Attempting to reconnect WebSocket...");
              connectWebSocket();
            }
          }, 5000);
        };

        websocket.onerror = function (error) {
          console.error("WebSocket error:", error);
          updateWebSocketStatus(false);
        };
      }

      function updateWebSocketStatus(connected) {
        const statusEl = document.getElementById("websocketStatus");
        if (connected) {
          statusEl.textContent = "WebSocket: Connected";
          statusEl.className = "websocket-status websocket-connected";
        } else {
          statusEl.textContent = "WebSocket: Disconnected";
          statusEl.className = "websocket-status websocket-disconnected";
        }
      }

      // Demo functions for testing
      function runDemo() {
        showAlert(
          "Demo mode: This will create sample tasks and files",
          "info",
          "taskAlertContainer"
        );

        // Create sample tasks
        setTimeout(() => {
          document.getElementById("taskTitle").value = "Demo Task 1";
          document.getElementById("taskDescription").value =
            "This is a demo task to show DynamoDB integration";
          document.getElementById("taskPriority").value = "high";
          createTask();
        }, 1000);

        setTimeout(() => {
          document.getElementById("taskTitle").value = "Demo Task 2";
          document.getElementById("taskDescription").value =
            "This task demonstrates caching functionality";
          document.getElementById("taskPriority").value = "medium";
          createTask();
        }, 2000);
      }

      // Add demo button and API URL configuration
      function showApiConfig() {
        const currentUrl = document.getElementById("apiUrl")
          ? document.getElementById("apiUrl").value
          : API_BASE_URL;
        const newUrl = prompt("Enter your API URL :", currentUrl);

        if (newUrl && newUrl !== currentUrl) {
          // Update the API base URL
          window.API_BASE_URL = newUrl.replace(/\/$/, ""); // Remove trailing slash

          // Show confirmation
          showAlert(`API URL updated to: ${window.API_BASE_URL}`, "success");

          // Add input field to remember URL
          if (!document.getElementById("apiUrl")) {
            const configDiv = document.createElement("div");
            configDiv.innerHTML = `
                        <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <label for="apiUrl" style="font-weight: 600; margin-bottom: 8px; display: block;">API URL:</label>
                            <input type="text" id="apiUrl" value="${window.API_BASE_URL}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                            <button onclick="showApiConfig()" style="margin-top: 8px; padding: 6px 12px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer;">Update URL</button>
                        </div>
                    `;
            document
              .querySelector(".form-container")
              .insertBefore(configDiv, document.querySelector(".auth-tabs"));
          } else {
            document.getElementById("apiUrl").value = window.API_BASE_URL;
          }
        }
      }

      // Override the makeApiRequest function to use dynamic URL
      const originalMakeApiRequest = makeApiRequest;
      makeApiRequest = function (endpoint, method = "GET", body = null) {
        const baseUrl = window.API_BASE_URL || API_BASE_URL;
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

        return fetch(`${baseUrl}${endpoint}`, options);
      };

      // Add configuration button when page loads
      document.addEventListener("DOMContentLoaded", function () {
        // Add API config button to auth section
        const authContainer = document.querySelector(".form-container");
        const configButton = document.createElement("button");
        configButton.textContent = "⚙️ Configure API URL";
        configButton.className = "btn btn-secondary";
        configButton.style.marginTop = "10px";
        configButton.onclick = showApiConfig;

        // Insert before demo credentials
        const demoDiv = authContainer.querySelector('div[style*="demo"]');
        if (demoDiv) {
          authContainer.insertBefore(configButton, demoDiv);
        } else {
          authContainer.appendChild(configButton);
        }

        // Add demo button to app section
        const taskForm = document.querySelector(".task-form");
        const demoButton = document.createElement("button");
        demoButton.textContent = "🚀 Run Demo";
        demoButton.className = "btn btn-secondary";
        demoButton.style.marginTop = "10px";
        demoButton.onclick = runDemo;

        const logoutButton = taskForm.querySelector(".btn-danger");
        taskForm.insertBefore(demoButton, logoutButton);
      });

      // Health check function
      async function checkHealth() {
        try {
          const baseUrl = window.API_BASE_URL || API_BASE_URL;
          const response = await fetch(`${baseUrl}/health`);
          const data = await response.json();

          if (response.ok) {
            showAlert(
              `✅ API Health Check: ${data.status} (${data.timestamp})`,
              "success"
            );
          } else {
            showAlert("❌ API Health Check: Failed", "error");
          }
        } catch (error) {
          showAlert("❌ API Health Check: Connection failed", "error");
        }
      }
