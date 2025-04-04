FROM python:3.11-slim

RUN apt-get update -y && apt-get install -y --no-install-recommends --fix-missing \
    libsqlite3-0=3.40.1-2+deb12u1 \
    libgl1-mesa-glx=22.3.6-1+deb12u1 \
    libjemalloc-dev=5.3.0-1 \
    git && \
    rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash user && \
    mkdir -p /home/user && \
    chown -R user /home/user/

WORKDIR /home/user/
RUN git clone --depth 1 https://github.com/opea-project/GenAIComps.git

WORKDIR /home/user/GenAIComps
RUN pip install --no-cache-dir --upgrade pip==24.3.1 setuptools==75.3.0 && \
    pip install --no-cache-dir -r /home/user/GenAIComps/requirements.txt

COPY ./templates/microservices/* /home/user/templates/microservices/
COPY ./megaservice.py /home/user/megaservice.py
COPY ./orchestrator.py /home/user/GenAIComps/comps/cores/mega/orchestrator.py
COPY config/* /home/user/config/

ENV PYTHONPATH=/home/user/GenAIComps
ENV TELEMETRY_ENDPOINT="http://my-otel-collector-opentelemetry-collector.opentelemetry.svc.cluster.local:4318/v1/traces"
# ENV embedding_tei_langchain_0_port=9007 \
#     llm_tgi_0_port=9008 \
#     prepare_doc_redis_prep_0_port=9009 \
#     reranking_tei_0_port=9010 \
#     retriever_redis_0_port=9011

USER user

WORKDIR /home/user

RUN echo 'ulimit -S -n 999999' >> ~/.bashrc

ENTRYPOINT ["python", "megaservice.py"]
