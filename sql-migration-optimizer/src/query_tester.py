import time
import json
import os
from app import db
from sqlalchemy import text
import re

class QueryPerformanceTester:
    """
    Tests and compares performance between original and optimized SQL queries
    """
    
    def __init__(self):
        self.connection = None
        self.results = []
    
    def connect(self):
        """Establish database connection"""
        try:
            # Using Flask-SQLAlchemy connection
            self.connection = db.session
            return True
        except Exception as e:
            print(f"Database connection failed: {e}")
            return False
    
    def close(self):
        """Close database connection"""
        # SQLAlchemy handles connection pooling, no need to explicitly close
        pass
    
    def execute_with_timing(self, query, query_type="original"):
        """
        Execute a query and measure its performance
        
        Args:
            query: SQL query to execute
            query_type: "original" or "optimized"
            
        Returns:
            Dictionary with timing and execution information
        """
        if not self.connection:
            return {"error": "No database connection"}
        
        try:
            # Start timing
            start_time = time.time()
            
            # Execute EXPLAIN ANALYZE to get execution plan and timing
            explain_query = f"EXPLAIN (ANALYZE true, BUFFERS true, FORMAT JSON) {query}"
            result = self.connection.execute(text(explain_query))
            explain_result = result.fetchone()
            
            end_time = time.time()
            execution_time = (end_time - start_time) * 1000  # Convert to milliseconds
            
            # Parse the execution plan
            plan_data = explain_result[0][0] if explain_result and explain_result[0] else {}
            
            # Extract key metrics
            actual_total_time = plan_data.get('Execution Time', 0)
            planning_time = plan_data.get('Planning Time', 0)
            
            # Get execution plan details
            plan = plan_data.get('Plan', {})
            actual_rows = plan.get('Actual Rows', 0)
            actual_loops = plan.get('Actual Loops', 1)
            shared_hit_blocks = plan_data.get('Shared Hit Blocks', 0)
            shared_read_blocks = plan_data.get('Shared Read Blocks', 0)
            
            query_result = {
                "query_type": query_type,
                "execution_time": actual_total_time,
                "planning_time": planning_time,
                "total_time": actual_total_time + planning_time,
                "rows_returned": actual_rows * actual_loops,
                "shared_hit_blocks": shared_hit_blocks,
                "shared_read_blocks": shared_read_blocks,
                "execution_plan": plan,
                "success": True,
                "error": None
            }
            
            return query_result
            
        except Exception as e:
            return {
                "query_type": query_type,
                "execution_time": 0,
                "planning_time": 0,
                "total_time": 0,
                "rows_returned": 0,
                "shared_hit_blocks": 0,
                "shared_read_blocks": 0,
                "execution_plan": {},
                "success": False,
                "error": str(e)
            }
    
    def compare_queries(self, original_query, optimized_query, iterations=3):
        """
        Compare performance between original and optimized queries
        
        Args:
            original_query: Original SQL query
            optimized_query: Optimized SQL query
            iterations: Number of times to run each query for averaging
            
        Returns:
            Dictionary with comparison results
        """
        if not self.connect():
            return {"error": "Failed to connect to database"}
        
        try:
            original_results = []
            optimized_results = []
            
            # Run multiple iterations for more accurate timing
            for i in range(iterations):
                # Test original query
                orig_result = self.execute_with_timing(original_query, "original")
                if orig_result["success"]:
                    original_results.append(orig_result)
                
                # Test optimized query
                opt_result = self.execute_with_timing(optimized_query, "optimized")
                if opt_result["success"]:
                    optimized_results.append(opt_result)
            
            # Calculate averages
            if not original_results or not optimized_results:
                return {"error": "Failed to execute queries successfully"}
            
            orig_avg_time = sum(r["total_time"] for r in original_results) / len(original_results)
            opt_avg_time = sum(r["total_time"] for r in optimized_results) / len(optimized_results)
            
            orig_avg_execution = sum(r["execution_time"] for r in original_results) / len(original_results)
            opt_avg_execution = sum(r["execution_time"] for r in optimized_results) / len(optimized_results)
            
            # Calculate improvement metrics
            time_improvement = ((orig_avg_time - opt_avg_time) / orig_avg_time * 100) if orig_avg_time > 0 else 0
            execution_improvement = ((orig_avg_execution - opt_avg_execution) / orig_avg_execution * 100) if orig_avg_execution > 0 else 0
            
            comparison_result = {
                "original": {
                    "avg_total_time": round(orig_avg_time, 2),
                    "avg_execution_time": round(orig_avg_execution, 2),
                    "iterations": len(original_results),
                    "results": original_results
                },
                "optimized": {
                    "avg_total_time": round(opt_avg_time, 2),
                    "avg_execution_time": round(opt_avg_execution, 2),
                    "iterations": len(optimized_results),
                    "results": optimized_results
                },
                "improvement": {
                    "total_time_improvement_percent": round(time_improvement, 2),
                    "execution_time_improvement_percent": round(execution_improvement, 2),
                    "faster": opt_avg_time < orig_avg_time,
                    "time_saved_ms": round(orig_avg_time - opt_avg_time, 2)
                },
                "success": True
            }
            
            self.results.append(comparison_result)
            return comparison_result
            
        except Exception as e:
            return {"error": f"Query comparison failed: {str(e)}"}
        
        finally:
            self.close()
    
    def create_test_data(self):
        """
        Create sample test tables with data for testing queries
        """
        if not self.connect():
            return False
        
        try:
            # Create test tables
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
            
            -- Insert sample data
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
            
            self.connection.execute(text(test_tables_sql))
            self.connection.commit()
            
            print("Test data created successfully")
            return True
            
        except Exception as e:
            print(f"Failed to create test data: {e}")
            if self.connection:
                self.connection.rollback()
            return False
        
        finally:
            self.close()
    
    def get_test_queries(self):
        """
        Return a set of test query pairs (original vs optimized) for testing
        """
        test_queries = [
            {
                "name": "Customer Orders with Implicit Join",
                "description": "Test implicit vs explicit JOIN syntax",
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
                "description": "Test subquery performance vs EXISTS clause",
                "original": """
                    SELECT c.first_name, c.last_name, c.email
                    FROM test_customers c
                    WHERE c.customer_id IN (
                        SELECT o.customer_id 
                        FROM test_orders o 
                        WHERE o.total_amount > 200
                    )
                    ORDER BY c.last_name
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
                """
            },
            {
                "name": "Correlated Subquery vs JOIN",
                "description": "Test correlated subquery vs JOIN performance",
                "original": """
                    SELECT c.first_name, c.last_name,
                           (SELECT COUNT(*) FROM test_orders o WHERE o.customer_id = c.customer_id) as order_count,
                           (SELECT AVG(total_amount) FROM test_orders o WHERE o.customer_id = c.customer_id) as avg_order
                    FROM test_customers c
                    WHERE c.city IN ('New York', 'Los Angeles')
                    ORDER BY order_count DESC
                    LIMIT 50
                """,
                "optimized": """
                    SELECT c.first_name, c.last_name,
                           COALESCE(o.order_count, 0) as order_count,
                           COALESCE(o.avg_order, 0) as avg_order
                    FROM test_customers c
                    LEFT JOIN (
                        SELECT customer_id,
                               COUNT(*) as order_count,
                               AVG(total_amount) as avg_order
                        FROM test_orders
                        GROUP BY customer_id
                    ) o ON c.customer_id = o.customer_id
                    WHERE c.city IN ('New York', 'Los Angeles')
                    ORDER BY order_count DESC
                    LIMIT 50
                """
            }
        ]
        
        return test_queries

def run_performance_tests():
    """
    Run all performance tests and return results
    """
    tester = QueryPerformanceTester()
    
    # Create test data first
    print("Creating test data...")
    if not tester.create_test_data():
        return {"error": "Failed to create test data"}
    
    # Get test queries
    test_queries = tester.get_test_queries()
    results = []
    
    print(f"Running {len(test_queries)} performance tests...")
    
    for i, query_test in enumerate(test_queries, 1):
        print(f"Test {i}/{len(test_queries)}: {query_test['name']}")
        
        result = tester.compare_queries(
            query_test["original"],
            query_test["optimized"],
            iterations=3
        )
        
        if "error" not in result:
            result["test_name"] = query_test["name"]
            result["test_description"] = query_test["description"]
            results.append(result)
            
            # Print summary
            improvement = result["improvement"]
            if improvement["faster"]:
                print(f"  ✓ Optimized query is {improvement['total_time_improvement_percent']:.1f}% faster")
            else:
                print(f"  ⚠ Optimized query is {abs(improvement['total_time_improvement_percent']):.1f}% slower")
        else:
            print(f"  ✗ Test failed: {result['error']}")
    
    return {
        "success": True,
        "total_tests": len(test_queries),
        "successful_tests": len(results),
        "results": results
    }

if __name__ == "__main__":
    results = run_performance_tests()
    print(json.dumps(results, indent=2))