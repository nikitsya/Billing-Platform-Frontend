# Billing Platform Frontend

A static HTML, CSS and JavaScript interface for the Billing Platform API.
The six navigation sections cover the overview, customers, products and
prices, subscriptions, payments and a project assistant.

## Local preview

Serve the repository using any static web server, for example:

```sh
python3 -m http.server 5173
```

Open `http://localhost:5173/ask-ai/`. The API URL in `js/api.js` points to
the Render deployment. To test against the local Java API, temporarily use
`http://localhost:8080/api/v1` there and restore the URL before committing.
The API already allows `http://localhost:5173` through CORS.

## Project assistant

The sixth section sends questions to `POST
/api/v1/project-assistant/messages` on the existing API. Deploy the matching
backend change and configure its `OPENAI_API_KEY` before enabling real
replies. Keep this key exclusively in the backend environment; it must never
appear in this repository, browser storage or a browser request.

The [backend repository](https://github.com/nikitsya/Billing-Platform-API)
contains setup instructions, request limits and the curated knowledge file
at `src/main/resources/assistant/project-notes.txt`. Update those notes when
the implementation changes. The assistant reads both public repositories'
default branches using a catalogue cached for one hour. For each question,
it selects up to three allowed source files and displays links pinned to
their commits below the answer. It does not access live billing records.
Local changes become source evidence only after they reach the repositories'
default branches.

Requests contain alternating user and assistant messages, ending in a user
question. Questions are limited to 2,000 characters. The browser includes at
most four previous exchanges within a 12,000-character context budget. The
API returns `{ "answer": "...", "sources": [{"label": "...", "url": "..."}]
}` or an error with `code` and `message`. Answers are rendered as plain
text, including any HTML-like model output.

Conversation history lives in page memory only. Reloading or choosing **New
conversation** clears it. Messages are sent to OpenAI through the API; the
page discloses this before submission. Failed requests can be retried
without adding duplicate user messages. The interface handles timeouts,
unavailable service and usage limits without inventing an answer.

## Checks

With a recent Node.js version, run `npm test` for conversation context
checks. Browser checks should also cover a successful reply, a follow-up,
retry, reset, keyboard submission and mobile navigation. Backend tests
exercise validation, response handling and the persistent request limits
without making paid requests.
