import { useSelector } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, StyledEngineProvider } from '@mui/material';
import Routes from '@/routes';
import themes from '@/themes';
import NavigationScroll from '@/layout/NavigationScroll';
import KeycloakProvider from './KeycloakContext'; // Import the updated KeycloakProvider

const App = () => {
    const customization = useSelector((state) => state.customization);

    return (
        <StyledEngineProvider injectFirst>
            <KeycloakProvider>
                <ThemeProvider theme={themes(customization)}>
                    <CssBaseline />
                    <NavigationScroll>
                        <Routes />
                    </NavigationScroll>
                </ThemeProvider>
            </KeycloakProvider>
        </StyledEngineProvider>
    );
};

export default App;
