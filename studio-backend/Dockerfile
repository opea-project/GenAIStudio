# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /usr/src/

# Copy the current directory contents into the container at /usr/src/app
COPY app /usr/src/app

# Upgrade libsqlite3 to a safe version
RUN apt-get update -y && apt-get install -y --no-install-recommends --fix-missing \
    libsqlite3-0=3.40.1-2+deb12u1 && \
    rm -rf /var/lib/apt/lists/*

# Upgrade setuptools to a safe version and install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir --upgrade pip==24.3.1 setuptools==75.3.0 && \
    pip install --no-cache-dir -r /usr/src/app/requirements.txt

# Define environment variable
ENV PORT=5000

# Run uvicorn when the container launches
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]