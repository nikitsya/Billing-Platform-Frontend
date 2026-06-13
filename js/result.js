const result = document.getElementById("result")

export function showBackendStartingMessage() {
    result.textContent = "Starting backend... this may take up to 60 seconds on the first request."
}

export function showResponse(response) {
    const prefix = response.error ? "Request failed via" : "URL:"
    result.textContent = `${prefix} ${response.url}\nStatus: ${response.status}`
    result.textContent += response.body ? `\nBody: ${response.body}` : ``
}

export function showRequestError(error) {
    result.textContent = `Request failed: ${error}`
}
