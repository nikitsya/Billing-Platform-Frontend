const API_BASE_URL = "https://billing-platform-api.onrender.com/api/v1"

export async function sendRequest(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, options)
    const body = await response.text()
    const data = parseBody(body)
    const message = getResponseMessage(data) || getResponseMessage(body)

    return {
        url: response.url,
        status: response.status,
        data,
        body,
        message,
        error: !response.ok
    }
}

export function throwResponseError(response) {
    if (response.error) {
        throw new Error(response.message || "Request failed.")
    }
}

function parseBody(body) {
    if (!body) {
        return null
    }

    try {
        return JSON.parse(body)
    } catch {
        return body
    }
}

function getResponseMessage(body) {
    if (!body) {
        return ""
    }

    if (typeof body === "string") {
        const trimmedBody = body.trim()

        if (!trimmedBody) {
            return ""
        }

        const parsedBody = parseBody(trimmedBody)

        return parsedBody === trimmedBody ? "" : getResponseMessage(parsedBody)
    }

    if (typeof body.message === "string" && body.message.trim()) {
        return body.message.trim()
    }

    return getResponseMessage(body.body)
}
