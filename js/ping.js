import {sendRequest, throwResponseError} from "./api.js"
import {getErrorMessage} from "./result.js"

const pingButton = document.getElementById("pingButton")
const apiStatus = document.getElementById("apiStatus")

export function initialisePing() {
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
