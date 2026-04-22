"""Seed script — creates tables and loads data into both Oracle and Aurora PG."""

import csv
import os
import sys

# ── Oracle seeding ──────────────────────────────────────────────────
def seed_oracle(host: str, port: int, service: str, user: str, password: str):
    import oracledb
    conn = oracledb.connect(user=user, password=password, dsn=f"{host}:{port}/{service}")
    cur = conn.cursor()

    # Create tables
    for stmt in [
        """CREATE TABLE employees (
            employee_id NUMBER PRIMARY KEY, first_name VARCHAR2(50), last_name VARCHAR2(50),
            email VARCHAR2(100), hire_date DATE, salary NUMBER(10,2),
            department_id NUMBER, manager_id NUMBER, commission_pct NUMBER(3,2))""",
        """CREATE TABLE departments (
            department_id NUMBER PRIMARY KEY, department_name VARCHAR2(50),
            location VARCHAR2(50), manager_id NUMBER)""",
        """CREATE TABLE orders (
            order_id NUMBER PRIMARY KEY, employee_id NUMBER, order_date DATE,
            amount NUMBER(12,2), status VARCHAR2(20), customer_name VARCHAR2(100))""",
    ]:
        try:
            cur.execute(stmt)
        except oracledb.DatabaseError as e:
            if "ORA-00955" in str(e):  # table already exists
                pass
            else:
                raise

    # Load CSV data
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    _load_csv_oracle(cur, "employees", os.path.join(data_dir, "employees.csv"))
    _load_csv_oracle(cur, "departments", os.path.join(data_dir, "departments.csv"))
    _load_csv_oracle(cur, "orders", os.path.join(data_dir, "orders.csv"))

    # Create sequence for demo
    try:
        cur.execute("CREATE SEQUENCE emp_seq START WITH 100 INCREMENT BY 1")
    except oracledb.DatabaseError:
        pass

    conn.commit()
    cur.close()
    conn.close()
    print(f"Oracle seeded: {host}:{port}/{service}")


def _load_csv_oracle(cur, table, path):
    import oracledb
    from datetime import datetime
    # Set date format for the session
    cur.execute("ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD'")
    with open(path) as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames
        # Use TO_DATE for date columns
        date_cols = {"hire_date", "order_date"}
        parts = []
        for c in cols:
            if c in date_cols:
                parts.append(f"TO_DATE(:{c}, 'YYYY-MM-DD')")
            else:
                parts.append(f":{c}")
        sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(parts)})"
        for row in reader:
            cleaned = {k: (None if v == "NULL" or v == "" else v) for k, v in row.items()}
            try:
                cur.execute(sql, cleaned)
            except oracledb.DatabaseError as e:
                if "ORA-00001" in str(e):
                    pass
                else:
                    raise


# ── Aurora PG seeding ───────────────────────────────────────────────
def seed_postgres(host: str, port: int, database: str, user: str, password: str):
    import psycopg2
    conn = psycopg2.connect(host=host, port=port, database=database, user=user, password=password, sslmode="require")
    cur = conn.cursor()

    for stmt in [
        """CREATE TABLE IF NOT EXISTS employees (
            employee_id INT PRIMARY KEY, first_name VARCHAR(50), last_name VARCHAR(50),
            email VARCHAR(100), hire_date DATE, salary NUMERIC(10,2),
            department_id INT, manager_id INT, commission_pct NUMERIC(3,2))""",
        """CREATE TABLE IF NOT EXISTS departments (
            department_id INT PRIMARY KEY, department_name VARCHAR(50),
            location VARCHAR(50), manager_id INT)""",
        """CREATE TABLE IF NOT EXISTS orders (
            order_id INT PRIMARY KEY, employee_id INT, order_date DATE,
            amount NUMERIC(12,2), status VARCHAR(20), customer_name VARCHAR(100))""",
        "CREATE SEQUENCE IF NOT EXISTS emp_seq START WITH 100 INCREMENT BY 1",
    ]:
        cur.execute(stmt)

    data_dir = os.path.join(os.path.dirname(__file__), "data")
    _load_csv_pg(cur, "employees", os.path.join(data_dir, "employees.csv"))
    _load_csv_pg(cur, "departments", os.path.join(data_dir, "departments.csv"))
    _load_csv_pg(cur, "orders", os.path.join(data_dir, "orders.csv"))

    conn.commit()
    cur.close()
    conn.close()
    print(f"Aurora PG seeded: {host}:{port}/{database}")


def _load_csv_pg(cur, table, path):
    with open(path) as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames
        placeholders = ", ".join(["%s"] * len(cols))
        sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
        for row in reader:
            vals = [None if v == "NULL" or v == "" else v for v in row.values()]
            cur.execute(sql, vals)


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "both"

    if action in ("oracle", "both"):
        seed_oracle(
            host=os.environ.get("ORACLE_HOST", "localhost"),
            port=int(os.environ.get("ORACLE_PORT", "1521")),
            service=os.environ.get("ORACLE_SERVICE", "LASTMILE"),
            user=os.environ.get("ORACLE_USER", "oracleadmin"),
            password=os.environ.get("ORACLE_PASSWORD", "LastMile2Aurora2026"),
        )

    if action in ("pg", "both"):
        seed_postgres(
            host=os.environ.get("PG_HOST", "localhost"),
            port=int(os.environ.get("PG_PORT", "5432")),
            database=os.environ.get("PG_DATABASE", "lastmile"),
            user=os.environ.get("PG_USER", "lastmileadmin"),
            password=os.environ.get("PG_PASSWORD", "LastMile2Aurora2026"),
        )
