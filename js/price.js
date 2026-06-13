import {sendRequest} from "./api.js"
import {
    showBackendStartingMessage,
    showRequestError,
    showResponse
} from "./result.js"

const allPricesButton = document.getElementById("allPricesButton")

export function initialisePrices() {
    allPricesButton.addEventListener("click", getAllPrices)
}

async function getAllPrices() {
    showBackendStartingMessage()

    try {
        const response = await sendRequest("/prices")
        showResponse(response)
    } catch (error) {
        showRequestError(error)
    }
}