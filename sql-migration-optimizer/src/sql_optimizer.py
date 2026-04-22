import re
from sql_parser import parse_sql, determine_sql_type, is_oracle_specific, is_sqlserver_specific

def optimize_sql(sql_code, source_type, analysis_results, target_version='16', aurora_specific=True):
    """
    Optimize SQL code for PostgreSQL based on analysis results
    
    Args:
        sql_code: The original SQL code
        source_type: The source database type ('oracle', 'sqlserver', or 'postgresql')
        analysis_results: Results from the SQL analyzer
        target_version: Target PostgreSQL version ('14', '15', or '16')
        aurora_specific: Whether to include Aurora PostgreSQL-specific optimizations
        
    Returns:
        tuple: (optimized_sql, optimization_details)
    """
    optimized_sql = sql_code
    optimization_details = []
    
    # Process each issue from the analysis
    for issue in analysis_results.get('issues', []):
        if issue['type'] == 'function_replacement':
            if 'SYSDATE' in issue['message']:
                optimized_sql, details = _replace_sysdate(optimized_sql)
                if details:
                    optimization_details.append(details)
            
            elif 'TO_DATE' in issue['message']:
                optimized_sql, details = _replace_to_date(optimized_sql)
                if details:
                    optimization_details.append(details)
            
            elif 'TO_CHAR' in issue['message']:
                optimized_sql, details = _replace_to_char(optimized_sql)
                if details:
                    optimization_details.append(details)
            
            elif 'NVL' in issue['message'] or 'ISNULL' in issue['message']:
                optimized_sql, details = _replace_nvl_isnull(optimized_sql, source_type)
                if details:
                    optimization_details.append(details)
            
            elif 'GETDATE' in issue['message']:
                optimized_sql, details = _replace_getdate(optimized_sql)
                if details:
                    optimization_details.append(details)
        
        elif issue['type'] == 'pagination':
            if 'ROWNUM' in issue['message']:
                optimized_sql, details = _replace_rownum(optimized_sql)
                if details:
                    optimization_details.append(details)
            elif 'TOP' in issue['message']:
                optimized_sql, details = _replace_top(optimized_sql)
                if details:
                    optimization_details.append(details)
        
        elif issue['type'] == 'join_syntax':
            optimized_sql, details = _optimize_joins(optimized_sql)
            if details:
                optimization_details.append(details)
        
        elif issue['type'] == 'merge_statement':
            optimized_sql, details = _replace_merge(optimized_sql, source_type)
            if details:
                optimization_details.append(details)
        
        elif issue['type'] == 'output_clause':
            optimized_sql, details = _replace_output_with_returning(optimized_sql)
            if details:
                optimization_details.append(details)
        
        elif issue['type'] == 'update_join':
            optimized_sql, details = _optimize_update_join(optimized_sql)
            if details:
                optimization_details.append(details)
        
        elif issue['type'] == 'hierarchical_query':
            optimized_sql, details = _replace_connect_by(optimized_sql)
            if details:
                optimization_details.append(details)
    
    # Process warnings that might need optimization
    for warning in analysis_results.get('warnings', []):
        if warning['type'] == 'schema_reference':
            optimized_sql, details = _fix_schema_references(optimized_sql)
            if details:
                optimization_details.append(details)
        
        elif warning['type'] == 'subquery_optimization':
            optimized_sql, details = _optimize_subqueries(optimized_sql)
            if details:
                optimization_details.append(details)
        
        elif warning['type'] == 'data_type':
            optimized_sql, details = _convert_data_types(optimized_sql, source_type)
            if details:
                optimization_details.append(details)
    
    # Perform source-specific optimizations
    if source_type == 'oracle':
        optimized_sql, oracle_details = _oracle_specific_optimizations(optimized_sql)
        optimization_details.extend(oracle_details)
    elif source_type == 'sqlserver':
        optimized_sql, sqlserver_details = _sqlserver_specific_optimizations(optimized_sql)
        optimization_details.extend(sqlserver_details)
    elif source_type == 'postgresql':
        # For pure PostgreSQL, just focus on optimization
        optimizations = []
        
        # Check for COUNT(*) that could use COUNT(1) for slightly better performance
        if 'COUNT(*)' in optimized_sql:
            optimized_sql = optimized_sql.replace('COUNT(*)', 'COUNT(1)')
            optimizations.append({
                'type': 'performance_optimization',
                'original': 'COUNT(*)',
                'replacement': 'COUNT(1)',
                'description': 'Replaced COUNT(*) with COUNT(1) for small performance gain in Aurora PostgreSQL'
            })
        
        # Check for LIKE operations that could use indexed searches
        like_pattern = r'(\w+)\s+LIKE\s+\'%([^%]+)%\''
        if re.search(like_pattern, optimized_sql, re.IGNORECASE):
            # Suggest using full text search instead of LIKE with wildcards
            optimizations.append({
                'type': 'performance_suggestion',
                'original': 'column LIKE \'%value%\'',
                'replacement': 'to_tsvector(\'english\', column) @@ to_tsquery(\'value\')',
                'description': 'Consider using PostgreSQL full text search instead of LIKE with wildcards for better performance with large text fields'
            })
        
        # Check for Aurora-specific optimizations if requested
        if aurora_specific:
            # Check for large IN clauses that could use arrays
            in_clause_pattern = r'IN\s*\(([^)]+)\)'
            for match in re.finditer(in_clause_pattern, optimized_sql, re.IGNORECASE):
                in_values = match.group(1)
                if in_values.count(',') > 5:  # If more than 5 values in the IN clause
                    optimizations.append({
                        'type': 'aurora_optimization',
                        'original': 'IN clause with multiple values',
                        'replacement': 'column = ANY(ARRAY[values])',
                        'description': 'Consider using PostgreSQL arrays with ANY operator instead of large IN clauses for better performance in Aurora'
                    })
            
            # Add Aurora-specific version suggestions
            if int(target_version) >= 14:
                optimizations.append({
                    'type': 'aurora_configuration',
                    'original': 'Default settings',
                    'replacement': 'Aurora-optimized settings',
                    'description': f'For Aurora PostgreSQL {target_version}, consider enabling aurora_parallel_query=on for better performance'
                })
        
        optimization_details.extend(optimizations)
    
    return optimized_sql, optimization_details

def _replace_sysdate(sql):
    """Replace Oracle SYSDATE with PostgreSQL CURRENT_TIMESTAMP"""
    original = sql
    result = re.sub(r'\bsysdate\b', 'CURRENT_TIMESTAMP', sql, flags=re.IGNORECASE)
    
    if original != result:
        return result, {
            'type': 'function_replacement',
            'original': 'SYSDATE',
            'replacement': 'CURRENT_TIMESTAMP',
            'description': 'Replaced Oracle SYSDATE with PostgreSQL CURRENT_TIMESTAMP'
        }
    
    return sql, None

def _replace_to_date(sql):
    """Replace Oracle TO_DATE with PostgreSQL TO_TIMESTAMP"""
    original = sql
    
    # This is a simplified replacement - actual format strings might need manual adjustment
    result = re.sub(r'to_date\s*\(([^,]+),\s*([^)]+)\)', r'TO_TIMESTAMP(\1, \2)', sql, flags=re.IGNORECASE)
    
    if original != result:
        return result, {
            'type': 'function_replacement',
            'original': 'TO_DATE',
            'replacement': 'TO_TIMESTAMP',
            'description': 'Replaced Oracle TO_DATE with PostgreSQL TO_TIMESTAMP - format strings may need manual adjustment'
        }
    
    return sql, None

def _replace_to_char(sql):
    """Adjust Oracle TO_CHAR format strings for PostgreSQL"""
    original = sql
    
    # This is just a notification since the function exists but format strings might differ
    # We'll add a comment but not modify the code
    if re.search(r'to_char\s*\(.*,\s*[\'"].*[\'"]', sql, re.IGNORECASE):
        result = sql
        return result, {
            'type': 'format_adjustment_needed',
            'original': 'TO_CHAR with Oracle format',
            'replacement': 'TO_CHAR with PostgreSQL format',
            'description': 'TO_CHAR format strings may need manual adjustment for PostgreSQL compatibility'
        }
    
    return sql, None

def _replace_nvl_isnull(sql, source_type):
    """Replace Oracle NVL or SQL Server ISNULL with PostgreSQL COALESCE"""
    original = sql
    
    if source_type == 'oracle':
        result = re.sub(r'nvl\s*\(([^,]+),\s*([^)]+)\)', r'COALESCE(\1, \2)', sql, flags=re.IGNORECASE)
        function_name = 'NVL'
    else:  # SQL Server
        result = re.sub(r'isnull\s*\(([^,]+),\s*([^)]+)\)', r'COALESCE(\1, \2)', sql, flags=re.IGNORECASE)
        function_name = 'ISNULL'
    
    if original != result:
        return result, {
            'type': 'function_replacement',
            'original': function_name,
            'replacement': 'COALESCE',
            'description': f'Replaced {source_type.capitalize()} {function_name} with PostgreSQL COALESCE'
        }
    
    return sql, None

def _replace_getdate(sql):
    """Replace SQL Server GETDATE with PostgreSQL CURRENT_TIMESTAMP"""
    original = sql
    result = re.sub(r'getdate\s*\(\s*\)', 'CURRENT_TIMESTAMP', sql, flags=re.IGNORECASE)
    
    if original != result:
        return result, {
            'type': 'function_replacement',
            'original': 'GETDATE()',
            'replacement': 'CURRENT_TIMESTAMP',
            'description': 'Replaced SQL Server GETDATE() with PostgreSQL CURRENT_TIMESTAMP'
        }
    
    return sql, None

def _replace_rownum(sql):
    """Replace Oracle ROWNUM with PostgreSQL LIMIT/OFFSET"""
    original = sql
    
    # Replace "WHERE ROWNUM <= n" with "LIMIT n"
    result = re.sub(r'where\s+rownum\s*<=\s*(\d+)', r'LIMIT \1', sql, flags=re.IGNORECASE)
    
    # Replace "WHERE ROWNUM < n" with "LIMIT (n-1)"
    match = re.search(r'where\s+rownum\s*<\s*(\d+)', result, flags=re.IGNORECASE)
    if match:
        n = int(match.group(1))
        result = re.sub(r'where\s+rownum\s*<\s*\d+', f'LIMIT {n-1}', result, flags=re.IGNORECASE)
    
    # Replace "WHERE ROWNUM BETWEEN n AND m" with "LIMIT (m-n+1) OFFSET (n-1)"
    match = re.search(r'where\s+rownum\s+between\s+(\d+)\s+and\s+(\d+)', result, flags=re.IGNORECASE)
    if match:
        n = int(match.group(1))
        m = int(match.group(2))
        result = re.sub(
            r'where\s+rownum\s+between\s+\d+\s+and\s+\d+', 
            f'LIMIT {m-n+1} OFFSET {n-1}', 
            result, 
            flags=re.IGNORECASE
        )
    
    if original != result:
        return result, {
            'type': 'pagination_replacement',
            'original': 'ROWNUM',
            'replacement': 'LIMIT/OFFSET',
            'description': 'Replaced Oracle ROWNUM pagination with PostgreSQL LIMIT/OFFSET'
        }
    
    return sql, None

def _replace_top(sql):
    """Replace SQL Server TOP with PostgreSQL LIMIT"""
    original = sql
    
    # Replace "SELECT TOP n" with "SELECT ... LIMIT n"
    result = re.sub(r'select\s+top\s+(\d+)', r'SELECT', sql, flags=re.IGNORECASE)
    
    # Add LIMIT at the end if it was found and removed
    if original != result:
        match = re.search(r'top\s+(\d+)', original, flags=re.IGNORECASE)
        if match:
            limit_value = match.group(1)
            
            # Check if there's already a semicolon at the end
            if result.rstrip().endswith(';'):
                result = result.rstrip()[:-1] + f' LIMIT {limit_value};'
            else:
                result = result + f' LIMIT {limit_value}'
                
            return result, {
                'type': 'pagination_replacement',
                'original': 'TOP',
                'replacement': 'LIMIT',
                'description': 'Replaced SQL Server TOP with PostgreSQL LIMIT'
            }
    
    return sql, None

def _optimize_joins(sql):
    """Convert implicit joins to explicit JOIN syntax"""
    original = sql
    
    # This is a complex transformation that would require proper SQL parsing
    # Here's a simplified approach for common cases
    
    # Find FROM clauses with comma-separated tables
    match = re.search(r'from\s+([a-zA-Z0-9_\.]+)\s*,\s*([a-zA-Z0-9_\.]+)(\s+where\s+|$)', sql, flags=re.IGNORECASE)
    
    if match:
        table1 = match.group(1)
        table2 = match.group(2)
        where_clause = match.group(3)
        
        # Look for join conditions in the WHERE clause
        join_condition_match = re.search(
            rf'{table1}\.([a-zA-Z0-9_]+)\s*=\s*{table2}\.([a-zA-Z0-9_]+)',
            sql,
            flags=re.IGNORECASE
        )
        
        if join_condition_match:
            col1 = join_condition_match.group(1)
            col2 = join_condition_match.group(2)
            
            # Replace the comma join with explicit JOIN
            old_from = f"FROM {table1}, {table2}"
            new_from = f"FROM {table1} JOIN {table2} ON {table1}.{col1} = {table2}.{col2}"
            
            result = sql.replace(old_from, new_from, 1)
            
            # Remove the join condition from the WHERE clause if it exists
            join_condition = f"{table1}.{col1} = {table2}.{col2}"
            where_pattern = rf'WHERE\s+{join_condition}\s+AND\s+'
            result = re.sub(where_pattern, "WHERE ", result, flags=re.IGNORECASE)
            
            where_pattern = rf'WHERE\s+{join_condition}(\s|$)'
            result = re.sub(where_pattern, "WHERE ", result, flags=re.IGNORECASE)
            
            # Clean up any potential "WHERE AND" issues
            result = re.sub(r'WHERE\s+AND', "WHERE", result, flags=re.IGNORECASE)
            
            # Clean up potential empty WHERE clause
            result = re.sub(r'WHERE\s+$', "", result, flags=re.IGNORECASE)
            result = re.sub(r'WHERE\s+ORDER\s+BY', "ORDER BY", result, flags=re.IGNORECASE)
            result = re.sub(r'WHERE\s+GROUP\s+BY', "GROUP BY", result, flags=re.IGNORECASE)
            
            if original != result:
                return result, {
                    'type': 'join_optimization',
                    'original': 'Implicit comma join',
                    'replacement': 'Explicit JOIN with ON clause',
                    'description': 'Converted implicit comma join to explicit JOIN syntax for better performance'
                }
    
    return sql, None

def _replace_merge(sql, source_type):
    """Replace Oracle/SQL Server MERGE with PostgreSQL INSERT ... ON CONFLICT"""
    # This is a complex transformation requiring detailed parsing
    # Simply identify MERGE statements and provide guidance
    
    if re.search(r'\bmerge\b', sql, flags=re.IGNORECASE):
        return sql, {
            'type': 'manual_conversion_needed',
            'original': f'{source_type.capitalize()} MERGE statement',
            'replacement': 'INSERT ... ON CONFLICT or UPDATE/INSERT combination',
            'description': 'MERGE statements need manual conversion to PostgreSQL equivalent patterns'
        }
    
    return sql, None

def _replace_output_with_returning(sql):
    """Replace SQL Server OUTPUT clause with PostgreSQL RETURNING"""
    original = sql
    
    # Simple pattern matching for basic cases
    # Proper implementation would require more complex parsing
    result = re.sub(
        r'output\s+inserted\.([a-zA-Z0-9_,\s]+)',
        r'RETURNING \1',
        sql,
        flags=re.IGNORECASE
    )
    
    if original != result:
        return result, {
            'type': 'clause_replacement',
            'original': 'OUTPUT',
            'replacement': 'RETURNING',
            'description': 'Replaced SQL Server OUTPUT clause with PostgreSQL RETURNING'
        }
    
    return sql, None

def _optimize_update_join(sql):
    """Optimize SQL Server style UPDATE with FROM to PostgreSQL syntax"""
    # This is a complex transformation
    # Simply provide guidance for manual conversion
    
    if re.search(r'update\s+\w+\s+set\s+.*from', sql, flags=re.IGNORECASE | re.DOTALL):
        return sql, {
            'type': 'manual_conversion_needed',
            'original': 'SQL Server UPDATE with FROM',
            'replacement': 'PostgreSQL UPDATE with FROM',
            'description': 'UPDATE statements with joins need to be rewritten with PostgreSQL syntax'
        }
    
    return sql, None

def _replace_connect_by(sql):
    """Replace Oracle CONNECT BY with PostgreSQL recursive query"""
    # This is a complex transformation requiring custom implementation
    # Provide guidance for manual conversion
    
    if re.search(r'connect\s+by', sql, flags=re.IGNORECASE):
        return sql, {
            'type': 'manual_conversion_needed',
            'original': 'Oracle CONNECT BY',
            'replacement': 'PostgreSQL recursive WITH query',
            'description': 'Hierarchical queries using CONNECT BY need to be rewritten as recursive common table expressions'
        }
    
    return sql, None

def _fix_schema_references(sql):
    """Fix three-part schema references for PostgreSQL"""
    original = sql
    
    # Match database.schema.object patterns and convert to schema.object
    pattern = r'([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)'
    result = re.sub(pattern, r'\2.\3', sql)
    
    if original != result:
        return result, {
            'type': 'schema_reference_update',
            'original': 'Three-part identifier (db.schema.object)',
            'replacement': 'Two-part identifier (schema.object)',
            'description': 'Removed database qualifier from object references'
        }
    
    return sql, None

def _optimize_subqueries(sql):
    """Optimize subqueries for better performance in PostgreSQL"""
    # This is a complex transformation that would need detailed SQL parsing
    # Provide guidance for manual optimization
    
    if sql.count('SELECT') > 1:
        return sql, {
            'type': 'manual_optimization_suggested',
            'original': 'Subquery',
            'replacement': 'JOIN or EXISTS',
            'description': 'Complex subqueries may perform better when rewritten with JOINs or EXISTS'
        }
    
    return sql, None

def _convert_data_types(sql, source_type):
    """Convert source database data types to PostgreSQL equivalents"""
    original = sql
    result = sql
    
    if source_type == 'oracle':
        # Convert Oracle data types to PostgreSQL
        data_type_conversions = [
            (r'\bvarchar2\s*\((\d+)\)', r'VARCHAR(\1)'),
            (r'\bnumber\s*\((\d+),\s*(\d+)\)', r'NUMERIC(\1, \2)'),
            (r'\bnumber\s*\((\d+)\)', r'NUMERIC(\1)'),
            (r'\bnumber\b', r'NUMERIC'),
            (r'\binteger\b', r'INTEGER'),
            (r'\braw\s*\((\d+)\)', r'BYTEA'),
            (r'\blong\s+raw\b', r'BYTEA'),
            (r'\bclob\b', r'TEXT'),
            (r'\bnclob\b', r'TEXT'),
            (r'\bblob\b', r'BYTEA'),
            (r'\blong\b', r'TEXT'),
            (r'\bdate\b', r'TIMESTAMP'),
            (r'\browid\b', r'BIGINT')
        ]
        
        for old_type, new_type in data_type_conversions:
            result = re.sub(old_type, new_type, result, flags=re.IGNORECASE)
    
    elif source_type == 'sqlserver':
        # Convert SQL Server data types to PostgreSQL
        data_type_conversions = [
            (r'\bnvarchar\s*\((\d+)\)', r'VARCHAR(\1)'),
            (r'\bnchar\s*\((\d+)\)', r'CHAR(\1)'),
            (r'\bvarchar\s*\(max\)', r'TEXT'),
            (r'\bnvarchar\s*\(max\)', r'TEXT'),
            (r'\bvarbinary\s*\(max\)', r'BYTEA'),
            (r'\bdatetime\b', r'TIMESTAMP'),
            (r'\bsmalldate\b', r'DATE'),
            (r'\bsmallint\b', r'SMALLINT'),
            (r'\btinyint\b', r'SMALLINT'),
            (r'\bbigint\b', r'BIGINT'),
            (r'\bmoney\b', r'DECIMAL(19, 4)'),
            (r'\bbit\b', r'BOOLEAN'),
            (r'\buniqueidentifier\b', r'UUID'),
            (r'\bxml\b', r'XML')
        ]
        
        for old_type, new_type in data_type_conversions:
            result = re.sub(old_type, new_type, result, flags=re.IGNORECASE)
    
    if original != result:
        return result, {
            'type': 'data_type_conversion',
            'original': f'{source_type.capitalize()} data types',
            'replacement': 'PostgreSQL data types',
            'description': f'Converted {source_type.capitalize()} data types to PostgreSQL equivalents'
        }
    
    return sql, None

def _oracle_specific_optimizations(sql):
    """Perform Oracle-specific optimizations for PostgreSQL migration"""
    changes = []
    result = sql
    
    # Replace Oracle hints
    if '/*+' in result:
        original = result
        result = re.sub(r'/\*\+[^*]*\*/', '', result)
        
        if original != result:
            changes.append({
                'type': 'oracle_hint_removal',
                'original': 'Oracle optimizer hints',
                'replacement': 'No hints',
                'description': 'Removed Oracle optimizer hints which are not supported in PostgreSQL'
            })
    
    # Replace sequence syntax: nextval
    if 'nextval' in result:
        original = result
        result = re.sub(r'(\w+)\.nextval', r"nextval('\1')", result)
        
        if original != result:
            changes.append({
                'type': 'sequence_syntax',
                'original': 'Oracle sequence.nextval',
                'replacement': "nextval('sequence')",
                'description': 'Updated Oracle sequence syntax to PostgreSQL format'
            })
    
    # Replace sequence syntax: currval
    if 'currval' in result:
        original = result
        result = re.sub(r'(\w+)\.currval', r"currval('\1')", result)
        
        if original != result:
            changes.append({
                'type': 'sequence_syntax',
                'original': 'Oracle sequence.currval',
                'replacement': "currval('sequence')",
                'description': 'Updated Oracle sequence syntax to PostgreSQL format'
            })
    
    # Replace DUAL table references
    if re.search(r'\bfrom\s+dual\b', result, re.IGNORECASE):
        original = result
        result = re.sub(r'\bfrom\s+dual\b', '', result, flags=re.IGNORECASE)
        
        if original != result:
            changes.append({
                'type': 'dual_removal',
                'original': 'FROM DUAL',
                'replacement': '',
                'description': 'Removed Oracle DUAL table references as they are not needed in PostgreSQL'
            })
    
    return result, changes

def _sqlserver_specific_optimizations(sql):
    """Perform SQL Server-specific optimizations for PostgreSQL migration"""
    changes = []
    result = sql
    
    # Replace identity columns
    if 'IDENTITY' in result.upper():
        original = result
        # Convert IDENTITY(1,1) to SERIAL or BIGSERIAL
        result = re.sub(r'int\s+IDENTITY\s*\(\s*1\s*,\s*1\s*\)', 'SERIAL', result, flags=re.IGNORECASE)
        result = re.sub(r'bigint\s+IDENTITY\s*\(\s*1\s*,\s*1\s*\)', 'BIGSERIAL', result, flags=re.IGNORECASE)
        
        if original != result:
            changes.append({
                'type': 'identity_conversion',
                'original': 'SQL Server IDENTITY',
                'replacement': 'PostgreSQL SERIAL',
                'description': 'Converted SQL Server IDENTITY columns to PostgreSQL SERIAL or BIGSERIAL'
            })
    
    # Replace table hints
    if re.search(r'with\s*\(\s*(nolock|readuncommitted|readcommitted|repeatableread|serializable|readpast|updlock|xlock|rowlock|paglock|tablock|tablockx)\s*\)', result, re.IGNORECASE):
        original = result
        # Remove table hints
        result = re.sub(r'with\s*\(\s*(nolock|readuncommitted|readcommitted|repeatableread|serializable|readpast|updlock|xlock|rowlock|paglock|tablock|tablockx)\s*\)', '', result, flags=re.IGNORECASE)
        
        if original != result:
            changes.append({
                'type': 'hint_removal',
                'original': 'SQL Server table hints',
                'replacement': '',
                'description': 'Removed SQL Server table hints which are not supported in PostgreSQL'
            })
    
    # Replace square bracket identifiers
    if '[' in result and ']' in result:
        original = result
        # Convert [schema].[table] to schema.table
        result = re.sub(r'\[([^\]]+)\]', r'"\1"', result)
        
        if original != result:
            changes.append({
                'type': 'identifier_conversion',
                'original': 'SQL Server [bracketed] identifiers',
                'replacement': 'PostgreSQL "quoted" identifiers',
                'description': 'Converted SQL Server bracketed identifiers to PostgreSQL quoted identifiers'
            })
    
    # Replace DATEDIFF function
    if re.search(r'datediff\s*\(', result, re.IGNORECASE):
        original = result
        # This is a simplified replacement that won't work for all cases
        changes.append({
            'type': 'function_replacement_needed',
            'original': 'DATEDIFF()',
            'replacement': 'age() or date_part()',
            'description': 'DATEDIFF function needs to be replaced with PostgreSQL date functions'
        })
    
    # Replace DATEADD function
    if re.search(r'dateadd\s*\(', result, re.IGNORECASE):
        original = result
        # This is a simplified replacement that won't work for all cases
        changes.append({
            'type': 'function_replacement_needed',
            'original': 'DATEADD()',
            'replacement': '+ interval',
            'description': 'DATEADD function needs to be replaced with PostgreSQL interval addition'
        })
    
    return result, changes
