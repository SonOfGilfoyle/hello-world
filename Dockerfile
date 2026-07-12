# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . .

EXPOSE 8000

# Serve the game when the container launches
CMD [ "python", "./main.py" ]
