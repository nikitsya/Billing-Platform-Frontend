import {sendRequest} from "./api.js"

const MAX_CONTEXT_CHARACTERS = 12000
const MAX_CONTEXT_MESSAGES = 9

export function buildChatMessages(history, question) {
    const messages = [{role: "user", content: question}]
    let characters = question.length

    for (let index = history.length - 2; index >= 0; index -= 2) {
        const pair = history.slice(index, index + 2)
        const length = pair.reduce((total, message) => total + message.content.length, 0)

        if (characters + length > MAX_CONTEXT_CHARACTERS || messages.length + 2 > MAX_CONTEXT_MESSAGES ||
            pair.some(message => message.content.length > 8000)) {
            break
        }

        messages.unshift(...pair)
        characters += length
    }

    return messages
}

export function initialiseProjectChat() {
    const form = document.getElementById("chatForm")
    if (!form) return

    const question = document.getElementById("chatQuestion")
    const messages = document.getElementById("chatMessages")
    const introduction = document.getElementById("chatIntroduction")
    const status = document.getElementById("chatStatus")
    const error = document.getElementById("chatError")
    const errorMessage = document.getElementById("chatErrorMessage")
    const send = document.getElementById("sendQuestion")
    const reset = document.getElementById("newConversation")
    const retry = document.getElementById("retryQuestion")
    const suggestions = [...document.querySelectorAll(".chat-suggestions button")]
    let history = []
    let failedQuestion = null
    let pending = false

    function appendMessage(role, text, sources = []) {
        const entry = document.createElement("article")
        entry.className = `chat-message chat-message-${role}`
        const label = document.createElement("h3")
        label.textContent = role === "user" ? "You" : "Project assistant"
        const content = document.createElement("p")
        content.textContent = text
        entry.append(label, content)
        if (sources.length) {
            const references = document.createElement("ul")
            references.className = "chat-source-links"
            references.ariaLabel = "Source files read for this answer"
            sources.slice(0, 3).forEach(source => {
                if (!source || typeof source.url !== "string" || typeof source.label !== "string" ||
                    !/^https:\/\/github\.com\/nikitsya\/Billing-Platform-(API|Frontend)\/blob\/[a-f0-9]{40}\/[A-Za-z0-9_./-]+$/.test(source.url)) return
                const item = document.createElement("li")
                const link = document.createElement("a")
                link.href = source.url
                link.textContent = source.label
                link.target = "_blank"
                link.rel = "noopener noreferrer"
                item.append(link)
                references.append(item)
            })
            entry.append(references)
        }
        messages.append(entry)
        messages.scrollTop = messages.scrollHeight
    }

    function setPending(value) {
        pending = value
        send.disabled = value
        question.disabled = value
        reset.disabled = value || !messages.childElementCount
        retry.disabled = value
        suggestions.forEach(button => button.disabled = value)
        form.setAttribute("aria-busy", String(value))
        send.textContent = value ? "Thinking…" : "Send question"
        status.textContent = value ? "Reading the project source… The first reply may take a little longer." : ""
    }

    async function ask(text, isRetry = false) {
        if (pending || !text.trim()) return
        text = text.trim()
        if (text.length > 2000) return

        introduction.hidden = true
        error.hidden = true
        failedQuestion = null
        if (!isRetry) appendMessage("user", text)
        question.value = ""
        setPending(true)
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 120000)

        try {
            const context = buildChatMessages(history, text)
            const response = await sendRequest("/project-assistant/messages", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({messages: context}),
                signal: controller.signal
            })

            if (response.error) {
                const friendlyMessages = {
                    400: "Please shorten your question and try again.",
                    413: "This conversation is too long. Start a new conversation to continue.",
                    429: "The assistant has reached its usage limit. Please try again later.",
                    503: "The assistant is temporarily unavailable. Please try again later."
                }
                throw new Error(friendlyMessages[response.status] || "The assistant could not reply. Please try again.")
            }

            const answer = response.data?.answer
            if (typeof answer !== "string" || !answer.trim()) {
                throw new Error("The assistant returned an empty reply. Please try again.")
            }

            history = [...context, {role: "assistant", content: answer}]
            appendMessage("assistant", answer, Array.isArray(response.data.sources) ? response.data.sources : [])
        } catch (failure) {
            failedQuestion = text
            errorMessage.textContent = controller.signal.aborted
                ? "The reply took too long. Please try again."
                : failure instanceof TypeError
                    ? "Could not connect to the assistant. Check your connection and try again."
                    : failure.message
            error.hidden = false
        } finally {
            clearTimeout(timeout)
            setPending(false)
            question.focus({preventScroll: true})
        }
    }

    form.addEventListener("submit", event => {
        event.preventDefault()
        if (!question.value.trim()) {
            question.setCustomValidity("Please enter a question.")
            question.reportValidity()
            return
        }
        void ask(question.value)
    })
    question.addEventListener("input", () => question.setCustomValidity(""))
    question.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault()
            form.requestSubmit()
        }
    })
    suggestions.forEach(button => button.addEventListener("click", () => void ask(button.textContent)))
    retry.addEventListener("click", () => {
        if (failedQuestion) void ask(failedQuestion, true)
    })
    reset.addEventListener("click", () => {
        history = []
        failedQuestion = null
        messages.replaceChildren()
        introduction.hidden = false
        error.hidden = true
        question.value = ""
        question.setCustomValidity("")
        setPending(false)
        question.focus()
    })
}
