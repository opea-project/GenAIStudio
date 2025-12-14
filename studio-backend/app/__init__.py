from app.compat import ensure_urllib3_getheaders

# Ensure urllib3 2.x exposes HTTPResponse.getheaders for kubernetes client compatibility.
ensure_urllib3_getheaders()
