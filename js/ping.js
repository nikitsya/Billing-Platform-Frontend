import {sendRequest} from "./api.js"

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
        if (response.error) {
            throw new Error()
        }

        apiStatus.textContent = "API is online"
    } catch {
        pingButton.classList.add("is-error")
        apiStatus.textContent = "API is unavailable"
    } finally {
        pingButton.disabled = false
    }
}
