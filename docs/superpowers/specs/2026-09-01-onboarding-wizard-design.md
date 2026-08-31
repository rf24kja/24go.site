# Onboarding Wizard Design — 24GO

## Overview
Full-screen modal overlay showing 3 sequential screens after first registration.

## Component: `OnboardingWizard.tsx`
- Client component, mounted in `providers.tsx`
- Gated by `localStorage.onboarding_complete`
- 3 screens with progress dots, Skip/Next buttons
- CSS transitions between screens

## Screens
1. Welcome — emoji, heading, description, Get Started button
2. Connect Telegram — emoji, description, 3-step flow diagram, Connect Account → /accounts
3. Ready — emoji, checklist preview (account status from API), Go to Dashboard → /targets

## Files
- Create: `src/components/OnboardingWizard.tsx`
- Edit: `src/app/providers.tsx`
- Edit: `src/lib/en.json` (16 wizard.* keys)
- Edit: `src/lib/ru.json` (16 wizard.* keys)
