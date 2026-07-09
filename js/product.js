import {sendRequest, throwResponseError} from "./api.js"
import {escapeHtml, getErrorMessage} from "./result.js"
import {loadPrices} from "./price.js"

const refreshButton = document.getElementById("allProductsButton")
const hiddenPriceButton = document.getElementById("allPricesButton")
const planList = document.getElementById("planList")
const productCount = document.getElementById("productCount")
const priceCount = document.getElementById("priceCount")

let products = []

export function initialiseProducts() {
    if (!refreshButton && !hiddenPriceButton && !planList && !productCount && !priceCount) {
        return null
    }

    refreshButton?.addEventListener("click", loadCatalogue)
    hiddenPriceButton?.addEventListener("click", loadCatalogue)
    return loadCatalogue()
}

export async function loadCatalogue() {
    setLoadingState(true)

    try {
        const [loadedProducts, prices] = await Promise.all([
            loadProducts(),
            loadPrices()
        ])
        renderCatalogue(loadedProducts, prices)
        if (productCount) {
            productCount.textContent = products.length
        }
        if (priceCount) {
            priceCount.textContent = prices.length
        }
    } catch (error) {
        if (productCount) {
            productCount.textContent = "—"
        }
        if (priceCount) {
            priceCount.textContent = "—"
        }
        if (planList) {
            planList.innerHTML = `<p class="empty-state">${escapeHtml(getErrorMessage(error, "The plan catalogue is unavailable."))}</p>`
        }
    } finally {
        setLoadingState(false)
    }
}

export async function loadProducts() {
    const response = await sendRequest("/products")
    throwResponseError(response)

    products = Array.isArray(response.data) ? response.data : []
    document.dispatchEvent(new CustomEvent("billing:products-updated", {
        detail: products
    }))
    return products
}

export function getProducts() {
    return products
}

function renderCatalogue(products, prices) {
    if (!planList) {
        return
    }

    if (!products.length) {
        planList.innerHTML = '<p class="empty-state">No recurring plans are available.</p>'
        return
    }

    planList.replaceChildren(...products.map((product, index) => {
        const productPrices = prices.filter(price => Number(price.productId) === Number(product.id))
        const article = document.createElement("article")
        article.className = "plan"

        const heading = document.createElement("div")
        const planIndex = document.createElement("span")
        planIndex.className = "plan-index"
        planIndex.textContent = String(index + 1).padStart(2, "0")
        const title = document.createElement("h3")
        title.textContent = product.name
        heading.append(planIndex, title)

        const description = document.createElement("p")
        description.className = "plan-description"
        description.textContent = product.description || "Recurring billing plan."

        const options = document.createElement("div")
        options.className = "price-options"
        options.append(...productPrices.map(createPriceOption))

        article.append(heading, description, options)
        return article
    }))
}

function createPriceOption(price) {
    const option = document.createElement("div")
    const interval = (price.billingInterval || "price").toLowerCase()
    option.className = `price-option ${interval === "yearly" ? "yearly" : ""}`

    const label = document.createElement("span")
    label.textContent = interval.replace("_", " ")

    const amount = document.createElement("strong")
    amount.textContent = formatMoney(price.unitAmountCents, price.currency)

    option.append(label, amount)
    return option
}

function formatMoney(amountInCents, currency = "EUR") {
    return new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency
    }).format((amountInCents || 0) / 100)
}

function setLoadingState(isLoading) {
    if (!refreshButton) {
        return
    }

    refreshButton.disabled = isLoading
    refreshButton.textContent = isLoading ? "Loading..." : "Refresh catalogue"
}
