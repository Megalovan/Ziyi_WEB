/* Edit this file to configure hosting and optional analytics. No secrets belong here. */
window.SITE_CONFIG = {
  name: 'Ziyi Xu',
  // Local portrait displayed beside the name.
  portrait: 'portrait-current.png',
  email: 'ziyi@link.cuhk.edu.hk',
  scholar: 'https://scholar.google.com/citations?user=KofM2AMAAAAJ&hl=en',
  linkedin: 'https://www.linkedin.com/in/ziyi-xu-7628b2290/',
  updated: '2026-10-23',
  // Set to the final homepage URL to add a canonical link and social-sharing URL.
  canonicalUrl: 'https://megalovan.github.io/Ziyi_WEB/',
  analytics: {
    // Busuanzi provides real host-level PV / UV after publication, without an account.
    // Disable it if you choose to use only your own analytics endpoint below.
    busuanzi: true,
    // Optional Cloudflare Worker supplied in analytics/. Example: https://stats.example.workers.dev
    // This supplies a shared country/region map and replaces Busuanzi counts.
    endpoint: '',
    // Enables aggregate section time / scroll / paper-click metrics only when endpoint is set.
    // Deploy the updated analytics/ Worker first. Reports at analytics.html require ADMIN_TOKEN.
    engagement: true,
    // The visitor must click before the third-party IP geolocation service is contacted.
    locationEndpoint: 'https://ipwho.is/?fields=success,country,country_code,region,city,latitude,longitude',
  },
};
