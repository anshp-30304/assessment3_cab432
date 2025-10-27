/**
 * PDF Generator Module
 * 
 * This module handles CPU-intensive PDF report generation for the Task Manager.
 * It's designed to be computationally expensive to ensure high CPU utilization
 * for auto-scaling demonstrations.
 * 
 * Features:
 * - Task statistics and analytics
 * - Multi-page reports with formatting
 * - Charts and visualizations
 * - CPU-intensive calculations
 */

const PDFDocument = require('pdfkit');

require('dotenv').config();
/**
 * Main PDF generation function
 * This is designed to be CPU-intensive for auto-scaling purposes
 */
async function generateTaskReport(reportData, tasks) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
        info: {
          Title: 'Task Management Report',
          Author: 'Task Manager System',
          Subject: 'Task Analytics and Summary',
          Keywords: 'tasks, productivity, analytics'
        }
      });
      
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Generate report content
      generateCoverPage(doc, reportData);
      generateExecutiveSummary(doc, tasks);
      generateTaskStatistics(doc, tasks);
      generateDetailedAnalytics(doc, tasks);
      generateTaskList(doc, tasks);
      generateRecommendations(doc, tasks);
      
      // Add page numbers to all pages
      addPageNumbers(doc);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate cover page
 */
function generateCoverPage(doc, reportData) {
  // Company/App branding
  doc.fontSize(35)
     .fillColor('#4f46e5')
     .text('Task Manager', { align: 'center' });
  
  doc.moveDown(0.5);
  
  doc.fontSize(25)
     .fillColor('#6b7280')
     .text('Analytics Report', { align: 'center' });
  
  doc.moveDown(3);
  
  // Report details box
  const boxTop = doc.y;
  doc.rect(100, boxTop, 400, 180)
     .fillAndStroke('#f8fafc', '#e5e7eb');
  
  doc.fillColor('#111827')
     .fontSize(14)
     .text('Report Details', 120, boxTop + 20, { width: 360 });
  
  doc.fontSize(11)
     .fillColor('#374151');
  
  doc.text(`User ID: ${reportData.userId}`, 120, boxTop + 50, { width: 360 });
  doc.text(`Report Type: ${reportData.reportType}`, 120, boxTop + 70, { width: 360 });
  doc.text(`Request ID: ${reportData.requestId}`, 120, boxTop + 90, { width: 360 });
  doc.text(`Generated: ${new Date().toLocaleString()}`, 120, boxTop + 110, { width: 360 });
  doc.text(`Page Count: Will be calculated`, 120, boxTop + 130, { width: 360 });
  
  // Add decorative elements
  doc.circle(70, boxTop + 90, 15)
     .fillAndStroke('#4f46e5', '#4f46e5');
  
  doc.circle(530, boxTop + 90, 15)
     .fillAndStroke('#4f46e5', '#4f46e5');
  
  doc.addPage();
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(doc, tasks) {
  addSectionHeader(doc, 'Executive Summary', '#4f46e5');
  
  const stats = calculateStatistics(tasks);
  const analytics = performCPUIntensiveAnalysis(tasks);
  
  doc.fontSize(11)
     .fillColor('#374151');
  
  // Key metrics box
  doc.moveDown(1);
  const summaryY = doc.y;
  
  // Total tasks metric
  drawMetricBox(doc, 50, summaryY, 120, 80, stats.total.toString(), 'Total Tasks', '#3b82f6');
  
  // Completion rate metric
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  drawMetricBox(doc, 190, summaryY, 120, 80, `${completionRate}%`, 'Completed', '#10b981');
  
  // In progress metric
  drawMetricBox(doc, 330, summaryY, 120, 80, stats.inProgress.toString(), 'In Progress', '#f59e0b');
  
  // Pending metric
  drawMetricBox(doc, 470, summaryY, 120, 80, stats.todo.toString(), 'To Do', '#6b7280');
  
  doc.y = summaryY + 100;
  doc.moveDown(2);
  
  // Summary text
  doc.fontSize(11)
     .fillColor('#374151')
     .text('Overview', { underline: true, continued: false });
  
  doc.moveDown(0.5);
  
  doc.fontSize(10)
     .text(`This report provides a comprehensive analysis of ${stats.total} tasks managed by the user. ` +
           `The completion rate stands at ${completionRate}%, with ${stats.inProgress} tasks currently in progress. ` +
           `Priority distribution shows ${stats.highPriority} high-priority tasks requiring immediate attention.`, {
      align: 'justify',
      lineGap: 3
    });
  
  doc.moveDown(1);
  
  // Key insights
  doc.fontSize(11)
     .fillColor('#374151')
     .text('Key Insights', { underline: true });
  
  doc.moveDown(0.5);
  doc.fontSize(10);
  
  const insights = generateInsights(stats, analytics);
  insights.forEach((insight, index) => {
    doc.fillColor('#4f46e5')
       .text('▸ ', { continued: true })
       .fillColor('#374151')
       .text(insight);
    doc.moveDown(0.3);
  });
  
  doc.addPage();
}

/**
 * Generate detailed task statistics
 */
function generateTaskStatistics(doc, tasks) {
  addSectionHeader(doc, 'Task Statistics', '#7c3aed');
  
  const stats = calculateStatistics(tasks);
  
  // Status breakdown
  doc.fontSize(13)
     .fillColor('#111827')
     .text('Status Distribution', { underline: true });
  
  doc.moveDown(0.5);
  
  // Status chart (text-based visualization)
  drawStatusChart(doc, stats);
  
  doc.moveDown(2);
  
  // Priority breakdown
  doc.fontSize(13)
     .fillColor('#111827')
     .text('Priority Distribution', { underline: true });
  
  doc.moveDown(0.5);
  
  // Priority chart
  drawPriorityChart(doc, stats);
  
  doc.moveDown(2);
  
  // Time-based analysis
  doc.fontSize(13)
     .fillColor('#111827')
     .text('Time-Based Analysis', { underline: true });
  
  doc.moveDown(0.5);
  
  const timeAnalysis = analyzeTaskTiming(tasks);
  doc.fontSize(10)
     .fillColor('#374151');
  
  doc.text(`Average Task Age: ${timeAnalysis.avgAge} days`);
  doc.text(`Oldest Task: ${timeAnalysis.oldestAge} days`);
  doc.text(`Newest Task: ${timeAnalysis.newestAge} days`);
  doc.text(`Tasks Created This Week: ${timeAnalysis.thisWeek}`);
  doc.text(`Tasks Created This Month: ${timeAnalysis.thisMonth}`);
  
  doc.addPage();
}

/**
 * Generate detailed analytics with CPU-intensive calculations
 */
function generateDetailedAnalytics(doc, tasks) {
  addSectionHeader(doc, 'Detailed Analytics', '#059669');
  
  doc.fontSize(11)
     .fillColor('#374151')
     .text('This section contains advanced analytics computed through intensive data processing.');
  
  doc.moveDown(1);
  
  // CPU-INTENSIVE: Perform complex analysis
  console.log('Starting CPU-intensive analytics calculations...');
  const startTime = Date.now();
  
  const analytics = performCPUIntensiveAnalysis(tasks);
  
  const duration = Date.now() - startTime;
  console.log(`Analytics calculation completed in ${duration}ms`);
  
  // Productivity score
  doc.fontSize(12)
     .fillColor('#111827')
     .text('Productivity Score', { underline: true });
  
  doc.moveDown(0.5);
  
  const scoreY = doc.y;
  drawProgressBar(doc, 50, scoreY, 500, 25, analytics.productivityScore, '#10b981');
  
  doc.y = scoreY + 40;
  doc.fontSize(10)
     .fillColor('#374151')
     .text(`Your productivity score is ${analytics.productivityScore.toFixed(1)}% based on task completion rates, ` +
           `priority management, and time-to-completion metrics.`);
  
  doc.moveDown(1.5);
  
  // Task velocity
  doc.fontSize(12)
     .fillColor('#111827')
     .text('Task Completion Velocity', { underline: true });
  
  doc.moveDown(0.5);
  doc.fontSize(10)
     .fillColor('#374151')
     .text(`Average Completion Rate: ${analytics.velocity.toFixed(2)} tasks per day`);
  doc.text(`Estimated Time to Complete Remaining: ${analytics.estimatedCompletion} days`);
  
  doc.moveDown(1.5);
  
  // Workload balance
  doc.fontSize(12)
     .fillColor('#111827')
     .text('Workload Balance Analysis', { underline: true });
  
  doc.moveDown(0.5);
  doc.fontSize(10)
     .fillColor('#374151')
     .text(`Current Workload: ${analytics.workloadStatus}`);
  doc.text(`Task Distribution Score: ${analytics.distributionScore.toFixed(1)}/10`);
  doc.text(`Recommended Daily Tasks: ${analytics.recommendedDaily}`);
  
  doc.addPage();
}

/**
 * Generate task list
 */
function generateTaskList(doc, tasks) {
  addSectionHeader(doc, 'Task List', '#dc2626');
  
  if (tasks.length === 0) {
    doc.fontSize(11)
       .fillColor('#6b7280')
       .text('No tasks found.');
    return;
  }
  
  // Limit to 50 tasks for PDF size
  const displayTasks = tasks.slice(0, 50);
  
  doc.fontSize(10)
     .fillColor('#6b7280')
     .text(`Showing ${displayTasks.length} of ${tasks.length} tasks`);
  
  doc.moveDown(1);
  
  displayTasks.forEach((task, index) => {
    // Check if we need a new page
    if (doc.y > 700) {
      doc.addPage();
      addSectionHeader(doc, 'Task List (continued)', '#dc2626');
    }
    
    // Task number and title
    doc.fontSize(11)
       .fillColor('#111827')
       .text(`${index + 1}. ${task.title}`, { continued: false });
    
    // Status badge
    const statusColor = getStatusColor(task.status);
    doc.fontSize(9)
       .fillColor(statusColor)
       .text(`   ● ${task.status.toUpperCase()}`, { continued: true });
    
    // Priority badge
    const priorityColor = getPriorityColor(task.priority);
    doc.fillColor(priorityColor)
       .text(` | ${task.priority.toUpperCase()} PRIORITY`);
    
    // Description
    if (task.description) {
      doc.fontSize(9)
         .fillColor('#6b7280')
         .text(`   ${task.description.substring(0, 150)}${task.description.length > 150 ? '...' : ''}`, {
           indent: 20
         });
    }
    
    // Metadata
    if (task.createdAt) {
      doc.fontSize(8)
         .fillColor('#9ca3af')
         .text(`   Created: ${new Date(task.createdAt).toLocaleDateString()}`, {
           indent: 20
         });
    }
    
    doc.moveDown(0.8);
    
    // Divider
    if (index < displayTasks.length - 1) {
      doc.strokeColor('#e5e7eb')
         .lineWidth(0.5)
         .moveTo(50, doc.y)
         .lineTo(550, doc.y)
         .stroke();
      doc.moveDown(0.5);
    }
  });
  
  if (tasks.length > 50) {
    doc.moveDown(1);
    doc.fontSize(10)
       .fillColor('#6b7280')
       .text(`... and ${tasks.length - 50} more tasks not shown in this report.`);
  }
  
  doc.addPage();
}

/**
 * Generate recommendations
 */
function generateRecommendations(doc, tasks) {
  addSectionHeader(doc, 'Recommendations', '#f59e0b');
  
  const recommendations = generateRecommendationsList(tasks);
  
  doc.fontSize(10)
     .fillColor('#374151')
     .text('Based on the analysis of your tasks, here are some actionable recommendations to improve productivity:');
  
  doc.moveDown(1);
  
  recommendations.forEach((rec, index) => {
    doc.fontSize(11)
       .fillColor('#111827')
       .text(`${index + 1}. ${rec.title}`, { underline: true });
    
    doc.moveDown(0.3);
    
    doc.fontSize(10)
       .fillColor('#374151')
       .text(rec.description, {
         indent: 20,
         align: 'justify'
       });
    
    doc.moveDown(0.3);
    
    doc.fontSize(9)
       .fillColor('#6b7280')
       .text(`Priority: ${rec.priority} | Impact: ${rec.impact}`, {
         indent: 20
       });
    
    doc.moveDown(1);
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate basic task statistics
 */
function calculateStatistics(tasks) {
  const stats = {
    total: tasks.length,
    completed: 0,
    inProgress: 0,
    todo: 0,
    highPriority: 0,
    mediumPriority: 0,
    lowPriority: 0
  };

  tasks.forEach(task => {
    // Count by status
    const status = (task.status || 'todo').toLowerCase();
    if (status === 'done' || status === 'completed') {
      stats.completed++;
    } else if (status === 'in-progress' || status === 'inprogress') {
      stats.inProgress++;
    } else {
      stats.todo++;
    }

    // Count by priority
    const priority = (task.priority || 'medium').toLowerCase();
    if (priority === 'high') {
      stats.highPriority++;
    } else if (priority === 'medium') {
      stats.mediumPriority++;
    } else {
      stats.lowPriority++;
    }
  });

  return stats;
}

/**
 * CPU-INTENSIVE: Perform advanced analytics
 * This function is intentionally computationally expensive
 */
function performCPUIntensiveAnalysis(tasks) {
  const analytics = {
    productivityScore: 0,
    velocity: 0,
    estimatedCompletion: 0,
    workloadStatus: 'balanced',
    distributionScore: 0,
    recommendedDaily: 0
  };
  
  // Perform intensive calculations
  let computationResult = 0;
  const iterations = 3000000; // 3 million iterations for CPU load
  
  for (let i = 0; i < iterations; i++) {
    computationResult += Math.sqrt(i * Math.random());
    computationResult += Math.sin(i / 1000) * Math.cos(i / 1000);
    
    if (i % 100000 === 0) {
      // Additional nested calculations
      for (let j = 0; j < 500; j++) {
        computationResult += Math.pow(j, 1.5);
        computationResult -= Math.log(j + 1);
      }
    }
  }
  
  // Calculate actual analytics
  const completed = tasks.filter(t => 
    (t.status || '').toLowerCase() === 'done' || 
    (t.status || '').toLowerCase() === 'completed'
  ).length;
  
  analytics.productivityScore = tasks.length > 0 
    ? (completed / tasks.length) * 100 
    : 0;
  
  // Calculate velocity (simplified)
  const avgDaysOld = calculateAverageAge(tasks);
  analytics.velocity = avgDaysOld > 0 
    ? completed / avgDaysOld 
    : completed;
  
  const remaining = tasks.length - completed;
  analytics.estimatedCompletion = analytics.velocity > 0 
    ? Math.ceil(remaining / analytics.velocity) 
    : 0;
  
  // Workload analysis
  const highPriority = tasks.filter(t => (t.priority || '').toLowerCase() === 'high').length;
  if (highPriority > tasks.length * 0.5) {
    analytics.workloadStatus = 'overloaded';
  } else if (highPriority < tasks.length * 0.2) {
    analytics.workloadStatus = 'light';
  }
  
  // Distribution score (0-10)
  const priorityBalance = Math.abs(0.33 - (highPriority / tasks.length));
  analytics.distributionScore = Math.max(0, 10 - (priorityBalance * 30));
  
  // Recommended daily tasks
  analytics.recommendedDaily = Math.max(1, Math.ceil(remaining / 30));
  
  return analytics;
}

/**
 * Analyze task timing
 */
function analyzeTaskTiming(tasks) {
  const now = new Date();
  let totalAge = 0;
  let oldestAge = 0;
  let newestAge = Infinity;
  let thisWeek = 0;
  let thisMonth = 0;
  
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  tasks.forEach(task => {
    if (task.createdAt) {
      const created = new Date(task.createdAt);
      const age = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      
      totalAge += age;
      if (age > oldestAge) oldestAge = age;
      if (age < newestAge) newestAge = age;
      
      if (created >= weekAgo) thisWeek++;
      if (created >= monthAgo) thisMonth++;
    }
  });
  
  return {
    avgAge: tasks.length > 0 ? Math.round(totalAge / tasks.length) : 0,
    oldestAge,
    newestAge: newestAge === Infinity ? 0 : newestAge,
    thisWeek,
    thisMonth
  };
}

/**
 * Calculate average task age
 */
function calculateAverageAge(tasks) {
  if (tasks.length === 0) return 0;
  
  const now = new Date();
  let totalAge = 0;
  let count = 0;
  
  tasks.forEach(task => {
    if (task.createdAt) {
      const created = new Date(task.createdAt);
      const age = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      totalAge += age;
      count++;
    }
  });
  
  return count > 0 ? totalAge / count : 0;
}

/**
 * Generate insights based on statistics
 */
function generateInsights(stats, analytics) {
  const insights = [];
  
  const completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
  
  if (completionRate >= 75) {
    insights.push('Excellent completion rate! You\'re staying on top of your tasks effectively.');
  } else if (completionRate >= 50) {
    insights.push('Good progress on tasks, but there\'s room for improvement in completion rates.');
  } else {
    insights.push('Consider focusing on completing existing tasks before adding new ones.');
  }
  
  if (stats.highPriority > stats.total * 0.4) {
    insights.push(`${stats.highPriority} high-priority tasks require immediate attention.`);
  }
  
  if (stats.inProgress > stats.total * 0.5) {
    insights.push('Many tasks are in progress. Focus on completing them before starting new ones.');
  }
  
  if (analytics.velocity > 0) {
    insights.push(`At your current pace, you complete approximately ${analytics.velocity.toFixed(1)} tasks per day.`);
  }
  
  return insights;
}

/**
 * Generate recommendations list
 */
function generateRecommendationsList(tasks) {
  const recommendations = [];
  const stats = calculateStatistics(tasks);
  
  if (stats.highPriority > 5) {
    recommendations.push({
      title: 'Focus on High-Priority Tasks',
      description: `You have ${stats.highPriority} high-priority tasks. Consider dedicating focused time blocks to tackle these first, as they likely have the most significant impact on your goals.`,
      priority: 'High',
      impact: 'High'
    });
  }
  
  if (stats.inProgress > stats.completed) {
    recommendations.push({
      title: 'Complete In-Progress Tasks',
      description: 'You have more tasks in progress than completed. Try to finish existing tasks before starting new ones to maintain momentum and reduce context switching.',
      priority: 'Medium',
      impact: 'High'
    });
  }
  
  if (stats.todo > 20) {
    recommendations.push({
      title: 'Review and Prioritize Backlog',
      description: `With ${stats.todo} tasks in your backlog, consider reviewing and prioritizing them. Some may no longer be relevant or could be delegated.`,
      priority: 'Medium',
      impact: 'Medium'
    });
  }
  
  recommendations.push({
    title: 'Set Daily Goals',
    description: 'Establish a daily goal for task completion. Even completing 2-3 important tasks per day can significantly improve your productivity over time.',
    priority: 'Low',
    impact: 'High'
  });
  
  recommendations.push({
    title: 'Regular Reviews',
    description: 'Schedule weekly reviews of your task list to ensure priorities are up-to-date and remove obsolete tasks.',
    priority: 'Low',
    impact: 'Medium'
  });
  
  return recommendations;
}

// ============================================================================
// DRAWING HELPER FUNCTIONS
// ============================================================================

/**
 * Add section header
 */
function addSectionHeader(doc, title, color = '#111827') {
  doc.fontSize(18)
     .fillColor(color)
     .text(title, { underline: false });
  
  doc.moveDown(0.3);
  
  // Underline
  doc.strokeColor(color)
     .lineWidth(2)
     .moveTo(50, doc.y)
     .lineTo(250, doc.y)
     .stroke();
  
  doc.moveDown(1);
}

/**
 * Draw metric box
 */
function drawMetricBox(doc, x, y, width, height, value, label, color) {
  // Box background
  doc.rect(x, y, width, height)
     .fillAndStroke('#ffffff', '#e5e7eb');
  
  // Value
  doc.fontSize(24)
     .fillColor(color)
     .text(value, x, y + 15, {
       width: width,
       align: 'center'
     });
  
  // Label
  doc.fontSize(9)
     .fillColor('#6b7280')
     .text(label, x, y + 50, {
       width: width,
       align: 'center'
     });
}

/**
 * Draw status chart
 */
function drawStatusChart(doc, stats) {
  const total = stats.total || 1;
  const chartY = doc.y;
  const barHeight = 25;
  const maxWidth = 400;
  
  // Completed bar
  drawBar(doc, 'Completed', stats.completed, total, 50, chartY, maxWidth, barHeight, '#10b981');
  
  // In Progress bar
  drawBar(doc, 'In Progress', stats.inProgress, total, 50, chartY + 40, maxWidth, barHeight, '#f59e0b');
  
  // To Do bar
  drawBar(doc, 'To Do', stats.todo, total, 50, chartY + 80, maxWidth, barHeight, '#6b7280');
  
  doc.y = chartY + 120;
}

/**
 * Draw priority chart
 */
function drawPriorityChart(doc, stats) {
  const total = stats.total || 1;
  const chartY = doc.y;
  const barHeight = 25;
  const maxWidth = 400;
  
  // High priority bar
  drawBar(doc, 'High', stats.highPriority, total, 50, chartY, maxWidth, barHeight, '#ef4444');
  
  // Medium priority bar
  drawBar(doc, 'Medium', stats.mediumPriority, total, 50, chartY + 40, maxWidth, barHeight, '#f59e0b');
  
  // Low priority bar
  drawBar(doc, 'Low', stats.lowPriority, total, 50, chartY + 80, maxWidth, barHeight, '#6b7280');
  
  doc.y = chartY + 120;
}

/**
 * Draw a single bar in a chart
 */
function drawBar(doc, label, value, total, x, y, maxWidth, height, color) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const barWidth = (maxWidth * percentage) / 100;
  
  // Label
  doc.fontSize(10)
     .fillColor('#374151')
     .text(`${label} (${value})`, x + maxWidth + 20, y + 5);
  
  // Background bar
  doc.rect(x, y, maxWidth, height)
     .fillAndStroke('#f3f4f6', '#e5e7eb');
  
  // Filled bar
  if (barWidth > 0) {
    doc.rect(x, y, barWidth, height)
       .fill(color);
  }
  
  // Percentage text
  if (percentage > 10) {
    doc.fontSize(9)
       .fillColor('#ffffff')
       .text(`${percentage.toFixed(0)}%`, x + barWidth - 35, y + 6);
  } else if (percentage > 0) {
    doc.fontSize(9)
       .fillColor('#374151')
       .text(`${percentage.toFixed(0)}%`, x + barWidth + 5, y + 6);
  }
}

/**
 * Draw progress bar
 */
function drawProgressBar(doc, x, y, width, height, percentage, color) {
  const fillWidth = (width * percentage) / 100;
  
  // Background
  doc.rect(x, y, width, height)
     .fillAndStroke('#f3f4f6', '#e5e7eb');
  
  // Fill
  if (fillWidth > 0) {
    doc.rect(x, y, fillWidth, height)
       .fill(color);
  }
  
  // Percentage text
  doc.fontSize(12)
     .fillColor('#111827')
     .text(`${percentage.toFixed(1)}%`, x + width / 2 - 20, y + height / 2 - 6);
}

/**
 * Add page numbers to all pages
 */
function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    
    // Page number
    doc.fontSize(9)
       .fillColor('#9ca3af')
       .text(
         `Page ${i + 1} of ${range.count}`,
         50,
         doc.page.height - 50,
         {
           align: 'center',
           width: doc.page.width - 100
         }
       );
    
    // Footer line
    doc.strokeColor('#e5e7eb')
       .lineWidth(0.5)
       .moveTo(50, doc.page.height - 70)
       .lineTo(doc.page.width - 50, doc.page.height - 70)
       .stroke();
  }
}

/**
 * Get color for task status
 */
function getStatusColor(status) {
  const s = (status || 'todo').toLowerCase();
  if (s === 'done' || s === 'completed') return '#10b981';
  if (s === 'in-progress' || s === 'inprogress') return '#f59e0b';
  return '#6b7280';
}

/**
 * Get color for task priority
 */
function getPriorityColor(priority) {
  const p = (priority || 'medium').toLowerCase();
  if (p === 'high') return '#ef4444';
  if (p === 'medium') return '#f59e0b';
  return '#6b7280';
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  generateTaskReport
};
