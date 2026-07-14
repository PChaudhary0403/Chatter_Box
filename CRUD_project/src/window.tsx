import { API_BASE_URL } from "./config";

export default function Chatbox() {
    async function SendMessage() {
        const input = document.getElementById("messageInput") as HTMLInputElement;
        if (!input) return;
        const msg = input.value;
        const token = localStorage.getItem("token");
        fetch(`${API_BASE_URL}/send`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ message: msg })
        });
    }
    return (
        <>
            <div>
                <input id="messageInput" />
                <button onClick={SendMessage}>Send</button>
            </div>
        </>
    );
}