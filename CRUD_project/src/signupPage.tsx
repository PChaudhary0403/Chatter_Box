import React, { useState, useEffect } from "react"
import { API_BASE_URL } from "./config"
function SignUp() {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [isSignup, setStatus] = useState(false)
    async function handleSignin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        type signin_data = { username: string, password: string };
        const data: signin_data = {
            username,
            password
        }
        try {
            const response = await fetch(`${API_BASE_URL}/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            const result = await response.json()
            if (response.ok) {
                setStatus(true)
                console.log("Signin Successful")
                console.log(result)
            }
            else {
                alert("Signup Unsucessful")
            }
        } catch (err) {
            console.log(err)
            alert(err)
        }
    }
    useEffect(() => {
        if (isSignup) {
            console.log("Signup Successful")
        }
    }, [isSignup])
    return (
        <>
            <header>SigupPage</header>
            <main>
                <form onSubmit={handleSignin}>
                    <div>
                        <input placeholder="create username" value={username} onChange={(e) => setUsername(e.target.value)}></input>
                        <input placeholder="create password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}></input>
                    </div>
                    <button type="submit">Submit</button></form>
            </main>
        </>
    )
}
export default SignUp