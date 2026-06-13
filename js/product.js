import {sendRequest} from "./api.js"
import {
    showBackendStartingMessage,
    showRequestError,
    showResponse
} from "./result.js"

const allProductsButton = document.getElementById("allProductsButton")

export function initialiseProducts() {
    allProductsButton.addEventListener("click", getAllProducts)
}

async function getAllProducts() {
    showBackendStartingMessage()

    try {
        const response = await sendRequest("/products")
        showResponse(response)
    } catch (error) {
        showRequestError(error)
    }
}