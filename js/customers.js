import {sendRequest, throwResponseError} from "./api.js"
import {escapeHtml, getErrorMessage, setStatus} from "./result.js"

const customerForm = document.getElementById("customerForm")
const allCustomersButton = document.getElementById("allCustomersButton")
const customerRows = document.getElementById("customerRows")
const customerSummary = document.getElementById("customerSummary")
const customerCount = document.getElementById("customerCount")
const customerFormStatus = document.getElementById("customerFormStatus")
const deleteCustomerDialog = document.getElementById("deleteCustomerDialog")
const deleteCustomerName = document.getElementById("deleteCustomerName")
const cancelDeleteCustomerButton = document.getElementById("cancelDeleteCustomerButton")
const confirmDeleteCustomerButton = document.getElementById("confirmDeleteCustomerButton")
const deleteCustomerStatus = document.getElementById("deleteCustomerStatus")

let customers = []
let deletingCustomerId = null
let customerPendingDeletion = null
let previouslyFocusedElement = null

export function initialiseCustomers() {
    if (!customerForm && !allCustomersButton && !customerRows && !customerCount) {
        return null
    }

    customerForm?.addEventListener("submit", handleCustomerFormSubmit)
    allCustomersButton?.addEventListener("click", loadCustomers)
    cancelDeleteCustomerButton?.addEventListener("click", closeCustomerDeleteDialog)
    confirmDeleteCustomerButton?.addEventListener("click", confirmCustomerDelete)
    deleteCustomerDialog?.addEventListener("click", handleDeleteDialogBackdropClick)
    document.addEventListener("keydown", handleDeleteDialogKeydown)
    return loadCustomers()
}

export function getCustomers() {
    return customers
}

export async function loadCustomers() {
    setLoadingState(true)

    try {
        const response = await sendRequest("/customers")
        throwResponseError(response)

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

        throwResponseError(response)

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

    const canDeleteCustomer = wasCustomerCreatedToday(customer)
    const button = document.createElement("button")
    button.className = "danger-action-button"
    button.type = "button"
    button.textContent = "×"
    button.ariaLabel = canDeleteCustomer
        ? `Delete ${customer.name || "customer"}`
        : `${customer.name || "Customer"} cannot be deleted because they were not created today`
    button.title = canDeleteCustomer ? "Delete customer" : "Only customers created today can be deleted"
    button.disabled = deletingCustomerId === customer.id || !canDeleteCustomer
    button.classList.toggle("inactive-action-button", !canDeleteCustomer)
    button.addEventListener("click", () => openCustomerDeleteDialog(customer))

    cell.append(button)
    return cell
}

function openCustomerDeleteDialog(customer) {
    if (!deleteCustomerDialog || !customer?.id || deletingCustomerId || !wasCustomerCreatedToday(customer)) {
        return
    }

    customerPendingDeletion = customer
    previouslyFocusedElement = document.activeElement

    if (deleteCustomerName) {
        deleteCustomerName.textContent = getCustomerLabel(customer)
    }

    setStatus(deleteCustomerStatus, "")
    deleteCustomerDialog.hidden = false
    document.body.classList.add("modal-open")
    confirmDeleteCustomerButton?.focus()
}

function closeCustomerDeleteDialog() {
    if (!deleteCustomerDialog || deletingCustomerId) {
        return
    }

    deleteCustomerDialog.hidden = true
    document.body.classList.remove("modal-open")
    customerPendingDeletion = null
    setStatus(deleteCustomerStatus, "")

    if (previouslyFocusedElement instanceof HTMLElement) {
        previouslyFocusedElement.focus()
    }

    previouslyFocusedElement = null
}

function handleDeleteDialogBackdropClick(event) {
    if (event.target === deleteCustomerDialog) {
        closeCustomerDeleteDialog()
    }
}

function handleDeleteDialogKeydown(event) {
    if (event.key === "Escape" && !deleteCustomerDialog?.hidden) {
        closeCustomerDeleteDialog()
    }
}

function confirmCustomerDelete() {
    return handleCustomerDelete(customerPendingDeletion)
}

async function handleCustomerDelete(customer) {
    if (!customer?.id || deletingCustomerId || !wasCustomerCreatedToday(customer)) {
        return
    }

    const customerLabel = getCustomerLabel(customer)
    deletingCustomerId = customer.id
    renderCustomers()
    setDeleteDialogLoading(true)
    setStatus(deleteCustomerStatus, `Deleting ${customerLabel}...`)

    try {
        const response = await sendRequest(`/customers/${customer.id}`, {
            method: "DELETE"
        })

        throwResponseError(response)

        setStatus(deleteCustomerStatus, "Customer deleted successfully.", "success")
        deletingCustomerId = null
        closeCustomerDeleteDialog()
        await loadCustomers()
    } catch (error) {
        setStatus(deleteCustomerStatus, getErrorMessage(error), "error")
    } finally {
        if (deletingCustomerId !== null) {
            deletingCustomerId = null
            renderCustomers()
        }
        setDeleteDialogLoading(false)
    }
}

function getCustomerLabel(customer) {
    return customer.name || customer.email || `customer #${customer.id}`
}

function wasCustomerCreatedToday(customer) {
    const createdAt = customer.createdAt || customer.created_at || customer.createdDate || customer.created

    if (!createdAt) {
        return false
    }

    const createdDate = parseCustomerCreatedDate(createdAt)

    if (Number.isNaN(createdDate.getTime())) {
        return false
    }

    const today = new Date()
    return createdDate.getFullYear() === today.getFullYear()
        && createdDate.getMonth() === today.getMonth()
        && createdDate.getDate() === today.getDate()
}

function parseCustomerCreatedDate(createdAt) {
    if (typeof createdAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(createdAt)) {
        const [year, month, day] = createdAt.split("-").map(Number)
        return new Date(year, month - 1, day)
    }

    return new Date(createdAt)
}

function setDeleteDialogLoading(isLoading) {
    if (confirmDeleteCustomerButton) {
        confirmDeleteCustomerButton.disabled = isLoading
        confirmDeleteCustomerButton.textContent = isLoading ? "Deleting..." : "Delete customer"
    }

    if (cancelDeleteCustomerButton) {
        cancelDeleteCustomerButton.disabled = isLoading
    }
}

function emptyRow(message, colspan) {
    return `<tr><td class="empty-state" colspan="${colspan}">${escapeHtml(message)}</td></tr>`
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
