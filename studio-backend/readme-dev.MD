## Development Instructions
To start the server locally, run the following command:
```sh
uvicorn app.main:app --host 0.0.0.0 --port 5000
```

To test the server using curl, run the following command:
```sh
curl http://localhost:5000/health
```

Example commands to run tests using pytest:
```sh
python3 -m pytest
python3 -m pytest -s tests/manifest-exporter/test_manifest-exporter.py
python3 -m pytest -s tests/manifest-exporter/test_manifest-exporter.py::test_convert_chatqna_proj_info_to_manifest_obj
```