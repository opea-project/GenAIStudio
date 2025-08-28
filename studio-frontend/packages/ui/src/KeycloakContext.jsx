import React, { createContext, useContext, useEffect, useState } from 'react';

// Create the Keycloak context
const KeycloakContext = createContext(null);

// Check if Keycloak is disabled via environment variable
const isKeycloakDisabled = import.meta.env.VITE_DISABLE_KEYCLOAK === 'true';
console.log('isKeycloakDisabled: ', isKeycloakDisabled);

// Simple user object for when Keycloak is disabled
const createAdminUser = () => ({
    authenticated: true,
    tokenParsed: {
        email: 'admin@admin.com',
        preferred_username: 'admin',
        name: 'Admin User',
        given_name: 'Admin',
        family_name: 'User',
        resource_access: {
            genaistudio: {
                roles: ['admin']
            }
        }
    },
    logout: () => {
        console.log('Logout called - refreshing page');
        window.location.href = '/';
    }
});

// Provide the Keycloak context to the application
export const KeycloakProvider = ({ children }) => {
    const [keycloak, setKeycloak] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        // If Keycloak is disabled, use simple admin user
        if (isKeycloakDisabled) {
            console.info("Keycloak authentication is disabled. Using admin@admin.com as default user.");
            const adminUser = createAdminUser();
            setKeycloak(adminUser);
            setIsInitialized(true);
            return;
        }

        // Keycloak is enabled - dynamically import and initialize
        import('keycloak-js').then((KeycloakModule) => {
            const Keycloak = KeycloakModule.default;

            if (!window.crypto || !window.crypto.subtle) {
                console.error("Web Crypto API is not available. This may cause security issues.");
            }

            const initOptions = {
                url: '/auth/',
                realm: 'genaistudio',
                clientId: 'genaistudio',
                onLoad: 'login-required',
                responseType: 'code',
                silentCheckSsoRedirectUri: window.location.origin + "/silent-check-sso.html",
                checkLoginIframe: false,
            };

            const kc = new Keycloak(initOptions);

            kc.init({
                onLoad: initOptions.onLoad,
                responseType: 'code',
            }).then((auth) => {
                if (!auth) {
                    window.location.reload();
                } else {
                    console.info("Authenticated with Keycloak");
                    console.log('auth', auth);
                    console.log('Keycloak', kc);

                    kc.onTokenExpired = () => {
                        console.log('token expired');
                    };

                    setKeycloak(kc);
                    setIsInitialized(true);
                }
            }).catch((error) => {
                console.error("Authentication Failed", error);
            });
        });
    }, []);

    if (!isInitialized) {
        return <div>Loading...</div>; // Show a loading state until Keycloak is initialized
    }

    return (
        <KeycloakContext.Provider value={keycloak}>
            {children}
        </KeycloakContext.Provider>
    );
};

// Custom hook to use Keycloak context
export const useKeycloak = () => {
    const context = useContext(KeycloakContext);
    if (!context) {
        throw new Error('useKeycloak must be used within a KeycloakProvider');
    }
    return context;
};

export default KeycloakProvider;