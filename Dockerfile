FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the SQL optimizer engine
COPY sql-migration-optimizer/src/ /app/optimizer_engine/
ENV PYTHONPATH="/app/optimizer_engine:${PYTHONPATH}"

# Copy backend code
COPY backend/ /app/

# Copy frontend build as static files
COPY frontend/dist/ /app/static/

# Copy mock workload data
COPY mock-workload/ /app/mock-workload/

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
