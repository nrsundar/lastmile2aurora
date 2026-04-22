from app import db
from datetime import datetime
import json


class SQLQuery(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    source_type = db.Column(db.String(20), nullable=False)  # 'oracle', 'sqlserver', 'postgresql'
    original_query = db.Column(db.Text, nullable=False)
    optimized_query = db.Column(db.Text)
    issues = db.Column(db.Text)  # JSON string of issues and recommendations
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    target_version = db.Column(db.String(10), default="16")  # Target PostgreSQL version (14, 15, 16)
    aurora_specific = db.Column(db.Boolean, default=True)  # Whether to include Aurora-specific optimizations
    
    def __repr__(self):
        return f'<SQLQuery {self.id}>'
    
    def get_issues_json(self):
        """Return issues as a parsed JSON object"""
        if not self.issues:
            return {}
        try:
            return json.loads(self.issues)
        except json.JSONDecodeError:
            return {}


class OptimizationRule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    rule_name = db.Column(db.String(100), nullable=False)
    source_dialect = db.Column(db.String(20), nullable=False)  # 'oracle', 'sqlserver', 'postgresql', 'any'
    description = db.Column(db.Text, nullable=False)
    pattern = db.Column(db.Text, nullable=False)  # regex or text pattern to match
    suggestion = db.Column(db.Text, nullable=False)
    min_pg_version = db.Column(db.String(10), default="13")  # Minimum PostgreSQL version required
    aurora_only = db.Column(db.Boolean, default=False)  # Is this an Aurora-specific optimization?
    
    def __repr__(self):
        return f'<OptimizationRule {self.rule_name}>'


class ComplexTypeMapping(db.Model):
    """Mapping for complex data types between different database systems"""
    id = db.Column(db.Integer, primary_key=True)
    source_type = db.Column(db.String(20), nullable=False)  # 'oracle', 'sqlserver'
    source_data_type = db.Column(db.String(50), nullable=False)
    pg_data_type = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text)
    conversion_notes = db.Column(db.Text)
    min_pg_version = db.Column(db.String(10), default="13")  # Minimum PostgreSQL version required
    
    def __repr__(self):
        return f'<ComplexTypeMapping {self.source_data_type} to {self.pg_data_type}>'


class StoredProcedureTemplate(db.Model):
    """Templates for common stored procedure patterns conversion"""
    id = db.Column(db.Integer, primary_key=True)
    source_type = db.Column(db.String(20), nullable=False)  # 'oracle', 'sqlserver'
    procedure_pattern = db.Column(db.Text, nullable=False)
    pg_equivalent = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)
    min_pg_version = db.Column(db.String(10), default="13")  # Minimum PostgreSQL version required
    
    def __repr__(self):
        return f'<StoredProcedureTemplate {self.id}>'


class AuroraFeature(db.Model):
    """Aurora PostgreSQL specific features and optimizations"""
    id = db.Column(db.Integer, primary_key=True)
    feature_name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    usage_example = db.Column(db.Text)
    min_pg_version = db.Column(db.String(10), default="13")  # Minimum PostgreSQL version required
    
    def __repr__(self):
        return f'<AuroraFeature {self.feature_name}>'


class DDLAnalysis(db.Model):
    """Analysis of table DDLs with index recommendations"""
    id = db.Column(db.Integer, primary_key=True)
    schema_name = db.Column(db.String(100), nullable=False)
    ddl_content = db.Column(db.Text, nullable=False)  # Original DDL statements
    query_content = db.Column(db.Text, nullable=False)  # Query to analyze
    source_type = db.Column(db.String(20), nullable=False)  # 'oracle', 'sqlserver', 'postgresql'
    index_recommendations = db.Column(db.Text)  # JSON string of index recommendations
    index_ddls = db.Column(db.Text)  # Generated index DDL statements
    analysis_results = db.Column(db.Text)  # JSON string of analysis details
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    target_version = db.Column(db.String(10), default="16")  # Target PostgreSQL version
    
    def __repr__(self):
        return f'<DDLAnalysis {self.schema_name}>'
    
    def get_index_recommendations_json(self):
        """Return index recommendations as a parsed JSON object"""
        if not self.index_recommendations:
            return []
        try:
            return json.loads(self.index_recommendations)
        except json.JSONDecodeError:
            return []
    
    def get_analysis_results_json(self):
        """Return analysis results as a parsed JSON object"""
        if not self.analysis_results:
            return {}
        try:
            return json.loads(self.analysis_results)
        except json.JSONDecodeError:
            return {}


class ExplainAnalysis(db.Model):
    """Analysis of EXPLAIN ANALYZE output with optimization suggestions"""
    id = db.Column(db.Integer, primary_key=True)
    query_text = db.Column(db.Text, nullable=False)  # Original query
    explain_output = db.Column(db.Text, nullable=False)  # EXPLAIN ANALYZE output
    source_type = db.Column(db.String(20), nullable=False)  # 'oracle', 'sqlserver', 'postgresql'
    performance_issues = db.Column(db.Text)  # JSON string of identified issues
    optimization_suggestions = db.Column(db.Text)  # JSON string of suggestions
    index_suggestions = db.Column(db.Text)  # JSON string of index recommendations
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    execution_time_ms = db.Column(db.Float)  # Extracted execution time
    rows_processed = db.Column(db.Integer)  # Number of rows processed
    
    def __repr__(self):
        return f'<ExplainAnalysis {self.id}>'
    
    def get_performance_issues_json(self):
        """Return performance issues as a parsed JSON object"""
        if not self.performance_issues:
            return []
        try:
            return json.loads(self.performance_issues)
        except json.JSONDecodeError:
            return []
    
    def get_optimization_suggestions_json(self):
        """Return optimization suggestions as a parsed JSON object"""
        if not self.optimization_suggestions:
            return []
        try:
            return json.loads(self.optimization_suggestions)
        except json.JSONDecodeError:
            return []
    
    def get_index_suggestions_json(self):
        """Return index suggestions as a parsed JSON object"""
        if not self.index_suggestions:
            return []
        try:
            return json.loads(self.index_suggestions)
        except json.JSONDecodeError:
            return []
