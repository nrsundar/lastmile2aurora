import sqlparse
import re

def parse_sql(sql_code):
    """
    Parse SQL code into individual statements
    
    Args:
        sql_code: String containing one or more SQL statements
        
    Returns:
        List of parsed SQL statements
    """
    # Split and parse the SQL code
    statements = sqlparse.split(sql_code)
    parsed_statements = [sqlparse.parse(stmt)[0] if sqlparse.parse(stmt) else None for stmt in statements]
    
    # Filter out None or empty statements
    return [stmt for stmt in parsed_statements if stmt is not None]

def determine_sql_type(parsed_statement):
    """
    Determine the type of SQL statement (query, function, procedure)
    
    Args:
        parsed_statement: A parsed SQL statement
        
    Returns:
        String indicating the SQL type ('query', 'function', 'procedure', 'unknown')
    """
    if not parsed_statement:
        return 'unknown'
    
    statement_str = str(parsed_statement).lower()
    
    # Check for various types of SQL statements
    if re.search(r'^\s*select', statement_str, re.IGNORECASE):
        return 'query'
    elif re.search(r'create\s+function', statement_str, re.IGNORECASE):
        return 'function'
    elif re.search(r'create\s+procedure', statement_str, re.IGNORECASE):
        return 'procedure'
    elif re.search(r'create\s+package', statement_str, re.IGNORECASE):
        return 'package'
    elif re.search(r'create\s+trigger', statement_str, re.IGNORECASE):
        return 'trigger'
    elif re.search(r'^\s*(insert|update|delete)', statement_str, re.IGNORECASE):
        return 'dml'
    elif re.search(r'^\s*(create|alter|drop)', statement_str, re.IGNORECASE):
        return 'ddl'
    
    return 'unknown'

def extract_tables(parsed_statement):
    """
    Extract table names from a SQL statement
    
    Args:
        parsed_statement: A parsed SQL statement
        
    Returns:
        List of table names
    """
    tables = []
    
    # Convert to string and use regex to find table names
    statement_str = str(parsed_statement)
    
    # Extract tables from FROM clause
    from_tables = re.findall(r'from\s+([a-zA-Z0-9_\.]+)', statement_str, re.IGNORECASE)
    tables.extend(from_tables)
    
    # Extract tables from JOIN clauses
    join_tables = re.findall(r'join\s+([a-zA-Z0-9_\.]+)', statement_str, re.IGNORECASE)
    tables.extend(join_tables)
    
    # Clean up table names (remove schema prefixes, etc.)
    cleaned_tables = []
    for table in tables:
        if '.' in table:
            schema, table_name = table.split('.', 1)
            cleaned_tables.append(table_name)
        else:
            cleaned_tables.append(table)
    
    return list(set(cleaned_tables))  # Remove duplicates

def is_oracle_specific(sql_code):
    """
    Check if SQL code contains Oracle-specific syntax
    
    Args:
        sql_code: SQL code to check
        
    Returns:
        Boolean indicating if Oracle-specific syntax was found
    """
    oracle_patterns = [
        r'(n)?varchar2\s*\(',                # VARCHAR2 data type
        r'number\s*\(',                      # NUMBER data type
        r'\bsysdate\b',                      # SYSDATE function
        r'to_char\s*\(',                     # TO_CHAR function
        r'connect\s+by',                     # CONNECT BY clause
        r':=',                               # PL/SQL assignment
        r'\bbegin\b.*\bend\b',               # PL/SQL block
        r'rownum',                           # ROWNUM pseudocolumn
        r'dual',                             # DUAL table
        r'dbms_',                            # DBMS packages
    ]
    
    for pattern in oracle_patterns:
        if re.search(pattern, sql_code, re.IGNORECASE | re.DOTALL):
            return True
            
    return False

def is_sqlserver_specific(sql_code):
    """
    Check if SQL code contains SQL Server-specific syntax
    
    Args:
        sql_code: SQL code to check
        
    Returns:
        Boolean indicating if SQL Server-specific syntax was found
    """
    sqlserver_patterns = [
        r'declare\s+@',                      # T-SQL variable declaration
        r'nvarchar\s*\(',                    # NVARCHAR data type
        r'getdate\s*\(',                     # GETDATE function
        r'top\s+\d+',                        # TOP clause
        r'isnull\s*\(',                      # ISNULL function
        r'stuff\s*\(',                       # STUFF function
        r'@\w+',                             # T-SQL variables
        r'dateadd\s*\(',                     # DATEADD function
        r'datediff\s*\(',                    # DATEDIFF function
        r'output\s+inserted',                # OUTPUT inserted clause
    ]
    
    for pattern in sqlserver_patterns:
        if re.search(pattern, sql_code, re.IGNORECASE | re.DOTALL):
            return True
            
    return False
