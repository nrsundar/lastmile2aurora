/**
 * DDL Analysis JavaScript Module
 * Handles DDL upload, analysis, and index recommendations
 */

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('ddlAnalysisForm');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingAnimation = document.getElementById('loadingAnimation');
    const resultsSection = document.getElementById('analysisResults');
    
    // Form submission handler
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        analyzeDDL();
    });
    
    // Download button handler
    document.addEventListener('click', function(e) {
        if (e.target.id === 'downloadIndexesBtn' || e.target.closest('#downloadIndexesBtn')) {
            const analysisId = e.target.dataset.analysisId || e.target.closest('#downloadIndexesBtn').dataset.analysisId;
            if (analysisId) {
                downloadIndexDDL(analysisId);
            }
        }
    });
});

/**
 * Analyze DDL and query for index recommendations
 */
function analyzeDDL() {
    const schemaName = document.getElementById('schemaName').value.trim();
    const sourceType = document.getElementById('sourceType').value;
    const targetVersion = document.getElementById('targetVersion').value;
    const ddlContent = document.getElementById('ddlContent').value.trim();
    const queryContent = document.getElementById('queryContent').value.trim();
    
    // Validate input
    if (!ddlContent) {
        showAlert('Please provide table DDL statements', 'warning');
        return;
    }
    
    if (!queryContent) {
        showAlert('Please provide a query to analyze', 'warning');
        return;
    }
    
    if (!schemaName) {
        showAlert('Please provide a schema name', 'warning');
        return;
    }
    
    // Show loading animation
    showLoadingAnimation();
    
    // Prepare request data
    const requestData = {
        schema_name: schemaName,
        source_type: sourceType,
        target_version: targetVersion,
        ddl_content: ddlContent,
        query_content: queryContent
    };
    
    // Send analysis request
    fetch('/api/analyze_ddl', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        hideLoadingAnimation();
        
        if (data.success) {
            displayDDLAnalysisResults(data);
            showAlert('DDL analysis completed successfully!', 'success');
        } else {
            showAlert('Analysis failed: ' + (data.error || 'Unknown error'), 'danger');
        }
    })
    .catch(error => {
        hideLoadingAnimation();
        console.error('Detailed error:', error);
        if (error.message.includes('HTTP')) {
            showAlert('Server error: ' + error.message, 'danger');
        } else if (error.message.includes('JSON')) {
            showAlert('Invalid response format from server', 'danger');
        } else {
            showAlert('Network error during analysis: ' + error.message, 'danger');
        }
    });
}

/**
 * Display DDL analysis results in the UI
 */
function displayDDLAnalysisResults(data) {
    const resultsSection = document.getElementById('analysisResults');
    
    // Check if results section exists
    if (!resultsSection) {
        console.error('Results section not found');
        showAlert('Page layout error - results section missing', 'danger');
        return;
    }
    
    // Show results section
    resultsSection.style.display = 'block';
    
    // Display index recommendations
    displayIndexRecommendations(data.index_recommendations || [], data.analysis_id);
    
    // Display performance comparison
    displayPerformanceComparison(data.performance_comparison || {});
    
    // Display generated DDL
    displayGeneratedDDL(data.index_ddls || []);
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Display index recommendations
 */
function displayIndexRecommendations(recommendations, analysisId) {
    const container = document.getElementById('indexRecommendations');
    
    if (!recommendations || recommendations.length === 0) {
        container.innerHTML = '<p class="text-muted">No index recommendations generated.</p>';
        return;
    }
    
    // Set analysis ID for download button
    const downloadBtn = document.getElementById('downloadIndexesBtn');
    if (downloadBtn && analysisId) {
        downloadBtn.dataset.analysisId = analysisId;
    }
    
    let html = '';
    
    recommendations.forEach((rec, index) => {
        const priorityClass = rec.priority === 'high' ? 'danger' : 
                             rec.priority === 'medium' ? 'warning' : 'info';
        
        html += `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="card-title">
                                <span class="badge bg-${priorityClass}">${rec.priority.toUpperCase()}</span>
                                ${rec.type.toUpperCase()} Index on ${rec.table}
                            </h6>
                            <p class="card-text">
                                <strong>Columns:</strong> ${rec.columns.join(', ')}<br>
                                <strong>Reason:</strong> ${rec.reason}
                            </p>
                        </div>
                        <div class="text-end">
                            <small class="text-muted">#${index + 1}</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Display performance comparison
 */
function displayPerformanceComparison(comparison) {
    const container = document.getElementById('performanceComparison');
    
    if (!comparison.baseline || !comparison.with_indexes) {
        container.innerHTML = '<p class="text-muted">Performance comparison not available.</p>';
        return;
    }
    
    const improvement = comparison.improvement || {};
    const executionImprovement = improvement.execution_time || 0;
    const planningImprovement = improvement.planning_time || 0;
    
    const html = `
        <div class="row">
            <div class="col-md-6">
                <div class="card border-secondary">
                    <div class="card-header">
                        <h6 class="mb-0">Before Indexes</h6>
                    </div>
                    <div class="card-body">
                        <p><strong>Execution Time:</strong> ${comparison.baseline.execution_time || 0}ms</p>
                        <p><strong>Planning Time:</strong> ${comparison.baseline.planning_time || 0}ms</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border-success">
                    <div class="card-header bg-success text-white">
                        <h6 class="mb-0">After Indexes</h6>
                    </div>
                    <div class="card-body">
                        <p><strong>Execution Time:</strong> ${comparison.with_indexes.execution_time || 0}ms</p>
                        <p><strong>Planning Time:</strong> ${comparison.with_indexes.planning_time || 0}ms</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="mt-3">
            <h6>Performance Improvement:</h6>
            <div class="progress mb-2">
                <div class="progress-bar bg-success" style="width: ${Math.min(100, Math.abs(executionImprovement) / 100 * 100)}%">
                    Execution: ${executionImprovement > 0 ? '+' : ''}${executionImprovement.toFixed(2)}ms
                </div>
            </div>
            <div class="progress">
                <div class="progress-bar bg-info" style="width: ${Math.min(100, Math.abs(planningImprovement) / 100 * 100)}%">
                    Planning: ${planningImprovement > 0 ? '+' : ''}${planningImprovement.toFixed(2)}ms
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * Display generated DDL statements
 */
function displayGeneratedDDL(ddlStatements) {
    const container = document.getElementById('generatedDDL');
    
    if (!ddlStatements || ddlStatements.length === 0) {
        container.textContent = '-- No DDL statements generated';
        return;
    }
    
    const ddlText = ddlStatements.join('\n\n');
    container.textContent = ddlText;
}

/**
 * Download index DDL file
 */
function downloadIndexDDL(analysisId) {
    if (!analysisId) {
        showAlert('No analysis ID available for download', 'warning');
        return;
    }
    
    window.location.href = `/api/download_ddl_indexes/${analysisId}`;
}

/**
 * Load sample DDL and query data
 */
function loadSampleData() {
    const sampleDDL = `-- Sample e-commerce tables
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    city VARCHAR(50),
    country VARCHAR(50),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    price DECIMAL(10,2),
    supplier_id INTEGER,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2),
    status VARCHAR(20),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE order_items (
    item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);`;

    const sampleQuery = `-- Complex query with multiple joins and filters
SELECT 
    c.first_name,
    c.last_name,
    c.city,
    o.order_date,
    o.total_amount,
    p.product_name,
    oi.quantity,
    oi.unit_price
FROM customers c
INNER JOIN orders o ON c.customer_id = o.customer_id
INNER JOIN order_items oi ON o.order_id = oi.order_id
INNER JOIN products p ON oi.product_id = p.product_id
WHERE c.city IN ('New York', 'Los Angeles', 'Chicago')
    AND o.order_date >= '2024-01-01'
    AND o.status = 'completed'
    AND p.category = 'electronics'
ORDER BY o.order_date DESC, o.total_amount DESC
LIMIT 100;`;
    
    document.getElementById('ddlContent').value = sampleDDL;
    document.getElementById('queryContent').value = sampleQuery;
    document.getElementById('schemaName').value = 'ecommerce_sample';
    
    showAlert('Sample DDL and query loaded!', 'info');
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
 * Show alert message
 */
function showAlert(message, type) {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Insert at top of container
    const container = document.querySelector('.container-fluid');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alertDiv && alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}