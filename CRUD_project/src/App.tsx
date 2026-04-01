import { useState,useEffect } from 'react'
import './App.css'
import type {FormEvent} from 'react';
import { BrowserRouter,Routes,Route } from "react-router-dom";

function App() {
  const [username,setUser] = useState("")
  const [password,setPassword]=useState("")
  const [isLogin,setLogin]=useState(false)

  async function handleSubmit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    type logindata={username:string;password:string};
    const data:logindata={
      username,
      password
    };
    try{
      const response=await fetch("http://localhost:4000/login",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(data)
    });
    const result=await response.json();
    if(response.ok){
      setLogin(true)
    }
    console.log(result);
  }catch(err){
    console.error(err);
    alert(err);
  }
  }

  useEffect(()=>{
    if(isLogin){
    alert("Admin Login Successful✅")
    }
  },[isLogin]);

return (
  <>
  <header>
      <div style={{backgroundColor:"#1A1A1A"}}>Chat Website</div>
  </header>
  <nav> Nav </nav>

  <main>
  <section>
    <div>
      <div>
          <input placeholder="UserName" value={username} onChange={(e)=>setUser(e.target.value)}></input>
          <input placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)}></input>
      </div>
      <button onClick={handleSubmit}>Submit</button>
    </div>
  </section>
  </main>
  </>
)
}
export default App