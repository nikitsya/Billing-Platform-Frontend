import {getResponseError, sendRequest} from "./api.js"
import {getCustomers} from "./customers.js"
import {getPrices} from "./price.js"
import {getErrorMessage, setStatus} from "./result.js"

const subscriptionForm = document.getElementById("subscriptionForm")
const customerSelect = document.getElementById("subscriptionCustomer")
const priceSelect = document.getElementById("subscriptionPrice")
const refreshButton = document.getElementById("allSubscriptionsButton")
const subscriptionRows = document.getElementById("subscriptionRows")
const subscriptionSummary = document.getElementById("subscriptionSummary")
const subscriptionCount = document.getElementById("subscriptionCount")
const subscriptionFormStatus = document.getElementById("subscriptionFormStatus")

let subscriptions = []

export function initialiseSubscriptions() {
    subscriptionForm.addEventListener("submit", handleSubscriptionSubmit)
    refreshButton.addEventListener("click", loadSubscriptions)
    document.addEventListener("billing:customers-updated", event => populateCustomerOptions(event.detail))
    document.addEventListener("billing:prices-updated", event => populatePriceOptions(event.detail))

    populateCustomerOptions(getCustomers())
    populatePriceOptions(getPrices())
    return loadSubscriptions()
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
    } catch (error) {
        subscriptionCount.textContent = "—"
        subscriptionSummary.textContent = "The subscriptions endpoint is not available yet."
        subscriptionRows.innerHTML = emptyRow(getErrorMessage(error), 4)
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
    const currentValue = customerSelect.value
    customerSelect.replaceChildren(createOption("", "Select customer"))

    customers.forEach(customer => {
        customerSelect.append(createOption(customer.id, `${customer.name} · ${customer.email}`))
    })

    customerSelect.value = currentValue
}

function populatePriceOptions(prices) {
    const currentValue = priceSelect.value
    priceSelect.replaceChildren(createOption("", "Select plan"))

    prices
        .filter(price => price.active && price.billingInterval !== "ONE_TIME")
        .sort(comparePrices)
        .forEach(price => {
            const productName = price.product?.name || "Plan"
            const interval = price.billingInterval?.toLowerCase() || "billing period"
            const amount = formatMoney(price.unitAmountCents, price.currency)
            priceSelect.append(createOption(price.id, `${productName} · ${amount} / ${interval}`))
        })

    priceSelect.value = currentValue
}

function renderSubscriptions() {
    subscriptionCount.textContent = subscriptions.length
    subscriptionSummary.textContent = `${subscriptions.length} subscription${subscriptions.length === 1 ? "" : "s"} recorded.`

    if (!subscriptions.length) {
        subscriptionRows.innerHTML = emptyRow("No subscriptions have been created yet.", 4)
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
            createStatusCell(subscription.status)
        )

        return row
    }))
}

function findCustomer(customerId) {
    return getCustomers().find(customer => customer.id === customerId)
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
    refreshButton.disabled = isLoading
    refreshButton.textContent = isLoading ? "Loading..." : "Refresh subscriptions"
}
