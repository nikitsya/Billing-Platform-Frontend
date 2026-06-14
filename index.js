import {initialisePing} from "./js/ping.js"
import {initialiseCustomers} from "./js/customers.js"
import {initialiseProducts} from "./js/product.js"
import {initialiseSubscriptions} from "./js/subscriptions.js"

initialisePing()
initialiseCustomers()
initialiseProducts()
initialiseSubscriptions()
initialiseNavigation()

function initialiseNavigation() {
    const navigationLinks = [...document.querySelectorAll(".nav-link")]
    const sections = navigationLinks
        .map(link => document.querySelector(link.getAttribute("href")))
        .filter(Boolean)

    const observer = new IntersectionObserver(entries => {
        const visibleSection = entries
            .filter(entry => entry.isIntersecting)
            .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0]

        if (!visibleSection) {
            return
        }

        navigationLinks.forEach(link => {
            link.classList.toggle("is-active", link.getAttribute("href") === `#${visibleSection.target.id}`)
        })
    }, {
        rootMargin: "-25% 0px -60% 0px",
        threshold: [0, 0.25, 0.5]
    })

    sections.forEach(section => observer.observe(section))
}
