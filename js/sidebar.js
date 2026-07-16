const navItems = [
    {
        id: "overview",
        number: "01",
        label: "Overview",
        href: "../overview/"
    },
    {
        id: "customers",
        number: "02",
        label: "Customers",
        href: "../customers/"
    },
    {
        id: "products-and-prices",
        number: "03",
        label: "Products & Prices",
        href: "../products-and-prices/"
    },
    {
        id: "subscriptions",
        number: "04",
        label: "Subscriptions",
        href: "../subscriptions/"
    },
    {
        id: "payments",
        number: "05",
        label: "Payments",
        href: "../payments/"
    }
]

export function initialiseSidebar() {
    const sidebar = document.querySelector(".sidebar[data-active-page]")

    if (!sidebar) {
        return
    }

    const activePage = sidebar.dataset.activePage
    sidebar.replaceChildren(createBrand(), createNavigation(activePage), createHealthCheck())
}

function createBrand() {
    const brand = document.createElement("a")
    brand.ariaLabel = "Billing Platform dashboard"
    brand.className = "brand"
    brand.href = "../overview/"

    const mark = document.createElement("span")
    mark.className = "brand-mark"
    mark.textContent = "BP"

    const label = document.createElement("span")
    label.append("Billing", document.createElement("br"), "Platform")

    brand.append(mark, label)
    return brand
}

function createNavigation(activePage) {
    const navigation = document.createElement("nav")
    navigation.ariaLabel = "Dashboard pages"

    navItems.forEach(item => {
        const link = document.createElement("a")
        link.className = `nav-link${item.id === activePage ? " is-active" : ""}`
        link.href = item.href

        const number = document.createElement("span")
        number.setAttribute("aria-hidden", "true")
        number.textContent = item.number

        link.append(number, item.label)
        navigation.append(link)
    })

    return navigation
}

function createHealthCheck() {
    const button = document.createElement("button")
    button.className = "health-check"
    button.id = "pingButton"
    button.type = "button"

    const dot = document.createElement("span")
    dot.setAttribute("aria-hidden", "true")
    dot.className = "health-dot"

    const content = document.createElement("span")
    const title = document.createElement("strong")
    title.textContent = "API status"
    const status = document.createElement("small")
    status.id = "apiStatus"
    status.textContent = "Check connection"

    content.append(title, status)
    button.append(dot, content)
    return button
}
