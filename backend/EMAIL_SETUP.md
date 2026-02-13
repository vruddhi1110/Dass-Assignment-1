Email (credential delivery) setup

The backend can send credential emails to newly-created participants when an Organizer adds them. This uses nodemailer and is optional.

Environment variables (add to your backend `.env`):

- EMAIL_USER - SMTP username (required to enable sending)
- EMAIL_PASS - SMTP password (required to enable sending)
- EMAIL_HOST - optional SMTP host (default: smtp.gmail.com)
- EMAIL_PORT - optional SMTP port (default: 587)
- EMAIL_FROM - optional From header (defaults to EMAIL_USER)

Notes:
- For Gmail accounts you must use an App Password (recommended) or OAuth; plain account passwords are often blocked by Google.
- If EMAIL_USER/EMAIL_PASS are not set the server will still work but will not send emails.

Testing:

- Start the backend (from `backend/`): set env vars and run `npm run dev`.
- Use the Organizer "Add Participant" form in the frontend or POST to `/api/events/:id/add-participant` with a JSON body containing participant details (firstName, lastName, email, contactNumber, collegeName, formResponses, merchandiseSelection).
- If a new user is created the backend will email the generated password to the provided email. If the user already exists, no password email will be sent.

Security recommendation: For production, prefer sending a one-time password reset link instead of emailing plaintext passwords. Store SMTP credentials securely and avoid committing them to source control.
