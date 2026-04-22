import os
import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor
import logging

logger = logging.getLogger(__name__)

def get_db_connection():
    """
    Create a connection to the PostgreSQL database
    using environment variables
    
    Returns:
        A PostgreSQL database connection
    """
    try:
        # Get connection parameters from environment variables
        conn = psycopg2.connect(
            host=os.environ.get('PGHOST'),
            database=os.environ.get('PGDATABASE'),
            user=os.environ.get('PGUSER'),
            password=os.environ.get('PGPASSWORD'),
            port=os.environ.get('PGPORT', 5432)
        )
        return conn
    except Exception as e:
        logger.error(f"Error connecting to PostgreSQL database: {e}")
        return None

def execute_query(query, params=None, fetch=True):
    """
    Execute a SQL query against the PostgreSQL database
    
    Args:
        query: The SQL query to execute
        params: Parameters for the query
        fetch: Whether to fetch results (for SELECT queries)
        
    Returns:
        Query results as a list of dictionaries, or None on error
    """
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, params or ())
            
            if fetch:
                results = cursor.fetchall()
                return results
            else:
                conn.commit()
                return True
                
    except Exception as e:
        logger.error(f"Error executing query: {e}")
        conn.rollback()
        return None
    finally:
        conn.close()

def get_table_structure(table_name, schema='public'):
    """
    Get the structure of a specified table
    
    Args:
        table_name: Name of the table
        schema: Schema name (default 'public')
        
    Returns:
        Dictionary with table structure information
    """
    query = """
    SELECT column_name, data_type, character_maximum_length, is_nullable
    FROM information_schema.columns
    WHERE table_schema = %s AND table_name = %s
    ORDER BY ordinal_position
    """
    
    return execute_query(query, (schema, table_name))

def get_table_indexes(table_name, schema='public'):
    """
    Get the indexes for a specified table
    
    Args:
        table_name: Name of the table
        schema: Schema name (default 'public')
        
    Returns:
        List of indexes on the table
    """
    query = """
    SELECT
        i.relname as index_name,
        a.attname as column_name,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary
    FROM
        pg_class t,
        pg_class i,
        pg_index ix,
        pg_attribute a,
        pg_namespace n
    WHERE
        t.oid = ix.indrelid
        AND i.oid = ix.indexrelid
        AND a.attrelid = t.oid
        AND a.attnum = ANY(ix.indkey)
        AND t.relkind = 'r'
        AND t.relname = %s
        AND n.oid = t.relnamespace
        AND n.nspname = %s
    ORDER BY
        i.relname, a.attnum
    """
    
    return execute_query(query, (table_name, schema))

def check_query_performance(query):
    """
    Check the performance of a query using EXPLAIN ANALYZE
    
    Args:
        query: The SQL query to explain
        
    Returns:
        Dictionary with query plan and performance statistics
    """
    explain_query = f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {query}"
    
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        with conn.cursor() as cursor:
            cursor.execute(explain_query)
            results = cursor.fetchall()
            return results[0][0]  # Return the JSON query plan
    except Exception as e:
        logger.error(f"Error explaining query: {e}")
        return None
    finally:
        conn.close()
