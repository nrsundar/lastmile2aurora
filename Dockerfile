FROM python:3.11-slim

WORKDIR /app

# Install sql-migration-optimizer engine
COPY ../sql-migration-optimizer/src /app/optimizer_engine
ENV PYTHONPATH="/app/optimizer_engine:${PYTHONPATH}"

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ /app/
COPY mock-workload/ /app/mock-workload/

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
