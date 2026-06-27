const isDemoMode = window.location.hostname.includes("github.io") || window.location.hostname.includes("vercel.app") || import.meta.env.MODE === "production";

if (isDemoMode) {
  console.log("Installing mock fetch for DEMO MODE");
  const originalFetch = window.fetch;

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    
    // Only intercept API calls
    if (url.includes('/api/')) {
      console.log(`[Demo API Intercept] ${init?.method || 'GET'} ${url}`);
      
      // Simulate network delay
      await new Promise(r => setTimeout(r, 200));

      const mockResponse = (body, status = 200) => {
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' }
        });
      };

      if (url.includes('/api/pest-risk')) {
        return mockResponse({
          zones: [
            { id: 1, pestType: 'whitefly', riskLevel: 'HIGH', area: 'Sector A' },
            { id: 2, pestType: 'aphid', riskLevel: 'MEDIUM', area: 'Sector B' }
          ]
        });
      }

      if (url.includes('/api/sensors/health')) {
        return mockResponse([
          { id: 'node-1', status: 'online', battery: 95 },
          { id: 'node-2', status: 'online', battery: 88 },
          { id: 'node-3', status: 'offline', battery: 10 }
        ]);
      }

      if (url.includes('/api/reports')) {
        return mockResponse([
          { id: 'rep-1', date: '2026-06-25', summary: 'High whitefly activity detected in North sector.', severity: 'high' },
          { id: 'rep-2', date: '2026-06-20', summary: 'Normal operation. Minor aphid presence.', severity: 'low' }
        ]);
      }

      if (url.includes('/api/irrigation/pump')) {
        return mockResponse({ status: 'OFF' });
      }

      if (url.includes('/api/irrigation/schedules')) {
        return mockResponse([
          { id: 1, time: '06:00', durationMinutes: 30, active: true },
          { id: 2, time: '18:00', durationMinutes: 20, active: false }
        ]);
      }

      // Default empty success for other API endpoints
      return mockResponse({ success: true, message: 'Demo operation successful.' });
    }

    // Fallback to original fetch for non-API requests (e.g. assets)
    return originalFetch(input, init);
  };
}
