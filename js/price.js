import {getResponseError, sendRequest} from "./api.js"

let prices = []

export async function loadPrices() {
    const response = await sendRequest("/prices")
    if (response.error) {
        throw new Error(getResponseError(response, "Unable to load prices"))
    }

    prices = Array.isArray(response.data) ? response.data : []
    document.dispatchEvent(new CustomEvent("billing:prices-updated", {
        detail: prices
    }))
    return prices
}

export function getPrices() {
    return prices
}
