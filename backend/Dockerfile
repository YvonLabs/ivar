FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV DATABASE_URL=sqlite:////app/data/ivar.db

EXPOSE 7331

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "7331"]
