"""
Performance Metrics Estimator for SQL Code Conversion
Estimates performance improvements based on SQL transformations
"""

import re
import json
from typing import Dict, List, Tuple, Any
from sqlparse import parse, tokens
from sqlparse.sql import Statement, IdentifierList, Identifier, Function, Where, Comparison


class PerformanceEstimator:
    """
    Estimates performance metrics for SQL code conversion
    """
    
    def __init__(self):
        # Performance impact weights for different optimizations
        self.optimization_weights = {
            'rownum_to_limit': 15,  # ROWNUM -> LIMIT typically 15% improvement
            'implicit_to_explicit_joins': 25,  # Implicit -> Explicit joins
            'nvl_to_coalesce': 5,  # NVL -> COALESCE minor improvement
            'sysdate_to_current_timestamp': 8,  # SYSDATE -> CURRENT_TIMESTAMP
            'oracle_hints_removal': 12,  # Remove Oracle hints
            'subquery_optimization': 30,  # Subquery improvements
            'function_optimization': 18,  # Function call optimizations
            'index_hint_conversion': 20,  # Index hint optimizations
            'merge_to_upsert': 35,  # MERGE -> INSERT...ON CONFLICT
            'connect_by_to_recursive': 40,  # CONNECT BY -> WITH RECURSIVE
            'top_to_limit': 10,  # TOP -> LIMIT
            'getdate_to_current_timestamp': 5,  # GETDATE -> CURRENT_TIMESTAMP
            'output_to_returning': 15,  # OUTPUT -> RETURNING
            'three_part_name_fix': 8,  # Fix schema references
            'data_type_optimization': 12,  # Data type improvements
        }
        
        # Complexity factors that affect performance estimation
        self.complexity_factors = {
            'join_count': 1.2,  # Each additional join
            'subquery_count': 1.5,  # Each subquery
            'function_count': 1.1,  # Each function call
            'where_clause_complexity': 1.3,  # Complex WHERE conditions
            'aggregate_functions': 1.2,  # GROUP BY, aggregates
            'window_functions': 1.4,  # Window functions
        }
    
    def estimate_performance_metrics(self, original_sql: str, optimized_sql: str, 
                                   analysis_results: Dict, source_type: str) -> Dict[str, Any]:
        """
        Estimate performance metrics comparing original vs optimized SQL
        
        Args:
            original_sql: Original SQL code
            optimized_sql: Optimized PostgreSQL code
            analysis_results: Results from SQL analysis
            source_type: Source database type
            
        Returns:
            Dictionary with performance estimates
        """
        
        # Parse SQL statements
        original_parsed = parse(original_sql)
        optimized_parsed = parse(optimized_sql)
        
        # Calculate complexity scores
        original_complexity = self._calculate_complexity_score(original_sql, source_type)
        optimized_complexity = self._calculate_complexity_score(optimized_sql, 'postgresql')
        
        # Estimate performance improvements from optimizations
        optimization_impact = self._calculate_optimization_impact(analysis_results)
        
        # Calculate estimated execution time improvement
        execution_time_improvement = self._estimate_execution_time_improvement(
            original_complexity, optimized_complexity, optimization_impact
        )
        
        # Estimate resource usage improvements
        resource_improvements = self._estimate_resource_improvements(
            original_sql, optimized_sql, optimization_impact
        )
        
        # Generate performance metrics
        metrics = {
            'execution_time': {
                'estimated_improvement_percentage': round(execution_time_improvement, 1),
                'confidence_level': self._calculate_confidence_level(analysis_results),
                'factors': self._get_improvement_factors(analysis_results)
            },
            'resource_usage': resource_improvements,
            'complexity_analysis': {
                'original_complexity_score': original_complexity,
                'optimized_complexity_score': optimized_complexity,
                'complexity_reduction': round(
                    ((original_complexity - optimized_complexity) / original_complexity) * 100, 1
                ) if original_complexity > 0 else 0
            },
            'optimization_summary': {
                'total_optimizations': len(optimization_impact),
                'high_impact_optimizations': len([o for o in optimization_impact if o['impact'] > 20]),
                'estimated_maintenance_improvement': self._estimate_maintenance_improvement(analysis_results)
            },
            'postgresql_benefits': self._estimate_postgresql_benefits(source_type, analysis_results),
            'recommendations': self._generate_performance_recommendations(analysis_results, optimization_impact)
        }
        
        return metrics
    
    def _calculate_complexity_score(self, sql: str, db_type: str) -> float:
        """Calculate complexity score for SQL code"""
        score = 0.0
        sql_lower = sql.lower()
        
        # Base complexity factors
        score += len(re.findall(r'\bjoin\b', sql_lower)) * 2  # Joins
        score += len(re.findall(r'\bselect\b', sql_lower)) * 1  # Subqueries
        score += len(re.findall(r'\bwhere\b', sql_lower)) * 1.5  # WHERE clauses
        score += len(re.findall(r'\bgroup by\b', sql_lower)) * 2  # GROUP BY
        score += len(re.findall(r'\border by\b', sql_lower)) * 1  # ORDER BY
        score += len(re.findall(r'\bhaving\b', sql_lower)) * 2  # HAVING
        score += len(re.findall(r'\bunion\b', sql_lower)) * 3  # UNION
        score += len(re.findall(r'\bexists\b', sql_lower)) * 2  # EXISTS
        score += len(re.findall(r'\bin\s*\(', sql_lower)) * 1.5  # IN clauses
        
        # Database-specific complexity
        if db_type == 'oracle':
            score += len(re.findall(r'\brownum\b', sql_lower)) * 2
            score += len(re.findall(r'\bconnect by\b', sql_lower)) * 4
            score += len(re.findall(r'/\*\+.*?\*/', sql)) * 1  # Oracle hints
        elif db_type == 'sqlserver':
            score += len(re.findall(r'\btop\s+\d+\b', sql_lower)) * 1
            score += len(re.findall(r'\boutput\b', sql_lower)) * 2
        
        return score
    
    def _calculate_optimization_impact(self, analysis_results: Dict) -> List[Dict]:
        """Calculate impact of each optimization applied"""
        optimizations = []
        
        if 'optimization_details' in analysis_results:
            opt_details = analysis_results.get('optimization_details', [])
        if isinstance(opt_details, list):
            changes = opt_details
        elif isinstance(opt_details, dict):
            changes = opt_details.get('changes_made', [])
        else:
            changes = []
            
            for change in changes:
                change_lower = change.lower()
                impact = 0
                optimization_type = 'general'
                
                # Identify optimization type and impact
                if 'rownum' in change_lower and 'limit' in change_lower:
                    impact = self.optimization_weights['rownum_to_limit']
                    optimization_type = 'rownum_to_limit'
                elif 'join' in change_lower and 'explicit' in change_lower:
                    impact = self.optimization_weights['implicit_to_explicit_joins']
                    optimization_type = 'join_optimization'
                elif 'nvl' in change_lower and 'coalesce' in change_lower:
                    impact = self.optimization_weights['nvl_to_coalesce']
                    optimization_type = 'function_conversion'
                elif 'sysdate' in change_lower:
                    impact = self.optimization_weights['sysdate_to_current_timestamp']
                    optimization_type = 'function_conversion'
                elif 'merge' in change_lower and 'conflict' in change_lower:
                    impact = self.optimization_weights['merge_to_upsert']
                    optimization_type = 'statement_optimization'
                elif 'connect by' in change_lower and 'recursive' in change_lower:
                    impact = self.optimization_weights['connect_by_to_recursive']
                    optimization_type = 'query_structure'
                elif 'top' in change_lower and 'limit' in change_lower:
                    impact = self.optimization_weights['top_to_limit']
                    optimization_type = 'limit_optimization'
                elif 'getdate' in change_lower:
                    impact = self.optimization_weights['getdate_to_current_timestamp']
                    optimization_type = 'function_conversion'
                elif 'output' in change_lower and 'returning' in change_lower:
                    impact = self.optimization_weights['output_to_returning']
                    optimization_type = 'clause_optimization'
                elif 'data type' in change_lower:
                    impact = self.optimization_weights['data_type_optimization']
                    optimization_type = 'data_type'
                else:
                    impact = 8  # Default impact for unspecified optimizations
                
                optimizations.append({
                    'description': change,
                    'type': optimization_type,
                    'impact': impact
                })
        
        return optimizations
    
    def _estimate_execution_time_improvement(self, original_complexity: float, 
                                           optimized_complexity: float, 
                                           optimizations: List[Dict]) -> float:
        """Estimate execution time improvement percentage"""
        
        # Base improvement from complexity reduction
        complexity_improvement = 0
        if original_complexity > 0:
            complexity_improvement = ((original_complexity - optimized_complexity) / original_complexity) * 15
        
        # Improvement from specific optimizations
        optimization_improvement = sum(opt['impact'] for opt in optimizations)
        
        # Apply diminishing returns for multiple optimizations
        if len(optimizations) > 1:
            optimization_improvement *= (0.8 + 0.2 / len(optimizations))
        
        # Cap maximum improvement at 75%
        total_improvement = min(complexity_improvement + optimization_improvement, 75)
        
        return max(0, total_improvement)
    
    def _estimate_resource_improvements(self, original_sql: str, optimized_sql: str, 
                                      optimizations: List[Dict]) -> Dict[str, Any]:
        """Estimate resource usage improvements"""
        
        cpu_improvement = 0
        memory_improvement = 0
        io_improvement = 0
        
        for opt in optimizations:
            opt_type = opt['type']
            impact = opt['impact']
            
            if opt_type in ['join_optimization', 'query_structure']:
                cpu_improvement += impact * 0.6
                memory_improvement += impact * 0.4
            elif opt_type in ['function_conversion', 'clause_optimization']:
                cpu_improvement += impact * 0.8
            elif opt_type in ['limit_optimization', 'rownum_to_limit']:
                io_improvement += impact * 0.9
                memory_improvement += impact * 0.3
            elif opt_type == 'statement_optimization':
                cpu_improvement += impact * 0.5
                io_improvement += impact * 0.7
        
        return {
            'cpu_usage_improvement': round(min(cpu_improvement, 60), 1),
            'memory_usage_improvement': round(min(memory_improvement, 50), 1),
            'io_operations_improvement': round(min(io_improvement, 70), 1),
            'overall_resource_efficiency': round(
                (cpu_improvement + memory_improvement + io_improvement) / 3, 1
            )
        }
    
    def _calculate_confidence_level(self, analysis_results: Dict) -> str:
        """Calculate confidence level for performance estimates"""
        
        # Factors that increase confidence
        confidence_score = 0
        
        # Number of specific optimizations identified
        if 'optimization_details' in analysis_results:
            changes = len((analysis_results.get('optimization_details', []) if isinstance(analysis_results.get('optimization_details'), list) else analysis_results.get('optimization_details', {}).get('changes_made', [])))
            confidence_score += min(changes * 10, 40)
        
        # Presence of detailed analysis
        if 'issues' in analysis_results.get('analysis', {}):
            issues = analysis_results['analysis']['issues']
            confidence_score += min(len(issues) * 5, 30)
        
        # SQL complexity (more complex = lower confidence)
        if 'complexity' in analysis_results.get('analysis', {}):
            complexity = analysis_results['analysis']['complexity']
            if complexity == 'low':
                confidence_score += 20
            elif complexity == 'medium':
                confidence_score += 10
            # high complexity adds 0
        
        # Determine confidence level
        if confidence_score >= 70:
            return 'High'
        elif confidence_score >= 40:
            return 'Medium'
        else:
            return 'Low'
    
    def _get_improvement_factors(self, analysis_results: Dict) -> List[str]:
        """Get list of factors contributing to performance improvement"""
        factors = []
        
        if 'optimization_details' in analysis_results:
            opt_details = analysis_results.get('optimization_details', [])
        if isinstance(opt_details, list):
            changes = opt_details
        elif isinstance(opt_details, dict):
            changes = opt_details.get('changes_made', [])
        else:
            changes = []
            
            for change in changes:
                change_lower = change.lower()
                if 'join' in change_lower:
                    factors.append('Optimized join operations')
                elif 'limit' in change_lower:
                    factors.append('Improved result set limiting')
                elif 'function' in change_lower:
                    factors.append('PostgreSQL-native function usage')
                elif 'index' in change_lower:
                    factors.append('Better index utilization')
                elif 'subquery' in change_lower:
                    factors.append('Subquery optimization')
                elif 'recursive' in change_lower:
                    factors.append('Recursive query efficiency')
                else:
                    factors.append('General SQL optimization')
        
        return list(set(factors))  # Remove duplicates
    
    def _estimate_maintenance_improvement(self, analysis_results: Dict) -> float:
        """Estimate code maintainability improvement"""
        
        improvement = 0
        
        if 'optimization_details' in analysis_results:
            opt_details = analysis_results.get('optimization_details', [])
        if isinstance(opt_details, list):
            changes = opt_details
        elif isinstance(opt_details, dict):
            changes = opt_details.get('changes_made', [])
        else:
            changes = []
            
            for change in changes:
                change_lower = change.lower()
                if 'explicit' in change_lower and 'join' in change_lower:
                    improvement += 15  # Explicit joins are more readable
                elif 'standard' in change_lower or 'ansi' in change_lower:
                    improvement += 10  # ANSI standard compliance
                elif 'simplified' in change_lower:
                    improvement += 12  # Code simplification
                elif 'removed' in change_lower and 'hint' in change_lower:
                    improvement += 8   # Removed database-specific hints
        
        return min(improvement, 50)  # Cap at 50%
    
    def _estimate_postgresql_benefits(self, source_type: str, analysis_results: Dict) -> Dict[str, Any]:
        """Estimate PostgreSQL-specific benefits"""
        
        benefits = {
            'standards_compliance': 'Improved ANSI SQL compliance',
            'portability': 'Better database portability',
            'features': []
        }
        
        if source_type == 'oracle':
            benefits['features'].extend([
                'Native PostgreSQL date/time functions',
                'Improved transaction handling',
                'Better concurrent access patterns'
            ])
        elif source_type == 'sqlserver':
            benefits['features'].extend([
                'ANSI-compliant LIMIT clause',
                'Standard RETURNING clause',
                'Cross-platform compatibility'
            ])
        
        # Add Aurora-specific benefits if applicable
        benefits['aurora_benefits'] = [
            'Optimized for Aurora PostgreSQL storage',
            'Better integration with AWS services',
            'Improved backup and recovery performance'
        ]
        
        return benefits
    
    def _generate_performance_recommendations(self, analysis_results: Dict, 
                                            optimizations: List[Dict]) -> List[str]:
        """Generate performance recommendations based on analysis"""
        
        recommendations = []
        
        # General recommendations
        recommendations.append('Test converted queries in a staging environment')
        recommendations.append('Update table statistics after data migration')
        
        # Specific recommendations based on optimizations
        high_impact_opts = [opt for opt in optimizations if opt['impact'] > 20]
        
        if high_impact_opts:
            recommendations.append('Monitor high-impact optimizations in production')
        
        if any('join' in opt['description'].lower() for opt in optimizations):
            recommendations.append('Review and optimize table indexes for new join patterns')
        
        if any('limit' in opt['description'].lower() for opt in optimizations):
            recommendations.append('Consider adding appropriate indexes for LIMIT queries')
        
        if any('recursive' in opt['description'].lower() for opt in optimizations):
            recommendations.append('Test recursive query performance with representative data volumes')
        
        # Add PostgreSQL-specific recommendations
        recommendations.extend([
            'Configure PostgreSQL query planner statistics',
            'Consider using EXPLAIN ANALYZE to verify performance improvements',
            'Review connection pooling configuration for optimal performance'
        ])
        
        return recommendations


def estimate_query_performance(original_sql: str, optimized_sql: str, 
                             analysis_results: Dict, source_type: str) -> Dict[str, Any]:
    """
    Main function to estimate performance metrics for SQL conversion
    
    Args:
        original_sql: Original SQL code
        optimized_sql: Optimized PostgreSQL code
        analysis_results: Results from SQL analysis
        source_type: Source database type
        
    Returns:
        Performance metrics estimation
    """
    estimator = PerformanceEstimator()
    return estimator.estimate_performance_metrics(
        original_sql, optimized_sql, analysis_results, source_type
    )