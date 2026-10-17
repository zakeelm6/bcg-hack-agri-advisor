FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY requirements.txt requirements-sat.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
 && python -m venv .venv-sat && .venv-sat/bin/pip install --no-cache-dir -r requirements-sat.txt   # the satellite job runs here
COPY . .
# The database file lives in a volume (see docker-compose.yml); the API listens on 8000.
ENV FA_DB=/data/farm_advisor.db
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
