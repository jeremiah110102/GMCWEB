# Church Dedication Certificate Management System

A complete browser-based certificate registry built with HTML5, CSS3, vanilla JavaScript, Firebase Authentication, Firestore, jsPDF, html2canvas, docx.js, and FileSaver.js. No framework or build step is used.

## 1. Firebase setup

1. Open [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Add a Web app from **Project overview > Add app > Web**.
3. Copy the Firebase configuration values into `js/firebase-config.js`. These are the only intended placeholders in the code.
4. Open **Authentication > Sign-in method** and enable **Email/Password**.
5. Open **Firestore Database**, create the database, and choose the region nearest your users.
6. Open **Firestore Database > Rules**, replace the contents with `firestore.rules`, then publish.

## 2. Create the first administrator

1. In **Firebase Console > Authentication > Users**, click **Add user**.
2. Enter the administrator email and a strong password.
3. Copy the new user's UID.
4. In **Firestore Database**, create a collection named `users`.
5. Create a document whose **document ID is exactly the Authentication UID**.
6. Add these fields:

   - `displayName` (string): `System Administrator`
   - `email` (string): the same authentication email
   - `role` (string): `administrator`
   - `createdAt` (timestamp): current date and time
   - `updatedAt` (timestamp): current date and time

After the first administrator signs in, additional role profiles can be created in **Users**. Create each person's Authentication account in Firebase Console first, then paste its UID into the Users module.

## 3. Roles

- **Administrator**: full access to churches, pastors, templates, users, records, deletion, print, and export.
- **Encoder**: create and correct dedication records; view and export certificates.
- **Viewer**: view, search, preview, print, PDF export, and Word export only.

Interface restrictions improve usability; `firestore.rules` is the authoritative data security layer.

## 4. Add sample data

Use `sample-data.json` as a field reference. In Firestore Console, create documents in this order:

1. `churches`
2. `pastors` — replace `CHURCH_DOCUMENT_ID` with the church document ID.
3. `certificateTemplates` — replace the church and pastor IDs.

Firestore Console cannot directly import this JSON file. Add the listed fields manually or use Firebase CLI/import tooling if you already maintain an import workflow.

## 5. Run locally

Firebase Authentication requires the site to be served over HTTP; do not double-click `index.html`.

From the project folder, use either:

```bash
python -m http.server 5500
```

or the VS Code **Live Server** extension. Then open:

```text
http://localhost:5500
```

If Firebase rejects the domain, open **Authentication > Settings > Authorized domains** and add `localhost` and your deployed domain.

## 6. Deploy

The folder can be hosted on Firebase Hosting, GitHub Pages, Netlify, or any static HTTPS web server. For Firebase Hosting:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

Choose this project folder as the public directory and do not configure it as a single-page app because it uses separate HTML pages.

## 7. Important behavior

- The logo is always loaded from `assets/img/logo.png`. It is never uploaded to Firebase.
- All timestamps written by the app use Firestore `serverTimestamp()`.
- Every new dedication saves `createdBy` and `updatedBy`; edits preserve `createdBy` and update `updatedBy`.
- Pastor and template dropdowns are filtered by the selected church.
- PDF export renders the A4 certificate at 3× scale.
- Word export creates a real `.docx` file with the same certificate information and local logo.
- Printing and exports hide navigation and action buttons.
- User deletion in the Users module removes the Firestore profile only. Delete the Authentication account separately in Firebase Console.

## 8. Collections

`users`, `churches`, `pastors`, `certificateTemplates`, and `dedications`.

## Troubleshooting

- **Permission denied**: confirm the signed-in user's UID matches the `users` document ID and the role is lowercase: `administrator`, `encoder`, or `viewer`.
- **Blank counts or records**: confirm the Firestore database and web app use the same Firebase project.
- **Logo missing in Word/PDF**: ensure the file exists at `assets/img/logo.png` and serve the site through HTTP.
- **CDN scripts blocked**: allow access to `gstatic.com`, `cdnjs.cloudflare.com`, and `unpkg.com`, or download those libraries locally and update the script paths.
