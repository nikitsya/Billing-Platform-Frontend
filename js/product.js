import {getResponseError, sendRequest} from "./api.js"
import {getErrorMessage} from "./result.js"
import {loadPrices} from "./price.js"

const refreshButton = document.getElementById("allProductsButton")
const hiddenPriceButton = document.getElementById("allPricesButton")
const planList = document.getElementById("planList")
const productCount = document.getElementById("productCount")
const priceCount = document.getElementById("priceCount")

let products = []

export function initialiseProducts() {
    refreshButton.addEventListener("click", loadCatalogue)
    hiddenPriceButton.addEventListener("click", loadCatalogue)
    return loadCatalogue()
}

export async function loadCatalogue() {
    setLoadingState(true)

    try {
        const [productResponse, prices] = await Promise.all([
            sendRequest("/products"),
            loadPrices()
        ])

        if (productResponse.error) {
            throw new Error(getResponseError(productResponse, "Unable to load products"))
        }

        products = Array.isArray(productResponse.data) ? productResponse.data : []
        renderCatalogue(products, prices)
        productCount.textContent = products.length
        priceCount.textContent = prices.length
    } catch (error) {
        productCount.textContent = "—"
        priceCount.textContent = "—"
        planList.innerHTML = `<p class="empty-state">${getErrorMessage(error, "The plan catalogue is unavailable.")}</p>`
    } finally {
        setLoadingState(false)
    }
}

function renderCatalogue(products, prices) {
    if (!products.length) {
        planList.innerHTML = '<p class="empty-state">No recurring plans are available.</p>'
        return
    }

    planList.replaceChildren(...products.map((product, index) => {
        const productPrices = prices.filter(price => price.product?.id === product.id)
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
    const interval = price.billingInterval?.toLowerCase() || "price"
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
    refreshButton.disabled = isLoading
    refreshButton.textContent = isLoading ? "Loading..." : "Refresh catalogue"
}
