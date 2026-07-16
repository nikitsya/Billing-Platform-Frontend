import {sendRequest, throwResponseError} from "./api.js"
import {getCustomers, loadCustomers} from "./customers.js"
import {getPrices, loadPrices} from "./price.js"
import {getProducts, loadProducts} from "./product.js"
import {escapeHtml, getErrorMessage, setStatus} from "./result.js"

const paymentForm = document.getElementById("paymentForm")
const customerSelect = document.getElementById("paymentCustomer")
const priceSelect = document.getElementById("paymentPrice")
const amountInput = document.getElementById("paymentAmount")
const currencySelect = document.getElementById("paymentCurrency")
const refreshButton = document.getElementById("allPaymentsButton")
const paymentRows = document.getElementById("paymentRows")
const paymentSummary = document.getElementById("paymentSummary")
const paymentFormStatus = document.getElementById("paymentFormStatus")

let paymentIntents = []
let confirmingPaymentId = null

export function initialisePayments() {
    if (!paymentForm && !refreshButton && !paymentRows) return null

    paymentForm?.addEventListener("submit", handlePaymentSubmit)
    refreshButton?.addEventListener("click", loadPaymentIntents)
    priceSelect?.addEventListener("change", handlePriceSelection)
    document.addEventListener("billing:customers-updated", handleCustomersUpdated)
    document.addEventListener("billing:prices-updated", event => populatePriceOptions(event.detail))
    document.addEventListener("billing:products-updated", () => populatePriceOptions(getPrices()))

    populateCustomerOptions(getCustomers())
    populatePriceOptions(getPrices())
    loadPaymentFormOptions()
    return loadPaymentIntents()
}

async function loadPaymentFormOptions() {
    const requests = []

    if (customerSelect && !getCustomers().length) requests.push(loadCustomers())
    if (priceSelect && !getPrices().length) requests.push(loadPrices())

    try {
        await Promise.all(requests)
        if (!getProducts().length) await loadProducts()
        populatePriceOptions(getPrices())
    } catch (error) {
        setStatus(paymentFormStatus, getErrorMessage(error), "error")
    }
}

async function loadPaymentIntents() {
    setLoadingState(true)

    try {
        const response = await sendRequest("/payment_intents")
        throwResponseError(response)

        paymentIntents = Array.isArray(response.data) ? response.data : []
        renderPaymentIntents()
    } catch (error) {
        if (paymentSummary) paymentSummary.textContent = "The payment intents endpoint is not available yet."
        if (paymentRows) paymentRows.innerHTML = emptyRow(getErrorMessage(error), 6)
    } finally {
        setLoadingState(false)
    }
}

async function handlePaymentSubmit(event) {
    event.preventDefault()
    const submitButton = paymentForm.querySelector("button[type='submit']")
    submitButton.disabled = true
    setStatus(paymentFormStatus, "Creating payment...")

    const selectedPrice = findPrice(Number(priceSelect.value))
    const payload = selectedPrice ? createPricePayload(selectedPrice) : createManualPayload()
    payload.customerId = Number(customerSelect.value)

    try {
        const response = await sendRequest("/payment_intents", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })

        throwResponseError(response)

        paymentForm.reset()
        handlePriceSelection()
        setStatus(paymentFormStatus, "Payment created successfully.", "success")
        await loadPaymentIntents()
    } catch (error) {
        setStatus(paymentFormStatus, getErrorMessage(error), "error")
    } finally {
        submitButton.disabled = false
    }
}

function createManualPayload() {
    return {
        amount: parseAmountToCents(amountInput.value),
        currency: currencySelect.value,
        description: "Manual one-off payment"
    }
}

function createPricePayload(price) {
    return {
        amount: getPriceUnitAmountCents(price),
        currency: price.currency,
        description: `${getPriceProductName(price) || "One-time price"} payment`,
        metadata: {
            priceId: price.id
        }
    }
}

function handlePriceSelection() {
    const selectedPrice = findPrice(Number(priceSelect?.value))
    const hasSelectedPrice = Boolean(selectedPrice)

    if (amountInput) {
        amountInput.disabled = hasSelectedPrice
        amountInput.required = !hasSelectedPrice
        amountInput.value = hasSelectedPrice ? formatDecimalAmount(getPriceUnitAmountCents(selectedPrice)) : amountInput.value
    }

    if (currencySelect) {
        currencySelect.disabled = hasSelectedPrice
        if (hasSelectedPrice) currencySelect.value = String(selectedPrice.currency || "EUR").toUpperCase()
    }
}

function populateCustomerOptions(customers) {
    if (!customerSelect) return

    const currentValue = customerSelect.value
    customerSelect.replaceChildren(createOption("", "Select customer"))

    customers.forEach(customer => {
        customerSelect.append(createOption(customer.id, `${customer.name} · ${customer.email}`))
    })

    if (customers.some(customer => String(customer.id) === currentValue)) customerSelect.value = currentValue
}

function handleCustomersUpdated(event) {
    populateCustomerOptions(event.detail)
    renderPaymentIntents()
}

function populatePriceOptions(prices) {
    if (!priceSelect) return

    const currentValue = priceSelect.value
    priceSelect.replaceChildren(createOption("", "Manual amount"))

    const oneTimePrices = prices.filter(price => getPriceBillingInterval(price).toUpperCase() === "ONE_TIME")

    oneTimePrices
        .sort(comparePrices)
        .forEach(price => {
            const productName = getPriceProductName(price)
            const amount = formatMoney(getPriceUnitAmountCents(price), price.currency)
            priceSelect.append(createOption(price.id, `${productName} · ${amount}`))
        })

    priceSelect.value = oneTimePrices.some(price => String(price.id) === currentValue) ? currentValue : ""
    handlePriceSelection()
}

function renderPaymentIntents() {
    if (paymentSummary) {
        paymentSummary.textContent = `${paymentIntents.length} payment intent${paymentIntents.length === 1 ? "" : "s"} recorded.`
    }

    if (!paymentRows) return

    if (!paymentIntents.length) {
        paymentRows.innerHTML = emptyRow("No payment intents have been created yet.", 6)
        return
    }

    paymentRows.replaceChildren(...paymentIntents.map(paymentIntent => {
        const customer = findCustomer(getPaymentCustomerId(paymentIntent))
        const row = document.createElement("tr")

        row.append(
            createCell(`#${paymentIntent.id}`, "muted-cell"),
            createCell(customer?.name || customer?.email || `Customer #${getPaymentCustomerId(paymentIntent) || "-"}`, "customer-name"),
            createCell(formatMoney(getPaymentAmount(paymentIntent), paymentIntent.currency)),
            createStatusCell(paymentIntent.status),
            createCell(formatDate(paymentIntent.createdAt), "muted-cell"),
            createConfirmCell(paymentIntent)
        )

        return row
    }))
}

function createConfirmCell(paymentIntent) {
    const cell = document.createElement("td")
    cell.className = "action-cell"

    const button = document.createElement("button")
    button.className = "inline-action-button"
    button.type = "button"
    button.textContent = confirmingPaymentId === paymentIntent.id ? "Confirming..." : "Confirm"
    button.disabled = confirmingPaymentId === paymentIntent.id || !canConfirmPayment(paymentIntent)
    button.addEventListener("click", () => confirmPaymentIntent(paymentIntent))

    cell.append(button)
    return cell
}

async function confirmPaymentIntent(paymentIntent) {
    if (!canConfirmPayment(paymentIntent) || confirmingPaymentId) return

    confirmingPaymentId = paymentIntent.id
    renderPaymentIntents()

    try {
        const response = await sendRequest(`/payment_intents/${paymentIntent.id}/confirm`, {
            method: "POST"
        })
        throwResponseError(response)
        await loadPaymentIntents()
        setStatus(paymentFormStatus, "Payment confirmation started.", "success")
    } catch (error) {
        setStatus(paymentFormStatus, getErrorMessage(error), "error")
    } finally {
        confirmingPaymentId = null
        renderPaymentIntents()
    }
}

function canConfirmPayment(paymentIntent) {
    return normalisePaymentStatus(paymentIntent?.status) === "REQUIRES_CONFIRMATION"
}

function findCustomer(customerId) {
    return getCustomers().find(customer => Number(customer.id) === customerId)
}

function findPrice(priceId) {
    return getPrices().find(price => Number(price.id) === priceId)
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

function createStatusCell(status = "REQUIRES_CONFIRMATION") {
    const cell = document.createElement("td")
    const badge = document.createElement("span")
    const displayStatus = normalisePaymentStatus(status)
    const normalisedStatus = displayStatus.toLowerCase().replaceAll("_", "-")
    badge.className = `status-badge ${normalisedStatus}`
    badge.textContent = titleCaseStatus(displayStatus)
    cell.append(badge)
    return cell
}

function normalisePaymentStatus(status = "REQUIRES_CONFIRMATION") {
    const statusValue = String(status || "REQUIRES_CONFIRMATION").toUpperCase()
    return statusValue === "CANCELED" ? "CANCELLED" : statusValue
}

function titleCaseStatus(status) {
    return status
        .toLowerCase()
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
}

function parseAmountToCents(amount) {
    return Math.round(Number(amount || 0) * 100)
}

function formatDecimalAmount(amountInCents) {
    return ((amountInCents || 0) / 100).toFixed(2)
}

function getPaymentAmount(paymentIntent) {
    return paymentIntent.amount ?? paymentIntent.amountCents ?? paymentIntent.unitAmountCents ?? 0
}

function getPaymentCustomerId(paymentIntent) {
    return Number(paymentIntent.customerId)
}

function getPriceBillingInterval(price) {
    return price?.billingInterval || ""
}

function getPriceProductName(price) {
    const product = getProducts().find(item => Number(item.id) === Number(price?.productId))
    return price?.productName || product?.name || (price?.productId ? `Product #${price.productId}` : "")
}

function getPriceUnitAmountCents(price) {
    return price?.unitAmountCents ?? 0
}

function comparePrices(firstPrice, secondPrice) {
    return getPriceProductName(firstPrice).localeCompare(getPriceProductName(secondPrice))
        || getPriceUnitAmountCents(firstPrice) - getPriceUnitAmountCents(secondPrice)
}

function formatMoney(amountInCents, currency = "EUR") {
    return new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: String(currency || "EUR").toUpperCase()
    }).format((amountInCents || 0) / 100)
}

function formatDate(value) {
    if (!value) return "-"

    return new Intl.DateTimeFormat("en-IE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value))
}

function emptyRow(message, colspan) {
    return `<tr><td class="empty-state" colspan="${colspan}">${escapeHtml(message)}</td></tr>`
}

function setLoadingState(isLoading) {
    if (!refreshButton) return

    refreshButton.disabled = isLoading
    refreshButton.textContent = isLoading ? "Loading..." : "Refresh payments"
}
