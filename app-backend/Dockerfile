FROM python:3.11-slim

RUN apt-get update -y && apt-get install -y --no-install-recommends --fix-missing \
    libsqlite3-0=3.40.1-2+deb12u1 \
    libgl1-mesa-glx=22.3.6-1+deb12u1 \
    libjemalloc-dev=5.3.0-1 \
    git=1:2.39.5-0+deb12u1 && \
    rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash user && \
    mkdir -p /home/user && \
    chown -R user /home/user/

WORKDIR /home/user/
# temporary pointing to v1.1 GenAIComps for Gateway dependency
RUN git clone https://github.com/opea-project/GenAIComps.git -b v1.1rc

WORKDIR /home/user/GenAIComps
RUN pip install --no-cache-dir --upgrade pip==24.3.1 setuptools==75.3.0 && \
    pip install --no-cache-dir -r /home/user/GenAIComps/requirements.txt

COPY ./app_gateway.py /home/user/app_gateway.py
COPY ./templates/microservices/* /home/user/templates/microservices/
COPY ./megaservice.py /home/user/megaservice.py
COPY config/* /home/user/config/

ENV PYTHONPATH=/home/user/GenAIComps

USER user

WORKDIR /home/user

RUN echo 'ulimit -S -n 999999' >> ~/.bashrc

ENTRYPOINT ["python", "megaservice.py"]