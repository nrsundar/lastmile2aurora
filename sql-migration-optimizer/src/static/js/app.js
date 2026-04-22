/**
 * Main application JavaScript for the PostgreSQL SQL Optimizer
 */

// Track if the analysis is in progress
let isAnalyzing = false;

/**
 * Load recent queries from the API
 */
function loadRecentQueries() {
    const container = document.getElementById('recent-queries-container');
    
    fetch('/api/recent_queries')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                container.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
                return;
            }
            
            if (!data.queries || data.queries.length === 0) {
                container.innerHTML = `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>No recent queries found
                    </div>
                `;
                return;
            }
            
            // Create a table of recent queries
            let html = `
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Source Type</th>
                                <th>Query</th>
                                <th>Date</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            data.queries.forEach(query => {
                // Format the date
                const date = new Date(query.created_at);
                const formattedDate = date.toLocaleString();
                
                // Truncate the query if it's too long
                const truncatedQuery = query.original_query.length > 100 
                    ? query.original_query.substring(0, 100) + '...' 
                    : query.original_query;
                
                html += `
                    <tr class="recent-query-item" data-query="${escapeHtml(query.original_query)}" data-source="${query.source_type}">
                        <td><span class="badge bg-secondary">${query.source_type}</span></td>
                        <td class="recent-query-preview">${escapeHtml(truncatedQuery)}</td>
                        <td>${formattedDate}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary load-query" 
                                    data-query="${escapeHtml(query.original_query)}" 
                                    data-source="${query.source_type}">
                                <i class="fas fa-upload"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            container.innerHTML = html;
            
            // Add event listeners to the load buttons
            document.querySelectorAll('.load-query').forEach(button => {
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    const query = this.getAttribute('data-query');
                    const source = this.getAttribute('data-source');
                    
                    // Find the editor instance
                    if (typeof sqlEditor !== 'undefined') {
                        // Set the editor value to the query
                        sqlEditor.setValue(query);
                        
                        // Set the source type dropdown
                        document.getElementById('source-type').value = source;
                        
                        // Scroll to the editor
                        document.querySelector('.card').scrollIntoView({
                            behavior: 'smooth'
                        });
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error loading recent queries:', error);
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>Error loading recent queries
                </div>
            `;
        });
}

/**
 * Display analysis results in the UI
 */
function displayAnalysisResults(data) {
    const resultsContainer = document.getElementById('results-container');
    const analysisResults = document.getElementById('analysis-results');
    const originalSqlDisplay = document.getElementById('original-sql-display');
    const optimizedSqlDisplay = document.getElementById('optimized-sql-display');
    const optimizedSql = document.getElementById('optimized-sql');
    
    // Show the results container
    resultsContainer.classList.remove('d-none');
    
    // Update the optimized SQL
    optimizedSql.value = data.optimized_sql;
    
    // Update the original and optimized SQL displays
    originalSqlDisplay.textContent = data.original_sql;
    optimizedSqlDisplay.textContent = data.optimized_sql;
    
    // Update the analysis results
    let issueCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    let resultHtml = '';
    
    // Process issues
    if (data.analysis.issues && data.analysis.issues.length > 0) {
        issueCount = data.analysis.issues.length;
        resultHtml += '<h5>Issues</h5>';
        
        data.analysis.issues.forEach(issue => {
            resultHtml += `
                <div class="alert alert-danger issue-item error">
                    <h6 class="alert-heading">${issue.message}</h6>
                    <p>${issue.recommendation}</p>
                    ${issue.line ? `<small class="text-muted">Line: ${issue.line}</small>` : ''}
                </div>
            `;
        });
    }
    
    // Process warnings
    if (data.analysis.warnings && data.analysis.warnings.length > 0) {
        warningCount = data.analysis.warnings.length;
        resultHtml += '<h5>Warnings</h5>';
        
        data.analysis.warnings.forEach(warning => {
            resultHtml += `
                <div class="alert alert-warning issue-item warning">
                    <h6 class="alert-heading">${warning.message}</h6>
                    <p>${warning.recommendation}</p>
                    ${warning.line ? `<small class="text-muted">Line: ${warning.line}</small>` : ''}
                </div>
            `;
        });
    }
    
    // Process informational messages
    if (data.analysis.info && data.analysis.info.length > 0) {
        infoCount = data.analysis.info.length;
        resultHtml += '<h5>Information</h5>';
        
        data.analysis.info.forEach(info => {
            resultHtml += `
                <div class="alert alert-info issue-item info">
                    <h6 class="alert-heading">${info.message}</h6>
                    <p>${info.recommendation}</p>
                    ${info.line ? `<small class="text-muted">Line: ${info.line}</small>` : ''}
                </div>
            `;
        });
    }
    
    // Display optimization details
    if (data.optimization_details && data.optimization_details.length > 0) {
        resultHtml += '<h5>Optimization Details</h5>';
        resultHtml += '<div class="list-group mb-3">';
        
        data.optimization_details.forEach(detail => {
            resultHtml += `
                <div class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${detail.type}</h6>
                    </div>
                    <p class="mb-1">${detail.description}</p>
                    <small>Changed: <code>${detail.original}</code> to <code>${detail.replacement}</code></small>
                </div>
            `;
        });
        
        resultHtml += '</div>';
    }
    
    // If no issues were found
    if (issueCount === 0 && warningCount === 0 && infoCount === 0) {
        resultHtml = `
            <div class="alert alert-success">
                <i class="fas fa-check-circle me-2"></i>No issues found in the SQL code.
            </div>
        `;
    }
    
    // Update the badge count
    document.getElementById('issues-badge').textContent = issueCount + warningCount;
    
    // Update the analysis results
    analysisResults.innerHTML = resultHtml;
    
    // Scroll to results
    resultsContainer.scrollIntoView({
        behavior: 'smooth'
    });
}

/**
 * Analyze SQL code
 */
function analyzeSql(sqlCode, sourceType, targetVersion, auroraSpecific) {
    if (isAnalyzing) {
        return;
    }
    
    isAnalyzing = true;
    
    // Show enhanced loading animation
    showAnalysisLoadingAnimation();
    document.getElementById('analyze-button').classList.add('d-none');
    document.getElementById('loading-spinner').classList.remove('d-none');
    
    // Call the API to analyze the SQL
    fetch('/api/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            sql: sqlCode,
            source_type: sourceType,
            target_version: targetVersion,
            aurora_specific: auroraSpecific
        }),
    })
    .then(response => response.json())
    .then(data => {
        isAnalyzing = false;
        
        // Hide loading spinner
        document.getElementById('analyze-button').classList.remove('d-none');
        document.getElementById('loading-spinner').classList.add('d-none');
        
        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }
        
        // Display the results
        displayAnalysisResults(data);
        
        // Display performance metrics if available
        if (data.performance_metrics) {
            displayPerformanceMetrics(data.performance_metrics);
        }
        
        // Trigger gamification event for query analysis
        if (window.SQLGameification) {
            SQLGameification.triggerEvent('sqlQueryAnalyzed', {
                sourceType: sourceType,
                targetVersion: targetVersion,
                auroraSpecific: auroraSpecific,
                issuesFound: data.analysis.issues ? data.analysis.issues.length : 0
            });
        }
        
        // Refresh the recent queries list
        loadRecentQueries();
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred during analysis');
        
        isAnalyzing = false;
        
        // Hide loading spinner
        document.getElementById('analyze-button').classList.remove('d-none');
        document.getElementById('loading-spinner').classList.add('d-none');
    });
}

/**
 * Helper function to escape HTML
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Set up refresh button for recent queries
// Add a download button for batch processing
function setupBatchDownloadButton() {
    const batchDownloadButton = document.getElementById('download-all-sql');
    if (!batchDownloadButton) return;
    
    batchDownloadButton.addEventListener('click', function() {
        // Get all the optimized SQL from the batch results
        const accordionContainer = document.getElementById('accordion-container');
        const optimizedSqlElements = accordionContainer.querySelectorAll('.batch-item-optimized');
        
        if (optimizedSqlElements.length === 0) {
            alert('No optimized SQL available to download.');
            return;
        }
        
        // Collect all optimized SQL statements
        const sqlStatements = [];
        let sourceType = 'oracle';
        let targetVersion = '15';
        
        optimizedSqlElements.forEach(element => {
            const sql = element.textContent || element.innerText;
            sqlStatements.push(sql);
            
            // Get source type and target version from the first element
            if (sqlStatements.length === 1) {
                const batchItem = element.closest('.batch-item');
                sourceType = batchItem.getAttribute('data-source') || sourceType;
                targetVersion = batchItem.getAttribute('data-target') || targetVersion;
            }
        });
        
        // Show temporary "Downloading..." message
        const originalText = batchDownloadButton.innerHTML;
        batchDownloadButton.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Downloading...';
        
        // Use server-side API for better handling
        fetch('/api/download_batch_sql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sql_statements: sqlStatements,
                source_type: sourceType,
                target_version: targetVersion
            }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.blob();
        })
        .then(blob => {
            // Use FileSaver.js to save the file
            const timestamp = new Date().toISOString().slice(0, 10);
            saveAs(blob, `aurora_optimized_batch_${timestamp}.zip`);
            
            // Show success message
            batchDownloadButton.innerHTML = '<i class="fas fa-check me-1"></i>Downloaded!';
            
            setTimeout(() => {
                batchDownloadButton.innerHTML = originalText;
            }, 2000);
        })
        .catch(error => {
            console.error('Error downloading batch file:', error);
            
            // Fallback to client-side zip creation
            const zip = new JSZip();
            
            // Add each SQL to the zip
            optimizedSqlElements.forEach((element, index) => {
                const sql = element.textContent || element.innerText;
                const sourceType = element.closest('.batch-item').getAttribute('data-source') || 'unknown';
                const filename = `aurora_optimized_${index + 1}_${sourceType}.sql`;
                zip.file(filename, sql);
            });
            
            // Generate the zip file
            zip.generateAsync({type: 'blob'})
                .then(function(content) {
                    // Save the zip file
                    const timestamp = new Date().toISOString().slice(0, 10);
                    saveAs(content, `aurora_optimized_batch_${timestamp}.zip`);
                    
                    // Show success message
                    batchDownloadButton.innerHTML = '<i class="fas fa-check me-1"></i>Downloaded!';
                    
                    setTimeout(() => {
                        batchDownloadButton.innerHTML = originalText;
                    }, 2000);
                });
        });
    });
}

// Export batch results as a report
function setupBatchExportButton() {
    const exportButton = document.getElementById('export-batch-results');
    if (!exportButton) return;
    
    exportButton.addEventListener('click', function() {
        const accordionContainer = document.getElementById('accordion-container');
        const batchItems = accordionContainer.querySelectorAll('.batch-item');
        
        if (batchItems.length === 0) {
            alert('No results available to export.');
            return;
        }
        
        let report = "# Aurora PostgreSQL Migration Analysis Report\n\n";
        report += `Generated on: ${new Date().toLocaleString()}\n\n`;
        
        batchItems.forEach((item, index) => {
            const sourceType = item.getAttribute('data-source') || 'unknown';
            const original = item.querySelector('.batch-item-original').textContent;
            const optimized = item.querySelector('.batch-item-optimized').textContent;
            const issues = item.querySelectorAll('.issue-item');
            
            report += `## SQL Statement ${index + 1} (${sourceType})\n\n`;
            report += "### Original SQL\n\n```sql\n" + original + "\n```\n\n";
            report += "### Optimized SQL\n\n```sql\n" + optimized + "\n```\n\n";
            
            if (issues.length > 0) {
                report += "### Issues and Recommendations\n\n";
                
                issues.forEach(issue => {
                    const type = issue.classList.contains('error') ? 'Error' :
                                issue.classList.contains('warning') ? 'Warning' : 'Info';
                    const heading = issue.querySelector('.alert-heading').textContent;
                    const content = issue.querySelector('p').textContent;
                    
                    report += `- **${type}**: ${heading}\n  - ${content}\n\n`;
                });
            }
            
            report += "\n---\n\n";
        });
        
        // Create a blob and download it
        const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
        const timestamp = new Date().toISOString().slice(0, 10);
        saveAs(blob, `aurora_migration_report_${timestamp}.md`);
        
        // Show temporary message
        const originalText = exportButton.innerHTML;
        exportButton.innerHTML = '<i class="fas fa-check me-1"></i>Report Downloaded!';
        
        setTimeout(() => {
            exportButton.innerHTML = originalText;
        }, 2000);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const refreshButton = document.getElementById('refresh-recent');
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            loadRecentQueries();
        });
    }
    
    // Setup download buttons
    setupBatchDownloadButton();
    setupBatchExportButton();
});

// Enhanced loading animation functions
function showAnalysisLoadingAnimation() {
    const loadingContainer = document.getElementById('loading-spinner');
    if (!loadingContainer) return;
    
    loadingContainer.innerHTML = `
        <div class="loading-container">
            <div class="sql-loading"></div>
            <div class="db-connection">
                <div class="db-icon"></div>
                <div class="connection-line"></div>
                <div class="db-icon"></div>
            </div>
            <div class="performance-meter"></div>
            <div class="sql-icons">
                <div class="sql-icon">S</div>
                <div class="sql-icon">Q</div>
                <div class="sql-icon">L</div>
            </div>
            <div class="loading-text">Analyzing SQL performance</div>
        </div>
    `;
}

function hideAnalysisLoadingAnimation() {
    const loadingContainer = document.getElementById('loading-spinner');
    if (loadingContainer) {
        loadingContainer.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        `;
    }
}

// Override the existing download functions to trigger gamification events
const originalDownloadOptimizedFunction = window.downloadOptimized || function() {};

function triggerDownloadEvent(type) {
    if (window.SQLGameification) {
        SQLGameification.triggerEvent('sqlDownloaded', {
            type: type,
            timestamp: new Date()
        });
    }
}

/**
 * Display performance metrics in the UI
 */
function displayPerformanceMetrics(metrics) {
    const container = document.getElementById('performance-metrics');
    if (!container) return;

    container.innerHTML = `
        <div class="row g-4">
            <!-- Execution Time Improvement -->
            <div class="col-lg-6">
                <div class="card h-100">
                    <div class="card-header">
                        <h5 class="card-title mb-0">
                            <i class="fas fa-clock text-primary me-2"></i>Execution Time Estimation
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            <div class="performance-gauge me-3">
                                <div class="gauge-circle" data-percentage="${metrics.execution_time.estimated_improvement_percentage}">
                                    <span class="gauge-text">${metrics.execution_time.estimated_improvement_percentage}%</span>
                                </div>
                            </div>
                            <div>
                                <p class="mb-1 text-muted">Estimated Improvement</p>
                                <p class="mb-0 small">Confidence: ${metrics.execution_time.confidence_level}</p>
                            </div>
                        </div>
                        <div class="improvement-factors">
                            <h6>Contributing Factors:</h6>
                            <ul class="list-unstyled">
                                ${metrics.execution_time.factors.map(factor => 
                                    `<li><i class="fas fa-check text-success me-2"></i>${factor}</li>`
                                ).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Resource Usage Improvements -->
            <div class="col-lg-6">
                <div class="card h-100">
                    <div class="card-header">
                        <h5 class="card-title mb-0">
                            <i class="fas fa-server text-primary me-2"></i>Resource Usage Improvements
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="resource-metrics">
                            <div class="metric-item d-flex justify-content-between align-items-center mb-3">
                                <span><i class="fas fa-microchip text-info me-2"></i>CPU Usage</span>
                                <div class="progress flex-grow-1 mx-3" style="height: 8px;">
                                    <div class="progress-bar bg-info" style="width: ${metrics.resource_usage.cpu_usage_improvement}%"></div>
                                </div>
                                <span class="badge bg-info">${metrics.resource_usage.cpu_usage_improvement}%</span>
                            </div>
                            <div class="metric-item d-flex justify-content-between align-items-center mb-3">
                                <span><i class="fas fa-memory text-warning me-2"></i>Memory</span>
                                <div class="progress flex-grow-1 mx-3" style="height: 8px;">
                                    <div class="progress-bar bg-warning" style="width: ${metrics.resource_usage.memory_usage_improvement}%"></div>
                                </div>
                                <span class="badge bg-warning">${metrics.resource_usage.memory_usage_improvement}%</span>
                            </div>
                            <div class="metric-item d-flex justify-content-between align-items-center mb-3">
                                <span><i class="fas fa-hdd text-success me-2"></i>I/O Operations</span>
                                <div class="progress flex-grow-1 mx-3" style="height: 8px;">
                                    <div class="progress-bar bg-success" style="width: ${metrics.resource_usage.io_operations_improvement}%"></div>
                                </div>
                                <span class="badge bg-success">${metrics.resource_usage.io_operations_improvement}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Complexity Analysis -->
            <div class="col-lg-6">
                <div class="card h-100">
                    <div class="card-header">
                        <h5 class="card-title mb-0">
                            <i class="fas fa-chart-line text-primary me-2"></i>Complexity Analysis
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="complexity-comparison">
                            <div class="row text-center mb-3">
                                <div class="col">
                                    <div class="complexity-score original">
                                        <div class="score-value">${metrics.complexity_analysis.original_complexity_score}</div>
                                        <div class="score-label">Original</div>
                                    </div>
                                </div>
                                <div class="col-auto d-flex align-items-center">
                                    <i class="fas fa-arrow-right text-muted"></i>
                                </div>
                                <div class="col">
                                    <div class="complexity-score optimized">
                                        <div class="score-value">${metrics.complexity_analysis.optimized_complexity_score}</div>
                                        <div class="score-label">Optimized</div>
                                    </div>
                                </div>
                            </div>
                            <div class="text-center">
                                <span class="badge bg-primary fs-6">
                                    ${metrics.complexity_analysis.complexity_reduction}% Complexity Reduction
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- PostgreSQL Benefits -->
            <div class="col-lg-6">
                <div class="card h-100">
                    <div class="card-header">
                        <h5 class="card-title mb-0">
                            <i class="fas fa-elephant text-primary me-2"></i>PostgreSQL Benefits
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="benefits-list">
                            <p class="mb-3"><strong>${metrics.postgresql_benefits.standards_compliance}</strong></p>
                            <p class="mb-3"><strong>${metrics.postgresql_benefits.portability}</strong></p>
                            <h6>Key Improvements:</h6>
                            <ul class="list-unstyled">
                                ${metrics.postgresql_benefits.features.map(feature => 
                                    `<li class="mb-1"><i class="fas fa-check text-success me-2"></i>${feature}</li>`
                                ).join('')}
                            </ul>
                            ${metrics.postgresql_benefits.aurora_benefits ? `
                                <h6 class="mt-3">Aurora PostgreSQL:</h6>
                                <ul class="list-unstyled">
                                    ${metrics.postgresql_benefits.aurora_benefits.map(benefit => 
                                        `<li class="mb-1"><i class="fas fa-cloud text-info me-2"></i>${benefit}</li>`
                                    ).join('')}
                                </ul>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Optimization Summary -->
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title mb-0">
                            <i class="fas fa-cogs text-primary me-2"></i>Optimization Summary
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-4">
                                <div class="text-center p-3">
                                    <div class="h2 text-primary mb-0">${metrics.optimization_summary.total_optimizations}</div>
                                    <div class="text-muted">Total Optimizations</div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="text-center p-3">
                                    <div class="h2 text-success mb-0">${metrics.optimization_summary.high_impact_optimizations}</div>
                                    <div class="text-muted">High Impact Changes</div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="text-center p-3">
                                    <div class="h2 text-info mb-0">${metrics.optimization_summary.estimated_maintenance_improvement}%</div>
                                    <div class="text-muted">Maintainability Improvement</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Recommendations -->
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title mb-0">
                            <i class="fas fa-lightbulb text-primary me-2"></i>Performance Recommendations
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="recommendations-list">
                            ${metrics.recommendations.map(rec => 
                                `<div class="alert alert-light border-start border-primary border-4 mb-2">
                                    <i class="fas fa-info-circle text-primary me-2"></i>${rec}
                                </div>`
                            ).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Initialize performance gauge animation
    setTimeout(() => {
        initializePerformanceGauge();
    }, 100);
}

/**
 * Initialize the circular performance gauge
 */
function initializePerformanceGauge() {
    const gaugeElement = document.querySelector('.gauge-circle');
    if (!gaugeElement) return;
    
    const percentage = parseFloat(gaugeElement.dataset.percentage) || 0;
    const circumference = 2 * Math.PI * 45; // radius = 45
    
    // Create SVG for the gauge
    gaugeElement.innerHTML = `
        <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" stroke="#e9ecef" stroke-width="8" fill="none"></circle>
            <circle cx="50" cy="50" r="45" stroke="#ff9900" stroke-width="8" fill="none"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${circumference - (circumference * percentage / 100)}"
                    stroke-linecap="round" transform="rotate(-90 50 50)" class="gauge-progress"></circle>
        </svg>
        <div class="gauge-text">${percentage}%</div>
    `;
}
