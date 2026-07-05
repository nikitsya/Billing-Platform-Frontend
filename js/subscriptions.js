import {getResponseError, sendRequest} from "./api.js"
import {getCustomers, loadCustomers} from "./customers.js"
import {getPrices, loadPrices} from "./price.js"
import {getErrorMessage, setStatus} from "./result.js"

const subscriptionForm = document.getElementById("subscriptionForm")
const customerSelect = document.getElementById("subscriptionCustomer")
const priceSelect = document.getElementById("subscriptionPrice")
const refreshButton = document.getElementById("allSubscriptionsButton")
const subscriptionRows = document.getElementById("subscriptionRows")
const subscriptionSummary = document.getElementById("subscriptionSummary")
const subscriptionCount = document.getElementById("subscriptionCount")
const subscriptionFormStatus = document.getElementById("subscriptionFormStatus")
const deleteSubscriptionDialog = document.getElementById("deleteSubscriptionDialog")
const deleteSubscriptionName = document.getElementById("deleteSubscriptionName")
const cancelDeleteSubscriptionButton = document.getElementById("cancelDeleteSubscriptionButton")
const confirmDeleteSubscriptionButton = document.getElementById("confirmDeleteSubscriptionButton")

let subscriptions = []
let deletingSubscriptionId = null
let subscriptionPendingDeletion = null
let previouslyFocusedElement = null

export function initialiseSubscriptions() {
    if (!subscriptionForm && !refreshButton && !subscriptionRows && !subscriptionCount) {
        return null
    }

    subscriptionForm?.addEventListener("submit", handleSubscriptionSubmit)
    refreshButton?.addEventListener("click", loadSubscriptions)
    document.addEventListener("billing:customers-updated", event => populateCustomerOptions(event.detail))
    document.addEventListener("billing:prices-updated", event => populatePriceOptions(event.detail))
    cancelDeleteSubscriptionButton?.addEventListener("click", closeSubscriptionDeleteDialog)
    confirmDeleteSubscriptionButton?.addEventListener("click", confirmSubscriptionDelete)
    deleteSubscriptionDialog?.addEventListener("click", handleDeleteDialogBackdropClick)
    document.addEventListener("keydown", handleDeleteDialogKeydown)

    populateCustomerOptions(getCustomers())
    populatePriceOptions(getPrices())
    loadSubscriptionFormOptions()
    return loadSubscriptions()
}

async function loadSubscriptionFormOptions() {
    const requests = []

    if (customerSelect && !getCustomers().length) {
        requests.push(loadCustomers())
    }

    if (priceSelect && !getPrices().length) {
        requests.push(loadPrices())
    }

    try {
        await Promise.all(requests)
    } catch (error) {
        setStatus(subscriptionFormStatus, getErrorMessage(error), "error")
    }
}

async function loadSubscriptions() {
    setLoadingState(true)

    try {
        const response = await sendRequest("/subscriptions")
        if (response.error) {
            throw new Error(getResponseError(response, "Unable to load subscriptions"))
        }

        subscriptions = Array.isArray(response.data) ? response.data : []
        renderSubscriptions()
        populateCustomerOptions(getCustomers())
    } catch (error) {
        if (subscriptionCount) {
            subscriptionCount.textContent = "—"
        }
        if (subscriptionSummary) {
            subscriptionSummary.textContent = "The subscriptions endpoint is not available yet."
        }
        if (subscriptionRows) {
            subscriptionRows.innerHTML = emptyRow(getErrorMessage(error), 5)
        }
    } finally {
        setLoadingState(false)
    }
}

async function handleSubscriptionSubmit(event) {
    event.preventDefault()
    const submitButton = subscriptionForm.querySelector("button[type='submit']")
    submitButton.disabled = true
    setStatus(subscriptionFormStatus, "Creating subscription...")

    const payload = {
        customerId: Number(customerSelect.value),
        priceId: Number(priceSelect.value)
    }

    try {
        const response = await sendRequest("/subscriptions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })

        if (response.error) {
            throw new Error(getResponseError(response, "Unable to create subscription"))
        }

        subscriptionForm.reset()
        setStatus(subscriptionFormStatus, "Subscription created successfully.", "success")
        await loadSubscriptions()
    } catch (error) {
        setStatus(subscriptionFormStatus, getErrorMessage(error), "error")
    } finally {
        submitButton.disabled = false
    }
}

function populateCustomerOptions(customers) {
    if (!customerSelect) {
        return
    }

    const currentValue = customerSelect.value
    customerSelect.replaceChildren(createOption("", "Select customer"))

    const availableCustomers = customers.filter(customer => !hasSubscription(customer))

    availableCustomers.forEach(customer => {
        customerSelect.append(createOption(customer.id, `${customer.name} · ${customer.email}`))
    })

    if (availableCustomers.some(customer => String(customer.id) === currentValue)) {
        customerSelect.value = currentValue
    }
}

function populatePriceOptions(prices) {
    if (!priceSelect) {
        return
    }

    const currentValue = priceSelect.value
    priceSelect.replaceChildren(createOption("", "Select plan"))

    prices
        .filter(price => price.billingInterval.toLowerCase() !== "one_time")
        .sort(comparePrices)
        .forEach(price => {
            const productName = price.product?.name || "Plan"
            const billingInterval = price.billingInterval?.toLowerCase() || "billing period"
            const amount = formatMoney(price.unitAmountCents, price.currency)
            priceSelect.append(createOption(price.id, `${productName} · ${amount} / ${billingInterval}`))
        })

    priceSelect.value = currentValue
}

function renderSubscriptions() {
    if (subscriptionCount) {
        subscriptionCount.textContent = subscriptions.length
    }
    if (subscriptionSummary) {
        subscriptionSummary.textContent = `${subscriptions.length} subscription${subscriptions.length === 1 ? "" : "s"} recorded.`
    }

    if (!subscriptionRows) {
        return
    }

    if (!subscriptions.length) {
        subscriptionRows.innerHTML = emptyRow("No subscriptions have been created yet.", 5)
        return
    }

    subscriptionRows.replaceChildren(...subscriptions.map(subscription => {
        const customer = subscription.customer || findCustomer(subscription.customerId)
        const price = subscription.price || findPrice(subscription.priceId)
        const row = document.createElement("tr")

        row.append(
            createCell(customer?.name || customer?.email || `Customer #${subscription.customerId ?? "—"}`, "customer-name"),
            createCell(price?.product?.name || subscription.product?.name || "—"),
            createCell(price?.billingInterval || subscription.billingInterval || "—", "muted-cell"),
            createStatusCell(subscription.status),
            createDeleteCell(subscription)
        )

        return row
    }))
}

function findCustomer(customerId) {
    return getCustomers().find(customer => customer.id === customerId)
}

function createDeleteCell(subscription) {
    const cell = document.createElement("td")
    cell.className = "action-cell"

    const button = document.createElement("button")
    button.className = "delete-customer-button"
    button.type = "button"
    button.textContent = "×"
    button.ariaLabel = `Delete ${getSubscriptionLabel(subscription)}`
    button.disabled = deletingSubscriptionId === subscription.id
    button.addEventListener("click", () => openSubscriptionDeleteDialog(subscription))

    cell.append(button)
    return cell
}

function openSubscriptionDeleteDialog(subscription) {
    if (!deleteSubscriptionDialog || !subscription?.id || deletingSubscriptionId) {
        return
    }

    subscriptionPendingDeletion = subscription
    previouslyFocusedElement = document.activeElement

    if (deleteSubscriptionName) {
        deleteSubscriptionName.textContent = getSubscriptionLabel(subscription)
    }

    deleteSubscriptionDialog.hidden = false
    document.body.classList.add("modal-open")
    confirmDeleteSubscriptionButton?.focus()
}

function closeSubscriptionDeleteDialog() {
    if (!deleteSubscriptionDialog || deletingSubscriptionId) {
        return
    }

    deleteSubscriptionDialog.hidden = true
    document.body.classList.remove("modal-open")
    subscriptionPendingDeletion = null

    if (previouslyFocusedElement instanceof HTMLElement) {
        previouslyFocusedElement.focus()
    }

    previouslyFocusedElement = null
}

function handleDeleteDialogBackdropClick(event) {
    if (event.target === deleteSubscriptionDialog) {
        closeSubscriptionDeleteDialog()
    }
}

function handleDeleteDialogKeydown(event) {
    if (event.key === "Escape" && !deleteSubscriptionDialog?.hidden) {
        closeSubscriptionDeleteDialog()
    }
}

function confirmSubscriptionDelete() {
    return handleSubscriptionDelete(subscriptionPendingDeletion)
}

async function handleSubscriptionDelete(subscription) {
    if (!subscription?.id || deletingSubscriptionId) {
        return
    }

    const subscriptionLabel = getSubscriptionLabel(subscription)
    deletingSubscriptionId = subscription.id
    renderSubscriptions()
    setDeleteDialogLoading(true)
    setStatus(subscriptionFormStatus, `Deleting ${subscriptionLabel}...`)

    try {
        const response = await sendRequest(`/subscriptions/${subscription.id}`, {
            method: "DELETE"
        })

        if (response.error) {
            throw new Error(getResponseError(response, "Unable to delete subscription"))
        }

        setStatus(subscriptionFormStatus, "Subscription deleted successfully.", "success")
        deletingSubscriptionId = null
        closeSubscriptionDeleteDialog()
        await loadSubscriptions()
    } catch (error) {
        setStatus(subscriptionFormStatus, getErrorMessage(error), "error")
    } finally {
        if (deletingSubscriptionId !== null) {
            deletingSubscriptionId = null
            renderSubscriptions()
        }
        setDeleteDialogLoading(false)
    }
}

function getSubscriptionLabel(subscription) {
    const customer = subscription.customer || findCustomer(subscription.customerId)
    const price = subscription.price || findPrice(subscription.priceId)
    const customerLabel = customer?.name || customer?.email || `subscription #${subscription.id}`
    const planLabel = price?.product?.name || subscription.product?.name
    return planLabel ? `${customerLabel} · ${planLabel}` : customerLabel
}

function setDeleteDialogLoading(isLoading) {
    if (confirmDeleteSubscriptionButton) {
        confirmDeleteSubscriptionButton.disabled = isLoading
        confirmDeleteSubscriptionButton.textContent = isLoading ? "Deleting..." : "Delete subscription"
    }

    if (cancelDeleteSubscriptionButton) {
        cancelDeleteSubscriptionButton.disabled = isLoading
    }
}

function hasSubscription(customer) {
    return subscriptions.some(subscription => getSubscriptionCustomerId(subscription) === Number(customer.id))
}

function getSubscriptionCustomerId(subscription) {
    return Number(subscription.customer?.id ?? subscription.customerId)
}

function findPrice(priceId) {
    return getPrices().find(price => price.id === priceId)
}

function createOption(value, label) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = label
    return option
}

function createCell(value, className = "") {
    const cell = document.createElement("td")
    cell.textContent = value
    cell.className = className
    return cell
}

function createStatusCell(status = "INCOMPLETE") {
    const cell = document.createElement("td")
    const badge = document.createElement("span")
    const normalisedStatus = status.toLowerCase().replaceAll("_", "-")
    badge.className = `status-badge ${normalisedStatus}`
    badge.textContent = status.replaceAll("_", " ")
    cell.append(badge)
    return cell
}

function comparePrices(firstPrice, secondPrice) {
    const firstName = firstPrice.product?.name || ""
    const secondName = secondPrice.product?.name || ""
    return firstName.localeCompare(secondName) || firstPrice.unitAmountCents - secondPrice.unitAmountCents
}

function formatMoney(amountInCents, currency = "EUR") {
    return new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency
    }).format((amountInCents || 0) / 100)
}

function emptyRow(message, colspan) {
    return `<tr><td class="empty-state" colspan="${colspan}">${message}</td></tr>`
}

function setLoadingState(isLoading) {
    if (!refreshButton) {
        return
    }

    refreshButton.disabled = isLoading
    refreshButton.textContent = isLoading ? "Loading..." : "Refresh subscriptions"
}
