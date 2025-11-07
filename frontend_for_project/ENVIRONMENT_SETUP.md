# Frontend Environment Setup

## Environment Variables

Create a `.env.local` file in the `forntend_for_project` directory with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Backend API URL
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Google AI API Key (for AI features)
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
```

## How to Get Credentials

### Supabase
1. Go to [supabase.com](https://supabase.com)
2. Select your project
3. Go to Settings > API
4. Copy:
   - Project URL (for NEXT_PUBLIC_SUPABASE_URL)
   - anon key (for NEXT_PUBLIC_SUPABASE_ANON_KEY)

### Google AI API Key
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. Copy the key for GOOGLE_AI_API_KEY

## Running the Application

1. Install dependencies: `npm install`
2. Set up environment variables (see above)
3. Start development server: `npm run dev`
4. Open [http://localhost:9002](http://localhost:9002)
