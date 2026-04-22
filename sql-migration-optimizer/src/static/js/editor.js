/**
 * SQL Editor initialization and functionality
 */

// Global reference to the SQL editor
let sqlEditor;

/**
 * Initialize the SQL editor with CodeMirror
 */
function initSqlEditor() {
    // Initialize the CodeMirror editor
    sqlEditor = CodeMirror.fromTextArea(document.getElementById('sql-input'), {
        mode: 'text/x-sql',
        theme: 'darcula',
        lineNumbers: true,
        matchBrackets: true,
        indentWithTabs: false,
        indentUnit: 4,
        lineWrapping: true,
        extraKeys: {"Ctrl-Space": "autocomplete"},
        hintOptions: {tables: {}}
    });
    
    // Set up event listeners
    setupEditorEventListeners();
}

/**
 * Set up event listeners for the editor and related buttons
 */
function setupEditorEventListeners() {
    // Analyze button
    const analyzeButton = document.getElementById('analyze-button');
    if (analyzeButton) {
        analyzeButton.addEventListener('click', function() {
            const sqlCode = sqlEditor.getValue();
            if (!sqlCode.trim()) {
                alert('Please enter SQL code to analyze');
                return;
            }
            
            const sourceType = document.getElementById('source-type').value;
            const targetVersion = document.getElementById('target-version').value;
            const auroraSpecific = document.getElementById('aurora-specific').checked;
            
            analyzeSql(sqlCode, sourceType, targetVersion, auroraSpecific);
        });
    }
    
    // Clear button
    const clearButton = document.getElementById('clear-button');
    if (clearButton) {
        clearButton.addEventListener('click', function() {
            sqlEditor.setValue('');
            document.getElementById('results-container').classList.add('d-none');
        });
    }
    
    // Copy optimized SQL button
    const copyOptimizedButton = document.getElementById('copy-optimized');
    if (copyOptimizedButton) {
        copyOptimizedButton.addEventListener('click', function() {
            const optimizedSql = document.getElementById('optimized-sql');
            optimizedSql.select();
            document.execCommand('copy');
            
            // Show a temporary tooltip or message
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-check me-1"></i>Copied!';
            
            setTimeout(() => {
                this.innerHTML = originalText;
            }, 2000);
        });
    }

    // Download optimized SQL button
    const downloadOptimizedButton = document.getElementById('download-optimized');
    if (downloadOptimizedButton) {
        downloadOptimizedButton.addEventListener('click', function() {
            const optimizedSql = document.getElementById('optimized-sql').value;
            if (!optimizedSql.trim()) {
                alert('No optimized SQL available to download.');
                return;
            }
            
            const sourceType = document.getElementById('source-type').value;
            const targetVersion = document.getElementById('target-version').value;
            
            // Show temporary "Downloading..." message
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Downloading...';
            
            // Use our API endpoint to download the file
            fetch('/api/download_sql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sql: optimizedSql,
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
                const filename = `aurora_pg${targetVersion}_optimized_${timestamp}.sql`;
                saveAs(blob, filename);
                
                // Show success message
                this.innerHTML = '<i class="fas fa-check me-1"></i>Downloaded!';
                
                // Trigger gamification event
                if (window.SQLGameification) {
                    SQLGameification.triggerEvent('sqlDownloaded', {
                        type: 'single',
                        timestamp: new Date()
                    });
                }
                
                setTimeout(() => {
                    this.innerHTML = originalText;
                }, 2000);
            })
            .catch(error => {
                console.error('Error downloading file:', error);
                
                // Create a blob and download it as fallback
                const blob = new Blob([optimizedSql], { type: 'text/plain;charset=utf-8' });
                const filename = `aurora_pg${targetVersion}_optimized_${new Date().toISOString().slice(0, 10)}.sql`;
                saveAs(blob, filename);
                
                this.innerHTML = '<i class="fas fa-check me-1"></i>Downloaded!';
                
                setTimeout(() => {
                    this.innerHTML = originalText;
                }, 2000);
            });
        });
    }
    
    // Use optimized SQL as input button
    const useOptimizedButton = document.getElementById('use-optimized');
    if (useOptimizedButton) {
        useOptimizedButton.addEventListener('click', function() {
            const optimizedSql = document.getElementById('optimized-sql').value;
            sqlEditor.setValue(optimizedSql);
            
            // Scroll back to the editor
            document.querySelector('.card').scrollIntoView({
                behavior: 'smooth'
            });
        });
    }
    
    // Key shortcut for analyze (Ctrl+Enter)
    sqlEditor.setOption('extraKeys', {
        'Ctrl-Enter': function() {
            const sqlCode = sqlEditor.getValue();
            if (!sqlCode.trim()) {
                return;
            }
            
            const sourceType = document.getElementById('source-type').value;
            const targetVersion = document.getElementById('target-version').value;
            const auroraSpecific = document.getElementById('aurora-specific').checked;
            
            analyzeSql(sqlCode, sourceType, targetVersion, auroraSpecific);
        },
        'Ctrl-Space': 'autocomplete'
    });
}

/**
 * Sample SQL templates for quick insertion
 */
const sqlTemplates = {
    oracleSelect: `SELECT e.employee_id, e.first_name, e.last_name, d.department_name
FROM employees e, departments d
WHERE e.department_id = d.department_id
AND ROWNUM <= 10`,

    oracleFunction: `CREATE OR REPLACE FUNCTION get_employee_salary(
    p_emp_id IN NUMBER
) RETURN NUMBER
IS
    v_salary NUMBER;
BEGIN
    SELECT salary INTO v_salary
    FROM employees
    WHERE employee_id = p_emp_id;
    
    RETURN v_salary;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN NULL;
END;`,

    sqlserverSelect: `SELECT TOP 10 e.employee_id, e.first_name, e.last_name, d.department_name
FROM employees e
INNER JOIN departments d ON e.department_id = d.department_id
WHERE e.hire_date > GETDATE() - 365`,

    sqlserverProcedure: `CREATE PROCEDURE update_employee_salary
    @employee_id INT,
    @new_salary DECIMAL(10, 2)
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE employees
    SET salary = @new_salary
    WHERE employee_id = @employee_id;
    
    SELECT @@ROWCOUNT AS rows_affected;
END`
};

/**
 * Insert a SQL template into the editor
 */
function insertTemplate(templateKey) {
    if (sqlTemplates[templateKey]) {
        sqlEditor.setValue(sqlTemplates[templateKey]);
    }
}

// Add event listener for template buttons if they exist
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-template]').forEach(button => {
        button.addEventListener('click', function() {
            const templateKey = this.getAttribute('data-template');
            insertTemplate(templateKey);
        });
    });
});
