# Felicity Event Management System

## Overview
 It supports user registration, event creation, ticketing, real-time communication, and attendance tracking via QR codes. The system is built with a focus on role-based access control (Student, Organizer, Admin) and provides a seamless experience for both event organizers and participants.

## Tech Stack & Justification

### Backend
The backend is built using   Node.js   with the   Express   framework.
->   Express  : Chosen for its minimal and flexible structure, allowing for rapid API development and easy middleware integration.
->   MongoDB & Mongoose  : Used as the database solution. Events and registrations often have varying structures; a NoSQL database provides the flexibility needed for evolving data models. Mongoose simplifies schema validation and data relationships.
->   Authentication (JWT & bcryptjs)  : JSON Web Tokens (JWT) provide stateless authentication, essential for scaling. `bcryptjs` ensures secure password hashing.
->   Socket.io  : Implemented to enable real-time features. This was necessary to support the live discussion forums for each event without requiring page refreshes.
->   Nodemailer  : Integrated for sending transactional emails (reset passwords, registration confirmations).
->   Multer  : Handles file uploads, specifically for event banners and proof-of-payment screenshots.
->   QR Code Tools (`qrcode`, `jimp`, `qrcode-reader`) :  A suite of libraries selected to generate unique tickets on the server and process Scanned code images for attendance verification.

### Frontend
The frontend is a Single Page Application (SPA) built with   React  .
->   React  : Selected for its component-based architecture, making the UI modular and reusable (e.g., standardizing the Navbar or Event Cards).
->   React Router DOM  : Manages client-side routing, ensuring a smooth navigation experience without full page reloads.
->   Axios  : preferred over the native Fetch API for its automatic JSON transformation and better error handling capabilities.
->   Socket.io Client  : Connects to the backend websocket server for real-time updates in event chat rooms.
->   jsQR  : A pure JavaScript library used to implement the in-browser QR code scanner for attendance taking, removing the need for external hardware.

## Key Features & Implementation

### 1. Role-Based Access Control (RBAC) & Authentication
I implemented a strict middleware-based permission system with distinct functionalities for each role.
->   Domain-Specific Logic  : The system validates email domains  to classify users as Student (Single Degree), Research Student (Dual Degree), or Professor. Non-IIIT domains are classified as external participants.
->   Secure Auth Flow  : Uses BCrypt for password hashing and JWT for session management.
->   Implementation  : Middleware functions like `authMiddleware.js` intercept requests to verify the JWT payload and Role before granting access to sensitive routes (e.g., only Admin can create organizers).

### 2. Comprehensive Event Management
->   Creation Wizard  : Organizers can create events with detailed metadata including dates, descriptions, and custom form fields.
->   Discord Integration  : When a new event is published, the backend automatically sends a notification to a configured Discord channel via Webhooks, keeping the community updated instantly.
->   Merchandise & Stock Management  : Supports events of type 'Merchandise', capable of tracking stock levels and handling purchase requests.

### 3. QR Code Attendance System (Tier B/C Feature)
Automating attendance was a key requirement to replace manual lists.
->   Unique Ticket Generation  : Upon registration, a QR code acts as a digital ticket.
->   Built-in Scanner  : Organizers use the in-app scanner (built with `jsQR`) to verify attendees at the venue.
->   Audit Logging  : Every scan is recorded in an immutable `AttendanceAudit` log. This tracks  who  scanned the ticket,  when , and the  result  (success/failure), resolving any potential disputes.

### 4. Real-Time Event Discussion Forum (Tier B Feature)
To faster community interaction, every event features a live chat room.
->   WebSocket Architecture  : `Socket.io` enables bidirectional communication. Messages are pushed instantly to all connected clients in the specific event room.
->   Persistence  : Chat history is stored in MongoDB, ensuring users can see previous discussions when they join later.

### 5. Onboarding & Preferences
->   Personalization  : New users go through an onboarding flow to select interests (e.g., Technology, Music) and follow specific clubs.
->   Smart Dashboard  : The dashboard filters events based on these user preferences, highlighting relevant activities.

### 6. Admin & Organizer Dashboards
->   Admin Powers  : Admins can manage the organizer , creating accounts with auto-generated credentials if needed.
->   Organizer Tools  : Dedicated views to track registration numbers, manage event status (Draft/Published), and approve merchandise payments.
->   Payment Verification  : For paid events/merch, users upload payment screenshots which organizers can review and approve manually.

### 7. Email & Notification Verification

7.1 Ethereal Email (Testing Emails)
This project is configured to use   Ethereal Email   (a fake SMTP service) for testing transactional emails to avoid spamming real inboxes.

  -> To verify email functionality (Forgot Password, Registration Confirmation):
1.  Trigger an action (e.g., Click "Forgot Password" on the login screen or Register for an event).
2.  In the backend terminal/logs (or Render dashboard logs), look for a console output or simply check the functionality.
3.  For Evaluators: Since you don't have access to my specific Ethereal dashboard account, you can see the configuration in the code (`backend/controllers/authController.js`).
4.  If you run the project locally, you can create your own account at [ethereal.email](https://ethereal.email), update the credentials in `.env`, and you will see a "Preview URL" logged in the console for every email sent.

 7.2 Discord Webhooks (Event Alerts)
The system sends automatic notifications to a Discord channel whenever a new event is published.

To verify this feature:
1.  Create a Discord server (or use an existing one).
2.  Go to Server Settings -> Integrations -> Webhooks -> New Webhook.
3.  Copy the Webhook URL.
4.  Log in as an Organizer (or use the Admin dashboard to create one).
5.  Go to Profile or during Event Creation, you may see an option to provide a Webhook URL (or it falls back to the system default if configured).
6.  Publish a new event.
7.  Check your Discord channel; you should receive a message instantly with the event details.

## Technical Decisions & Trade-offs

->   Stateless Auth  : I chose JWT over sessions to avoid server-side state management, which simplifies deployment and allows the backend to be restarted without logging everyone out.
->   Image Storage  : For this local implementation, images are stored on the local filesystem (`uploads/` folder). In a production environment, this would be abstracted to cloud storage (like AWS S3), but local storage was sufficient for the assignment and reduced external dependencies.
->   Domain Validation  : Hardcoded regex patterns for IIITH domains ensure strict categorization of internal vs external users, a crucial requirement for university event policies.


## Installation & Setup Instructions

### Prerequisites
-> Node.js (v14 or higher) installed.
-> MongoDB installed and running locally on port 27017.

### 1. Backend Setup
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.    Environment Variables  : The project uses `dotenv`. Create a `.env` file in the `backend` folder or ensure the defaults in `index.js` are sufficient. Typical variables needed:
    -> `PORT=5000`
    -> `MONGO_URI=mongodb://127.0.0.1:27017/felicity`
    -> `JWT_SECRET=your_secret_key`
    -> `EMAIL_USER` / `EMAIL_PASS` (if testing email features)
    -> `DISCORD_WEBHOOK_URL` (for notifications)
4.  Start the server:
    ```bash
    npm start
    ```
    -> To populate dummy data , check the `scripts/` folder.

### 2. Frontend Setup
1.  Open a new terminal and navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the React development server:
    ```bash
    npm start
    ```
4.  The application will launch automatically at `http://localhost:3000`.

### 3. Usage
->   Admin Access  : You need to use the email id which already in the database that has role as admin.
->   Scanning  : Ensure your device has camera permissions enabled to use the QR scanner.

## Deployment Configuration

The application is deployed and hosted on the following platforms:

### 12.1 Hosting Requirements
->   Frontend  : Deployed to Vercel. 
     Production URL  : `https://felicity-event-management-frontend.vercel.app`
->   Backend  : Deployed to Render. 
     Base API URL  : `https://felicity-event-management-backend.onrender.com`
->   Database  : Hosted on MongoDB Atlas. Connection strings are managed via secure environment variables in the hosting provider's dashboard.

### Deployment Guides (For Reproducibility)

#### Frontend Deployment (Vercel)
1.  Push the `frontend` folder to a GitHub repository.
2.  Import the project into Vercel.
3.  Set the   Build Command   to `npm run build`.
4.  Set the   Output Directory   to `build`.
5.   Crucial Step : Since `api.js` points to `localhost` by default, update the `baseURL` in `src/api.js` to point to the production backend URL before deploying, or use `process.env.REACT_APP_API_URL` and set that environment variable in Vercel.

#### Backend Deployment (Render)
1.  Push the `backend` folder to a GitHub repository.
2.  Create a "Web Service" on Render.
3.  Set the   Build Command   to `npm install`.
4.  Set the   Start Command   to `npm start`.
5.    Environment Variables  : Add the following secrets in the Render dashboard:
    -> `MONGO_URI`: Your production MongoDB Atlas connection string.
    -> `JWT_SECRET`: A strong, random string.
    -> `NODE_ENV`: Set to `production`.
6.    Persistent Storage  : Note that since this project uses local filesystem storage (`uploads/`) for images, uploaded files on Render (free tier) will disappear after re-deploys. For a permanent solution, you would need to refactor `uploadRoutes.js` to use a cloud service like AWS S3 or Cloudinary.
