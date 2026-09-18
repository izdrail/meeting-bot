# Meeting Bot 🤖

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)

An open-source automation bot for joining and recording video meetings across multiple platforms including Google Meet, Microsoft Teams, and Zoom. Built with TypeScript, Node.js, and Playwright for reliable browser automation.

## ✨ Features

- **Multi-Platform Support**: Join meetings on Google Meet, Microsoft Teams, and Zoom
- **Automated Recording**: Capture meeting recordings with configurable duration limits
- **Single Job Execution**: Ensures only one meeting is processed at a time across the entire system
- **Dual Integration Options**: RESTful API endpoints and Redis message queue for flexible integration
- **Asynchronous Processing**: Redis queue support for high-throughput, scalable meeting requests
- **Docker Support**: Containerized deployment with Docker and Docker Compose
- **Graceful Shutdown**: Proper cleanup and resource management
- **Prometheus Metrics**: Built-in monitoring and metrics collection
- **Stealth Mode**: Advanced browser automation with anti-detection measures
- **Completion Notifications**: Optional webhook and Redis notifications when a recording is completed

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose (for containerized deployment)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/screenappai/meeting-bot.git
   cd meeting-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run with Docker (Recommended)**
   ```bash
   npm run dev
   ```

   Or run locally:
   ```bash
   npm start
   ```

The server will start on `http://localhost:3000`

## 📖 Usage

### How Meeting Bot Works

Meeting Bot operates with a single job execution model to ensure reliable meeting processing:

- **Single Job Processing**: Meeting Bot accepts only one job at a time and works until it's completely finished before accepting another job
- **Automatic Retry**: The bot automatically retries on certain errors such as automation failures or when it takes too long to admit the bot into a meeting

### API Endpoints


#### Join a Google Meet
```bash
POST /google/join
Content-Type: application/json

{
  "bearerToken": "your-auth-token",
  "url": "https://meet.google.com/abc-defg-hij",
  "name": "Meeting Notetaker",
  "teamId": "team123",
  "timezone": "UTC",
  "userId": "user123",
  "botId": "UUID"
}
```

For Google Meet, you can optionally connect to an already-running Chrome via `GOOGLE_CHROME_CDP_URL`, or run the browser with a dedicated signed-in Google profile by setting `GOOGLE_CHROME_USER_DATA_DIR` or `GOOGLE_CHROME_STORAGE_STATE_PATH`. The CDP option is useful when the Docker browser is treated differently from a normal Chrome. If you use CDP, launch that Chrome with `--auto-accept-this-tab-capture` so recording can select the current Meet tab without a manual browser prompt. The Chrome window and virtual display should normally use `1280,800`; the bot then sets the page viewport to `1280x720`, leaving room for Chrome's top UI without clipping the Meet controls.

The production image starts Chrome, Xvfb, PulseAudio, the sign-in console, and the Node app in one container. It points `GOOGLE_CHROME_CDP_URL` at the bundled Chrome on `http://127.0.0.1:9222` by default. You can still set that variable to any reachable external Chrome endpoint when a split deployment is preferable.

For **local testing**, `docker compose up --build` still uses the development `chrome-cdp` sidecar so changes can be tested independently. The production Compose stack uses the single combined image. If host port `6379` is already taken by another local Redis, start with `REDIS_PORT_HOST=6380 docker compose up --build`. Join a Meet that allows guests, make sure a second participant is present (the bot leaves if it's alone), then `POST /google/join` (see above) and follow `docker compose logs -f meeting-bot`. With the default local uploader, recordings are written under `/recordings`. Set `GOOGLE_CHROME_CDP_URL=` (empty) to bypass CDP and let Playwright launch a browser per meeting. The development sidecar starts with a reusable but initially unsigned-in profile; meetings that require sign-in can use an account profile created in the dashboard.

#### Join a Microsoft Teams Meeting
```bash
POST /microsoft/join
Content-Type: application/json

{
  "bearerToken": "your-auth-token",
  "url": "https://teams.microsoft.com/l/meetup-join/...",
  "name": "Meeting Notetaker",
  "teamId": "team123",
  "timezone": "UTC",
  "userId": "user123",
  "botId": "UUID"
}
```

#### Join a Zoom Meeting
```bash
POST /zoom/join
Content-Type: application/json

{
  "bearerToken": "your-auth-token",
  "url": "https://zoom.us/j/123456789",
  "name": "Meeting Notetaker",
  "teamId": "team123",
  "timezone": "UTC",
  "userId": "user123",
  "botId": "UUID"
}
```

### Recording Completion Notifications (Optional)

You can configure Meeting Bot to notify external systems when a recording has finished and is ready. Two channels are supported:

- Webhook HTTP POST
- Redis list push (RPUSH) to a configurable DB and list

Webhook notifications are disabled by default. Redis completion notifications are enabled automatically for Redis-worker mode (`REDIS_CONSUMER_ENABLED=true`) and can also be enabled explicitly with `NOTIFY_REDIS_ENABLED=true`.

#### Environment Variables

- NOTIFY_WEBHOOK_ENABLED: Enable webhook delivery (default: false)
- NOTIFY_WEBHOOK_URL: Webhook endpoint URL
- NOTIFY_WEBHOOK_SECRET: Optional secret to HMAC-SHA256 sign payloads. Signature header: X-Webhook-Signature

- NOTIFY_REDIS_ENABLED: Enable Redis notifications. Completion notifications are also enabled automatically when REDIS_CONSUMER_ENABLED=true so Redis jobs produce result-list entries.
- NOTIFY_REDIS_URI: Optional Redis URI for notifications; if not set, falls back to REDIS_HOST/REDIS_PORT/etc via redisUri
- NOTIFY_REDIS_DB: Optional Redis database number to use for notifications. If not set, the Redis client's default DB is used. DB 0 is allowed when explicitly configured.
- NOTIFY_REDIS_LIST: Redis list key to RPUSH to (default: jobs:meetbot:recordings)
- NOTIFY_REDIS_FAILURE_LIST: Redis list key to RPUSH failed meeting jobs to (default: jobs:meetbot:failures)

Existing REDIS_* connection envs are used to derive a default redisUri when NOTIFY_REDIS_URI is not specified.

#### Payload Schema

An example JSON payload sent via webhook and pushed to the Redis list:

```
{
  "recordingId": "abc123",
  "meetingLink": "https://your.meeting/provider/link",
  "status": "completed",
  "timestamp": "2025-09-08T12:00:00Z",
  "metadata": {
    "userId": "user123",
    "teamId": "team123",
    "botId": "bot-uuid",
    "contentType": "video/webm",
    "uploaderType": "s3",
    "storage": {
      "provider": "s3",
      "bucket": "my-bucket",
      "key": "meeting-bot/user123/2025-09-08-12-00-00.webm",
      "region": "eu-central-1",
      "endpoint": "https://s3.eu-central-1.amazonaws.com",
      "forcePathStyle": false,
      "url": "https://my-bucket.s3.eu-central-1.amazonaws.com/meeting-bot/user123/2025-09-08-12-00-00.webm"
    }
  },
  "blobUrl": "https://my-bucket.s3.eu-central-1.amazonaws.com/meeting-bot/user123/2025-09-08-12-00-00.webm"
}
```

Notes:
- The storage URL is provided as blobUrl to be storage-provider agnostic (works for S3, Azure Blob, etc.). It may be omitted if not available.
- If available from internal APIs (screenapp uploader), a direct file URL is used. For S3-compatible uploads, the URL is constructed based on S3 configuration. For Azure Blob Storage, notification URLs are SAS URLs; unsigned Azure public blob URLs are not pushed to Redis as a fallback.
- If a webhook secret is configured, the request body is signed with HMAC-SHA256 and sent in the X-Webhook-Signature header.
- The metadata.storage section includes provider-specific path details. For S3-compatible uploads: bucket and key are provided. For the Screenapp uploader, you may see `{ provider: "screenapp", fileId, url, defaultProfile }`.

#### Behavior

- Notifications are triggered only after the recording upload/processing has successfully completed.
- Failed meeting jobs are pushed to NOTIFY_REDIS_FAILURE_LIST after all join/recording retries are exhausted, or after a non-retryable upload failure.
- Failure notifications are Redis-only and use the same NOTIFY_REDIS_ENABLED, NOTIFY_REDIS_URI, and NOTIFY_REDIS_DB settings.
- If both channels are enabled, both will receive the payload.
- Failures to notify are logged but do not interrupt the main recording flow.

#### Check System Status
```bash
GET /isbusy
```

#### Get Metrics
```bash
GET /metrics
```


### Response Format

**Success Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Meeting join request accepted and processing started",
  "data": {
    "userId": "user123",
    "teamId": "team123",
    "status": "processing"
  }
}
```

**Busy Response (409 Conflict):**
```json
{
  "success": false,
  "message": "System is currently busy processing another meeting",
  "error": "BUSY"
}
```


### Redis Message Queue (Alternative to REST API)

Meeting Bot also supports adding meeting join requests via Redis message queue, which provides asynchronous processing and better scalability for high-throughput scenarios.

#### Redis Message Structure

```typescript
interface MeetingJoinRedisParams {
  url: string;
  name: string;
  teamId: string;
  userId: string;
  bearerToken: string;
  timezone: string;
  botId?: string;
  eventId?: string;
  provider: 'google' | 'microsoft' | 'zoom';  // Required for Redis
}
```

#### Adding Messages to Redis Queue

**Using RPUSH (Recommended):**
```bash
# Connect to Redis and add a message to the queue
redis-cli RPUSH jobs:meetbot:list '{
  "url": "https://meet.google.com/abc-defg-hij",
  "name": "Meeting Notetaker",
  "teamId": "team123",
  "timezone": "UTC",
  "userId": "user123",
  "botId": "UUID",
  "provider": "google",
  "bearerToken": "your-auth-token"
}'
```

**Using Redis Client Libraries:**

**Node.js (ioredis):**
```javascript
import Redis from 'ioredis';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: 'your-password'
});

const message = {
  url: "https://meet.google.com/abc-defg-hij",
  name: "Meeting Notetaker",
  teamId: "team123",
  timezone: "UTC",
  userId: "user123",
  botId: "UUID",
  provider: "google",
  bearerToken: "your-auth-token"
};

await redis.rpush('jobs:meetbot:list', JSON.stringify(message));
```

**Python (redis-py):**
```python
import redis
import json

r = redis.Redis(host='localhost', port=6379, password='your-password')

message = {
    "url": "https://meet.google.com/abc-defg-hij",
    "name": "Meeting Notetaker",
    "teamId": "team123",
    "timezone": "UTC",
    "userId": "user123",
    "botId": "UUID",
    "provider": "google",
    "bearerToken": "your-auth-token"
}

r.rpush('jobs:meetbot:list', json.dumps(message))
```

#### Queue Processing

- **FIFO Queue**: Messages are processed in First-In-First-Out order
- **Atomic Processing Move**: The bot uses `BLMOVE` to move messages from the pending queue into the processing queue before recording starts
- **Processing Acknowledgement**: The bot removes the original message from the processing queue with `LREM` after the recording finishes or permanently fails
- **Automatic Processing**: Messages are automatically picked up and processed by the Redis consumer service
- **Single Job Execution**: Only one meeting is processed at a time across the entire system

#### Redis Configuration

The following environment variables configure Redis connectivity:

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis server hostname | `redis` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_USERNAME` | Redis username (optional) | - |
| `REDIS_PASSWORD` | Redis password (optional) | - |
| `REDIS_QUEUE_NAME` | Queue name for meeting jobs | `jobs:meetbot:list` |
| `REDIS_PROCESSING_QUEUE_NAME` | Queue name for active Redis meeting jobs | `jobs:meetbot:processing` |
| `REDIS_CONSUMER_ENABLED` | Enable/disable Redis consumer service | `false` |

**Note**: When `REDIS_CONSUMER_ENABLED` is set to `false`, the Redis consumer service will not start, and the application will only support REST API endpoints for meeting requests. Redis message queue functionality will be disabled.

### Recording Upload Configuration

Meeting Bot automatically uploads the meeting recording to object storage when a meeting ends. You can choose between S3-compatible storage and Microsoft Azure Blob Storage at runtime using a configuration flag.

- **AWS S3** - Amazon Web Services Simple Storage Service
- **GCP Cloud Storage** - Google Cloud Platform S3-compatible storage
- **MinIO** - Self-hosted S3-compatible object storage
- **Other S3-compatible services** - Any service that implements the S3 API
- **Azure Blob Storage** - Native Azure object storage

#### Storage Provider Selection

Select the storage backend without code changes:

```bash
# s3 (default) or azure
STORAGE_PROVIDER=s3
```

When `STORAGE_PROVIDER` is not set, it defaults to `s3` to preserve backward compatibility.

#### Environment Variables for S3-Compatible Upload Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `S3_ENDPOINT` | S3-compatible service endpoint URL | - | Yes for non-AWS |
| `S3_ACCESS_KEY_ID` | Access key for bucket authentication | - | Yes |
| `S3_SECRET_ACCESS_KEY` | Secret key for bucket authentication | - | Yes |
| `S3_BUCKET_NAME` | Target bucket name for uploads | - | Yes |
| `S3_REGION` | AWS region (for AWS S3) | - | Yes |
| `S3_USE_MINIO_COMPATIBILITY` | Enable MinIO compatibility mode | `false` | No |

#### Configuration Examples

**AWS S3:**
```bash
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
S3_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET_NAME=meeting-recordings
S3_REGION=us-west-2
```

**Google Cloud Storage (S3-compatible):**
```bash
S3_ENDPOINT=https://storage.googleapis.com
S3_ACCESS_KEY_ID=your-gcp-access-key
S3_SECRET_ACCESS_KEY=your-gcp-secret-key
S3_BUCKET_NAME=meeting-recordings
S3_REGION=us-west1
```

**MinIO:**
```bash
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_NAME=meeting-recordings
S3_REGION=us-west-2
S3_USE_MINIO_COMPATIBILITY=true
```

#### Azure Blob Storage Configuration

If you prefer Azure Blob Storage, set `STORAGE_PROVIDER=azure` and configure one of the supported authentication methods below. The bot will preserve the same folder structure and naming used by S3.

Required:

- `AZURE_STORAGE_CONTAINER` — Target container name
- One of the following auth options:
  - `AZURE_STORAGE_CONNECTION_STRING`
  - `AZURE_STORAGE_ACCOUNT` + `AZURE_STORAGE_ACCOUNT_KEY`
  - `AZURE_STORAGE_ACCOUNT` + `AZURE_STORAGE_SAS_TOKEN` (starts with `?sv=`)
  - `AZURE_STORAGE_ACCOUNT` + `AZURE_USE_MANAGED_IDENTITY=true` (requires appropriate RBAC on the container)

Optional:

- `AZURE_SIGNED_URL_TTL_SECONDS` — Expiry for generated SAS URLs (default: `3600`)
- `AZURE_UPLOAD_CONCURRENCY` — Parallelism for uploads (default: `4`)
- `AZURE_BLOB_PREFIX` — Optional prefix path within the container (defaults to none; the bot already includes a `meeting-bot/...` path in object keys)

Examples

Connection string:

```bash
STORAGE_PROVIDER=azure
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=example;AccountKey=redacted;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER=meeting-recordings
```

Account + Key:

```bash
STORAGE_PROVIDER=azure
AZURE_STORAGE_ACCOUNT=example
AZURE_STORAGE_ACCOUNT_KEY=redacted
AZURE_STORAGE_CONTAINER=meeting-recordings
```

Managed Identity (AAD):

```bash
STORAGE_PROVIDER=azure
AZURE_STORAGE_ACCOUNT=example
AZURE_USE_MANAGED_IDENTITY=true
AZURE_STORAGE_CONTAINER=meeting-recordings
```

#### How Upload Works

1. **Automatic Upload**: When a meeting recording completes, the bot automatically uploads the file to the configured object storage (S3-compatible or Azure Blob)
2. **File Naming**: Recordings are uploaded with descriptive names including meeting details and timestamps
3. **Error Handling**: If upload fails, the bot will automatically retry upload
4. **Cleanup**: Local recording files are cleaned up after successful upload

Notes:

- The default object key layout is: `meeting-bot/{userId}/{fileName}{extension}` (e.g., `meeting-bot/1234/My Meeting - 2025-11-13 14-42.webm`). This same layout is used for both S3 and Azure to ensure parity.
- When `STORAGE_PROVIDER=azure` is set and Azure environment variables are provided, the upload will go to Azure Blob Storage instead of S3.
- Signed URL generation for Azure uses SAS tokens with a configurable TTL via `AZURE_SIGNED_URL_TTL_SECONDS`. Redis completion notifications use these SAS URLs for Azure `blobUrl` and `metadata.storage.url`.

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MAX_RECORDING_DURATION_MINUTES` | Maximum recording duration in minutes | `180` |
| `MEETING_INACTIVITY_MINUTES` | Continuous inactivity duration after which the bot will end meeting recording | `1` |
| `INACTIVITY_DETECTION_START_DELAY_MINUTES` | Initial grace period at the start of recording before inactivity detection begins | `1` |
| `LONE_PARTICIPANT_EXIT_DELAY_SECONDS` | Delay before stopping after the bot has seen other participants and then becomes alone | `10` |
| `TEAMS_PREWARM_ENABLED` | Enable the extra Microsoft Teams warmup browser pass for environments that still show first-run dialogs | `false` |
| `TEAMS_AUDIO_STABILIZATION_MS` | Delay before starting Microsoft Teams ffmpeg recording after joining | `1000` |
| `GOOGLE_CHROME_CDP_URL` | Chrome CDP endpoint for Google Meet joins. The production image defaults to its bundled Chrome at `http://127.0.0.1:9222`; set a reachable URL to use external Chrome instead. Validated at startup. `CHROME_CDP_URL` is accepted as an alias. | `http://127.0.0.1:9222` in the production image |
| `AUTH_BASE_URL_V2` | Base URL of the optional ScreenApp-compatible backend used for bot status/log reporting and uploads. Must be an absolute http(s) URL; validated at startup (fails fast). Leave unset for local-only mode - reporting is skipped with a clear log line. `API_BASE_URL`, `BACKEND_URL` and `APP_URL` are accepted aliases. | - |
| `GOOGLE_CHROME_USER_DATA_DIR` | Optional persistent Chrome profile directory for Google Meet joins. Use a dedicated signed-in Google account profile. | - |
| `GOOGLE_CHROME_STORAGE_STATE_PATH` | Optional Playwright storage state JSON for Google Meet joins when not using a persistent profile. | - |
| `GOOGLE_ANONYMOUS_JOIN_REQUEST_ATTEMPTS` | Number of times to re-submit an anonymous Google Meet guest request if Meet redirects while waiting for host admission. | `10` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `UPLOADER_FILE_EXTENSION` | Final recording file extension (e.g., .mkv, .webm) | `.webm` |
| `REDIS_HOST` | Redis server hostname | `redis` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_USERNAME` | Redis username (optional) | - |
| `REDIS_PASSWORD` | Redis password (optional) | - |
| `REDIS_QUEUE_NAME` | Queue name for meeting jobs | `jobs:meetbot:list` |
| `REDIS_PROCESSING_QUEUE_NAME` | Queue name for active Redis meeting jobs | `jobs:meetbot:processing` |
| `REDIS_CONSUMER_ENABLED` | Enable/disable Redis consumer service | `false` |
| `S3_ENDPOINT` | S3-compatible service endpoint URL | - |
| `S3_ACCESS_KEY_ID` | Access key for bucket authentication | - |
| `S3_SECRET_ACCESS_KEY` | Secret key for bucket authentication | - |
| `S3_BUCKET_NAME` | Target bucket name for uploads | - |
| `S3_REGION` | AWS region (for AWS S3) | - |
| `S3_USE_MINIO_COMPATIBILITY` | Enable MinIO compatibility mode | `false` |

### Docker Configuration

The project includes Docker support with separate configurations for development and production:

- `Dockerfile.development` - Development build
- `Dockerfile.production` - Combined production build with the app and bundled Chrome
- `Dockerfile.chrome-cdp` - Google Chrome CDP backend for Kubernetes sidecar deployments
- `docker-compose.yml` - Complete development environment

#### Bundled Chrome and optional external CDP

`Dockerfile.production` contains both the meeting bot and Chrome. Its entrypoint starts Xvfb, PulseAudio, the local sign-in console, Chrome CDP, and then the Node app. The `/data/chrome-profile` directory is persistent in `compose.production.yml`, so Chrome sign-in survives restarts. CDP stays on loopback and is not published.

To use a separately managed Chrome instead, set an endpoint the container can reach:

```bash
GOOGLE_CHROME_CDP_URL=http://host.docker.internal:9223
```

The legacy `Dockerfile.chrome-cdp` remains available for custom split or Kubernetes deployments, but release workflows no longer build or publish a second image.

#### Troubleshooting: CDP and backend connectivity

- **CDP connection errors**: leave `GOOGLE_CHROME_CDP_URL` unset when using
  the combined production image, which defaults to `http://127.0.0.1:9222`.
  For an external browser, set an absolute endpoint reachable from the bot
  container, such as `http://host.docker.internal:9223`. DNS failures are
  deterministic: the bot reports them once with the URL, correlation ID and
  root cause, and does not burn join retries on them.
- **`TypeError: Invalid URL` from `patchBotStatus`**: the backend base URL was
  empty or relative, so axios could not build the request URL. URLs are now
  built with `new URL(path, base)` and the base is validated at startup - a
  bad `AUTH_BASE_URL_V2` fails fast with a clear config error, and an unset
  one disables reporting with a clear log line instead of a crash.

Do not publish the bundled CDP port. Keep external CDP endpoints private so only the bot can control the browser.

#### Using Docker Image from GitHub Packages

The project automatically builds and publishes Docker images to GitHub Packages on every push to the main branch.

**Pull the latest image:**
```bash
docker pull ghcr.io/screenappai/meeting-bot:latest
```

**Run the container:**
```bash
docker run -d \
  --name meeting-bot \
  -p 3000:3000 \
  -e MAX_RECORDING_DURATION_MINUTES=60 \
  -e NODE_ENV=production \
  -e REDIS_CONSUMER_ENABLED=false \
  -e S3_ENDPOINT= \
  -e S3_ACCESS_KEY_ID= \
  -e S3_SECRET_ACCESS_KEY= \
  -e S3_BUCKET_NAME= \
  -e S3_REGION= \
  ghcr.io/screenappai/meeting-bot:latest
```

**Available tags:**
- `latest` - Latest stable release from main branch
- `main` - Latest commit from main branch
- `sha-<commit-hash>` - Specific commit builds

## 🏗️ Architecture

```
src/
├── app/           # Express application and route handlers
├── bots/          # Platform-specific bot implementations
├── connect/       # Redis message broker and consumer services
├── lib/           # Core libraries and utilities
├── middleware/    # Express middleware
├── services/      # Business logic services
├── tasks/         # Background task implementations
├── types/         # TypeScript type definitions
└── util/          # Utility functions
```

### Key Components

- **AbstractMeetBot**: Base class for all platform bots
- **JobStore**: Manages single job execution across the system
- **RecordingTask**: Handles meeting recording functionality
- **ContextBridgeTask**: Manages browser context and automation
- **RedisMessageBroker**: Handles Redis queue operations (RPUSH/BLMOVE/LREM)
- **RedisConsumerService**: Processes messages from Redis queue asynchronously

## ⚠️ Authentication boundaries

Meeting Bot supports direct guest joins and signed-in Google, Microsoft, and Zoom browser profiles created from the web dashboard. A join can also carry a one-meeting password/passcode. Waiting rooms that require an authenticated identity use the selected account profile.

Interactive enterprise SSO is supported when the organization's browser flow can be completed and leaves a reusable session. No meeting bot can universally bypass identity-provider CAPTCHA, hardware keys, managed-device requirements, administrator conditional-access policy, or an expired/denied account. Reconnect the saved profile when the provider or organization requires fresh authentication. Host admission rules still apply after authentication.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to:

- Set up your development environment
- Submit bug reports and feature requests
- Contribute code changes
- Follow our coding standards

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

**🎯 Primary Support Channel:**
- **Discord**: [Join our Discord Community](https://discord.gg/frS8QgUygn) - Our main forum for discussions, support, and real-time collaboration

**📋 Additional Resources:**
- **Issues**: [GitHub Issues](https://github.com/screenappai/meeting-bot/issues) - For bug reports and feature requests
- **Documentation**: [Wiki](https://github.com/screenappai/meeting-bot/wiki) - Detailed documentation and guides

## 🙏 Acknowledgments

- Built with [Playwright](https://playwright.dev/) for reliable browser automation
- Uses [Express.js](https://expressjs.com/) for the web server
- Containerized with [Docker](https://www.docker.com/)

## 📊 Project Status

- ✅ Google Meet support
- ✅ Microsoft Teams support  
- ✅ Zoom support
- ✅ Recording functionality
- ✅ Docker deployment
- ✅ REST API support
- ✅ Redis message queue support
- ✅ Recording Upload support - S3-compatible bucket storage (AWS, GCP, MinIO)
- 🔄 Additional video format support (planned)
- 🔄 Enhanced platform feature support (planned)

---

**Note**: This project is for educational and legitimate automation purposes. Please ensure compliance with the terms of service of the platforms you're automating.

## Self-host with Docker Hub (`izdrail/meetings.izdrail.com`)

This fork ships a production image and a complete Compose stack. The stack contains:

- `izdrail/meetings.izdrail.com`: API, meeting recorder, Chrome, virtual display, audio, and sign-in console
- Redis 7: optional job queue and completion queue

The Chrome DevTools port is loopback-only inside the meeting-bot container.

### First run

```bash
git clone https://github.com/izdrail/meeting-bot.git
cd meeting-bot
cp .env.example .env
# Edit .env if you want to change the defaults.
docker compose -f compose.production.yml pull
docker compose -f compose.production.yml up -d
docker compose -f compose.production.yml ps
curl --fail http://localhost:3000/health
```

To build the exact image locally instead of pulling it:

```bash
docker build -f Dockerfile.production -t izdrail/meetings.izdrail.com:latest .
docker compose -f compose.production.yml up -d
```

Update or stop the stack:

```bash
docker compose -f compose.production.yml pull
docker compose -f compose.production.yml up -d
docker compose -f compose.production.yml down
# Add -v only if you also want to delete Redis data, recordings, and dashboard/Chrome profile data.
```

`.env.example` lists every setting needed by this self-hosted stack. REST endpoints work with `REDIS_CONSUMER_ENABLED=false`; Redis remains available so queue mode can be enabled without changing the stack. Completed recordings are moved to `/recordings/<userId>/` inside the container and persist in the `recordings` named volume. No S3, Azure, or ScreenApp backend is required.

List or copy recordings from the volume:

```bash
docker compose -f compose.production.yml exec meeting-bot find /recordings -type f
docker compose -f compose.production.yml cp meeting-bot:/recordings ./recordings-backup
```

To use a host directory instead, replace `recordings:/recordings` in `compose.production.yml` with `./recordings:/recordings` and create it with permissions writable by uid 1001.

Google, Microsoft, and Zoom can still require a meeting host to admit the bot. Use a dedicated, consented meeting identity where the provider requires sign-in. The persistent `dashboard_data` volume includes `/data/chrome-profile`, so the bundled Chrome profile survives restarts. Credentials are not included in the image.

### Publish to Docker Hub

Pull requests run the Node test suite and version check without building a Docker image. After a pull request is merged, pushes to `main` build and publish the combined image to Docker Hub and GitHub Container Registry. Create these repository Actions secrets:

- `DOCKERHUB_USERNAME`: `izdrail`
- `DOCKERHUB_TOKEN`: a Docker Hub access token with permission to push the repository

Create the Docker Hub repository `izdrail/meetings.izdrail.com` before the first push if the Docker Hub account does not allow automatic repository creation.

## Web dashboard

Open `http://localhost:3000/dashboard/` after starting either Compose stack. The dashboard is served by the existing Express process, so no second frontend service or port is needed.

Set `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` in `.env` to protect the dashboard and every `/api/dashboard`, `/api/accounts`, `/api/bots`, and `/api/recordings` route. Browser logins use an HTTP-only, same-site signed session cookie that expires after 12 hours. `DASHBOARD_SESSION_SECRET` is optional; set it to a long random value if you want session signing to remain independent from credential changes. Credentials and secrets are never returned or logged. Five failed attempts from one address lock login for 15 minutes.

If either username or password is missing, dashboard authentication is disabled and startup logs a warning. This is convenient for local development but should not be used on a network-accessible deployment. Existing programmatic clients can authenticate with `Authorization: Bearer $DASHBOARD_BEARER_TOKEN`; this bearer path remains available when interactive login is enabled.

It provides:

- provider/runtime status for Google Meet, Microsoft Teams, and Zoom
- reusable bot identities stored in the `dashboard_data` Docker volume
- a join form backed by the existing `POST /google/join`, `POST /microsoft/join`, and `POST /zoom/join` routes
- recent dashboard join attempts
- a local recording list with play and download links backed by `RECORDINGS_DIR`

`bearerToken` in a join request authenticates the configured recording uploader; it is not a Google or Microsoft OAuth token. The dashboard uses persistent browser profiles for meeting authentication and keeps the provider runtime modes visible:

- Google: the combined image uses its bundled Chrome CDP and persistent `/data/chrome-profile` by default. `GOOGLE_CHROME_USER_DATA_DIR` and `GOOGLE_CHROME_STORAGE_STATE_PATH` remain supported alternatives.
- Microsoft: the bot uses its documented Teams browser join route. Teams may admit it as a guest or ask the host to admit it.

Do not put provider passwords or access tokens into a bot definition. A bot definition contains only its display name, provider, team/user identifiers, timezone, and an optional local account-profile ID.

### Dashboard API

List the complete dashboard state:

```bash
curl --fail http://localhost:3000/api/dashboard \
  --header "Authorization: Bearer $DASHBOARD_BEARER_TOKEN"
```

Create a reusable Google bot:

```bash
curl --fail --request POST http://localhost:3000/api/bots \
  --header 'Content-Type: application/json' \
  --data '{
    "provider": "google",
    "name": "Meeting Notetaker",
    "teamId": "local",
    "userId": "stefan",
    "timezone": "Europe/London"
  }'
```

The response contains the generated bot `id`. Use it to join a meeting:

```bash
curl --fail --request POST http://localhost:3000/api/bots/BOT_ID/join \
  --header 'Content-Type: application/json' \
  --data '{"url":"https://meet.google.com/abc-defg-hij"}'
```

For `UPLOADER_TYPE=local`, the default `local-dashboard` bearer value is sufficient because the local uploader does not call ScreenApp. For `UPLOADER_TYPE=screenapp`, set `DASHBOARD_BEARER_TOKEN` in `.env`, or keep using the original join endpoints and pass `bearerToken` explicitly from a trusted backend. The dashboard never returns this environment value to the browser.

List recordings:

```bash
curl --fail http://localhost:3000/api/recordings
```

Remove a bot definition:

```bash
curl --fail --request DELETE http://localhost:3000/api/bots/BOT_ID
```

### Authenticated meetings

The dashboard can create isolated persistent Chrome profiles for Google, Microsoft, and Zoom. This is browser authentication, which is what the meeting web clients need; provider API OAuth tokens alone do not sign the browser into a meeting.

1. Open **Accounts** and choose **Connect account**.
2. Give the account a local label and open the sign-in browser.
3. Complete the provider's normal login, MFA, or organization SSO at `http://localhost:6080/vnc.html?autoconnect=1&resize=scale`. Compose binds this console to `127.0.0.1` only; use an SSH tunnel when the bot runs on another host, and never publish port 6080 directly.
4. Return to the dashboard and choose **Mark ready**. This closes Chrome cleanly so its session is saved.
5. Add a bot and select that signed-in account. Join requests from that bot launch with the saved profile.

The account label and state are stored in `/data/auth-accounts.json`; Chrome session data is stored under `/data/auth-profiles/<accountId>/`. Compose persists `/data` in `dashboard_data`. Passwords are entered only into the provider page and are never accepted by the meeting-bot API.

`DASHBOARD_DATA_DIR` sets the writable root for dashboard state and authenticated browser profiles (`DATA_DIR` is a fallback). It defaults to `/data` in production and `./data` outside production. `DASHBOARD_STATE_PATH`, `AUTH_ACCOUNTS_PATH`, and `AUTH_PROFILES_DIR` remain supported as per-path overrides. The container creates `/data` for its non-root `nodejs` user (UID/GID 1001), and the named Compose volume inherits that ownership. For a bind mount or Kubernetes PVC, make the directory writable by UID/GID 1001. A Kubernetes pod can use `runAsUser: 1001`, `runAsGroup: 1001`, and `fsGroup: 1001`; use an init container to `chown` an existing volume whose ownership cannot be changed through `fsGroup`. Do not use `chmod 777`. Startup stops with an actionable error if the data directory cannot be written.

Normal Google, Microsoft, and Zoom sign-in is supported. Enterprise SSO works when its browser flow can be completed interactively and leaves a reusable session. There is no universal way to automate arbitrary identity providers, hardware keys, device-compliance rules, CAPTCHA, or administrator conditional-access blocks; reconnect the profile interactively when the organization requires it.

Meeting passwords are separate from account sign-in. The dashboard accepts an optional password/passcode for one join attempt, keeps it out of bot metadata and activity, and tries the provider's visible password/passcode field. Existing direct-link and anonymous joins continue to work unchanged.

Direct API callers can add the optional fields to any join body:

```json
{
  "accountId": "UUID from POST /api/accounts",
  "meetingPassword": "one-meeting passcode"
}
```
