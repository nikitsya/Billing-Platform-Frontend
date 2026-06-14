export function setStatus(element, message, type = "") {
    element.textContent = message
    element.classList.toggle("is-error", type === "error")
    element.classList.toggle("is-success", type === "success")
}

export function getErrorMessage(error, fallbackMessage = "The request could not be completed.") {
    if (error instanceof TypeError) {
        return "The billing API is unavailable. Please try again shortly."
    }

    return error?.message || fallbackMessage
}
