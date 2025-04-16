# Copyright (C) 2024 Intel Corporation
 # SPDX-License-Identifier: Apache-2.0
 
import os
import requests


def search_knowledge_base(query: str) -> str:
    """Search a knowledge base about music and singers for a given query.

    Returns text related to the query.
    """
    url = os.environ.get("WORKER_AGENT_URL")
    print(url)
    proxies = {"http": ""}
    payload = {
        "messages": query,
    }
    response = requests.post(url, json=payload, proxies=proxies)
    return response.json()["text"]


def search_sql_database(query: str) -> str:
    """Search a SQL database on artists and their music with a natural language query.

    Returns text related to the query.
    """
    url = os.environ.get("SQL_AGENT_URL")
    print(url)
    proxies = {"http": ""}
    payload = {
        "messages": query,
    }
    response = requests.post(url, json=payload, proxies=proxies)
    return response.json()["text"]