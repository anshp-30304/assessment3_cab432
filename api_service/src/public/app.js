   // Configuration
      const API_BASE_URL = "https://n11857374-tasks.cab432.com"; // Change this to your domain
      let currentUser = null;
      let authToken = null;
      let websocket = null;
      let currentFiles = [];

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
        try {
          const response = await makeApiRequest(
            "/api/reports/generate",
            "POST",
            {
              taskIds: "all",
              reportType: "summary",
            }
          );

          if (response.ok) {
            const data = await response.json();
            showAlert(
              `Report queued! Request ID: ${data.requestId}`,
              "success"
            );
            // Poll for completion or use WebSocket for notification
          }
        } catch (error) {
          showAlert("Failed to generate report", "error");
        }
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

          if (response.ok) {
            authToken = data.accessToken;

            // Get user info
            const userResponse = await makeApiRequest("/api/auth/me");
            const userData = await userResponse.json();

            currentUser = userData.user;

            // Save to localStorage
            localStorage.setItem("authToken", authToken);
            localStorage.setItem("currentUser", JSON.stringify(currentUser));

            showAlert("Login successful!", "success");
            showAppSection();
          } else {
            showAlert(data.error || "Login failed", "error");
          }
        } catch (error) {
          showAlert("Network error. Please check your connection.", "error");
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

        // Display user info
        document.getElementById("userInfo").innerHTML = `
                <h3>Welcome, ${currentUser.username}!</h3>
                <p><strong>Email:</strong> ${currentUser.email}</p>
                <p><strong>Groups:</strong> ${
                  currentUser.groups.join(", ") || "None"
                }</p>
                <p><strong>User ID:</strong> ${currentUser.userId}</p>
            `;

        // Load tasks and connect WebSocket
        loadTasks();
        connectWebSocket();
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
        try {
          const response = await makeApiRequest("/api/tasks");
          const data = await response.json();

          if (response.ok) {
            displayTasks(data.tasks);

            // Show cache status
            const cacheStatus = data.cached
              ? "Loaded from cache ⚡"
              : "Loaded from database 💾";
            document.getElementById("cacheIndicator").textContent = cacheStatus;
          } else {
            showAlert("Failed to load tasks", "error", "taskAlertContainer");
          }
        } catch (error) {
          showAlert(
            "Network error. Please check your connection.",
            "error",
            "taskAlertContainer"
          );
        }
      }

      function displayTasks(tasks) {
        const container = document.getElementById("tasksContainer");

        if (!tasks || tasks.length === 0) {
          container.innerHTML =
            '<p class="loading">No tasks found. Create your first task!</p>';
          return;
        }

        container.innerHTML = tasks
          .map(
            (task) => `
                <div class="task-item" data-task-id="${task.taskId}">
                    <div class="task-header">
                        <div>
                            <div class="task-title">${task.title}</div>
                            <div class="task-meta">
                                <span class="task-badge priority-${
                                  task.priority
                                }">${task.priority}</span>
                                <span class="task-badge status-${
                                  task.status
                                }">${task.status.replace(
              "inprogress",
              "in progress"
            )}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${
                      task.description
                        ? `<p style="margin-bottom: 10px; color: #6b7280;">${task.description}</p>`
                        : ""
                    }
                    
                    <div style="font-size: 12px; color: #9ca3af; margin-bottom: 10px;">
                        Created: ${new Date(
                          task.createdAt
                        ).toLocaleDateString()}
                        ${
                          task.updatedAt !== task.createdAt
                            ? ` • Updated: ${new Date(
                                task.updatedAt
                              ).toLocaleDateString()}`
                            : ""
                        }
                    </div>
                    
                    <div class="task-actions">
                        <button class="btn btn-small" onclick="updateTaskStatus('${
                          task.taskId
                        }', '${
              task.status === "completed" ? "todo" : "completed"
            }')">
                            ${
                              task.status === "completed"
                                ? "Mark Incomplete"
                                : "Mark Complete"
                            }
                        </button>
                        <button class="btn btn-small btn-danger" onclick="deleteTask('${
                          task.taskId
                        }')">Delete</button>
                    </div>
                </div>
            `
          )
          .join("");
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

      async function downloadFile(fileKey, fileName) {
        try {
          const response = await makeApiRequest(
            "/api/files/download-url",
            "POST",
            {
              fileKey: fileKey,
            }
          );

          const data = await response.json();

          if (response.ok) {
            // Open download URL in new tab
            const link = document.createElement("a");
            link.href = data.downloadUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } else {
            showAlert(
              "Failed to get download URL",
              "error",
              "taskAlertContainer"
            );
          }
        } catch (error) {
          showAlert("Download failed", "error", "taskAlertContainer");
        }
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