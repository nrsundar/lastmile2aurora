"""
Simplified DDL Analysis Module for Index Recommendations
Provides static analysis without complex database operations
"""

import re
import json
from typing import Dict, List, Any


def analyze_ddl_with_query_simple(ddl_content: str, query_content: str, 
                                 source_type: str, target_version: str = "16") -> Dict[str, Any]:
    """
    Simplified DDL and query analysis for index recommendations
    
    Args:
        ddl_content: Table DDL statements
        query_content: Query to analyze
        source_type: Source database type
        target_version: Target PostgreSQL version
        
    Returns:
        Analysis results with index recommendations
    """
    try:
        # Validate input
        if not ddl_content or not ddl_content.strip():
            return {"success": False, "error": "DDL content is required"}
        if not query_content or not query_content.strip():
            return {"success": False, "error": "Query content is required"}

        # Parse tables from DDL
        tables = parse_ddl_statements(ddl_content, source_type)
        
        # Analyze query patterns
        query_analysis = analyze_query_patterns(query_content)
        
        # Generate index recommendations
        recommendations = generate_index_recommendations(tables, query_content, query_analysis)
        
        # Generate DDL statements
        index_ddls = generate_index_ddls(recommendations)
        
        # Create performance estimates
        performance_comparison = {
            'before': {
                'execution_time_ms': estimate_execution_time(query_content, False),
                'cost_estimate': estimate_cost(query_content, False)
            },
            'after': {
                'execution_time_ms': estimate_execution_time(query_content, True),
                'cost_estimate': estimate_cost(query_content, True)
            }
        }
        
        improvement = (performance_comparison['before']['execution_time_ms'] - 
                      performance_comparison['after']['execution_time_ms']) / \
                      performance_comparison['before']['execution_time_ms'] * 100
        
        performance_comparison['improvement_percentage'] = round(improvement, 1)
        performance_comparison['recommendation'] = f'Recommended {len(recommendations)} indexes should improve performance by ~{int(improvement)}%'
        
        return {
            'success': True,
            'tables': tables,
            'index_recommendations': recommendations,
            'index_ddls': index_ddls,
            'query_analysis': query_analysis,
            'performance_comparison': performance_comparison,
            'analysis_type': 'static_analysis'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def parse_ddl_statements(ddl_content: str, source_type: str) -> List[Dict]:
    """Parse DDL statements and extract table structures"""
    tables = []
    
    # Split DDL into individual statements
    statements = re.split(r';\s*(?=CREATE\s+TABLE)', ddl_content, flags=re.IGNORECASE)
    
    for statement in statements:
        if 'CREATE TABLE' in statement.upper():
            table_info = extract_table_info(statement, source_type)
            if table_info:
                tables.append(table_info)
    
    return tables


def extract_table_info(ddl_statement: str, source_type: str) -> Dict:
    """Extract table name and column information from DDL"""
    # Extract table name
    table_match = re.search(r'CREATE\s+TABLE\s+(?:\w+\.)?(\w+)\s*\(', ddl_statement, re.IGNORECASE)
    if not table_match:
        return None
    
    table_name = table_match.group(1)
    
    # Extract columns section
    start_paren = ddl_statement.find('(')
    end_paren = ddl_statement.rfind(')')
    
    if start_paren == -1 or end_paren == -1:
        return None
    
    columns_text = ddl_statement[start_paren + 1:end_paren]
    columns = parse_columns(columns_text, source_type)
    
    return {
        'name': table_name,
        'columns': columns,
        'ddl': ddl_statement
    }


def parse_columns(columns_text: str, source_type: str) -> List[Dict]:
    """Parse column definitions"""
    columns = []
    column_defs = split_column_definitions(columns_text)
    
    for col_def in column_defs:
        col_def = col_def.strip()
        if not col_def or col_def.upper().startswith(('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK')):
            continue
        
        parts = col_def.split()
        if len(parts) >= 2:
            column = {
                'name': parts[0],
                'type': convert_data_type(parts[1], source_type),
                'nullable': 'NOT NULL' not in col_def.upper(),
                'primary_key': 'PRIMARY KEY' in col_def.upper()
            }
            columns.append(column)
    
    return columns


def split_column_definitions(columns_text: str) -> List[str]:
    """Split column definitions by commas, handling nested parentheses"""
    definitions = []
    current_def = ""
    paren_count = 0
    
    for char in columns_text:
        if char == '(':
            paren_count += 1
        elif char == ')':
            paren_count -= 1
        elif char == ',' and paren_count == 0:
            definitions.append(current_def)
            current_def = ""
            continue
        
        current_def += char
    
    if current_def.strip():
        definitions.append(current_def)
    
    return definitions


def convert_data_type(data_type: str, source_type: str) -> str:
    """Convert data types to PostgreSQL equivalents"""
    data_type = data_type.upper()
    
    if source_type == 'oracle':
        type_mapping = {
            'VARCHAR2': 'VARCHAR',
            'NUMBER': 'NUMERIC',
            'DATE': 'TIMESTAMP',
            'CLOB': 'TEXT',
            'BLOB': 'BYTEA'
        }
    elif source_type == 'sqlserver':
        type_mapping = {
            'NVARCHAR': 'VARCHAR',
            'DATETIME': 'TIMESTAMP',
            'DATETIME2': 'TIMESTAMP',
            'MONEY': 'NUMERIC',
            'IMAGE': 'BYTEA'
        }
    else:
        type_mapping = {}
    
    for source_type_name, pg_type in type_mapping.items():
        if source_type_name in data_type:
            return data_type.replace(source_type_name, pg_type)
    
    return data_type


def analyze_query_patterns(query: str) -> Dict:
    """Analyze query to extract optimization patterns"""
    query_upper = query.upper()
    
    # Count different query elements
    join_count = len(re.findall(r'\bJOIN\b', query_upper))
    where_count = len(re.findall(r'\bWHERE\b', query_upper))
    order_by_count = len(re.findall(r'\bORDER BY\b', query_upper))
    group_by_count = len(re.findall(r'\bGROUP BY\b', query_upper))
    
    # Analyze complexity
    complexity = 'simple'
    if join_count > 2 or where_count > 1 or group_by_count > 0:
        complexity = 'medium'
    if join_count > 4 or order_by_count > 1 or 'SUBQUERY' in query_upper:
        complexity = 'complex'
    
    return {
        'complexity': complexity,
        'join_count': join_count,
        'where_conditions': where_count,
        'order_by_present': order_by_count > 0,
        'group_by_present': group_by_count > 0,
        'estimated_rows': estimate_rows_from_query(query)
    }


def generate_index_recommendations(tables: List[Dict], query: str, query_analysis: Dict) -> List[Dict]:
    """Generate index recommendations based on query analysis"""
    recommendations = []
    query_upper = query.upper()
    
    # Extract table and column references from query
    for table in tables:
        table_name = table['name']
        
        # Check if table is used in query
        if table_name.upper() not in query_upper:
            continue
        
        # Recommend indexes for WHERE clause columns
        where_columns = extract_where_columns(query, table_name)
        for column in where_columns:
            if column_exists_in_table(column, table):
                recommendations.append({
                    'type': 'btree',
                    'table': table_name,
                    'columns': [column],
                    'reason': f'WHERE clause filter on {column}',
                    'priority': 'high',
                    'estimated_improvement': '60-80%'
                })
        
        # Recommend indexes for JOIN columns
        join_columns = extract_join_columns(query, table_name)
        for column in join_columns:
            if column_exists_in_table(column, table):
                recommendations.append({
                    'type': 'btree',
                    'table': table_name,
                    'columns': [column],
                    'reason': f'JOIN condition on {column}',
                    'priority': 'high',
                    'estimated_improvement': '70-90%'
                })
        
        # Recommend indexes for ORDER BY columns
        order_columns = extract_order_by_columns(query, table_name)
        for column in order_columns:
            if column_exists_in_table(column, table):
                recommendations.append({
                    'type': 'btree',
                    'table': table_name,
                    'columns': [column],
                    'reason': f'ORDER BY clause on {column}',
                    'priority': 'medium',
                    'estimated_improvement': '40-60%'
                })
    
    # Remove duplicates
    unique_recommendations = []
    seen = set()
    for rec in recommendations:
        key = (rec['table'], tuple(rec['columns']))
        if key not in seen:
            seen.add(key)
            unique_recommendations.append(rec)
    
    return unique_recommendations


def extract_where_columns(query: str, table_name: str) -> List[str]:
    """Extract columns used in WHERE clauses"""
    columns = []
    # Enhanced pattern matching for WHERE conditions
    where_patterns = [
        rf'{table_name}\.(\w+)\s*[=<>!]',
        rf'(\w+)\s*[=<>!].*{table_name}',
        rf'{table_name}\.(\w+)\s+IN\s*\(',
        rf'{table_name}\.(\w+)\s+BETWEEN',
        rf'(\w+)\s+BETWEEN.*AND',  # For date ranges
        rf'(\w+)\s+IS\s+NOT\s+NULL',  # For NULL checks
    ]
    
    # Special handling for table aliases
    table_alias = get_table_alias(query, table_name)
    if table_alias:
        where_patterns.extend([
            rf'{table_alias}\.(\w+)\s*[=<>!]',
            rf'{table_alias}\.(\w+)\s+BETWEEN',
            rf'{table_alias}\.(\w+)\s+IS\s+NOT\s+NULL',
        ])
    
    for pattern in where_patterns:
        matches = re.findall(pattern, query, re.IGNORECASE)
        columns.extend(matches)
    
    return list(set(columns))


def extract_join_columns(query: str, table_name: str) -> List[str]:
    """Extract columns used in JOIN conditions"""
    columns = []
    
    # Enhanced patterns for JOIN conditions
    table_alias = get_table_alias(query, table_name)
    
    join_patterns = [
        rf'JOIN.*?ON.*?{table_name}\.(\w+)\s*=',
        rf'JOIN.*?ON.*?(\w+)\s*=.*?{table_name}\.',
    ]
    
    if table_alias:
        join_patterns.extend([
            rf'JOIN.*?ON.*?{table_alias}\.(\w+)\s*=',
            rf'JOIN.*?ON.*?(\w+)\s*=.*?{table_alias}\.',
        ])
    
    for pattern in join_patterns:
        matches = re.findall(pattern, query, re.IGNORECASE | re.DOTALL)
        columns.extend(matches)
    
    return list(set(columns))


def get_table_alias(query: str, table_name: str) -> str:
    """Extract table alias from query"""
    # Pattern to find table alias: "table_name alias"
    alias_pattern = rf'{table_name}\s+(\w+)'
    match = re.search(alias_pattern, query, re.IGNORECASE)
    if match:
        alias = match.group(1)
        # Make sure it's not a keyword
        if alias.upper() not in ['JOIN', 'ON', 'WHERE', 'GROUP', 'ORDER', 'HAVING']:
            return alias
    return None


def extract_order_by_columns(query: str, table_name: str) -> List[str]:
    """Extract columns used in ORDER BY clauses"""
    columns = []
    # Pattern for ORDER BY
    order_pattern = rf'ORDER\s+BY.*?{table_name}\.(\w+)'
    matches = re.findall(order_pattern, query, re.IGNORECASE | re.DOTALL)
    columns.extend(matches)
    
    return list(set(columns))


def column_exists_in_table(column_name: str, table: Dict) -> bool:
    """Check if column exists in table definition"""
    for col in table['columns']:
        if col['name'].lower() == column_name.lower():
            return True
    return False


def generate_index_ddls(recommendations: List[Dict]) -> List[str]:
    """Generate DDL statements for recommended indexes"""
    ddls = []
    
    for i, rec in enumerate(recommendations):
        table_name = rec['table']
        columns = rec['columns']
        index_type = rec.get('type', 'btree')
        
        # Generate index name
        column_str = '_'.join(columns[:2])  # Use first 2 columns for name
        index_name = f"idx_{table_name}_{column_str}_{i+1}"
        
        # Generate DDL
        if len(columns) == 1:
            ddl = f"CREATE INDEX {index_name} ON {table_name} USING {index_type} ({columns[0]});"
        else:
            columns_str = ', '.join(columns)
            ddl = f"CREATE INDEX {index_name} ON {table_name} USING {index_type} ({columns_str});"
        
        ddls.append(ddl)
    
    return ddls


def estimate_execution_time(query: str, with_indexes: bool) -> float:
    """Estimate query execution time"""
    base_time = 100.0
    
    # Adjust based on query complexity
    if 'JOIN' in query.upper():
        base_time *= 1.5
    if 'ORDER BY' in query.upper():
        base_time *= 1.2
    if 'GROUP BY' in query.upper():
        base_time *= 1.3
    
    # Apply index improvement
    if with_indexes:
        base_time *= 0.3  # 70% improvement with indexes
    
    return round(base_time, 1)


def estimate_cost(query: str, with_indexes: bool) -> float:
    """Estimate query cost"""
    base_cost = 150.0
    
    # Adjust based on query complexity
    if 'JOIN' in query.upper():
        base_cost *= 1.8
    if 'ORDER BY' in query.upper():
        base_cost *= 1.3
    if 'GROUP BY' in query.upper():
        base_cost *= 1.4
    
    # Apply index improvement
    if with_indexes:
        base_cost *= 0.25  # 75% cost reduction with indexes
    
    return round(base_cost, 1)


def estimate_rows_from_query(query: str) -> int:
    """Estimate number of rows based on query patterns"""
    if 'JOIN' in query.upper():
        return 10000
    elif 'WHERE' in query.upper():
        return 1000
    else:
        return 5000