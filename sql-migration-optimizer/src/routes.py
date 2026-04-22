from flask import render_template, request, jsonify, flash, redirect, url_for, send_file, Response
import json
import io
import zipfile
import tempfile
from datetime import datetime
from app import app, db
from models import SQLQuery, DDLAnalysis, ExplainAnalysis
from sql_analyzer import analyze_sql
from sql_optimizer import optimize_sql
from sql_parser import parse_sql, determine_sql_type
from performance_estimator import estimate_query_performance
from ddl_analyzer_simple import analyze_ddl_with_query_simple
from explain_analyzer import analyze_explain_output

@app.route('/')
def introduction():
    """Introduction page with features and documentation"""
    return render_template('introduction.html')

@app.route('/editor')
def index():
    """Main page with SQL editor"""
    return render_template('index.html')

@app.route('/batch')
def batch():
    """Batch processing page"""
    return render_template('batch.html')

@app.route('/about')
def about():
    """About page with information about the application"""
    return render_template('about.html')

@app.route('/api/analyze', methods=['POST'])
def api_analyze():
    """API endpoint to analyze SQL code"""
    data = request.json
    sql_code = data.get('sql', '')
    source_type = data.get('source_type', 'oracle')
    target_version = data.get('target_version', '15')
    aurora_specific = data.get('aurora_specific', True)
    
    if not sql_code:
        return jsonify({'error': 'No SQL code provided'}), 400
    
    try:
        # Parse the SQL to determine the type (query, function, procedure)
        sql_statements = parse_sql(sql_code)
        sql_types = [determine_sql_type(stmt) for stmt in sql_statements]
        
        # Analyze the SQL for performance issues
        analysis_results = analyze_sql(sql_code, source_type, target_version, aurora_specific)
        
        # Optimize the SQL based on analysis
        optimized_sql, optimization_details = optimize_sql(sql_code, source_type, analysis_results, target_version, aurora_specific)
        
        # Estimate performance metrics
        performance_metrics = estimate_query_performance(
            sql_code, optimized_sql, {
                'analysis': analysis_results,
                'optimization_details': optimization_details
            }, source_type
        )
        
        # Save to database if it's a valid query
        if sql_statements:
            query = SQLQuery(
                source_type=source_type,
                original_query=sql_code,
                optimized_query=optimized_sql,
                issues=str(analysis_results),
                target_version=target_version,
                aurora_specific=aurora_specific
            )
            db.session.add(query)
            db.session.commit()
        
        return jsonify({
            'original_sql': sql_code,
            'optimized_sql': optimized_sql,
            'analysis': analysis_results,
            'optimization_details': optimization_details,
            'performance_metrics': performance_metrics,
            'sql_types': sql_types,
            'target_version': target_version,
            'aurora_specific': aurora_specific
        })
    
    except Exception as e:
        app.logger.error(f"Error analyzing SQL: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/batch_analyze', methods=['POST'])
def api_batch_analyze():
    """API endpoint to analyze multiple SQL statements at once"""
    data = request.json
    sql_statements = data.get('sql_statements', [])
    source_type = data.get('source_type', 'oracle')
    target_version = data.get('target_version', '15')
    aurora_specific = data.get('aurora_specific', True)
    
    if not sql_statements:
        return jsonify({'error': 'No SQL statements provided'}), 400
    
    results = []
    
    try:
        for sql in sql_statements:
            # Analyze individual SQL statement
            analysis_results = analyze_sql(sql, source_type, target_version, aurora_specific)
            
            # Optimize SQL based on analysis
            optimized_sql, optimization_details = optimize_sql(sql, source_type, analysis_results, target_version, aurora_specific)
            
            # Add to results
            results.append({
                'original_sql': sql,
                'optimized_sql': optimized_sql,
                'analysis': analysis_results,
                'optimization_details': optimization_details,
                'target_version': target_version,
                'aurora_specific': aurora_specific
            })
        
        return jsonify({'results': results})
    
    except Exception as e:
        app.logger.error(f"Error in batch analysis: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/recent_queries', methods=['GET'])
def api_recent_queries():
    """API endpoint to get recently analyzed queries"""
    try:
        recent_queries = SQLQuery.query.order_by(SQLQuery.created_at.desc()).limit(10).all()
        queries = [{
            'id': q.id,
            'source_type': q.source_type,
            'original_query': q.original_query,
            'created_at': q.created_at.isoformat()
        } for q in recent_queries]
        
        return jsonify({'queries': queries})
    
    except Exception as e:
        app.logger.error(f"Error fetching recent queries: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_server_error(e):
    return render_template('500.html'), 500

@app.route('/api/download_sql', methods=['POST'])
def api_download_sql():
    """API endpoint to download optimized SQL"""
    data = request.json
    if not data or 'sql' not in data:
        return jsonify({'error': 'No SQL provided'}), 400
    
    sql = data['sql']
    source_type = data.get('source_type', 'oracle')
    target_version = data.get('target_version', '15')
    
    # Create a temporary file-like object
    sql_io = io.BytesIO()
    sql_io.write(sql.encode('utf-8'))
    sql_io.seek(0)
    
    # Generate a filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"aurora_pg{target_version}_optimized_{timestamp}.sql"
    
    return send_file(
        sql_io,
        mimetype='text/plain',
        as_attachment=True,
        download_name=filename
    )

@app.route('/api/download_batch_sql', methods=['POST'])
def api_download_batch_sql():
    """API endpoint to download a zip file with all optimized SQL from batch processing"""
    data = request.json
    if not data or 'sql_statements' not in data:
        return jsonify({'error': 'No SQL statements provided'}), 400
    
    statements = data['sql_statements']
    source_type = data.get('source_type', 'oracle')
    target_version = data.get('target_version', '15')
    
    # Create a zip file in memory
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for i, stmt in enumerate(statements):
            filename = f"aurora_pg{target_version}_optimized_{i+1}.sql"
            zf.writestr(filename, stmt)
    
    memory_file.seek(0)
    
    # Generate a filename for the zip
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    zip_filename = f"aurora_optimized_batch_{timestamp}.zip"
    
    return send_file(
        memory_file,
        mimetype='application/zip',
        as_attachment=True,
        download_name=zip_filename
    )

@app.route('/test-results')
def test_results():
    """Performance test results page"""
    return render_template('test_results.html')

@app.route('/api/setup_test_data', methods=['POST'])
def api_setup_test_data():
    """API endpoint to create test data for performance testing"""
    try:
        # Create test tables using raw SQL with SQLAlchemy
        test_tables_sql = """
        -- Drop tables if they exist
        DROP TABLE IF EXISTS test_orders CASCADE;
        DROP TABLE IF EXISTS test_customers CASCADE;
        DROP TABLE IF EXISTS test_products CASCADE;
        
        -- Create test customers table
        CREATE TABLE test_customers (
            customer_id SERIAL PRIMARY KEY,
            first_name VARCHAR(50),
            last_name VARCHAR(50),
            email VARCHAR(100),
            city VARCHAR(50),
            country VARCHAR(50),
            created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Create test products table
        CREATE TABLE test_products (
            product_id SERIAL PRIMARY KEY,
            product_name VARCHAR(100),
            category VARCHAR(50),
            price DECIMAL(10,2),
            supplier_id INTEGER
        );
        
        -- Create test orders table
        CREATE TABLE test_orders (
            order_id SERIAL PRIMARY KEY,
            customer_id INTEGER REFERENCES test_customers(customer_id),
            product_id INTEGER REFERENCES test_products(product_id),
            quantity INTEGER,
            order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total_amount DECIMAL(10,2)
        );
        
        -- Insert sample customers
        INSERT INTO test_customers (first_name, last_name, email, city, country, created_date)
        SELECT 
            'Customer' || i,
            'Lastname' || i,
            'customer' || i || '@example.com',
            CASE (i % 5) 
                WHEN 0 THEN 'New York'
                WHEN 1 THEN 'Los Angeles'
                WHEN 2 THEN 'Chicago'
                WHEN 3 THEN 'Houston'
                ELSE 'Phoenix'
            END,
            'USA',
            CURRENT_TIMESTAMP - INTERVAL '1 day' * (i % 365)
        FROM generate_series(1, 1000) i;
        
        -- Insert sample products
        INSERT INTO test_products (product_name, category, price, supplier_id)
        SELECT 
            'Product ' || i,
            CASE (i % 4)
                WHEN 0 THEN 'Electronics'
                WHEN 1 THEN 'Clothing'
                WHEN 2 THEN 'Books'
                ELSE 'Home'
            END,
            (RANDOM() * 100 + 10)::DECIMAL(10,2),
            (i % 50) + 1
        FROM generate_series(1, 500) i;
        
        -- Insert sample orders
        INSERT INTO test_orders (customer_id, product_id, quantity, order_date, total_amount)
        SELECT 
            (RANDOM() * 999 + 1)::INTEGER,
            (RANDOM() * 499 + 1)::INTEGER,
            (RANDOM() * 5 + 1)::INTEGER,
            CURRENT_TIMESTAMP - INTERVAL '1 day' * (RANDOM() * 365),
            (RANDOM() * 500 + 50)::DECIMAL(10,2)
        FROM generate_series(1, 5000) i;
        
        -- Create indexes for testing
        CREATE INDEX idx_customers_city ON test_customers(city);
        CREATE INDEX idx_orders_customer_id ON test_orders(customer_id);
        CREATE INDEX idx_orders_product_id ON test_orders(product_id);
        CREATE INDEX idx_orders_date ON test_orders(order_date);
        
        -- Update statistics
        ANALYZE test_customers;
        ANALYZE test_products;
        ANALYZE test_orders;
        """
        
        from sqlalchemy import text
        db.session.execute(text(test_tables_sql))
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Test data created successfully'})
    
    except Exception as e:
        app.logger.error(f"Error creating test data: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/run_performance_tests', methods=['POST'])
def api_run_performance_tests():
    """API endpoint to run performance tests comparing original vs optimized queries"""
    try:
        data = request.json or {}
        iterations = data.get('iterations', 3)
        
        # Define test queries directly in the API
        test_queries = [
            {
                "name": "Customer Orders with Implicit Join",
                "description": "Compare implicit vs explicit JOIN syntax performance",
                "original": """
                    SELECT c.first_name, c.last_name, o.total_amount
                    FROM test_customers c, test_orders o
                    WHERE c.customer_id = o.customer_id
                    AND c.city = 'New York'
                    AND o.order_date > '2024-01-01'
                    ORDER BY o.total_amount DESC
                    LIMIT 100
                """,
                "optimized": """
                    SELECT c.first_name, c.last_name, o.total_amount
                    FROM test_customers c
                    INNER JOIN test_orders o ON c.customer_id = o.customer_id
                    WHERE c.city = 'New York'
                    AND o.order_date > '2024-01-01'
                    ORDER BY o.total_amount DESC
                    LIMIT 100
                """
            },
            {
                "name": "Subquery vs EXISTS",
                "description": "Compare subquery performance vs EXISTS clause",
                "original": """
                    SELECT c.first_name, c.last_name, c.email
                    FROM test_customers c
                    WHERE c.customer_id IN (
                        SELECT o.customer_id 
                        FROM test_orders o 
                        WHERE o.total_amount > 200
                    )
                    ORDER BY c.last_name
                    LIMIT 50
                """,
                "optimized": """
                    SELECT c.first_name, c.last_name, c.email
                    FROM test_customers c
                    WHERE EXISTS (
                        SELECT 1 
                        FROM test_orders o 
                        WHERE o.customer_id = c.customer_id 
                        AND o.total_amount > 200
                    )
                    ORDER BY c.last_name
                    LIMIT 50
                """
            },
            {
                "name": "Aggregation with JOIN",
                "description": "Test aggregation query optimization",
                "original": """
                    SELECT c.city, COUNT(*) as customer_count, AVG(o.total_amount) as avg_order
                    FROM test_customers c, test_orders o
                    WHERE c.customer_id = o.customer_id
                    GROUP BY c.city
                    ORDER BY avg_order DESC
                """,
                "optimized": """
                    SELECT c.city, COUNT(*) as customer_count, AVG(o.total_amount) as avg_order
                    FROM test_customers c
                    INNER JOIN test_orders o ON c.customer_id = o.customer_id
                    GROUP BY c.city
                    ORDER BY avg_order DESC
                """
            }
        ]
        
        results = []
        from sqlalchemy import text
        import time
        
        for query_test in test_queries:
            try:
                # Run multiple iterations for each test
                original_times = []
                optimized_times = []
                
                for i in range(iterations):
                    # Test original query
                    start_time = time.time()
                    result = db.session.execute(text(f"EXPLAIN ANALYZE {query_test['original']}"))
                    result.fetchall()
                    original_times.append((time.time() - start_time) * 1000)
                    
                    # Test optimized query  
                    start_time = time.time()
                    result = db.session.execute(text(f"EXPLAIN ANALYZE {query_test['optimized']}"))
                    result.fetchall()
                    optimized_times.append((time.time() - start_time) * 1000)
                
                # Calculate averages
                orig_avg = sum(original_times) / len(original_times)
                opt_avg = sum(optimized_times) / len(optimized_times)
                improvement = ((orig_avg - opt_avg) / orig_avg * 100) if orig_avg > 0 else 0
                
                test_result = {
                    "test_name": query_test["name"],
                    "test_description": query_test["description"],
                    "original_query": query_test["original"],
                    "optimized_query": query_test["optimized"],
                    "original": {
                        "avg_total_time": round(orig_avg, 2),
                        "avg_execution_time": round(orig_avg, 2),
                        "iterations": len(original_times),
                        "results": [{"execution_time": t, "total_time": t, "success": True} for t in original_times]
                    },
                    "optimized": {
                        "avg_total_time": round(opt_avg, 2),
                        "avg_execution_time": round(opt_avg, 2),
                        "iterations": len(optimized_times),
                        "results": [{"execution_time": t, "total_time": t, "success": True} for t in optimized_times]
                    },
                    "improvement": {
                        "total_time_improvement_percent": round(improvement, 2),
                        "execution_time_improvement_percent": round(improvement, 2),
                        "faster": opt_avg < orig_avg,
                        "time_saved_ms": round(orig_avg - opt_avg, 2)
                    }
                }
                
                results.append(test_result)
                
            except Exception as e:
                app.logger.error(f"Error in test {query_test['name']}: {str(e)}")
                continue
        
        return jsonify({
            "success": True,
            "total_tests": len(test_queries),
            "successful_tests": len(results),
            "results": results
        })
    
    except Exception as e:
        app.logger.error(f"Error running performance tests: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/ddl-analysis')
def ddl_analysis():
    """DDL Analysis page for index recommendations"""
    return render_template('ddl_analysis.html')


@app.route('/explain-analysis')
def explain_analysis():
    """EXPLAIN ANALYZE output analysis page"""
    return render_template('explain_analysis.html')


@app.route('/api/analyze_ddl', methods=['POST'])
def api_analyze_ddl():
    """API endpoint to analyze DDL and query for index recommendations"""
    try:
        data = request.get_json()
        
        # Extract parameters
        ddl_content = data.get('ddl_content', '').strip()
        query_content = data.get('query_content', '').strip()
        source_type = data.get('source_type', 'postgresql')
        target_version = data.get('target_version', '15')
        schema_name = data.get('schema_name', 'analysis_schema')
        
        # Validate input
        if not ddl_content:
            return jsonify({
                "success": False,
                "error": "DDL content is required"
            })
        
        if not query_content:
            return jsonify({
                "success": False,
                "error": "Query content is required"
            })
        
        # Perform DDL analysis
        analysis_results = analyze_ddl_with_query_simple(
            ddl_content, query_content, source_type, target_version
        )
        
        if not analysis_results.get('success'):
            return jsonify({
                "success": False,
                "error": analysis_results.get('error', 'Analysis failed')
            })
        
        # Save analysis to database
        ddl_analysis = DDLAnalysis(
            schema_name=schema_name,
            ddl_content=ddl_content,
            query_content=query_content,
            source_type=source_type,
            index_recommendations=json.dumps(analysis_results.get('index_recommendations', [])),
            index_ddls='\n'.join(analysis_results.get('index_ddls', [])),
            analysis_results=json.dumps(analysis_results),
            target_version=target_version
        )
        
        db.session.add(ddl_analysis)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "analysis_id": ddl_analysis.id,
            "tables": analysis_results.get('tables', []),
            "index_recommendations": analysis_results.get('index_recommendations', []),
            "index_ddls": analysis_results.get('index_ddls', []),
            "performance_comparison": analysis_results.get('performance_comparison', {}),
            "query_analysis": analysis_results.get('query_analysis', {})
        })
        
    except Exception as e:
        app.logger.error(f"Error in DDL analysis: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Analysis failed: {str(e)}"
        })


@app.route('/test_explain_simple')
def test_explain_simple():
    """Simple test page for EXPLAIN analysis without complex JavaScript"""
    return render_template('test_explain_simple.html')

@app.route('/api/analyze_explain', methods=['POST'])
def api_analyze_explain():
    """API endpoint to analyze EXPLAIN ANALYZE output"""
    try:
        data = request.get_json()
        
        # Extract parameters
        query_text = data.get('query_text', '').strip()
        explain_output = data.get('explain_output', '').strip()
        source_type = data.get('source_type', 'postgresql')
        
        # Validate input
        if not query_text:
            return jsonify({
                "success": False,
                "error": "Query text is required"
            })
        
        if not explain_output:
            return jsonify({
                "success": False,
                "error": "EXPLAIN ANALYZE output is required"
            })
        
        # Perform simplified analysis to avoid timeout issues
        import re
        
        # Extract basic metrics from explain output
        metrics = {}
        issues = []
        suggestions = []
        index_suggestions = []
        
        # Basic parsing to extract execution time
        execution_time = 0
        time_match = re.search(r'actual time=([0-9.]+)\.\.([0-9.]+)', explain_output)
        if time_match:
            execution_time = float(time_match.group(2))
            metrics['execution_time'] = execution_time
        
        # Check for sequential scans
        if 'Seq Scan' in explain_output:
            issues.append({
                'type': 'sequential_scans',
                'severity': 'high',
                'description': 'Sequential scan detected - consider adding indexes',
                'value': len(re.findall(r'Seq Scan', explain_output))
            })
            
            # Extract table names for index suggestions
            seq_scan_matches = re.findall(r'Seq Scan on (\w+)', explain_output)
            for table in seq_scan_matches:
                # Extract filter conditions
                filter_match = re.search(rf'Seq Scan on {table}.*?Filter: \((.+?)\)', explain_output, re.DOTALL)
                if filter_match:
                    filter_text = filter_match.group(1)
                    # Extract column names from filter
                    columns = re.findall(r'(\w+)\s*[=<>!]', filter_text)
                    if columns:
                        for column in set(columns):
                            index_suggestions.append({
                                'type': 'btree',
                                'table': table,
                                'columns': [column],
                                'reason': f'Sequential scan with filter on {table}.{column}',
                                'priority': 'high',
                                'estimated_benefit': 'High - eliminates sequential scan',
                                'ddl': f'CREATE INDEX idx_{table}_{column} ON {table} ({column});'
                            })
        
        # Check for nested loops
        if 'Nested Loop' in explain_output:
            issues.append({
                'type': 'expensive_nested_loop',
                'severity': 'medium',
                'description': 'Nested loop join detected - consider adding indexes on join columns',
                'value': len(re.findall(r'Nested Loop', explain_output))
            })
        
        # Generate intelligent suggestions
        if issues:
            if any(issue['type'] == 'sequential_scans' for issue in issues):
                suggestions.append({
                    'category': 'indexing',
                    'priority': 'high',
                    'title': 'Add Missing Indexes',
                    'description': 'Sequential scans detected. Adding appropriate indexes can significantly improve performance.',
                    'actions': [
                        'Create B-tree indexes on columns used in WHERE clauses',
                        'Add indexes on JOIN columns for efficient joins',
                        'Consider partial indexes for selective conditions'
                    ],
                    'estimated_improvement': 'Up to 90% reduction in query time'
                })
            
            # Add query rewriting suggestions
            if ' IN (' in query_text.upper() and 'SELECT ' in query_text.upper():
                suggestions.append({
                    'category': 'query_rewriting',
                    'priority': 'high',
                    'title': 'Rewrite IN Subquery to EXISTS',
                    'description': 'IN subqueries can be inefficient. EXISTS is often faster and more predictable.',
                    'actions': [
                        'Replace IN (SELECT ...) with EXISTS (SELECT 1 FROM ... WHERE ...)',
                        'Add correlation conditions to EXISTS subquery'
                    ],
                    'example_rewrite': '''-- Instead of:
SELECT * FROM customers c 
WHERE c.id IN (SELECT customer_id FROM orders WHERE total > 100);

-- Use:
SELECT * FROM customers c 
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.total > 100);''',
                    'estimated_improvement': '30-50% improvement for large subquery results'
                })
        
        # Calculate basic performance score
        base_score = 100
        for issue in issues:
            if issue['severity'] == 'high':
                base_score -= 30
            elif issue['severity'] == 'medium':
                base_score -= 15
            else:
                base_score -= 5
        
        performance_score = {
            'score': max(base_score, 0),
            'grade': 'A' if base_score >= 90 else 'B' if base_score >= 80 else 'C' if base_score >= 70 else 'D' if base_score >= 60 else 'F',
            'total_issues': len(issues)
        }
        
        # Save simplified analysis to database
        explain_analysis = ExplainAnalysis(
            query_text=query_text,
            explain_output=explain_output,
            source_type=source_type,
            performance_issues=json.dumps(issues),
            optimization_suggestions=json.dumps(suggestions),
            index_suggestions=json.dumps(index_suggestions),
            execution_time_ms=execution_time
        )
        
        db.session.add(explain_analysis)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "analysis_id": explain_analysis.id,
            "performance_score": performance_score,
            "metrics": metrics,
            "issues": issues,
            "suggestions": suggestions,
            "index_suggestions": index_suggestions
        })
        
    except Exception as e:
        app.logger.error(f"Error in EXPLAIN analysis: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Analysis failed: {str(e)}"
        })


@app.route('/api/download_ddl_indexes/<int:analysis_id>')
def api_download_ddl_indexes(analysis_id):
    """API endpoint to download index DDL statements"""
    try:
        # Get the DDL analysis
        ddl_analysis = DDLAnalysis.query.get_or_404(analysis_id)
        
        # Create the SQL file content
        sql_content = f"""-- Index Recommendations for Schema: {ddl_analysis.schema_name}
-- Generated on: {ddl_analysis.created_at.strftime('%Y-%m-%d %H:%M:%S')}
-- Source Type: {ddl_analysis.source_type}
-- Target PostgreSQL Version: {ddl_analysis.target_version}

-- Original DDL:
/*
{ddl_analysis.ddl_content}
*/

-- Analyzed Query:
/*
{ddl_analysis.query_content}
*/

-- Recommended Indexes:
{ddl_analysis.index_ddls or '-- No index recommendations generated'}

-- Usage Instructions:
-- 1. Review the recommended indexes above
-- 2. Test the indexes in a development environment first
-- 3. Monitor performance impact after creating indexes
-- 4. Consider dropping unused indexes to maintain optimal performance
"""
        
        # Create file-like object
        file_content = io.BytesIO(sql_content.encode('utf-8'))
        
        # Generate filename
        timestamp = ddl_analysis.created_at.strftime('%Y%m%d_%H%M%S')
        filename = f"index_recommendations_{ddl_analysis.schema_name}_{timestamp}.sql"
        
        return send_file(
            file_content,
            mimetype='text/plain',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/ddl-docs')
def ddl_docs():
    """DDL Analysis documentation page"""
    return render_template('ddl_docs.html')


@app.route('/explain-docs')
def explain_docs():
    """EXPLAIN Analysis documentation page"""
    return render_template('explain_docs.html')
