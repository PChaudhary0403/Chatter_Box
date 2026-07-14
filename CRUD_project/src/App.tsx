import React, { useState, useEffect } from 'react'
import './App.css'
import { Link } from 'react-router-dom';
import { API_BASE_URL } from './config'

function App() {
  const [username,setUser] = useState("")
  const [password,setPassword]=useState("")
  const [isLogin,setLogin]=useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    type logindata={username:string;password:string};
    const data:logindata={
      username,
      password
    };
    try{
      const response=await fetch(`${API_BASE_URL}/login`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(data),
    });
    const result=await response.json();
    console.log(result.token)
    localStorage.setItem("token", result.token)
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
    alert("Login Successful✅")
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
    <form onSubmit={handleSubmit}>
      <div className="center_div">
        <div className="container">
          <div>
              <input style={{border:"3px solid black"}} placeholder="UserName" value={username} onChange={(e)=>setUser(e.target.value)}></input>
              <input style={{border:"3px solid black"}} placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)}></input>
          </div>
        </div>
      </div>
      <button type="submit">Submit</button>
      </form>
      <span><Link to="/signup">...Didn't register yet??</Link></span>
    </div>
  </section>
  </main>
  </>
)
}
export default App