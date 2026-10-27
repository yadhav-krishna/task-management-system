# Taskflow — Full-Stack Task Management System

Taskflow is a small educational task manager for the MDI3001 Advanced Web Technologies project. It keeps the existing HTML/CSS/vanilla JavaScript dashboard and connects it to an Express REST API backed by MongoDB. The browser never saves a second copy of the task collection: MongoDB is the source of truth.

> This is a local educational prototype. It has no authentication, user accounts, authorization, rate limiting, or production deployment hardening. Do not expose it publicly or store sensitive data.

## Features

- Dashboard counts for total, pending, in-progress, completed, overdue, and completion percentage, calculated from records fetched from MongoDB.
- Existing overview, all-task, pending, in-progress, completed, and category views.
- Create, edit, delete, and change status; successful UI changes happen only after an API response.
- Search title/description; combined status, priority, and category filters; sorting by due date, priority, and creation time.
- Responsive layout, modal validation, keyboard support, loading and API error states, retry control, confirmation dialogs, and toasts.
- Optional repeatable demo seeding that only inserts or refreshes records identified by fixed demo keys. It does not delete user-created tasks.
- Optional jQuery character counter for the description. Task functionality remains vanilla JavaScript and continues if the jQuery CDN cannot load.

## Technologies and why they are used

- **HTML5 and CSS3:** semantic page structure and the preserved responsive Taskflow design.
- **Vanilla JavaScript:** task interface logic, validation, accessible interactions, search/filter/sort, and Fetch API requests.
- **jQuery:** one optional live description character counter, kept separate from task logic.
- **Fetch API and JSON:** asynchronous browser-to-server communication without reloading the page.
- **Node.js:** JavaScript runtime used to run the backend.
- **Express.js:** HTTP server, static frontend hosting, JSON parsing, and REST routes.
- **MongoDB:** persistent document database.
- **Mongoose:** schema, validation, and database queries for MongoDB.
- **dotenv:** reads local settings from `.env`; `.env` is excluded from Git.
- **Nodemon:** optional development restart on file changes.

The optional jQuery counter loads from the official jQuery CDN and therefore needs internet access. If unavailable, only that counter is absent; the task application does not depend on it.

## Architecture and project structure

```text
task-management-system/
├── index.html                 # Existing Taskflow interface
├── css/style.css              # Existing responsive styling plus small counter styling
├── js/app.js                  # Vanilla UI, validation, filtering, and Fetch calls
├── server.js                  # Express setup, static hosting, and startup
├── package.json               # Dependencies and npm scripts
├── .env.example               # Safe configuration template
├── .gitignore                 # Excludes secrets and generated dependencies
├── config/db.js               # MongoDB connection
├── models/Task.js             # Mongoose task schema
├── routes/taskRoutes.js       # HTTP endpoint mapping
├── controllers/taskController.js # Validation and database operations
├── middleware/errorHandler.js # Central JSON error responses
├── scripts/seedDemo.js        # Optional safe demo seeding command
├── scripts/apiSmokeTest.js   # Creates and cleans up one temporary API test task
└── test/validation.test.js    # Database-independent validation tests
```

This is an **MVC-style separation** adapted to a vanilla JavaScript frontend and Express backend: the Task model describes database records, controller functions handle work, routes map URLs to controllers, and the existing frontend is the view. The folders support separation; they do not by themselves make this a strict textbook MVC architecture.

## Windows setup

### 1. Install prerequisites

Install a current Node.js LTS release from [nodejs.org](https://nodejs.org/) (npm is included). Install MongoDB Community Server and start its Windows service, or create a MongoDB Atlas cluster. Check the command line:

```powershell
node --version
npm --version
```

For a local MongoDB server, its default address is `mongodb://127.0.0.1:27017`. Atlas needs a database user and a network access rule for your current IP. Copy the Atlas connection string from Atlas and replace its password placeholder; do not commit it.

### 2. Install project dependencies

In PowerShell, go to the project folder and install packages:

```powershell
cd "E:\AWT PROJ\task-management-system"
npm install
```

### 3. Configure MongoDB

Create your private environment file from the template:

```powershell
Copy-Item .env.example .env
notepad .env
```

The local default is:

```dotenv
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/taskflow
```

For Atlas, set `MONGODB_URI` to the connection string you copied, including the database name and your own credentials. Keep `.env` private; `.gitignore` excludes it. Do not paste a real connection string into source code or public commits.

### 4. Start the app

```powershell
npm start
```

For development with automatic server restarts:

```powershell
npm run dev
```

The server connects to MongoDB before it starts listening. When both are ready, open [http://localhost:3000](http://localhost:3000). Opening `index.html` directly is no longer the run method because the browser needs the Express API.

### 5. Add project demo records (optional)

With MongoDB running and `.env` configured, use either the sidebar's **Seed demo tasks** button or:

```powershell
npm run seed
```

The seed operation upserts five records with fixed demo keys. Repeating it refreshes those records instead of making duplicate demo tasks. It does not clear the collection or remove tasks you created. Demo records include multiple categories/statuses/priorities, a task due yesterday, and one due today.

## Database schema

```js
{
  _id: ObjectId,                   // created by MongoDB
  title: String,                   // required, trimmed, max 80
  description: String,             // max 500, default empty
  category: 'Personal' | 'College' | 'Projects' | 'Work' | 'Other',
  priority: 'Low' | 'Medium' | 'High',
  dueDate: 'YYYY-MM-DD' | '',      // calendar date only; avoids timezone shifts
  status: 'Pending' | 'In Progress' | 'Completed',
  createdAt: Date,                 // managed by Mongoose timestamps
  updatedAt: Date                  // managed by Mongoose timestamps
}
```

The API and UI use MongoDB `_id` as the task identifier. `normalizeTask()` maps it to the existing UI's `id` property in memory. No duplicate localStorage collection is maintained. The internal `isDemo` and `demoKey` fields identify only seed records and are not writable through normal task endpoints.

## REST API

All endpoints use JSON responses with `{ "success": true, "data": ... }` or `{ "success": false, "error": { "message": "..." } }`.

| Method and path | Purpose | Success response |
| --- | --- | --- |
| `GET /api/tasks` | Return every task, newest first. Search/filter/sort are done once in the frontend. | `200` with `data` array |
| `GET /api/tasks/:id` | Return one MongoDB task. | `200`; `400` malformed ID; `404` missing task |
| `POST /api/tasks` | Validate and create a task. | `201` with saved task |
| `PUT /api/tasks/:id` | Replace editable task fields on an existing record. Protected fields are rejected. | `200`; `400` invalid ID/data; `404` missing task |
| `PATCH /api/tasks/:id/status` | Change only the task status. | `200`; `400` invalid status/ID; `404` missing task |
| `DELETE /api/tasks/:id` | Delete one selected task. | `200` with deleted ID and message |
| `POST /api/tasks/demo/seed` | Idempotently insert or refresh only known demo records. | `200` with insert/refresh counts and demo records |

Example create request:

```http
POST /api/tasks
Content-Type: application/json
```

```json
{
  "title": "Review lecture notes",
  "description": "Go over the week six notes.",
  "category": "College",
  "priority": "High",
  "dueDate": "2026-10-28",
  "status": "Pending"
}
```

Example response (`201 Created`):

```json
{
  "success": true,
  "data": {
    "_id": "671f00000000000000000001",
    "title": "Review lecture notes",
    "description": "Go over the week six notes.",
    "category": "College",
    "priority": "High",
    "dueDate": "2026-10-28",
    "status": "Pending",
    "createdAt": "2026-10-27T10:30:00.000Z",
    "updatedAt": "2026-10-27T10:30:00.000Z"
  }
}
```

For example, a status request is `PATCH /api/tasks/671f00000000000000000001/status` with JSON body `{ "status": "Completed" }`.

## HTTP, JSON, Fetch, and CRUD

- **HTTP** carries requests and responses between the browser and server.
- **REST** uses resource URLs and method meanings: GET reads, POST creates, PUT updates, PATCH changes a part, DELETE removes.
- **JSON** is the text format used for request and response data. Express parses request JSON; the browser parses response JSON.
- **Fetch API** sends asynchronous HTTP requests. The interface updates without a full-page reload, often called AJAX-style communication.
- **CRUD** means Create, Read, Update, Delete. These map to POST, GET, PUT/PATCH, and DELETE in this app.
- The frontend sends requests to Express; the controller calls Mongoose; Mongoose communicates with MongoDB. The frontend does not connect directly to the database.

## Validation and security notes

The browser checks title presence and length and the form limits text lengths. The controller validates allowed fields, title, enums, string lengths, real calendar dates, and MongoDB IDs. Mongoose repeats schema validation at persistence. The controller rejects extra/protected fields instead of allowing a request to set `_id`, timestamps, or demo markers. Dynamic task text is escaped before rendering. API errors return safe JSON messages; internal server failures are logged without exposing stack traces or credentials.

The prototype intentionally has no authentication or ownership model. Anyone who can reach the server can read, change, and delete all records. Run it on localhost for class demonstrations only.

## Troubleshooting

- **`mongod` not found / connection refused:** install and start MongoDB Community Server, or configure an Atlas URI in `.env` and confirm the Atlas network access rule.
- **Server exits before listening:** check the exact `MONGODB_URI`, that MongoDB is running, and that the URI database is reachable. The app does not silently switch to localStorage.
- **Browser says it cannot reach the server:** run `npm start` in the project directory and open the matching `http://localhost:<PORT>` URL.
- **Atlas authentication fails:** verify the database user/password, URL-encode special password characters, and check the cluster IP allowlist.
- **Port already in use:** change `PORT` in `.env`, then open that port's localhost URL.
- **jQuery counter is missing:** the optional CDN could not load; the task interface still works without it.

## Testing

Run dependency installation and syntax checks:

```powershell
npm install
node --check server.js
node --check js/app.js
node --check controllers/taskController.js
```

With MongoDB available, run `npm start` in one terminal, then run `npm test` and `npm run smoke` in another. The smoke test exercises GET, POST, PUT, PATCH, DELETE, validation, malformed IDs, and missing records. It creates one uniquely named temporary task and deletes it even if an intermediate check fails. The dashboard statistics use the same records returned by `GET /api/tasks`.

## Viva Preparation

**What is the difference between frontend and backend?** The frontend is the browser interface. The backend receives HTTP requests, validates them, and reads or changes database records.

**What is JavaScript?** It is a programming language used here in the browser for interaction and in Node.js on the server.

**What is jQuery?** A JavaScript library that simplifies common DOM operations. Here it only updates a description character counter; the task logic is vanilla JavaScript.

**What is Node.js?** A runtime that executes JavaScript outside a browser, used here to run the server.

**What is Express.js?** A Node.js framework that helps define HTTP middleware and API routes.

**What is MongoDB?** A document database that stores records in BSON documents, which are similar to JSON objects.

**What is Mongoose?** An object data modeling library for MongoDB. It defines the Task schema and provides validated database operations.

**What is a REST API?** A web interface organized around resources and HTTP methods. This API's resource is `/api/tasks`.

**What is HTTP?** The request/response protocol used between the browser and web server.

**What is JSON?** A portable text format for structured values, used for task data in API requests and responses.

**What is the Fetch API?** The browser API used to send HTTP requests and receive responses asynchronously.

**What is AJAX?** A general approach to exchanging data with a server without reloading the entire page. Fetch provides that behavior here.

**What is CRUD?** Create, Read, Update, and Delete, the four basic operations performed on task records.

**What is MVC?** A separation of model, view, and controller responsibilities. Taskflow uses an MVC-style backend with a separate frontend view and explicit route files.

**Why is localStorage no longer the main task store?** It belongs to one browser profile and cannot coordinate with the backend. MongoDB is now the persistent source of truth.

**How does the frontend communicate with MongoDB?** It does not connect directly. Fetch sends JSON to Express; the controller uses Mongoose to access MongoDB and returns JSON.

**What happens when the database connection fails?** The server logs a clear connection error and does not start listening. The UI also shows a retryable API error if it cannot reach a running server.

**How does the application validate a task?** The browser gives immediate feedback, and the backend independently checks editable fields and values before Mongoose saves them.

**How are dashboard statistics calculated?** The frontend counts the task records returned by the API. A task is overdue when its non-empty date is earlier than the browser's local calendar date and its status is not Completed.

## Limitations and future work

This is a local, single-collection teaching prototype. It has no login, task ownership, pagination, audit log, automated production deployment, or public access controls. Future work could add authentication and user-specific task ownership, pagination/server-side filtering, automated tests, and hardened deployment configuration.
