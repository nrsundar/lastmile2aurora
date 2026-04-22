import re
import sqlparse
from sql_parser import parse_sql, determine_sql_type, extract_tables, is_oracle_specific, is_sqlserver_specific

def analyze_sql(sql_code, source_type='oracle', target_version='16', aurora_specific=True):
    """
    Analyze SQL code for potential performance issues when migrating to PostgreSQL
    
    Args:
        sql_code: The SQL code to analyze
        source_type: The source database type ('oracle', 'sqlserver', or 'postgresql')
        target_version: Target PostgreSQL version ('14', '15', or '16')
        aurora_specific: Whether to include Aurora PostgreSQL-specific optimizations
        
    Returns:
        Dictionary containing analysis results
    """
    # Initialize results
    results = {
        'issues': [],
        'warnings': [],
        'info': []
    }
    
    # Parse the SQL code
    statements = parse_sql(sql_code)
    
    if not statements:
        results['warnings'].append({
            'type': 'parse_error',
            'message': 'Could not parse SQL code. Please check the syntax.',
            'line': 0
        })
        return results
    
    # Analyze each statement
    for i, stmt in enumerate(statements):
        stmt_type = determine_sql_type(stmt)
        
        # Get the statement as string and find its position in the original code
        stmt_str = str(stmt)
        stmt_position = sql_code.find(stmt_str)
        
        # Count the number of newlines before the statement to determine line number
        line_number = 1
        if stmt_position > 0:
            line_number += sql_code[:stmt_position].count('\n')
        
        # General analysis for all statement types
        _check_general_issues(stmt, stmt_str, results, line_number, source_type)
        
        # Specific analysis based on statement type
        if stmt_type == 'query':
            _analyze_query(stmt, stmt_str, results, line_number, source_type)
        elif stmt_type == 'function' or stmt_type == 'procedure':
            _analyze_routine(stmt, stmt_str, results, line_number, source_type)
        elif stmt_type == 'dml':
            _analyze_dml(stmt, stmt_str, results, line_number, source_type)
    
    # Source-specific analysis
    if source_type == 'oracle':
        _analyze_oracle_specific(sql_code, results)
    elif source_type == 'sqlserver':
        _analyze_sqlserver_specific(sql_code, results)
    
    return results

def _check_general_issues(stmt, stmt_str, results, line_number, source_type):
    """Check for general SQL issues that apply to any statement type"""
    
    # Check for proprietary functions that need to be replaced
    if source_type == 'oracle':
        # Oracle TO_DATE/TO_CHAR functions
        if re.search(r'to_date\s*\(', stmt_str, re.IGNORECASE):
            results['issues'].append({
                'type': 'function_replacement',
                'message': 'Oracle TO_DATE function should be replaced with PostgreSQL TO_TIMESTAMP',
                'line': line_number,
                'recommendation': 'Replace TO_DATE() with TO_TIMESTAMP() and adjust format strings accordingly'
            })
        
        if re.search(r'to_char\s*\(.*,\s*[\'"].*[\'"]', stmt_str, re.IGNORECASE):
            results['issues'].append({
                'type': 'function_replacement',
                'message': 'Oracle TO_CHAR function format strings may differ in PostgreSQL',
                'line': line_number,
                'recommendation': 'Review format strings in TO_CHAR() calls, as PostgreSQL uses different format patterns'
            })
        
        # Check for SYSDATE
        if re.search(r'\bsysdate\b', stmt_str, re.IGNORECASE):
            results['issues'].append({
                'type': 'function_replacement',
                'message': 'Oracle SYSDATE should be replaced with CURRENT_TIMESTAMP in PostgreSQL',
                'line': line_number,
                'recommendation': 'Replace SYSDATE with CURRENT_TIMESTAMP'
            })
            
        # Check for NVL
        if re.search(r'nvl\s*\(', stmt_str, re.IGNORECASE):
            results['issues'].append({
                'type': 'function_replacement',
                'message': 'Oracle NVL function should be replaced with COALESCE in PostgreSQL',
                'line': line_number,
                'recommendation': 'Replace NVL() with COALESCE()'
            })
            
    elif source_type == 'sqlserver':
        # SQL Server ISNULL
        if re.search(r'isnull\s*\(', stmt_str, re.IGNORECASE):
            results['issues'].append({
                'type': 'function_replacement',
                'message': 'SQL Server ISNULL function should be replaced with COALESCE in PostgreSQL',
                'line': line_number,
                'recommendation': 'Replace ISNULL() with COALESCE()'
            })
        
        # GETDATE
        if re.search(r'getdate\s*\(', stmt_str, re.IGNORECASE):
            results['issues'].append({
                'type': 'function_replacement',
                'message': 'SQL Server GETDATE() should be replaced with CURRENT_TIMESTAMP in PostgreSQL',
                'line': line_number,
                'recommendation': 'Replace GETDATE() with CURRENT_TIMESTAMP'
            })
    
    # Check for potential schema/owner qualifiers that might need adjustment
    if re.search(r'[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+', stmt_str):
        results['warnings'].append({
            'type': 'schema_reference',
            'message': 'Three-part identifier detected, PostgreSQL uses different schema reference conventions',
            'line': line_number,
            'recommendation': 'Replace three-part identifiers (db.schema.object) with two-part (schema.object)'
        })

def _analyze_query(stmt, stmt_str, results, line_number, source_type):
    """Analyze a SELECT query for PostgreSQL optimization opportunities"""
    
    # Check for ROWNUM (Oracle) or TOP (SQL Server)
    if source_type == 'oracle' and re.search(r'\brownum\b', stmt_str, re.IGNORECASE):
        results['issues'].append({
            'type': 'pagination',
            'message': 'Oracle ROWNUM should be replaced with LIMIT/OFFSET in PostgreSQL',
            'line': line_number,
            'recommendation': 'Replace "WHERE ROWNUM <= n" with "LIMIT n" and "WHERE ROWNUM BETWEEN n AND m" with "LIMIT (m-n+1) OFFSET (n-1)"'
        })
    elif source_type == 'sqlserver' and re.search(r'top\s+\d+', stmt_str, re.IGNORECASE):
        results['issues'].append({
            'type': 'pagination',
            'message': 'SQL Server TOP clause should be replaced with LIMIT in PostgreSQL',
            'line': line_number,
            'recommendation': 'Replace "TOP n" with "LIMIT n"'
        })
    
    # Check for inefficient joins (lack of explicit join conditions)
    if re.search(r'from\s+[a-zA-Z0-9_\.]+\s*,\s*[a-zA-Z0-9_\.]+', stmt_str, re.IGNORECASE):
        results['issues'].append({
            'type': 'join_syntax',
            'message': 'Implicit joins using comma-separated tables can lead to performance issues',
            'line': line_number,
            'recommendation': 'Replace comma-separated table lists with explicit JOIN syntax and ON conditions'
        })
    
    # Check for potential subquery performance issues
    if stmt_str.count('SELECT') > 1:
        # If we have a subquery in the WHERE clause, suggest using EXISTS instead
        if re.search(r'where\s+.*\(\s*select', stmt_str, re.IGNORECASE | re.DOTALL):
            results['warnings'].append({
                'type': 'subquery_optimization',
                'message': 'Subquery in WHERE clause may perform poorly',
                'line': line_number,
                'recommendation': 'Consider using EXISTS or JOIN instead of a subquery in the WHERE clause for better performance'
            })
        
        # If we have a subquery in the SELECT clause, suggest joining instead
        if re.search(r'select\s+.*\(\s*select', stmt_str, re.IGNORECASE | re.DOTALL):
            results['warnings'].append({
                'type': 'subquery_optimization',
                'message': 'Subquery in SELECT clause may perform poorly',
                'line': line_number,
                'recommendation': 'Consider using JOIN instead of a subquery in the SELECT clause for better performance'
            })

    # Check for use of DISTINCT which might indicate a need for better joins
    if re.search(r'select\s+distinct', stmt_str, re.IGNORECASE):
        results['info'].append({
            'type': 'distinct_usage',
            'message': 'DISTINCT usage detected, which may indicate suboptimal join conditions',
            'line': line_number,
            'recommendation': 'Review if DISTINCT is necessary or if it could be eliminated by improving join conditions'
        })
    
    # Check for potential missing indexes (WHERE/JOIN conditions on non-indexed columns)
    tables = extract_tables(stmt)
    if tables:
        where_columns = re.findall(r'where\s+(\w+)\.(\w+)', stmt_str, re.IGNORECASE)
        join_columns = re.findall(r'join\s+\w+\s+on\s+(\w+)\.(\w+)', stmt_str, re.IGNORECASE)
        
        if where_columns or join_columns:
            results['info'].append({
                'type': 'index_recommendation',
                'message': 'Columns used in WHERE/JOIN conditions may benefit from indexes in PostgreSQL',
                'line': line_number,
                'recommendation': 'Consider creating indexes on columns used in WHERE clauses and JOIN conditions'
            })

def _analyze_routine(stmt, stmt_str, results, line_number, source_type):
    """Analyze a stored procedure or function for PostgreSQL compatibility"""
    
    # Oracle PL/SQL to PostgreSQL PL/pgSQL conversion issues
    if source_type == 'oracle':
        # Check for variable declarations
        if re.search(r'\w+\s+\w+%TYPE', stmt_str, re.IGNORECASE):
            results['issues'].append({
                'type': 'type_declaration',
                'message': 'Oracle %TYPE attribute needs to be adjusted for PostgreSQL',
                'line': line_number,
                'recommendation': 'Replace "variable table.column%TYPE" with "variable table.column%TYPE" if the table exists or explicit type declaration'
            })
        
        # Check for exception handling
        if re.search(r'when\s+others\s+then', stmt_str, re.IGNORECASE):
            results['warnings'].append({
                'type': 'exception_handling',
                'message': 'Oracle exception handling may need adjustments for PostgreSQL',
                'line': line_number,
                'recommendation': 'Review exception handling blocks, PostgreSQL has different exception names and handling mechanisms'
            })
        
        # Check for autonomous transactions
        if re.search(r'pragma\s+autonomous_transaction', stmt_str, re.IGNORECASE):
            results['issues'].append({
                'type': 'transaction_control',
                'message': 'Oracle PRAGMA AUTONOMOUS_TRANSACTION is not supported in PostgreSQL',
                'line': line_number,
                'recommendation': 'Rewrite the logic using dblink or other approaches to achieve similar functionality'
            })
    
    # SQL Server T-SQL to PostgreSQL PL/pgSQL conversion issues
    elif source_type == 'sqlserver':
        # Check for variable declarations
        if re.search(r'declare\s+@\w+', stmt_str, re.IGNORECASE):
            results['issues'].append({
                'type': 'variable_declaration',
                'message': 'SQL Server variable declarations need to be adjusted for PostgreSQL',
                'line': line_number,
                'recommendation': 'Replace "DECLARE @var_name type" with "var_name type;"'
            })
        
        # Check for SET statements
        if re.search(r'set\s+@\w+\s*=', stmt_str, re.IGNORECASE):
            results['issues'].append({
                'type': 'variable_assignment',
                'message': 'SQL Server SET statement needs to be adjusted for PostgreSQL',
                'line': line_number,
                'recommendation': 'Replace "SET @var_name = value" with "var_name := value;"'
            })
        
        # Check for IF/ELSE structure
        if re.search(r'if\s+.*\s+begin', stmt_str, re.IGNORECASE):
            results['warnings'].append({
                'type': 'control_flow',
                'message': 'SQL Server IF/BEGIN/END structure needs to be adjusted for PostgreSQL',
                'line': line_number,
                'recommendation': 'Replace "IF condition BEGIN ... END" with "IF condition THEN ... END IF;"'
            })

def _analyze_dml(stmt, stmt_str, results, line_number, source_type):
    """Analyze INSERT, UPDATE, DELETE statements for PostgreSQL optimization"""
    
    # Check for Oracle-style MERGE or SQL Server MERGE
    if re.search(r'merge\s+into', stmt_str, re.IGNORECASE):
        results['issues'].append({
            'type': 'merge_statement',
            'message': f'{source_type.capitalize()} MERGE statement needs to be rewritten for PostgreSQL',
            'line': line_number,
            'recommendation': 'Replace MERGE with INSERT ... ON CONFLICT or a combination of UPDATE and INSERT statements'
        })
    
    # Check for RETURNING clause in Oracle or OUTPUT in SQL Server
    if source_type == 'oracle' and re.search(r'returning\s+', stmt_str, re.IGNORECASE):
        results['info'].append({
            'type': 'returning_clause',
            'message': 'Oracle RETURNING clause is supported in PostgreSQL, but syntax might need adjustments',
            'line': line_number,
            'recommendation': 'Review RETURNING clause syntax, PostgreSQL supports this functionality but with potentially different column referencing'
        })
    elif source_type == 'sqlserver' and re.search(r'output\s+', stmt_str, re.IGNORECASE):
        results['issues'].append({
            'type': 'output_clause',
            'message': 'SQL Server OUTPUT clause needs to be replaced with RETURNING in PostgreSQL',
            'line': line_number,
            'recommendation': 'Replace OUTPUT clause with RETURNING clause'
        })
    
    # Check for UPDATEs with JOINs in SQL Server style
    if source_type == 'sqlserver' and re.search(r'update\s+\w+\s+set\s+.*from', stmt_str, re.IGNORECASE | re.DOTALL):
        results['issues'].append({
            'type': 'update_join',
            'message': 'SQL Server style UPDATE with FROM clause needs adjustment for PostgreSQL',
            'line': line_number,
            'recommendation': 'Rewrite as "UPDATE table SET col = new_value FROM other_table WHERE conditions"'
        })

def _analyze_oracle_specific(sql_code, results):
    """Analyze Oracle-specific features that need special handling in PostgreSQL"""
    
    # Check for Oracle-specific data types
    if re.search(r'\b(varchar2|number|date|timestamp|clob|blob|long|raw)\b', sql_code, re.IGNORECASE):
        results['warnings'].append({
            'type': 'data_type',
            'message': 'Oracle-specific data types detected',
            'line': 0,
            'recommendation': 'Replace Oracle data types with PostgreSQL equivalents: VARCHAR2 → VARCHAR, NUMBER → NUMERIC, etc.'
        })
    
    # Check for CONNECT BY (hierarchical queries)
    if re.search(r'connect\s+by', sql_code, re.IGNORECASE):
        results['issues'].append({
            'type': 'hierarchical_query',
            'message': 'Oracle CONNECT BY hierarchical query syntax is not supported in PostgreSQL',
            'line': 0,
            'recommendation': 'Rewrite using Common Table Expressions (WITH) and recursive queries'
        })
    
    # Check for Oracle hints
    if re.search(r'/\*\+', sql_code):
        results['issues'].append({
            'type': 'optimizer_hints',
            'message': 'Oracle optimizer hints are not supported in PostgreSQL',
            'line': 0,
            'recommendation': 'Remove Oracle hints and use PostgreSQL-specific methods for query optimization if needed'
        })
    
    # Check for Oracle-specific functions
    oracle_functions = [
        r'\bdecode\s*\(',
        r'\bsys_context\s*\(',
        r'\bdbms_\w+\.\w+\s*\(',
        r'\butl_\w+\.\w+\s*\(',
    ]
    
    for func_pattern in oracle_functions:
        if re.search(func_pattern, sql_code, re.IGNORECASE):
            results['issues'].append({
                'type': 'function_not_supported',
                'message': 'Oracle-specific function detected that may not be available in PostgreSQL',
                'line': 0,
                'recommendation': 'Replace Oracle-specific functions with PostgreSQL equivalents or create custom functions'
            })
            break

def _analyze_sqlserver_specific(sql_code, results):
    """Analyze SQL Server-specific features that need special handling in PostgreSQL"""
    
    # Check for SQL Server-specific data types
    if re.search(r'\b(nvarchar|nchar|datetime|smalldatetime|money|uniqueidentifier|geography|xml)\b', sql_code, re.IGNORECASE):
        results['warnings'].append({
            'type': 'data_type',
            'message': 'SQL Server-specific data types detected',
            'line': 0,
            'recommendation': 'Replace SQL Server data types with PostgreSQL equivalents: NVARCHAR → VARCHAR, DATETIME → TIMESTAMP, etc.'
        })
    
    # Check for PIVOT/UNPIVOT
    if re.search(r'\b(pivot|unpivot)\b', sql_code, re.IGNORECASE):
        results['issues'].append({
            'type': 'pivot_operation',
            'message': 'SQL Server PIVOT/UNPIVOT operations are not directly supported in PostgreSQL',
            'line': 0,
            'recommendation': 'Rewrite using CASE expressions or crosstab functions'
        })
    
    # Check for specific SQL Server table hints
    if re.search(r'with\s*\(\s*(nolock|readuncommitted|readcommitted|repeatableread|serializable|readpast|updlock|xlock|rowlock|paglock|tablock|tablockx)\s*\)', sql_code, re.IGNORECASE):
        results['issues'].append({
            'type': 'table_hints',
            'message': 'SQL Server table hints are not supported in PostgreSQL',
            'line': 0,
            'recommendation': 'Remove table hints and adjust transaction isolation levels as needed'
        })
    
    # Check for SQL Server specific functions
    sqlserver_functions = [
        r'\bdatediff\s*\(',
        r'\bdateadd\s*\(',
        r'\bisdate\s*\(',
        r'\bconvert\s*\(',
        r'\bstuff\s*\(',
        r'\bpatindex\s*\(',
    ]
    
    for func_pattern in sqlserver_functions:
        if re.search(func_pattern, sql_code, re.IGNORECASE):
            results['issues'].append({
                'type': 'function_not_supported',
                'message': 'SQL Server-specific function detected that may not be available in PostgreSQL',
                'line': 0,
                'recommendation': 'Replace SQL Server-specific functions with PostgreSQL equivalents'
            })
            break
