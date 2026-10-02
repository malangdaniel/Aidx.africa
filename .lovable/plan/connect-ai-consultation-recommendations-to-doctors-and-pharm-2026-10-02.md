# Connect AI consultation recommendations to doctors and pharmacies

## Goal
Let patients act on AI consultation recommendations from both the completed assessment and recent conversation history: search pharmacies for a suggested medication or open doctors filtered to the suggested specialty.

## Work
1. Add medication and practitioner actions to the completed assessment. Medication actions open Pharmacy with that drug name filled in and searched; practitioner actions open Doctors filtered to the recommended specialty.
2. Save each structured assessment with its conversation session ID so recommendations can be retrieved for the matching history item. Add the schema change and update the Supabase types.
3. Load saved recommendations in Recent Conversations and show medication and practitioner action buttons for sessions with a linked assessment. Keep conversation opening and deletion working as before.
4. Verify navigation, prefilled/searching pharmacy results, specialty filtering, and recommendation loading for saved conversations.

## Technical details
- Reuse the existing PatientDashboard tab navigation, MedicationMarketplace search, DoctorSearch specialty filter, and `ai_diagnoses.diagnosis_data` assessment payload.
- Add a nullable session ID to diagnosis records; existing history without a linked structured assessment will continue to open normally but cannot show recommendation actions. New completed assessments will be linked accurately.
