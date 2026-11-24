import test from "node:test"
import assert from "node:assert/strict"
import {buildChatMessages} from "../js/project-chat.js"

test("keeps recent complete exchanges and the current question", () => {
    const history = Array.from({length: 12}, (_, index) => ({
        role: index % 2 === 0 ? "user" : "assistant",
        content: String(index)
    }))
    const messages = buildChatMessages(history, "What about testing?")
    assert.equal(messages.length, 9)
    assert.deepEqual(messages.slice(0, -1), history.slice(4))
    assert.deepEqual(messages.at(-1), {role: "user", content: "What about testing?"})
    assert.equal(history.length, 12)
})

test("drops older exchanges before exceeding the server character budget", () => {
    const history = [
        {role: "user", content: "a".repeat(2000)},
        {role: "assistant", content: "b".repeat(6000)},
        {role: "user", content: "c".repeat(2000)},
        {role: "assistant", content: "d".repeat(6000)}
    ]
    const messages = buildChatMessages(history, "e".repeat(2000))
    assert.equal(messages.length, 3)
    assert.equal(messages[0].content, history[2].content)
    assert.equal(messages.reduce((sum, message) => sum + message.content.length, 0), 10000)
})

test("omits oversized replies from context without losing the new question", () => {
    const history = [{role: "user", content: "Tour"}, {role: "assistant", content: "x".repeat(8001)}]
    assert.deepEqual(buildChatMessages(history, "Architecture?"), [{role: "user", content: "Architecture?"}])
})
