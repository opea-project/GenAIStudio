## Quick Start

Follow these steps to docker compose the application:

1. Set the public_host_ip environment variables in .env or export it in your environtment:

   ```bash
   # Note: public_host_ip is an external public IP
   # ./.env
   public_host_ip=192.168.1.1
   ```

2. If you are in a proxy environment, append the .env with or export the proxy-related environment variables:

   ```bash
   # ./.env
   public_host_ip=192.168.1.1
   http_proxy="Your_HTTP_Proxy"
   https_proxy="Your_HTTPS_Proxy"
   no_proxy="Your_No_Proxy,app-nginx,app-frontend,app-backend,...Other_Compose_Services"
   ```

3. Run Docker Compose

    ```bash
    docker compose -f compose.yaml up -d
    ```

4. Open application in browser with 

    ```bash
    http://<public_host_ip>:8090
    ```