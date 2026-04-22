/**
 * EXPLAIN ANALYZE Analysis JavaScript Module
 * Handles EXPLAIN output analysis and performance recommendations
 */

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('explainAnalysisForm');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingAnimation = document.getElementById('loadingAnimation');
    const resultsSection = document.getElementById('analysisResults');
    
    // Form submission handler
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        analyzeExplain();
    });
});

/**
 * Analyze EXPLAIN ANALYZE output
 */
function analyzeExplain() {
    const sourceType = document.getElementById('sourceType').value;
    const queryText = document.getElementById('queryText').value.trim();
    const explainOutput = document.getElementById('explainOutput').value.trim();
    
    // Validate input
    if (!queryText) {
        showAlert('Please provide the original query', 'warning');
        return;
    }
    
    if (!explainOutput) {
        showAlert('Please provide the EXPLAIN ANALYZE output', 'warning');
        return;
    }
    
    // Show loading animation
    showLoadingAnimation();
    
    // Prepare request data
    const requestData = {
        source_type: sourceType,
        query_text: queryText,
        explain_output: explainOutput
    };
    
    // Send analysis request
    console.log('Sending request with data:', requestData);
    
    fetch('/api/analyze_explain', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        console.log('Response received:', response);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Response data:', data);
        hideLoadingAnimation();
        
        if (data && data.success) {
            try {
                displayAnalysisResults(data);
                showAlert('EXPLAIN analysis completed successfully!', 'success');
            } catch (displayError) {
                console.error('Display error:', displayError);
                // Fallback: show raw results if display functions fail
                showRawResults(data);
                showAlert('Analysis completed - showing raw results due to display issue', 'warning');
            }
        } else {
            showAlert('Analysis failed: ' + (data?.error || 'Unknown error'), 'danger');
            console.error('Analysis error:', data?.error);
        }
    })
    .catch(error => {
        console.error('Caught error:', error);
        hideLoadingAnimation();
        
        // Check if it's a network error
        if (error instanceof TypeError && error.message.includes('fetch')) {
            showAlert('Network connection error. Please check your connection and try again.', 'danger');
        } else if (error.name === 'SyntaxError') {
            showAlert('Server response format error. Please try again.', 'danger');
        } else {
            showAlert('Analysis error: ' + (error.message || 'Unknown error'), 'danger');
        }
    });
}

/**
 * Show raw results as fallback when display functions fail
 */
function showRawResults(data) {
    const resultsSection = document.getElementById('analysisResults');
    if (resultsSection) {
        resultsSection.style.display = 'block';
        resultsSection.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h5>Analysis Results</h5>
                </div>
                <div class="card-body">
                    <h6>Performance Score: ${data.performance_score?.score || 0}/100 (Grade ${data.performance_score?.grade || 'F'})</h6>
                    <p><strong>Issues Found:</strong> ${data.issues?.length || 0}</p>
                    <p><strong>Index Suggestions:</strong> ${data.index_suggestions?.length || 0}</p>
                    
                    ${data.index_suggestions && data.index_suggestions.length > 0 ? `
                        <h6>Recommended Indexes:</h6>
                        <ul>
                            ${data.index_suggestions.map(idx => 
                                `<li><code>${idx.ddl}</code> - ${idx.reason}</li>`
                            ).join('')}
                        </ul>
                    ` : ''}
                    
                    ${data.suggestions && data.suggestions.length > 0 ? `
                        <h6>Optimization Suggestions:</h6>
                        <ul>
                            ${data.suggestions.map(s => 
                                `<li><strong>${s.title}:</strong> ${s.description}</li>`
                            ).join('')}
                        </ul>
                    ` : ''}
                    
                    <details class="mt-3">
                        <summary>Raw API Response</summary>
                        <pre class="mt-2">${JSON.stringify(data, null, 2)}</pre>
                    </details>
                </div>
            </div>
        `;
    }
}

/**
 * Display analysis results in the UI
 */
function displayAnalysisResults(data) {
    try {
        const resultsSection = document.getElementById('analysisResults');
        
        // Show results section
        resultsSection.style.display = 'block';
        
        console.log('Displaying performance score...');
        // Display performance score
        displayPerformanceScore(data.performance_score || {});
        
        console.log('Displaying performance issues...');
        // Display performance issues
        displayPerformanceIssues(data.issues || []);
        
        console.log('Displaying optimization suggestions...');
        // Display optimization suggestions
        displayOptimizationSuggestions(data.suggestions || []);
        
        console.log('Displaying index suggestions...');
        // Display index suggestions
        displayIndexSuggestions(data.index_suggestions || []);
        
        console.log('Scrolling to results...');
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        
        console.log('Analysis results displayed successfully!');
    } catch (error) {
        console.error('Error displaying analysis results:', error);
        showAlert('Error displaying results: ' + error.message, 'danger');
    }
}

/**
 * Display performance score with gauge
 */
function displayPerformanceScore(scoreData) {
    const container = document.getElementById('performanceScore');
    
    if (!container) {
        console.error('performanceScore container not found');
        return;
    }
    
    const score = scoreData.score || 0;
    const grade = scoreData.grade || 'F';
    const totalIssues = scoreData.total_issues || 0;
    const highSeverityIssues = scoreData.high_severity_issues || 0;
    
    // Determine score color
    let scoreColor = 'danger';
    if (score >= 80) scoreColor = 'success';
    else if (score >= 60) scoreColor = 'warning';
    
    const html = `
        <div class="row text-center">
            <div class="col-md-4">
                <div class="display-4 text-${scoreColor}">${score}</div>
                <div class="h5">Performance Score</div>
                <div class="badge bg-${scoreColor} fs-6">Grade ${grade}</div>
            </div>
            <div class="col-md-4">
                <div class="display-6">${totalIssues}</div>
                <div class="h6">Total Issues</div>
            </div>
            <div class="col-md-4">
                <div class="display-6 text-danger">${highSeverityIssues}</div>
                <div class="h6">Critical Issues</div>
            </div>
        </div>
        <div class="progress mt-3" style="height: 20px;">
            <div class="progress-bar bg-${scoreColor}" style="width: ${score}%">
                ${score}%
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * Display performance issues
 */
function displayPerformanceIssues(issues) {
    const container = document.getElementById('performanceIssues');
    
    if (!container) {
        console.error('performanceIssues container not found');
        return;
    }
    
    if (!issues || issues.length === 0) {
        container.innerHTML = '<div class="alert alert-success">No performance issues detected!</div>';
        return;
    }
    
    let html = '';
    
    issues.forEach((issue, index) => {
        const severityClass = issue.severity === 'high' ? 'danger' : 
                             issue.severity === 'medium' ? 'warning' : 'info';
        
        html += `
            <div class="alert alert-${severityClass}">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="alert-heading">
                            <span class="badge bg-${severityClass}">${issue.severity.toUpperCase()}</span>
                            ${issue.type.replace(/_/g, ' ').toUpperCase()}
                        </h6>
                        <p class="mb-0">${issue.description}</p>
                        ${issue.value !== undefined ? `<small class="text-muted">Value: ${issue.value}${issue.threshold ? ` (threshold: ${issue.threshold})` : ''}</small>` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Display optimization suggestions
 */
function displayOptimizationSuggestions(suggestions) {
    const container = document.getElementById('optimizationSuggestions');
    
    if (!container) {
        console.error('optimizationSuggestions container not found');
        return;
    }
    
    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No specific optimization suggestions available based on the execution plan.</div>';
        return;
    }
    
    let html = '';
    
    suggestions.forEach((suggestion, index) => {
        const priorityClass = suggestion.priority === 'high' ? 'danger' : 
                             suggestion.priority === 'medium' ? 'warning' : 'info';
        
        // Determine icon based on category
        let categoryIcon = 'fas fa-cog';
        if (suggestion.category === 'indexing') categoryIcon = 'fas fa-database';
        else if (suggestion.category === 'query_rewriting') categoryIcon = 'fas fa-edit';
        else if (suggestion.category === 'joins') categoryIcon = 'fas fa-link';
        else if (suggestion.category === 'performance') categoryIcon = 'fas fa-tachometer-alt';
        
        html += `
            <div class="card mb-3 border-${priorityClass}">
                <div class="card-header bg-${priorityClass} text-white">
                    <div class="d-flex justify-content-between align-items-center">
                        <h6 class="mb-0">
                            <i class="${categoryIcon} me-2"></i>
                            ${suggestion.title}
                        </h6>
                        <span class="badge bg-light text-dark">${suggestion.priority.toUpperCase()}</span>
                    </div>
                </div>
                <div class="card-body">
                    <p class="card-text">${suggestion.description}</p>
                    
                    ${suggestion.estimated_improvement ? `
                        <div class="alert alert-success">
                            <strong>Expected Improvement:</strong> ${suggestion.estimated_improvement}
                        </div>
                    ` : ''}
                    
                    ${suggestion.actions && suggestion.actions.length > 0 ? `
                        <h6><i class="fas fa-list-check me-1"></i>Recommended Actions:</h6>
                        <ul class="list-group list-group-flush">
                            ${suggestion.actions.map(action => `<li class="list-group-item">${action}</li>`).join('')}
                        </ul>
                    ` : ''}
                    
                    ${suggestion.example_rewrite ? `
                        <div class="mt-3">
                            <h6><i class="fas fa-code me-1"></i>Query Rewrite Example:</h6>
                            <div class="bg-dark text-light p-3 rounded">
                                <pre><code>${suggestion.example_rewrite}</code></pre>
                            </div>
                            <button class="btn btn-sm btn-outline-secondary mt-2" onclick="copyToClipboard(\`${suggestion.example_rewrite.replace(/`/g, '\\`')}\`)">
                                <i class="fas fa-copy me-1"></i>Copy Example
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Display index suggestions
 */
function displayIndexSuggestions(indexSuggestions) {
    const container = document.getElementById('indexSuggestions');
    
    if (!container) {
        console.error('indexSuggestions container not found');
        return;
    }
    
    if (!indexSuggestions || indexSuggestions.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No specific index recommendations identified from the execution plan.</div>';
        return;
    }
    
    let html = '';
    
    indexSuggestions.forEach((suggestion, index) => {
        const priorityClass = suggestion.priority === 'high' ? 'danger' : 
                             suggestion.priority === 'medium' ? 'warning' : 'info';
        
        html += `
            <div class="card mb-3 border-${priorityClass}">
                <div class="card-header bg-${priorityClass} text-white">
                    <div class="d-flex justify-content-between align-items-center">
                        <h6 class="mb-0">
                            <span class="badge bg-light text-dark">${suggestion.priority.toUpperCase()}</span>
                            ${suggestion.type.toUpperCase()} Index on ${suggestion.table}
                        </h6>
                        <small>#${index + 1}</small>
                    </div>
                </div>
                <div class="card-body">
                    <p class="card-text">
                        <strong>Columns:</strong> ${Array.isArray(suggestion.columns) ? suggestion.columns.join(', ') : suggestion.columns}<br>
                        <strong>Reason:</strong> ${suggestion.reason}<br>
                        ${suggestion.estimated_benefit ? `<strong>Expected Benefit:</strong> ${suggestion.estimated_benefit}<br>` : ''}
                        ${suggestion.current_cost ? `<strong>Current Cost:</strong> ${suggestion.current_cost}<br>` : ''}
                        ${suggestion.current_join_type ? `<strong>Current Join Type:</strong> ${suggestion.current_join_type}<br>` : ''}
                    </p>
                    
                    <div class="mt-3">
                        <h6>DDL Statement:</h6>
                        <div class="bg-dark text-light p-2 rounded">
                            <code>${suggestion.ddl || `CREATE INDEX idx_${suggestion.table}_${Array.isArray(suggestion.columns) ? suggestion.columns.join('_') : suggestion.columns} ON ${suggestion.table} (${Array.isArray(suggestion.columns) ? suggestion.columns.join(', ') : suggestion.columns});`}</code>
                        </div>
                    </div>
                    
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-secondary" onclick="copyToClipboard('${suggestion.ddl || `CREATE INDEX idx_${suggestion.table}_${Array.isArray(suggestion.columns) ? suggestion.columns.join('_') : suggestion.columns} ON ${suggestion.table} (${Array.isArray(suggestion.columns) ? suggestion.columns.join(', ') : suggestion.columns});`}')">
                            <i class="fas fa-copy me-1"></i>Copy DDL
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Load sample EXPLAIN output
 */
function loadSampleExplain() {
    const sampleQuery = `SELECT 
    c.first_name,
    c.last_name,
    o.order_date,
    o.total_amount
FROM customers c
INNER JOIN orders o ON c.customer_id = o.customer_id
WHERE c.city = 'New York'
    AND o.order_date > '2024-01-01'
ORDER BY o.total_amount DESC
LIMIT 100;`;

    const sampleExplain = `Limit  (cost=435.71..435.96 rows=100 width=84) (actual time=45.234..45.267 rows=100 loops=1)
  ->  Sort  (cost=435.71..438.21 rows=1000 width=84) (actual time=45.232..45.250 rows=100 loops=1)
        Sort Key: o.total_amount DESC
        Sort Method: top-N heapsort  Memory: 43kB
        ->  Hash Join  (cost=22.50..395.71 rows=1000 width=84) (actual time=2.234..43.567 rows=1000 loops=1)
              Hash Cond: (o.customer_id = c.customer_id)
              ->  Seq Scan on orders o  (cost=0.00..345.00 rows=5000 width=20) (actual time=0.123..35.234 rows=5000 loops=1)
                    Filter: (order_date > '2024-01-01'::date)
                    Rows Removed by Filter: 15000
              ->  Hash  (cost=20.00..20.00 rows=200 width=68) (actual time=1.234..1.234 rows=200 loops=1)
                    Buckets: 1024  Batches: 1  Memory Usage: 25kB
                    ->  Seq Scan on customers c  (cost=0.00..20.00 rows=200 width=68) (actual time=0.234..1.123 rows=200 loops=1)
                          Filter: (city = 'New York'::text)
                          Rows Removed by Filter: 800
Planning Time: 2.345 ms
Execution Time: 45.789 ms`;
    
    document.getElementById('queryText').value = sampleQuery;
    document.getElementById('explainOutput').value = sampleExplain;
    
    showAlert('Sample EXPLAIN output loaded!', 'info');
}

/**
 * Show loading animation
 */
function showLoadingAnimation() {
    document.getElementById('loadingAnimation').style.display = 'block';
    document.getElementById('analysisResults').style.display = 'none';
    document.getElementById('analyzeBtn').disabled = true;
}

/**
 * Hide loading animation
 */
function hideLoadingAnimation() {
    document.getElementById('loadingAnimation').style.display = 'none';
    document.getElementById('analyzeBtn').disabled = false;
}

/**
 * Show help modal
 */
function showHelpModal() {
    const modal = new bootstrap.Modal(document.getElementById('helpModal'));
    modal.show();
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showAlert('Copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        showAlert('Failed to copy to clipboard', 'warning');
    });
}

/**
 * Show alert message
 */
function showAlert(message, type) {
    try {
        // Create alert element
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Insert at top of container
        const container = document.querySelector('.container-fluid');
        if (container) {
            container.insertBefore(alertDiv, container.firstChild);
            
            // Auto-dismiss after 5 seconds
            setTimeout(() => {
                if (alertDiv && alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        } else {
            console.error('Container not found for alert');
        }
    } catch (error) {
        console.error('Error showing alert:', error);
    }
}