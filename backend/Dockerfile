FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 FA_DB=/data/farm_advisor.db
COPY requirements.txt requirements-sat.txt ./
# requirements-sat.txt brings the geospatial libraries (rasterio, pystac-client, pyproj) so the API can fetch the Sentinel-2
# pictures of the farmer's own field in a background process; without them the field works from weather and sensors only.
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 && rm -rf /var/lib/apt/lists/* \
    && pip install -r requirements.txt -r requirements-sat.txt \
    && python -c "import rasterio, pystac_client, pyproj"
COPY . .
# The SQLite file lives in /data (a volume). Use FA_DATABASE_URL for a managed database instead.
RUN useradd -m app && mkdir -p /data && chown -R app /data /app
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
