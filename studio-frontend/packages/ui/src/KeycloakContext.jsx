import React, { createContext, useContext, useEffect, useState } from 'react';
import Keycloak from 'keycloak-js';

// Create the Keycloak context
const KeycloakContext = createContext(null);

// Provide the Keycloak context to the application
export const KeycloakProvider = ({ children }) => {
    const [keycloak, setKeycloak] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const initOptions = {
            url: 'http://localhost:8090/',
            realm: 'genaistudio',
            clientId: 'genaistudio',
            onLoad: 'login-required', // check-sso | login-required
            KeycloakResponseType: 'code',
            silentCheckSsoRedirectUri: window.location.origin + "/silent-check-sso.html",
            checkLoginIframe: false,
        };

        const kc = new Keycloak(initOptions);

        kc.init({
            onLoad: initOptions.onLoad,
            KeycloakResponseType: 'code',
        }).then((auth) => {
            if (!auth) {
                window.location.reload();
            } else {
                console.info("Authenticated");
                console.log('auth', auth);
                console.log('Keycloak', kc);

                kc.onTokenExpired = () => {
                    console.log('token expired');
                };

                setKeycloak(kc); // Set the Keycloak instance in state
                setIsInitialized(true); // Mark initialization as complete
            }
        }).catch(() => {
            console.error("Authentication Failed");
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
