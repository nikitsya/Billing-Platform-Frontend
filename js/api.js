const API_BASE_URL = "https://billing-platform-api.onrender.com/api/v1"

export async function sendRequest(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, options)
    const body = await response.text()
    const data = parseBody(body)

    return {
        url: response.url,
        status: response.status,
        data,
        body,
        error: !response.ok
    }
}

export function getResponseError(response, fallbackMessage) {
    if (typeof response.data === "string" && response.data.trim()) {
        return response.data
    }

    if (response.data?.message) {
        return response.data.message
    }

    return `${fallbackMessage} (${response.status})`
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
