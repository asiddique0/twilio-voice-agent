# Juiz

This is a Node.js/TypeScript Express server which integrates Twilio VOIP with Eleven Labs and various other integrations.

## Setup

### Install dependencies

```
npm install
```

### Build the application

```
npm run build
```

## Running the application

```
npm start
```

## Supported npm commands

### Run in a dev environment

```
npm run dev
```

### Lint the application

```
npm run lint
```

### Format the application

```
npm run format
```

### Run test (currently not supported)

```
npm run test
```

## Environment setup

### Environment variables

```
// Express Server
SERVER_PORT='8080'

ACCOUNT_SID=
AUTH_TOKEN=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```