"""
EXPLAIN ANALYZE Output Analyzer
Analyzes execution plans to identify performance issues and suggest optimizations
"""

import re
import json
from typing import Dict, List, Any, Tuple


class ExplainAnalyzer:
    """
    Analyzes EXPLAIN ANALYZE output to identify performance bottlenecks
    """
    
    def __init__(self):
        self.performance_thresholds = {
            'seq_scan_rows': 10000,  # Sequential scan becomes expensive above this
            'nested_loop_rows': 1000,  # Nested loop joins become expensive above this
            'execution_time_ms': 1000,  # Queries slower than 1 second
            'planning_time_ms': 100,   # Planning time longer than 100ms
            'buffer_hit_ratio': 0.95   # Buffer hit ratio below 95%
        }
    
    def analyze_explain_output(self, query_text: str, explain_output: str, 
                             source_type: str = 'postgresql') -> Dict[str, Any]:
        """
        Analyze EXPLAIN ANALYZE output for performance issues
        
        Args:
            query_text: Original query text
            explain_output: EXPLAIN ANALYZE output
            source_type: Source database type
            
        Returns:
            Dictionary with analysis results and recommendations
        """
        try:
            # Parse the explain output
            parsed_plan = self._parse_explain_output(explain_output)
            
            # Extract performance metrics
            metrics = self._extract_performance_metrics(parsed_plan)
            
            # Identify performance issues
            issues = self._identify_performance_issues(parsed_plan, metrics)
            
            # Generate optimization suggestions
            suggestions = self._generate_optimization_suggestions(
                query_text, parsed_plan, issues, source_type
            )
            
            # Generate index recommendations
            index_suggestions = self._generate_index_suggestions(
                query_text, parsed_plan, issues
            )
            
            # Calculate performance scores
            performance_score = self._calculate_performance_score(metrics, issues)
            
            return {
                'success': True,
                'metrics': metrics,
                'issues': issues,
                'suggestions': suggestions,
                'index_suggestions': index_suggestions,
                'performance_score': performance_score,
                'parsed_plan': parsed_plan
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _parse_explain_output(self, explain_output: str) -> Dict:
        """Parse EXPLAIN ANALYZE output into structured format"""
        explain_output = explain_output.strip()
        
        # Try to parse as JSON first (EXPLAIN (FORMAT JSON))
        if explain_output.startswith('[') or explain_output.startswith('{'):
            try:
                return json.loads(explain_output)
            except json.JSONDecodeError:
                pass
        
        # Parse text format EXPLAIN output
        return self._parse_text_explain(explain_output)
    
    def _parse_text_explain(self, explain_text: str) -> Dict:
        """Parse text format EXPLAIN ANALYZE output"""
        lines = explain_text.split('\n')
        
        plan_data = {
            'execution_time': 0,
            'planning_time': 0,
            'nodes': [],
            'format': 'text'
        }
        
        # Extract timing information
        for line in lines:
            if 'Execution Time:' in line:
                time_match = re.search(r'Execution Time:\s*([\d.]+)\s*ms', line)
                if time_match:
                    plan_data['execution_time'] = float(time_match.group(1))
            
            elif 'Planning Time:' in line:
                time_match = re.search(r'Planning Time:\s*([\d.]+)\s*ms', line)
                if time_match:
                    plan_data['planning_time'] = float(time_match.group(1))
        
        # Parse node information
        for line in lines:
            line = line.strip()
            if not line or line.startswith('---') or 'Time:' in line:
                continue
            
            node_info = self._parse_explain_line(line)
            if node_info:
                plan_data['nodes'].append(node_info)
        
        return plan_data
    
    def _parse_explain_line(self, line: str) -> Dict:
        """Parse a single line from EXPLAIN output"""
        # Extract node type and details
        node_match = re.match(r'^(\s*)(.+?)\s*(\(cost=.*?\))?\s*(\(actual.*?\))?\s*$', line)
        if not node_match:
            return {}
        
        indent = len(node_match.group(1))
        node_text = node_match.group(2)
        cost_info = node_match.group(3) or ''
        actual_info = node_match.group(4) or ''
        
        node = {
            'indent': indent,
            'node_type': self._extract_node_type(node_text),
            'details': node_text,
            'cost': self._parse_cost_info(cost_info),
            'actual': self._parse_actual_info(actual_info)
        }
        
        return node
    
    def _extract_node_type(self, node_text: str) -> str:
        """Extract node type from explain line"""
        node_types = [
            'Seq Scan', 'Index Scan', 'Index Only Scan', 'Bitmap Heap Scan',
            'Bitmap Index Scan', 'Nested Loop', 'Hash Join', 'Merge Join',
            'Sort', 'Hash', 'Aggregate', 'Group', 'Limit', 'Subquery Scan'
        ]
        
        for node_type in node_types:
            if node_type in node_text:
                return node_type
        
        # Extract first word as node type
        words = node_text.split()
        return words[0] if words else 'Unknown'
    
    def _parse_cost_info(self, cost_info: str) -> Dict:
        """Parse cost information from explain output"""
        cost_data = {}
        
        # Extract cost range
        cost_match = re.search(r'cost=([\d.]+)\.\.([\d.]+)', cost_info)
        if cost_match:
            cost_data['startup_cost'] = float(cost_match.group(1))
            cost_data['total_cost'] = float(cost_match.group(2))
        
        # Extract row estimates
        rows_match = re.search(r'rows=(\d+)', cost_info)
        if rows_match:
            cost_data['rows'] = int(rows_match.group(1))
        
        # Extract width estimate
        width_match = re.search(r'width=(\d+)', cost_info)
        if width_match:
            cost_data['width'] = int(width_match.group(1))
        
        return cost_data
    
    def _parse_actual_info(self, actual_info: str) -> Dict:
        """Parse actual execution information"""
        actual_data = {}
        
        # Extract actual time
        time_match = re.search(r'actual time=([\d.]+)\.\.([\d.]+)', actual_info)
        if time_match:
            actual_data['startup_time'] = float(time_match.group(1))
            actual_data['total_time'] = float(time_match.group(2))
        
        # Extract actual rows
        rows_match = re.search(r'rows=(\d+)', actual_info)
        if rows_match:
            actual_data['rows'] = int(rows_match.group(1))
        
        # Extract loops
        loops_match = re.search(r'loops=(\d+)', actual_info)
        if loops_match:
            actual_data['loops'] = int(loops_match.group(1))
        
        return actual_data
    
    def _extract_performance_metrics(self, parsed_plan: Dict) -> Dict:
        """Extract key performance metrics from parsed plan"""
        metrics = {
            'execution_time': parsed_plan.get('execution_time', 0),
            'planning_time': parsed_plan.get('planning_time', 0),
            'total_cost': 0,
            'total_rows': 0,
            'seq_scans': 0,
            'index_scans': 0,
            'nested_loops': 0,
            'hash_joins': 0,
            'sorts': 0
        }
        
        # Process nodes to extract metrics
        if parsed_plan.get('format') == 'text':
            for node in parsed_plan.get('nodes', []):
                self._update_metrics_from_node(metrics, node)
        else:
            # Handle JSON format
            self._process_json_plan(metrics, parsed_plan)
        
        return metrics
    
    def _update_metrics_from_node(self, metrics: Dict, node: Dict):
        """Update metrics based on a single node"""
        node_type = node.get('node_type', '')
        cost = node.get('cost', {})
        actual = node.get('actual', {})
        
        # Update total cost
        if 'total_cost' in cost:
            metrics['total_cost'] += cost['total_cost']
        
        # Count node types
        if 'Seq Scan' in node_type:
            metrics['seq_scans'] += 1
        elif 'Index' in node_type and 'Scan' in node_type:
            metrics['index_scans'] += 1
        elif 'Nested Loop' in node_type:
            metrics['nested_loops'] += 1
        elif 'Hash Join' in node_type:
            metrics['hash_joins'] += 1
        elif 'Sort' in node_type:
            metrics['sorts'] += 1
        
        # Update row counts
        if 'rows' in actual:
            metrics['total_rows'] += actual['rows']
    
    def _process_json_plan(self, metrics: Dict, plan_data: Dict):
        """Process JSON format explain plan"""
        if isinstance(plan_data, list):
            plan_data = plan_data[0]
        
        if 'Plan' in plan_data:
            self._process_json_node(metrics, plan_data['Plan'])
        
        # Extract timing from top level
        if 'Execution Time' in plan_data:
            metrics['execution_time'] = plan_data['Execution Time']
        if 'Planning Time' in plan_data:
            metrics['planning_time'] = plan_data['Planning Time']
    
    def _process_json_node(self, metrics: Dict, node: Dict):
        """Process a single JSON node recursively"""
        node_type = node.get('Node Type', '')
        
        # Update metrics based on node type
        if node_type == 'Seq Scan':
            metrics['seq_scans'] += 1
        elif 'Index' in node_type and 'Scan' in node_type:
            metrics['index_scans'] += 1
        elif node_type == 'Nested Loop':
            metrics['nested_loops'] += 1
        elif node_type == 'Hash Join':
            metrics['hash_joins'] += 1
        elif node_type == 'Sort':
            metrics['sorts'] += 1
        
        # Update costs and rows
        if 'Total Cost' in node:
            metrics['total_cost'] += node['Total Cost']
        if 'Actual Rows' in node:
            metrics['total_rows'] += node['Actual Rows']
        
        # Process child nodes
        for child in node.get('Plans', []):
            self._process_json_node(metrics, child)
    
    def _identify_performance_issues(self, parsed_plan: Dict, metrics: Dict) -> List[Dict]:
        """Identify performance issues from the execution plan"""
        issues = []
        
        # High execution time
        if metrics['execution_time'] > self.performance_thresholds['execution_time_ms']:
            issues.append({
                'type': 'high_execution_time',
                'severity': 'high',
                'description': f"Query execution time ({metrics['execution_time']:.2f}ms) exceeds threshold",
                'value': metrics['execution_time'],
                'threshold': self.performance_thresholds['execution_time_ms']
            })
        
        # High planning time
        if metrics['planning_time'] > self.performance_thresholds['planning_time_ms']:
            issues.append({
                'type': 'high_planning_time',
                'severity': 'medium',
                'description': f"Query planning time ({metrics['planning_time']:.2f}ms) is high",
                'value': metrics['planning_time'],
                'threshold': self.performance_thresholds['planning_time_ms']
            })
        
        # Too many sequential scans
        if metrics['seq_scans'] > 0:
            issues.append({
                'type': 'sequential_scans',
                'severity': 'medium',
                'description': f"Query uses {metrics['seq_scans']} sequential scan(s) which may be inefficient",
                'value': metrics['seq_scans']
            })
        
        # Nested loop with high row count
        if metrics['nested_loops'] > 0 and metrics['total_rows'] > self.performance_thresholds['nested_loop_rows']:
            issues.append({
                'type': 'expensive_nested_loop',
                'severity': 'high',
                'description': f"Nested loop join processing {metrics['total_rows']} rows may be inefficient",
                'value': metrics['total_rows'],
                'threshold': self.performance_thresholds['nested_loop_rows']
            })
        
        # Multiple sorts
        if metrics['sorts'] > 1:
            issues.append({
                'type': 'multiple_sorts',
                'severity': 'medium',
                'description': f"Query performs {metrics['sorts']} sort operations",
                'value': metrics['sorts']
            })
        
        return issues
    
    def _generate_optimization_suggestions(self, query_text: str, parsed_plan: Dict, 
                                         issues: List[Dict], source_type: str) -> List[Dict]:
        """Generate optimization suggestions based on identified issues"""
        suggestions = []
        
        # Analyze query structure for rewriting opportunities
        query_rewrites = self._analyze_query_rewrites(query_text)
        suggestions.extend(query_rewrites)
        
        for issue in issues:
            if issue['type'] == 'high_execution_time':
                suggestions.append({
                    'category': 'performance',
                    'priority': 'high',
                    'title': 'Optimize Query Performance',
                    'description': f'Query execution time ({issue.get("value", 0):.2f}ms) exceeds performance threshold.',
                    'actions': [
                        'Add indexes on frequently filtered columns',
                        'Consider query rewriting with EXISTS instead of IN subqueries',
                        'Optimize WHERE clause conditions for better selectivity',
                        'Consider partitioning for large tables',
                        'Review and optimize complex subqueries'
                    ],
                    'estimated_improvement': '60-80% reduction in execution time'
                })
            
            elif issue['type'] == 'sequential_scans':
                scan_count = issue.get('value', 1)
                suggestions.append({
                    'category': 'indexing',
                    'priority': 'high',
                    'title': 'Eliminate Sequential Scans',
                    'description': f'{scan_count} sequential scan(s) detected. These are expensive operations that scan entire tables.',
                    'actions': [
                        'Create B-tree indexes on columns used in WHERE clauses',
                        'Add indexes on JOIN columns for efficient joins',
                        'Consider partial indexes for selective conditions',
                        'Add composite indexes for multi-column filters'
                    ],
                    'estimated_improvement': 'Up to 90% reduction in query time'
                })
            
            elif issue['type'] == 'expensive_nested_loop':
                rows = issue.get('value', 0)
                suggestions.append({
                    'category': 'joins',
                    'priority': 'high',
                    'title': 'Optimize Join Strategy',
                    'description': f'Nested loop join processing {rows:,} rows. This is inefficient for large datasets.',
                    'actions': [
                        'Add indexes on join columns to enable merge joins',
                        'Increase work_mem setting to allow hash joins',
                        'Reorder joins to filter data early',
                        'Add WHERE clause filters to reduce intermediate result sets',
                        'Consider denormalization for frequently joined tables'
                    ],
                    'estimated_improvement': '70-85% improvement in join performance'
                })
            
            elif issue['type'] == 'multiple_sorts':
                sort_count = issue.get('value', 1)
                suggestions.append({
                    'category': 'sorting',
                    'priority': 'medium',
                    'title': 'Eliminate Sort Operations',
                    'description': f'{sort_count} sort operation(s) detected. Sorting is expensive for large result sets.',
                    'actions': [
                        'Add indexes to support ORDER BY clauses',
                        'Use covering indexes to avoid sorting',
                        'Consider LIMIT with ORDER BY for pagination',
                        'Combine multiple sorts into single operation where possible'
                    ],
                    'estimated_improvement': '40-60% reduction in sorting overhead'
                })
            
            elif issue['type'] == 'high_planning_time':
                planning_time = issue.get('value', 0)
                suggestions.append({
                    'category': 'planning',
                    'priority': 'medium',
                    'title': 'Reduce Planning Overhead',
                    'description': f'Query planning time ({planning_time:.2f}ms) is high. This affects query startup performance.',
                    'actions': [
                        'Run ANALYZE on tables to update table statistics',
                        'Simplify complex subqueries and CTEs',
                        'Use prepared statements for repeated queries',
                        'Review and optimize view definitions',
                        'Consider increasing default_statistics_target for better estimates'
                    ],
                    'estimated_improvement': '50-70% reduction in planning time'
                })
        
        return suggestions
    
    def _analyze_query_rewrites(self, query_text: str) -> List[Dict]:
        """Analyze query for rewriting opportunities"""
        rewrites = []
        query_upper = query_text.upper()
        
        # Check for IN subqueries that can be rewritten as EXISTS
        if ' IN (' in query_upper and 'SELECT ' in query_upper:
            rewrites.append({
                'category': 'query_rewriting',
                'priority': 'high',
                'title': 'Rewrite IN Subquery to EXISTS',
                'description': 'IN subqueries can be inefficient. EXISTS is often faster and more predictable.',
                'actions': [
                    'Replace IN (SELECT ...) with EXISTS (SELECT 1 FROM ... WHERE ...)',
                    'Add correlation conditions to EXISTS subquery',
                    'Test performance with EXISTS vs IN'
                ],
                'example_rewrite': self._generate_exists_rewrite_example(query_text),
                'estimated_improvement': '30-50% improvement for large subquery results'
            })
        
        # Check for implicit joins (comma-separated tables)
        if ',' in query_upper and ' WHERE ' in query_upper:
            # Simple check for comma joins
            from_clause = self._extract_from_clause(query_text)
            if ',' in from_clause and 'JOIN' not in from_clause.upper():
                rewrites.append({
                    'category': 'query_rewriting',
                    'priority': 'medium',
                    'title': 'Convert Implicit Joins to Explicit',
                    'description': 'Implicit joins (comma syntax) are harder to read and optimize. Use explicit JOIN syntax.',
                    'actions': [
                        'Replace comma-separated tables with INNER JOIN',
                        'Move join conditions from WHERE to ON clause',
                        'Use appropriate join types (INNER, LEFT, RIGHT)',
                        'Consider join order for better performance'
                    ],
                    'example_rewrite': self._generate_explicit_join_example(query_text),
                    'estimated_improvement': '10-20% improvement in readability and maintainability'
                })
        
        # Check for correlated subqueries
        if self._has_correlated_subquery(query_text):
            rewrites.append({
                'category': 'query_rewriting',
                'priority': 'high',
                'title': 'Optimize Correlated Subqueries',
                'description': 'Correlated subqueries execute once per outer row and can be very slow.',
                'actions': [
                    'Rewrite as JOIN when possible',
                    'Use window functions for analytical queries',
                    'Consider EXISTS instead of correlated SELECT',
                    'Move calculations to WHERE clause if possible'
                ],
                'estimated_improvement': '60-80% improvement by eliminating correlation'
            })
        
        # Check for DISTINCT with ORDER BY
        if 'DISTINCT' in query_upper and 'ORDER BY' in query_upper:
            rewrites.append({
                'category': 'query_rewriting',
                'priority': 'medium',
                'title': 'Optimize DISTINCT with ORDER BY',
                'description': 'DISTINCT with ORDER BY can be expensive. Consider alternatives.',
                'actions': [
                    'Use GROUP BY instead of DISTINCT when possible',
                    'Add covering indexes for DISTINCT columns',
                    'Consider if DISTINCT is really necessary',
                    'Use window functions for complex deduplication'
                ],
                'estimated_improvement': '25-40% improvement in distinct operations'
            })
        
        return rewrites
    
    def _generate_exists_rewrite_example(self, query_text: str) -> str:
        """Generate an example of rewriting IN to EXISTS"""
        # This is a simplified example - a full implementation would parse the query
        return """
-- Instead of:
SELECT * FROM customers c 
WHERE c.id IN (SELECT customer_id FROM orders WHERE total > 100);

-- Use:
SELECT * FROM customers c 
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.total > 100);
"""
    
    def _generate_explicit_join_example(self, query_text: str) -> str:
        """Generate an example of converting implicit to explicit joins"""
        return """
-- Instead of:
SELECT c.name, o.total 
FROM customers c, orders o 
WHERE c.id = o.customer_id AND c.city = 'New York';

-- Use:
SELECT c.name, o.total 
FROM customers c 
INNER JOIN orders o ON c.id = o.customer_id 
WHERE c.city = 'New York';
"""
    
    def _extract_from_clause(self, query_text: str) -> str:
        """Extract FROM clause from query"""
        match = re.search(r'FROM\s+([^;]+?)(?:WHERE|GROUP|ORDER|LIMIT|$)', query_text, re.IGNORECASE | re.DOTALL)
        return match.group(1).strip() if match else ""
    
    def _has_correlated_subquery(self, query_text: str) -> bool:
        """Check if query has correlated subqueries"""
        # Simple check - look for subqueries with table references
        subquery_pattern = r'\(\s*SELECT[^)]+\)'
        subqueries = re.findall(subquery_pattern, query_text, re.IGNORECASE | re.DOTALL)
        
        # Extract table aliases from main query
        alias_pattern = r'FROM\s+\w+\s+(\w+)'
        aliases = re.findall(alias_pattern, query_text, re.IGNORECASE)
        
        # Check if any subquery references main query aliases
        for subquery in subqueries:
            for alias in aliases:
                if f'{alias}.' in subquery:
                    return True
        
        return False
    
    def _generate_index_suggestions(self, query_text: str, parsed_plan: Dict, 
                                  issues: List[Dict]) -> List[Dict]:
        """Generate specific index recommendations based on execution plan analysis"""
        index_suggestions = []
        
        # Extract table and column information from query
        query_analysis = self._analyze_query_for_indexes(query_text)
        
        # Analyze execution plan nodes for specific index opportunities
        plan_analysis = self._analyze_plan_nodes(parsed_plan)
        
        # High priority: Sequential scans that should be indexes
        for scan in plan_analysis.get('sequential_scans', []):
            table_name = scan.get('table')
            filter_columns = scan.get('filter_columns', [])
            
            for column in filter_columns:
                index_suggestions.append({
                    'type': 'btree',
                    'table': table_name,
                    'columns': [column],
                    'reason': f'Sequential scan with filter on {table_name}.{column} - high cost operation',
                    'priority': 'high',
                    'estimated_benefit': 'High - eliminates sequential scan, reduces I/O',
                    'current_cost': scan.get('cost', 'unknown'),
                    'ddl': f'CREATE INDEX idx_{table_name}_{column} ON {table_name} ({column});'
                })
        
        # High priority: Join columns without indexes
        for join in plan_analysis.get('inefficient_joins', []):
            for side in ['left', 'right']:
                table = join.get(f'{side}_table')
                column = join.get(f'{side}_column')
                if table and column:
                    index_suggestions.append({
                        'type': 'btree',
                        'table': table,
                        'columns': [column],
                        'reason': f'Inefficient join on {table}.{column} - using nested loop instead of hash/merge join',
                        'priority': 'high',
                        'estimated_benefit': 'High - enables hash/merge join strategy',
                        'current_join_type': join.get('join_type', 'unknown'),
                        'ddl': f'CREATE INDEX idx_{table}_{column} ON {table} ({column});'
                    })
        
        # Medium priority: WHERE clause filters from query analysis
        for table, columns in query_analysis['where_columns'].items():
            for column in columns:
                # Check if not already suggested from plan analysis
                if not any(idx['table'] == table and column in idx['columns'] for idx in index_suggestions):
                    index_suggestions.append({
                        'type': 'btree',
                        'table': table,
                        'columns': [column],
                        'reason': f'WHERE clause filter on {table}.{column}',
                        'priority': 'medium',
                        'estimated_benefit': 'Medium - improves filter performance',
                        'ddl': f'CREATE INDEX idx_{table}_{column} ON {table} ({column});'
                    })
        
        # Medium priority: ORDER BY optimization
        for table, columns in query_analysis['order_columns'].items():
            if len(columns) > 0:
                columns_str = '_'.join(columns)
                columns_ddl = ', '.join(columns)
                index_suggestions.append({
                    'type': 'btree',
                    'table': table,
                    'columns': columns,
                    'reason': f'ORDER BY clause on {table}.{", ".join(columns)} - eliminates sorting step',
                    'priority': 'medium',
                    'estimated_benefit': 'Medium - avoids expensive sort operation',
                    'ddl': f'CREATE INDEX idx_{table}_{columns_str} ON {table} ({columns_ddl});'
                })
        
        # Advanced: Composite index suggestions
        composite_suggestions = self._suggest_composite_indexes(query_analysis, plan_analysis)
        index_suggestions.extend(composite_suggestions)
        
        return index_suggestions
    
    def _analyze_query_for_indexes(self, query_text: str) -> Dict:
        """Analyze query to extract indexable columns"""
        query_upper = query_text.upper()
        
        analysis = {
            'where_columns': {},
            'joins': [],
            'order_columns': {}
        }
        
        # Extract WHERE clause columns
        where_match = re.search(r'WHERE\s+(.+?)(?:GROUP\s+BY|ORDER\s+BY|LIMIT|$)', query_upper, re.DOTALL)
        if where_match:
            where_clause = where_match.group(1)
            # Extract table.column references
            column_refs = re.findall(r'(\w+)\.(\w+)', where_clause)
            for table, column in column_refs:
                if table not in analysis['where_columns']:
                    analysis['where_columns'][table] = []
                if column not in analysis['where_columns'][table]:
                    analysis['where_columns'][table].append(column)
        
        # Extract JOIN conditions
        join_matches = re.findall(
            r'JOIN\s+(\w+)(?:\s+\w+)?\s+ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)', 
            query_upper
        )
        for table, left_table, left_col, right_table, right_col in join_matches:
            analysis['joins'].append({
                'joined_table': table,
                'left_table': left_table,
                'left_column': left_col,
                'right_table': right_table,
                'right_column': right_col
            })
        
        # Extract ORDER BY columns
        order_match = re.search(r'ORDER\s+BY\s+(.+?)(?:LIMIT|$)', query_upper, re.DOTALL)
        if order_match:
            order_clause = order_match.group(1).strip()
            # Extract table.column references
            column_refs = re.findall(r'(\w+)\.(\w+)', order_clause)
            for table, column in column_refs:
                if table not in analysis['order_columns']:
                    analysis['order_columns'][table] = []
                if column not in analysis['order_columns'][table]:
                    analysis['order_columns'][table].append(column)
        
        return analysis
    
    def _analyze_plan_nodes(self, parsed_plan: Dict) -> Dict:
        """Analyze execution plan nodes to identify specific optimization opportunities"""
        analysis = {
            'sequential_scans': [],
            'inefficient_joins': [],
            'expensive_sorts': [],
            'missing_indexes': []
        }
        
        if parsed_plan.get('format') == 'text':
            # Process text format explain output
            for node in parsed_plan.get('nodes', []):
                node_type = node.get('node_type', '')
                details = node.get('details', '')
                
                if 'Seq Scan' in node_type:
                    scan_info = self._extract_seq_scan_info(details)
                    if scan_info:
                        analysis['sequential_scans'].append(scan_info)
                
                elif 'Nested Loop' in node_type:
                    join_info = self._extract_join_info(details, 'nested_loop')
                    if join_info:
                        analysis['inefficient_joins'].append(join_info)
                
                elif 'Sort' in node_type:
                    sort_info = self._extract_sort_info(details)
                    if sort_info:
                        analysis['expensive_sorts'].append(sort_info)
        else:
            # Process JSON format explain output
            if isinstance(parsed_plan, list):
                parsed_plan = parsed_plan[0]
            
            if 'Plan' in parsed_plan:
                self._process_json_plan_nodes(analysis, parsed_plan['Plan'])
        
        return analysis
    
    def _extract_seq_scan_info(self, details: str) -> Dict:
        """Extract information from sequential scan node"""
        scan_info = {}
        
        # Extract table name
        table_match = re.search(r'Seq Scan on (\w+)', details)
        if table_match:
            scan_info['table'] = table_match.group(1)
        
        # Extract filter conditions
        filter_match = re.search(r'Filter: (.+)', details)
        if filter_match:
            filter_text = filter_match.group(1)
            # Extract column names from filter conditions
            columns = re.findall(r'(\w+)\s*[=<>!]', filter_text)
            scan_info['filter_columns'] = list(set(columns))
        
        # Extract cost information
        cost_match = re.search(r'cost=(\d+\.\d+)\.\.(\d+\.\d+)', details)
        if cost_match:
            scan_info['cost'] = float(cost_match.group(2))
        
        return scan_info if scan_info else {}
    
    def _extract_join_info(self, details: str, join_type: str) -> Dict:
        """Extract information from join operations"""
        join_info = {'join_type': join_type}
        
        # Extract join condition
        cond_match = re.search(r'Join Cond: \((.+?)\)', details)
        if cond_match:
            condition = cond_match.group(1)
            # Parse join condition like "t1.id = t2.id"
            eq_match = re.search(r'(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)', condition)
            if eq_match:
                join_info.update({
                    'left_table': eq_match.group(1),
                    'left_column': eq_match.group(2),
                    'right_table': eq_match.group(3),
                    'right_column': eq_match.group(4)
                })
        
        return join_info if 'left_table' in join_info else {}
    
    def _extract_sort_info(self, details: str) -> Dict:
        """Extract information from sort operations"""
        sort_info = {}
        
        # Extract sort key
        key_match = re.search(r'Sort Key: (.+)', details)
        if key_match:
            sort_key = key_match.group(1)
            # Extract table.column references
            columns = re.findall(r'(\w+)\.(\w+)', sort_key)
            if columns:
                sort_info['columns'] = columns
        
        # Extract sort method and memory usage
        method_match = re.search(r'Sort Method: (.+?)  Memory: (\d+)kB', details)
        if method_match:
            sort_info['method'] = method_match.group(1)
            sort_info['memory_kb'] = int(method_match.group(2))
        
        return sort_info if sort_info else {}
    
    def _process_json_plan_nodes(self, analysis: Dict, plan_node: Dict):
        """Process JSON format plan nodes recursively"""
        node_type = plan_node.get('Node Type', '')
        
        if node_type == 'Seq Scan':
            table_name = plan_node.get('Relation Name', '')
            filter_cond = plan_node.get('Filter', '')
            
            if table_name and filter_cond:
                # Extract column names from filter
                columns = re.findall(r'(\w+)\s*[=<>!]', filter_cond)
                analysis['sequential_scans'].append({
                    'table': table_name,
                    'filter_columns': list(set(columns)),
                    'cost': plan_node.get('Total Cost', 0)
                })
        
        elif node_type == 'Nested Loop':
            # Look for join conditions in child nodes
            join_info = {'join_type': 'nested_loop'}
            # This would need more complex parsing for JSON format
            analysis['inefficient_joins'].append(join_info)
        
        elif node_type == 'Sort':
            sort_key = plan_node.get('Sort Key', [])
            if sort_key:
                analysis['expensive_sorts'].append({
                    'sort_keys': sort_key,
                    'sort_method': plan_node.get('Sort Method', ''),
                    'memory_used': plan_node.get('Sort Space Used', 0)
                })
        
        # Process child nodes recursively
        for child in plan_node.get('Plans', []):
            self._process_json_plan_nodes(analysis, child)
    
    def _suggest_composite_indexes(self, query_analysis: Dict, plan_analysis: Dict) -> List[Dict]:
        """Suggest composite indexes for better performance"""
        composite_suggestions = []
        
        # Suggest composite indexes for tables with multiple filter conditions
        for table, columns in query_analysis['where_columns'].items():
            if len(columns) > 1:
                # Sort columns by selectivity (approximate)
                sorted_columns = sorted(columns)
                columns_str = '_'.join(sorted_columns)
                columns_ddl = ', '.join(sorted_columns)
                
                composite_suggestions.append({
                    'type': 'btree',
                    'table': table,
                    'columns': sorted_columns,
                    'reason': f'Composite index for multiple WHERE conditions on {table}',
                    'priority': 'medium',
                    'estimated_benefit': 'High - single index scan instead of multiple',
                    'ddl': f'CREATE INDEX idx_{table}_{columns_str}_composite ON {table} ({columns_ddl});'
                })
        
        # Suggest covering indexes for frequently accessed columns
        for table in query_analysis['where_columns'].keys():
            if table in query_analysis['order_columns']:
                where_cols = query_analysis['where_columns'][table]
                order_cols = query_analysis['order_columns'][table]
                
                # Combine WHERE and ORDER BY columns
                all_columns = where_cols + [col for col in order_cols if col not in where_cols]
                if len(all_columns) > 1:
                    columns_str = '_'.join(all_columns)
                    columns_ddl = ', '.join(all_columns)
                    
                    composite_suggestions.append({
                        'type': 'btree',
                        'table': table,
                        'columns': all_columns,
                        'reason': f'Covering index for {table} - includes WHERE and ORDER BY columns',
                        'priority': 'medium',
                        'estimated_benefit': 'High - index-only scan possible',
                        'ddl': f'CREATE INDEX idx_{table}_{columns_str}_covering ON {table} ({columns_ddl});'
                    })
        
        return composite_suggestions
    
    def _calculate_performance_score(self, metrics: Dict, issues: List[Dict]) -> Dict:
        """Calculate overall performance score"""
        base_score = 100
        
        # Deduct points for issues
        for issue in issues:
            if issue['severity'] == 'high':
                base_score -= 20
            elif issue['severity'] == 'medium':
                base_score -= 10
            else:
                base_score -= 5
        
        # Ensure score doesn't go below 0
        base_score = max(0, base_score)
        
        # Calculate grade
        if base_score >= 90:
            grade = 'A'
        elif base_score >= 80:
            grade = 'B'
        elif base_score >= 70:
            grade = 'C'
        elif base_score >= 60:
            grade = 'D'
        else:
            grade = 'F'
        
        return {
            'score': base_score,
            'grade': grade,
            'total_issues': len(issues),
            'high_severity_issues': len([i for i in issues if i['severity'] == 'high'])
        }


def analyze_explain_output(query_text: str, explain_output: str, 
                          source_type: str = 'postgresql') -> Dict[str, Any]:
    """
    Main function to analyze EXPLAIN ANALYZE output
    
    Args:
        query_text: Original query text
        explain_output: EXPLAIN ANALYZE output
        source_type: Source database type
        
    Returns:
        Analysis results with performance issues and recommendations
    """
    analyzer = ExplainAnalyzer()
    return analyzer.analyze_explain_output(query_text, explain_output, source_type)