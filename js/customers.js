import {getResponseError, sendRequest} from "./api.js"
import {getErrorMessage, setStatus} from "./result.js"

const customerForm = document.getElementById("customerForm")
const allCustomersButton = document.getElementById("allCustomersButton")
const customerRows = document.getElementById("customerRows")
const customerSummary = document.getElementById("customerSummary")
const customerCount = document.getElementById("customerCount")
const customerFormStatus = document.getElementById("customerFormStatus")

let customers = []
let deletingCustomerId = null

export function initialiseCustomers() {
    if (!customerForm && !allCustomersButton && !customerRows && !customerCount) {
        return null
    }

    customerForm?.addEventListener("submit", handleCustomerFormSubmit)
    allCustomersButton?.addEventListener("click", loadCustomers)
    return loadCustomers()
}

export function getCustomers() {
    return customers
}

export async function loadCustomers() {
    setLoadingState(true)

    try {
        const response = await sendRequest("/customers")
        if (response.error) {
            throw new Error(getResponseError(response, "Unable to load customers"))
        }

        customers = Array.isArray(response.data) ? response.data : []
        renderCustomers()
        notifyCustomersUpdated()
    } catch (error) {
        if (customerRows) {
            customerRows.innerHTML = emptyRow(getErrorMessage(error), 4)
        }
        if (customerSummary) {
            customerSummary.textContent = "Customer records are unavailable."
        }
        if (customerCount) {
            customerCount.textContent = "—"
        }
    } finally {
        setLoadingState(false)
    }
}

async function handleCustomerFormSubmit(event) {
    event.preventDefault()
    const submitButton = customerForm.querySelector("button[type='submit']")
    submitButton.disabled = true
    setStatus(customerFormStatus, "Creating customer...")

    const payload = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim()
    }

    try {
        const response = await sendRequest("/customers", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })

        if (response.error) {
            throw new Error(getResponseError(response, "Unable to create customer"))
        }

        customerForm.reset()
        setStatus(customerFormStatus, "Customer created successfully.", "success")
        await loadCustomers()
    } catch (error) {
        setStatus(customerFormStatus, getErrorMessage(error), "error")
    } finally {
        submitButton.disabled = false
    }
}

function renderCustomers() {
    if (customerCount) {
        customerCount.textContent = customers.length
    }
    if (customerSummary) {
        customerSummary.textContent = `${customers.length} customer${customers.length === 1 ? "" : "s"} in the directory.`
    }

    if (!customerRows) {
        return
    }

    if (!customers.length) {
        customerRows.innerHTML = emptyRow("No customers have been created yet.", 4)
        return
    }

    customerRows.replaceChildren(...customers.map(customer => {
        const row = document.createElement("tr")
        row.append(
            createCell(`#${customer.id}`, "muted-cell"),
            createCell(customer.name, "customer-name"),
            createCell(customer.email, "muted-cell"),
            createDeleteCell(customer)
        )
        return row
    }))
}

function createCell(value, className) {
    const cell = document.createElement("td")
    cell.textContent = value ?? "—"
    cell.className = className
    return cell
}

function createDeleteCell(customer) {
    const cell = document.createElement("td")
    cell.className = "action-cell"

    const button = document.createElement("button")
    button.className = "delete-customer-button"
    button.type = "button"
    button.textContent = "×"
    button.ariaLabel = `Delete ${customer.name || "customer"}`
    button.addEventListener("click", () => handleCustomerDelete(customer))

    cell.append(button)
    return cell
}

async function handleCustomerDelete(customer) {
    if (!customer?.id || deletingCustomerId) {
        return
    }

    const customerLabel = customer.name || customer.email || `customer #${customer.id}`
    if (!window.confirm(`Delete ${customerLabel}?`)) return

    deletingCustomerId = customer.id
    renderCustomers()
    setStatus(customerFormStatus, `Deleting ${customerLabel}...`)

    try {
        const response = await sendRequest(`/customers/${customer.id}`, {
            method: "DELETE"
        })

        if (response.error) {
            throw new Error(getResponseError(response, "Unable to delete customer"))
        }

        setStatus(customerFormStatus, "Customer deleted successfully.", "success")
        deletingCustomerId = null
        await loadCustomers()
    } catch (error) {
        setStatus(customerFormStatus, getErrorMessage(error), "error")
    } finally {
        if (deletingCustomerId !== null) {
            deletingCustomerId = null
            renderCustomers()
        }
    }
}

function emptyRow(message, colspan) {
    return `<tr><td class="empty-state" colspan="${colspan}">${message}</td></tr>`
}

function notifyCustomersUpdated() {
    document.dispatchEvent(new CustomEvent("billing:customers-updated", {
        detail: customers
    }))
}

function setLoadingState(isLoading) {
    if (!allCustomersButton) {
        return
    }

    allCustomersButton.disabled = isLoading
    allCustomersButton.textContent = isLoading ? "Loading..." : "Refresh customers"
}
