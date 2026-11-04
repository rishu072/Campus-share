# CampusShare

A trust-first resource sharing platform that helps institutions safely share underused labs, equipment and spaces.

## Features
- Resource listings with rules, location and eligibility requirements
- "Am I eligible?" check against verified credentials
- Booking requests with overlap conflict prevention
- Fair usage: weekly hour cap with auto-waitlist and a clear reason
- Owner approve / reject / waitlist with a required reason
- Check-in and return with before/after condition reports
- Damage disputes resolved by the owner
- Append-only audit timeline for every booking
- Role-based access (user, owner) enforced with Postgres Row-Level Security

## Tech Stack
Next.js 14, Supabase (Auth, Postgres, RLS), plain JavaScript

## Core Design
All booking rules live in two Postgres functions (`request_booking`, `transition_booking`), so every action is validated, role-checked and logged in one place.