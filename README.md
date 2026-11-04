# CampusShare

Next.js + Supabase resource sharing with eligibility, approval, check-in/return, damage disputes and an audit timeline.

## Run
1. Create a project at supabase.com.
2. Auth > Providers > Email: turn off "Confirm email".
3. SQL Editor: paste and run supabase/schema.sql.
4. cp .env.example .env.local and fill in the Project URL and anon key (Project Settings > API).
5. npm install
6. npm run dev, open http://localhost:3000

## Demo journey
1. Sign up as Owner (A). List "3D Printer" with requirement "Safety training".
2. Sign up as User (B) in a private window. Open the printer: eligibility shows MISSING. Click Request verification.
3. Owner A: Bookings > Credentials > Verify.
4. User B: request a slot. Owner A approves with a reason.
5. User B checks in with notes, then returns with Damage ticked.
6. Owner A resolves with a reason.
7. Open "View history" on the booking.
Conflict: request an overlapping slot after approval. Fair usage: request more hours than the weekly cap and it is auto-waitlisted with the reason.
