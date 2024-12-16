# Adding themes to keycloak

When running the keycloak container, please mount `providers` folder to `/opt/keycloak/providers`.

`opea` login theme will then be available under admin panel login theme.

the `realm-export.json` will automatically configured the client with the login theme.