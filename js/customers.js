import {sendRequest} from "./api.js"
import {
    showBackendStartingMessage,
    showRequestError,
    showResponse
} from "./result.js"

const customerForm = document.getElementById("customerForm")
const allCustomersButton = document.getElementById("allCustomersButton")

export function initialiseCustomers() {
    customerForm.addEventListener("submit", handleCustomerFormSubmit)
    allCustomersButton.addEventListener("click", getAllCustomers)
}

async function handleCustomerFormSubmit(event) {
    event.preventDefault()
    showBackendStartingMessage()

    const payload = {
        name: document.getElementById("name").value,
        email: document.getElementById("email").value
    }

    try {
        const response = await createCustomer(payload)
        showResponse(response)
    } catch (error) {
        showRequestError(error)
    }
}

async function createCustomer(payload) {
    return sendRequest("/customers", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
}

async function getAllCustomers() {
    showBackendStartingMessage()

    try {
        const response = await sendRequest("/customers")
        showResponse(response)
    } catch (error) {
        showRequestError(error)
    }
}