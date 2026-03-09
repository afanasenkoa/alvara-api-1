// /api/booking-windows.js
// Vercel Serverless Function - Proxy for HCP Booking Windows API
//
// Deploy: 
// 1. Create new Vercel project
// 2. Add this file as /api/booking-windows.js
// 3. Add environment variable: HCP_API_KEY = c42eebcb1df54c6b92dd328011473f72
// 4. Deploy
//
// Usage: GET https://your-project.vercel.app/api/booking-windows

export default async function handler(req, res) {
  // CORS headers for GitHub Pages
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const HCP_API_KEY = process.env.HCP_API_KEY;
  
  if (!HCP_API_KEY) {
    console.error('HCP_API_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const params = new URLSearchParams({
    service_duration: '180',  // 3 hours
    show_for_days: '7'
  });

  const url = `https://api.housecallpro.com/company/schedule_availability/booking_windows?${params}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': HCP_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HCP API error:', response.status, errorText);
      return res.status(502).json({ 
        success: false, 
        error: `HCP API returned ${response.status}` 
      });
    }

    const data = await response.json();

    // Filter only available slots and format for display
    const availableSlots = (data.booking_windows || [])
      .filter(slot => slot.available === true)
      .map(slot => ({
        start_time: slot.start_time,
        end_time: slot.end_time,
        // Format for display (Detroit timezone)
        display_date: new Date(slot.start_time).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          timeZone: 'America/Detroit'
        }),
        display_time: new Date(slot.start_time).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Detroit'
        }),
        // Date key for grouping (YYYY-MM-DD)
        date_key: new Date(slot.start_time).toLocaleDateString('en-CA', {
          timeZone: 'America/Detroit'
        })
      }));

    // Group by date for easier frontend rendering
    const groupedByDate = {};
    availableSlots.forEach(slot => {
      if (!groupedByDate[slot.date_key]) {
        groupedByDate[slot.date_key] = {
          display_date: slot.display_date,
          slots: []
        };
      }
      groupedByDate[slot.date_key].slots.push({
        start_time: slot.start_time,
        end_time: slot.end_time,
        display_time: slot.display_time
      });
    });

    return res.status(200).json({
      success: true,
      available_count: availableSlots.length,
      days: Object.values(groupedByDate)
    });

  } catch (error) {
    console.error('Fetch error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch availability' 
    });
  }
}
