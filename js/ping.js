import {sendRequest, throwResponseError} from "./api.js"
import {getErrorMessage} from "./result.js"

let pingButton = null
let apiStatus = null

export function initialisePing() {
    pingButton = document.getElementById("pingButton")
    apiStatus = document.getElementById("apiStatus")

    if (!pingButton || !apiStatus) {
        return
    }

    pingButton.addEventListener("click", checkPing)
}

async function checkPing() {
    pingButton.disabled = true
    pingButton.classList.remove("is-error")
    apiStatus.textContent = "Checking connection..."

    try {
        const response = await sendRequest("/ping")
        throwResponseError(response)

        apiStatus.textContent = "API is online"
    } catch (error) {
        pingButton.classList.add("is-error")
        apiStatus.textContent = getErrorMessage(error, "API is unavailable")
    } finally {
        pingButton.disabled = false
    }
}
