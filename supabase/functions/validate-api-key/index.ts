const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationResult {
  key: string;
  isValid: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey } = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ isValid: false, error: 'No API key provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test the API key with a simple channels.list request
    const testChannelId = 'UC_x5XG1OV2P6uZZ5FSM9Ttw'; // Google Developers channel
    const url = `https://www.googleapis.com/youtube/v3/channels?part=id&id=${testChannelId}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (response.ok && data.items) {
      return new Response(
        JSON.stringify({ isValid: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle specific error types
    let errorMessage = 'Invalid API key';
    if (data.error) {
      if (data.error.code === 403) {
        if (data.error.message?.includes('quota')) {
          errorMessage = 'Quota exceeded';
        } else {
          errorMessage = 'API key forbidden or disabled';
        }
      } else if (data.error.code === 400) {
        errorMessage = 'Bad request - invalid API key format';
      } else if (data.error.code === 401) {
        errorMessage = 'Unauthorized - invalid credentials';
      } else {
        errorMessage = data.error.message || 'Unknown error';
      }
    }

    return new Response(
      JSON.stringify({ isValid: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error validating API key:', error);
    return new Response(
      JSON.stringify({ isValid: false, error: 'Validation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
