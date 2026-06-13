const customerEndpoint = "https://billing-platform-api.onrender.com/api/v1/customers";
const pingEndpoint = "https://billing-platform-api.onrender.com/api/v1/ping";

const customer_form = document.getElementById("customerForm");
const pingButton = document.getElementById("pingButton");
const allCustomers = document.getElementById("allCustomersButton");

const result = document.getElementById("result");

function showBackendStartingMessage() {
    result.textContent = "Starting backend... this may take up to 60 seconds on the first request.";
}

async function createCustomer(payload) {
    const response = await fetch(customerEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const body = await response.text();

    return {
        url: response.url,
        status: response.status,
        body: body,
        error: !response.ok
    };
}

customer_form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showBackendStartingMessage();

    const payload = {
        name: document.getElementById("name").value,
        email: document.getElementById("email").value
    };

    try {
        const response = await createCustomer(payload);

        if (response.error) {
            result.textContent =
                `Request failed via ${response.url}\nStatus: ${response.status}\nBody: ${response.body}`;
            return;
        }

        result.textContent =
            `URL: ${response.url}\nStatus: ${response.status}\nBody: ${response.body}`;
    } catch (err) {
        result.textContent = `Request failed: ${err}`;
    }
});

async function checkPing() {
    showBackendStartingMessage();

    try {
        const response = await fetch(pingEndpoint);
        const body = await response.text();

        if (!response.ok) {
            result.textContent =
                `Request failed via ${response.url}\nStatus: ${response.status}\nBody: ${body}`;
            return;
        }

        result.textContent =
            `URL: ${response.url}\nStatus: ${response.status}\nBody: ${body}`;
    } catch (err) {
        result.textContent = `Request failed: ${err}`;
    }
}

pingButton.addEventListener("click", checkPing);

async function getAllCustomers() {
    showBackendStartingMessage();

    try {
        const response = await fetch(customerEndpoint);
        const body = await response.text();

        if (!response.ok) {
            result.textContent =
                `Request failed via ${response.url}\nStatus: ${response.status}\nBody: ${body}`;
            return;
        }

        result.textContent =
            `URL: ${response.url}\nStatus: ${response.status}\nBody: ${body}`;
    } catch (err) {
        result.textContent = `Request failed: ${err}`;
    }
}

allCustomers.addEventListener("click", getAllCustomers);
