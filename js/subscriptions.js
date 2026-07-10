import {sendRequest, throwResponseError} from "./api.js"
import {getCustomers, loadCustomers} from "./customers.js"
import {getPrices, loadPrices} from "./price.js"
import {getProducts, loadProducts} from "./product.js"
import {escapeHtml, getErrorMessage, setStatus} from "./result.js"

const subscriptionForm = document.getElementById("subscriptionForm")
const customerSelect = document.getElementById("subscriptionCustomer")
const priceSelect = document.getElementById("subscriptionPrice")
const refreshButton = document.getElementById("allSubscriptionsButton")
const subscriptionRows = document.getElementById("subscriptionRows")
const subscriptionSummary = document.getElementById("subscriptionSummary")
const subscriptionCount = document.getElementById("subscriptionCount")
const subscriptionFormStatus = document.getElementById("subscriptionFormStatus")
const cancelSubscriptionDialog = document.getElementById("cancelSubscriptionDialog")
const cancelSubscriptionName = document.getElementById("cancelSubscriptionName")
const closeCancelSubscriptionButton = document.getElementById("closeCancelSubscriptionButton")
const confirmCancelSubscriptionButton = document.getElementById("confirmCancelSubscriptionButton")
const cancelSubscriptionStatus = document.getElementById("cancelSubscriptionStatus")

let subscriptions = []
let cancellingSubscriptionId = null
let subscriptionPendingCancellation = null
let previouslyFocusedElement = null

export function initialiseSubscriptions() {
    if (!subscriptionForm && !refreshButton && !subscriptionRows && !subscriptionCount) {
        return null
    }

    subscriptionForm?.addEventListener("submit", handleSubscriptionSubmit)
    refreshButton?.addEventListener("click", loadSubscriptions)
    document.addEventListener("billing:customers-updated", event => populateCustomerOptions(event.detail))
    document.addEventListener("billing:prices-updated", event => populatePriceOptions(event.detail))
    document.addEventListener("billing:products-updated", handleProductsUpdated)
    closeCancelSubscriptionButton?.addEventListener("click", closeSubscriptionCancelDialog)
    confirmCancelSubscriptionButton?.addEventListener("click", confirmSubscriptionCancel)
    cancelSubscriptionDialog?.addEventListener("click", handleCancelDialogBackdropClick)
    document.addEventListener("keydown", handleCancelDialogKeydown)

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
        await loadProductNames()
    } catch (error) {
        setStatus(subscriptionFormStatus, getErrorMessage(error), "error")
    }
}

async function loadProductNames() {
    if (getProducts().length) {
        return
    }

    try {
        await loadProducts()
    } catch {
        renderSubscriptions()
    }
}

async function loadSubscriptions() {
    setLoadingState(true)

    try {
        const response = await sendRequest("/subscriptions")
        throwResponseError(response)

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

        throwResponseError(response)

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

    const availableCustomers = customers.filter(customer => !hasActiveSubscription(customer))

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
        .filter(price => getPriceBillingInterval(price).toLowerCase() !== "one_time")
        .sort(comparePrices)
        .forEach(price => {
            const productName = getPriceProductName(price)
            const billingInterval = getPriceBillingInterval(price).toLowerCase()
            const amount = formatMoney(getPriceUnitAmountCents(price), price.currency)
            priceSelect.append(createOption(price.id, `${productName} · ${amount} / ${billingInterval}`))
        })

    priceSelect.value = currentValue
}

function handleProductsUpdated() {
    populatePriceOptions(getPrices())
    renderSubscriptions()
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
        const customer = subscription.customer || findCustomer(getSubscriptionCustomerId(subscription))
        const price = subscription.price || findPrice(getSubscriptionPriceId(subscription))
        const row = document.createElement("tr")

        row.append(
            createCell(customer?.name || customer?.email || `Customer #${getSubscriptionCustomerId(subscription) || "—"}`, "customer-name"),
            createCell(getPriceProductName(price) || subscription.productName || "—"),
            createCell(getPriceBillingInterval(price) || getSubscriptionBillingInterval(subscription) || "—", "muted-cell"),
            createStatusCell(subscription.status),
            createCancelCell(subscription)
        )

        return row
    }))
}

function findCustomer(customerId) {
    return getCustomers().find(customer => customer.id === customerId)
}

function createCancelCell(subscription) {
    const cell = document.createElement("td")
    cell.className = "action-cell"

    const isCancelled = isSubscriptionCancelled(subscription)
    const button = document.createElement("button")
    button.className = "danger-action-button"
    button.type = "button"
    button.textContent = "×"
    button.ariaLabel = isCancelled
        ? `${getSubscriptionLabel(subscription)} is already cancelled`
        : `Cancel ${getSubscriptionLabel(subscription)}`
    button.disabled = cancellingSubscriptionId === subscription.id || isCancelled
    button.classList.toggle("inactive-action-button", isCancelled)
    button.addEventListener("click", () => openSubscriptionCancelDialog(subscription))

    cell.append(button)
    return cell
}

function openSubscriptionCancelDialog(subscription) {
    if (!cancelSubscriptionDialog || !subscription?.id || cancellingSubscriptionId || isSubscriptionCancelled(subscription)) {
        return
    }

    subscriptionPendingCancellation = subscription
    previouslyFocusedElement = document.activeElement

    if (cancelSubscriptionName) {
        cancelSubscriptionName.textContent = getSubscriptionLabel(subscription)
    }

    setStatus(cancelSubscriptionStatus, "")
    cancelSubscriptionDialog.hidden = false
    document.body.classList.add("modal-open")
    confirmCancelSubscriptionButton?.focus()
}

function closeSubscriptionCancelDialog() {
    if (!cancelSubscriptionDialog || cancellingSubscriptionId) {
        return
    }

    cancelSubscriptionDialog.hidden = true
    document.body.classList.remove("modal-open")
    subscriptionPendingCancellation = null
    setStatus(cancelSubscriptionStatus, "")

    if (previouslyFocusedElement instanceof HTMLElement) {
        previouslyFocusedElement.focus()
    }

    previouslyFocusedElement = null
}

function handleCancelDialogBackdropClick(event) {
    if (event.target === cancelSubscriptionDialog) {
        closeSubscriptionCancelDialog()
    }
}

function handleCancelDialogKeydown(event) {
    if (event.key === "Escape" && !cancelSubscriptionDialog?.hidden) {
        closeSubscriptionCancelDialog()
    }
}

function confirmSubscriptionCancel() {
    return handleSubscriptionCancel(subscriptionPendingCancellation)
}

async function handleSubscriptionCancel(subscription) {
    if (!subscription?.id || cancellingSubscriptionId || isSubscriptionCancelled(subscription)) {
        return
    }

    const subscriptionLabel = getSubscriptionLabel(subscription)
    cancellingSubscriptionId = subscription.id
    renderSubscriptions()
    setCancelDialogLoading(true)
    setStatus(cancelSubscriptionStatus, `Cancelling ${subscriptionLabel}...`)

    try {
        const response = await sendRequest(`/subscriptions/${subscription.id}/cancel`, {
            method: "POST"
        })

        throwResponseError(response)

        setStatus(cancelSubscriptionStatus, "Subscription cancelled successfully.", "success")
        cancellingSubscriptionId = null
        closeSubscriptionCancelDialog()
        await loadSubscriptions()
    } catch (error) {
        setStatus(cancelSubscriptionStatus, getErrorMessage(error), "error")
    } finally {
        if (cancellingSubscriptionId !== null) {
            cancellingSubscriptionId = null
            renderSubscriptions()
        }
        setCancelDialogLoading(false)
    }
}

function getSubscriptionLabel(subscription) {
    const customer = subscription.customer || findCustomer(getSubscriptionCustomerId(subscription))
    const price = subscription.price || findPrice(getSubscriptionPriceId(subscription))
    const customerLabel = customer?.name || customer?.email || `subscription #${subscription.id}`
    const planLabel = getPriceProductName(price) || subscription.productName
    return planLabel ? `${customerLabel} · ${planLabel}` : customerLabel
}

function setCancelDialogLoading(isLoading) {
    if (confirmCancelSubscriptionButton) {
        confirmCancelSubscriptionButton.disabled = isLoading
        confirmCancelSubscriptionButton.textContent = isLoading ? "Cancelling..." : "Cancel subscription"
    }

    if (closeCancelSubscriptionButton) {
        closeCancelSubscriptionButton.disabled = isLoading
    }
}

function hasActiveSubscription(customer) {
    return subscriptions.some(subscription => {
        return getSubscriptionCustomerId(subscription) === Number(customer.id) && !isSubscriptionCancelled(subscription)
    })
}

function getSubscriptionCustomerId(subscription) {
    return Number(subscription.customerId)
}

function getSubscriptionPriceId(subscription) {
    return Number(subscription.priceId)
}

function getSubscriptionBillingInterval(subscription) {
    return subscription.billingInterval
}

function findPrice(priceId) {
    return getPrices().find(price => Number(price.id) === Number(priceId))
}

function findProduct(productId) {
    return getProducts().find(product => Number(product.id) === Number(productId))
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
    const displayStatus = normaliseSubscriptionStatus(status)
    const normalisedStatus = displayStatus.toLowerCase().replaceAll("_", "-")
    badge.className = `status-badge ${normalisedStatus}`
    badge.textContent = displayStatus.replaceAll("_", " ")
    cell.append(badge)
    return cell
}

function isSubscriptionCancelled(subscription) {
    return normaliseSubscriptionStatus(subscription?.status) === "CANCELLED"
}

function normaliseSubscriptionStatus(status = "INCOMPLETE") {
    const statusValue = String(status || "INCOMPLETE").toUpperCase()
    return statusValue === "CANCELED" ? "CANCELLED" : statusValue
}

function comparePrices(firstPrice, secondPrice) {
    return getPriceProductId(firstPrice) - getPriceProductId(secondPrice)
        || getIntervalRank(getPriceBillingInterval(firstPrice)) - getIntervalRank(getPriceBillingInterval(secondPrice))
        || getPriceUnitAmountCents(firstPrice) - getPriceUnitAmountCents(secondPrice)
}

function getIntervalRank(interval) {
    const intervalRanks = {
        monthly: 1,
        yearly: 2,
        one_time: 3
    }

    return intervalRanks[String(interval || "").toLowerCase()] || 4
}

function getPriceBillingInterval(price) {
    return price?.billingInterval || ""
}

function getPriceProductId(price) {
    return Number(price?.productId)
}

function getPriceProductName(price) {
    const productId = getPriceProductId(price)
    const product = findProduct(productId)
    return price?.productName || product?.name || (productId ? `Product #${productId}` : "")
}

function getPriceUnitAmountCents(price) {
    return price?.unitAmountCents ?? 0
}

function formatMoney(amountInCents, currency = "EUR") {
    return new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency
    }).format((amountInCents || 0) / 100)
}

function emptyRow(message, colspan) {
    return `<tr><td class="empty-state" colspan="${colspan}">${escapeHtml(message)}</td></tr>`
}

function setLoadingState(isLoading) {
    if (!refreshButton) {
        return
    }

    refreshButton.disabled = isLoading
    refreshButton.textContent = isLoading ? "Loading..." : "Refresh subscriptions"
}
