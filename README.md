# FitSync Web

FitSync Web is a holistic health and fitness platform that combines wearable tracking, personalized workout regimens, dynamic meal planning, and sleep analysis into one unified dashboard.

## Features

- User authentication with username/password and Google login
- Dashboard with activity metrics
- Responsive design with clean, modern UI
- Integrated wellness tracking

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- NextAuth.js
- shadcn/ui components
- React Icons

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory with the following environment variables:
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

For local development, you can generate a secret with:
```bash
openssl rand -base64 32
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Environment Variables

- `NEXTAUTH_URL`: The URL of your application
- `NEXTAUTH_SECRET`: Secret used for encrypting JWTs
- `GOOGLE_CLIENT_ID`: Google OAuth client ID (optional for now, as we have mock credentials)
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

For local testing, you can use the demo credentials:
- Username: `demo`
- Password: `password`

## Project Structure

```
app/                    # Next.js 14 App Router pages
├── api/auth/[...nextauth]/route.js  # NextAuth configuration
├── login/page.js       # Login page
├── dashboard/page.js   # Dashboard page
components/            # Reusable UI components
├── ui/               # shadcn/ui components
providers/             # React context providers
lib/                  # Utility functions
```

## Roadmap

- Integrate with wearable device APIs (Google Fit, Apple Health, etc.)
- Implement workout and meal planning features
- Add progress tracking and visualization
- Introduce AI-powered wellness recommendations