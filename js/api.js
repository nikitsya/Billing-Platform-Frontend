const API_BASE_URL = "https://billing-platform-api.onrender.com/api/v1"

export async function sendRequest(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, options)
    const body = await response.text()

    return {
        url: response.url,
        status: response.status,
        body,
        error: !response.ok
    }
}
