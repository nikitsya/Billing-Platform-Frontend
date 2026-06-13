import {sendRequest} from "./api.js";
import {
    showBackendStartingMessage,
    showRequestError,
    showResponse
} from "./result.js";

const pingButton = document.getElementById("pingButton");

export function initialisePing() {
    pingButton.addEventListener("click", checkPing);
}

async function checkPing() {
    showBackendStartingMessage();

    try {
        const response = await sendRequest("/ping");
        showResponse(response);
    } catch (error) {
        showRequestError(error);
    }
}
