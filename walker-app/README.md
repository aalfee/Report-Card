# Alfiyay Walker App

A simple Expo mobile app for walkers to start and complete dog walks, record pee/poop events, and send walk summaries to the backend.

## Install

1. cd walker-app
2. npm install
3. npm start

## Run

- `npm run android`
- `npm run ios`
- `npm run web`

## Backend Integration

The app is configured to use `http://192.168.1.100:4000/api` as the API base URL in `src/api.js`. Replace this value with your backend URL. If your backend is deployed, use `https://alfiyay.com/api`.

Endpoints used by this app:

- `POST /api/auth/login`
- `POST /api/walks`
- `GET /api/walks`

The app includes:

- Live walk tracking with route polyline
- pee/poop event markers
- notes per walk
- walk history list
- summary view map and event details

### macOS issue: "EMFILE: too many open files"

Install Watchman to fix Metro file watcher limits:

```bash
brew install watchman
```
