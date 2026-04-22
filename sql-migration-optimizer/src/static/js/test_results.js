/**
 * JavaScript for Query Performance Test Results page
 */

let currentTestResults = null;

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
});

function setupEventListeners() {
    // Run Tests button
    document.getElementById('run-tests').addEventListener('click', runPerformanceTests);
    
    // Setup Test Data button
    document.getElementById('setup-test-data').addEventListener('click', setupTestData);
    
    // Export Results button
    document.getElementById('export-results').addEventListener('click', exportResults);
}

async function setupTestData() {
    const button = document.getElementById('setup-test-data');
    const originalText = button.innerHTML;
    
    try {
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Setting up...';
        button.disabled = true;
        
        const response = await fetch('/api/setup_test_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Test data created successfully!', 'success');
        } else {
            showAlert('Failed to create test data: ' + (result.error || 'Unknown error'), 'danger');
        }
        
    } catch (error) {
        console.error('Error setting up test data:', error);
        showAlert('Error setting up test data: ' + error.message, 'danger');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

async function runPerformanceTests() {
    const button = document.getElementById('run-tests');
    const originalText = button.innerHTML;
    const iterations = document.getElementById('iterations').value;
    
    try {
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Running...';
        button.disabled = true;
        
        // Show enhanced loading container
        showPerformanceTestLoadingAnimation();
        document.getElementById('loading-container').classList.remove('d-none');
        document.getElementById('test-results-container').classList.add('d-none');
        
        // Update status
        document.getElementById('test-status').textContent = 'Running';
        
        // Start progress simulation
        simulateProgress();
        
        const response = await fetch('/api/run_performance_tests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                iterations: parseInt(iterations)
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentTestResults = result;
            displayTestResults(result);
            document.getElementById('export-results').disabled = false;
            
            // Trigger gamification event for performance test completion
            if (window.SQLGameification) {
                SQLGameification.triggerEvent('performanceTestCompleted', {
                    testsRun: result.successful_tests,
                    totalTests: result.total_tests,
                    timestamp: new Date()
                });
            }
        } else {
            showAlert('Performance tests failed: ' + (result.error || 'Unknown error'), 'danger');
            document.getElementById('test-status').textContent = 'Failed';
        }
        
    } catch (error) {
        console.error('Error running performance tests:', error);
        showAlert('Error running performance tests: ' + error.message, 'danger');
        document.getElementById('test-status').textContent = 'Error';
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
        document.getElementById('loading-container').classList.add('d-none');
    }
}

function simulateProgress() {
    const progressBar = document.getElementById('test-progress');
    let progress = 0;
    
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        
        progressBar.style.width = progress + '%';
        
        if (document.getElementById('loading-container').classList.contains('d-none')) {
            clearInterval(interval);
            progressBar.style.width = '100%';
        }
    }, 500);
}

function displayTestResults(results) {
    // Update overview
    document.getElementById('total-tests').textContent = results.total_tests;
    document.getElementById('successful-tests').textContent = results.successful_tests;
    document.getElementById('test-status').textContent = 'Completed';
    
    // Calculate average improvement
    if (results.results && results.results.length > 0) {
        const avgImprovement = results.results.reduce((sum, test) => {
            return sum + test.improvement.total_time_improvement_percent;
        }, 0) / results.results.length;
        
        document.getElementById('avg-improvement').textContent = avgImprovement.toFixed(1) + '%';
        document.getElementById('avg-improvement').className = avgImprovement > 0 ? 'text-success' : 'text-danger';
    }
    
    // Display individual test results
    const container = document.getElementById('test-results-container');
    container.innerHTML = '';
    
    results.results.forEach((test, index) => {
        const testCard = createTestResultCard(test, index);
        container.appendChild(testCard);
    });
    
    container.classList.remove('d-none');
}

function createTestResultCard(test, index) {
    const template = document.getElementById('test-result-template');
    const card = template.cloneNode(true);
    card.id = `test-result-${index}`;
    card.classList.remove('d-none');
    
    // Basic info
    card.querySelector('.test-name').textContent = test.test_name;
    card.querySelector('.test-description').textContent = test.test_description;
    
    // Performance badge
    const badge = card.querySelector('.performance-badge');
    const improvement = test.improvement;
    if (improvement.faster) {
        badge.textContent = `${improvement.total_time_improvement_percent.toFixed(1)}% Faster`;
        badge.className = 'badge bg-success';
    } else {
        badge.textContent = `${Math.abs(improvement.total_time_improvement_percent).toFixed(1)}% Slower`;
        badge.className = 'badge bg-danger';
    }
    
    // Metrics
    card.querySelector('.original-time').textContent = test.original.avg_total_time + ' ms';
    card.querySelector('.optimized-time').textContent = test.optimized.avg_total_time + ' ms';
    card.querySelector('.improvement-percent').textContent = improvement.total_time_improvement_percent.toFixed(1) + '%';
    
    // Improvement background
    const improvementBg = card.querySelector('.improvement-bg');
    if (improvement.faster) {
        improvementBg.classList.add('bg-success', 'text-white');
    } else {
        improvementBg.classList.add('bg-danger', 'text-white');
    }
    
    // Detailed metrics
    if (test.original.results.length > 0 && test.optimized.results.length > 0) {
        const origResult = test.original.results[0];
        const optResult = test.optimized.results[0];
        
        card.querySelector('.original-execution').textContent = origResult.execution_time.toFixed(2) + ' ms';
        card.querySelector('.optimized-execution').textContent = optResult.execution_time.toFixed(2) + ' ms';
        card.querySelector('.original-planning').textContent = origResult.planning_time.toFixed(2) + ' ms';
        card.querySelector('.optimized-planning').textContent = optResult.planning_time.toFixed(2) + ' ms';
        card.querySelector('.original-rows').textContent = origResult.rows_returned;
        card.querySelector('.optimized-rows').textContent = optResult.rows_returned;
        card.querySelector('.original-hit-blocks').textContent = origResult.shared_hit_blocks;
        card.querySelector('.optimized-hit-blocks').textContent = optResult.shared_hit_blocks;
        card.querySelector('.original-read-blocks').textContent = origResult.shared_read_blocks;
        card.querySelector('.optimized-read-blocks').textContent = optResult.shared_read_blocks;
    }
    
    // Setup tabs
    setupTabs(card, index);
    
    return card;
}

function setupTabs(card, index) {
    const tabButtons = card.querySelectorAll('.nav-link');
    const tabPanes = card.querySelectorAll('.tab-pane');
    
    tabButtons.forEach((button, tabIndex) => {
        button.id = `tab-${index}-${tabIndex}`;
        button.setAttribute('data-bs-target', `#pane-${index}-${tabIndex}`);
        button.setAttribute('data-bs-toggle', 'tab');
        
        button.addEventListener('click', function() {
            // Remove active class from all tabs and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('show', 'active'));
            
            // Add active class to clicked tab and corresponding pane
            button.classList.add('active');
            tabPanes[tabIndex].classList.add('show', 'active');
        });
    });
    
    tabPanes.forEach((pane, paneIndex) => {
        pane.id = `pane-${index}-${paneIndex}`;
    });
}

function exportResults() {
    if (!currentTestResults) {
        showAlert('No test results to export', 'warning');
        return;
    }
    
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `performance_test_results_${timestamp}.json`;
    
    const blob = new Blob([JSON.stringify(currentTestResults, null, 2)], {
        type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAlert('Test results exported successfully!', 'success');
}

function showPerformanceTestLoadingAnimation() {
    const loadingContainer = document.getElementById('loading-container');
    if (!loadingContainer) return;
    
    const cardBody = loadingContainer.querySelector('.card-body');
    if (cardBody) {
        cardBody.innerHTML = `
            <div class="loading-container">
                <div class="progress-ring">
                    <svg width="80" height="80">
                        <circle class="progress-ring-circle" cx="40" cy="40" r="36"></circle>
                    </svg>
                </div>
                <div class="db-connection">
                    <div class="db-icon"></div>
                    <div class="connection-line"></div>
                    <div class="db-icon"></div>
                    <div class="connection-line"></div>
                    <div class="db-icon"></div>
                </div>
                <div class="progress-waves">
                    <div class="wave"></div>
                    <div class="wave"></div>
                    <div class="wave"></div>
                </div>
                <div class="sql-icons">
                    <div class="sql-icon">⚡</div>
                    <div class="sql-icon">📊</div>
                    <div class="sql-icon">🔍</div>
                </div>
                <div class="loading-text">Running performance comparison tests</div>
            </div>
        `;
    }
}

function showAlert(message, type) {
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Insert at top of container
    const container = document.querySelector('.container');
    container.insertBefore(alert, container.firstChild);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}