import {sendRequest, throwResponseError} from "./api.js"

let prices = []

export async function loadPrices() {
    const response = await sendRequest("/prices")
    throwResponseError(response)

    prices = Array.isArray(response.data) ? response.data : []
    document.dispatchEvent(new CustomEvent("billing:prices-updated", {
        detail: prices
    }))
    return prices
}

export function getPrices() {
    return prices
}
