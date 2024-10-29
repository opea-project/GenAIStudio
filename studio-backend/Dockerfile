# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /usr/src/

# Copy the current directory contents into the container at /usr/src/app
COPY app /usr/src/app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r /usr/src/app/requirements.txt

# Define environment variable
ENV PORT=5000

# Run uvicorn when the container launches
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]