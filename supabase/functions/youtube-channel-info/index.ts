const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChannelResponse {
  channelId: string;
  title: string;
  description: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  publishedAt: string;
  country: string;
  thumbnailUrl: string;
  isVerified: boolean;
  verifiedType: 'none' | 'verified' | 'artist';
  email: string | null;
  error?: string;
}

async function getChannelIdFromIdentifier(
  identifier: string,
  type: 'id' | 'handle' | 'custom' | 'user',
  apiKey: string
): Promise<string | null> {
  if (type === 'id') {
    return identifier;
  }

  let url: string;
  
  if (type === 'handle') {
    url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=@${identifier}&key=${apiKey}`;
  } else if (type === 'user') {
    url = `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${identifier}&key=${apiKey}`;
  } else {
    // Custom URL - try forHandle first, then search
    url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=@${identifier}&key=${apiKey}`;
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      return data.items[0].id;
    }

    // If custom URL and forHandle didn't work, try search
    if (type === 'custom') {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id&q=${encodeURIComponent(identifier)}&type=channel&maxResults=1&key=${apiKey}`;
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();
      
      if (searchData.items && searchData.items.length > 0) {
        return searchData.items[0].id.channelId;
      }
    }

    return null;
  } catch (error) {
    console.error('Error resolving channel identifier:', error);
    return null;
  }
}

async function getChannelData(channelId: string, apiKey: string): Promise<any> {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${apiKey}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message || 'YouTube API error');
  }
  
  if (!data.items || data.items.length === 0) {
    throw new Error('Channel not found');
  }
  
  return data.items[0];
}

async function getVerificationAndEmail(channelId: string): Promise<{ isVerified: boolean; verifiedType: 'none' | 'verified' | 'artist'; email: string | null }> {
  const aboutUrl = `https://www.youtube.com/channel/${channelId}/about`;
  
  try {
    const response = await fetch(aboutUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    
    const html = await response.text();
    
    // Check for verification badge
    let isVerified = false;
    let verifiedType: 'none' | 'verified' | 'artist' = 'none';
    
    if (html.includes('BADGE_STYLE_TYPE_VERIFIED_ARTIST')) {
      isVerified = true;
      verifiedType = 'artist';
    } else if (html.includes('BADGE_STYLE_TYPE_VERIFIED')) {
      isVerified = true;
      verifiedType = 'verified';
    }
    
    // Extract email from about page
    let email: string | null = null;
    
    // Try to find email in the HTML
    const emailPatterns = [
      /"businessEmail":"([^"]+@[^"]+)"/,
      /mailto:([^"'\s]+@[^"'\s]+)/,
      /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/,
    ];
    
    for (const pattern of emailPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        // Validate it looks like a real email
        const potentialEmail = match[1];
        if (potentialEmail.includes('@') && 
            !potentialEmail.includes('youtube.com') && 
            !potentialEmail.includes('google.com') &&
            potentialEmail.length < 100) {
          email = potentialEmail;
          break;
        }
      }
    }
    
    return { isVerified, verifiedType, email };
  } catch (error) {
    console.error('Error fetching verification/email:', error);
    return { isVerified: false, verifiedType: 'none', email: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channelIdentifier, identifierType, apiKey } = await req.json();

    if (!channelIdentifier || !identifierType || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve channel ID
    const channelId = await getChannelIdFromIdentifier(channelIdentifier, identifierType, apiKey);
    
    if (!channelId) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve channel ID' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get channel data from YouTube API
    const channelData = await getChannelData(channelId, apiKey);
    
    // Get verification status and email from HTML
    const { isVerified, verifiedType, email } = await getVerificationAndEmail(channelId);

    const response: ChannelResponse = {
      channelId,
      title: channelData.snippet?.title || '',
      description: channelData.snippet?.description || '',
      subscriberCount: parseInt(channelData.statistics?.subscriberCount || '0', 10),
      videoCount: parseInt(channelData.statistics?.videoCount || '0', 10),
      viewCount: parseInt(channelData.statistics?.viewCount || '0', 10),
      publishedAt: channelData.snippet?.publishedAt || '',
      country: channelData.snippet?.country || '',
      thumbnailUrl: channelData.snippet?.thumbnails?.medium?.url || channelData.snippet?.thumbnails?.default?.url || '',
      isVerified,
      verifiedType,
      email,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing channel:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
