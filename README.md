# Boardly – Kanban boards

Full-stack kanban app. Node.js + Express + TypeScript + MongoDB (Mongoose) on the backend, React + TypeScript + Vite on the frontend.

## Run it (2 terminals)

You need Node 18+ and MongoDB running locally (or an Atlas URI in `server/.env`).

```bash
# Terminal 1: API on :4000
cd server
npm install
npm run dev

# Terminal 2: web app on :5173
cd client
npm install
npm run dev
```

Open http://localhost:5173, create an account, and start a board.

## Features

- Register / sign in (bcrypt-hashed passwords, JWT, 7-day session)
- Each user only sees and edits their own boards
- Boards with colors and progress, three columns, drag-and-drop between and within columns
- Custom categories per board (add or delete your own, with colors) and a multi-select category filter
- Optional due dates (highlighted when due soon or overdue) and optional estimated time, with a "time left" total per board
- Confetti and a message when a board reaches 100%
- Task titles and notes (edit in a modal), delete tasks and boards

## API

| Method             | Route                               | Purpose                                                                           |
| ------------------ | ----------------------------------- | --------------------------------------------------------------------------------- |
| POST               | /api/auth/register, /api/auth/login | Get a token                                                                       |
| GET                | /api/auth/me                        | Current user                                                                      |
| GET, POST          | /api/boards                         | List / create boards                                                              |
| GET, PATCH, DELETE | /api/boards/:id                     | Board with its tasks / rename / delete                                            |
| POST               | /api/boards/:id/tasks               | Create a task                                                                     |
| POST               | /api/boards/:id/categories          | Add a category (name, color)                                                      |
| DELETE             | /api/boards/:id/categories/:catId   | Delete a category (tasks become uncategorized)                                    |
| PATCH, DELETE      | /api/tasks/:id                      | Update (title, notes, category, dueDate, estimateMinutes, status, order) / delete |

## Data model (MongoDB)

- `users`: name, email (unique), passwordHash
- `boards`: owner → user, title, color, categories (embedded: name, color)
- `tasks`: board → board, owner → user, title, description, category, dueDate (optional), estimateMinutes (optional), status (`todo|doing|done`), order

## Structure

```
server/src  index.ts (app + DB)  routes.ts  models.ts  middleware.ts (JWT)
client/src  App.tsx  api.ts  auth.tsx  confetti.ts  pages/{AuthPage,BoardsPage,BoardPage}.tsx  styles.css
```
