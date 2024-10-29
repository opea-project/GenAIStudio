const config = {
    // basename: only at build time to set, and Don't add '/' at end off BASENAME for breadcrumbs, also Don't put only '/' use blank('') instead,
    basename: '',
    defaultPath: '/opeaflows',
    fontFamily: `'Roboto', sans-serif`,
    borderRadius: 12,
    studio_server_url: import.meta.env.VITE_STUDIO_SERVER_URL || '',
    sandbox_status_endpoint: import.meta.env.VITE_SANDBOX_STATUS_ENDPOINT || 'studio-backend/ws/sandbox-status',
}

export default config
