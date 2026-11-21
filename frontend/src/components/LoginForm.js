import { useState } from "react";
import axios from "axios";
import CollectorDownload from "./CollectorDownload";

const LoginForm = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.post("http://127.0.0.1:5001/login", { username, password });
      if (response.status === 200) {
        localStorage.setItem("username", response.data.username);
        onLoginSuccess(response.data.username);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Those details were not accepted.");
    }
  };

  return (
    <div className="sp-login">
      <section className="sp-login-copy">
        <p className="sp-kicker"><span className="sp-mark">P</span> Pricebench</p>
        <h1>Compare shelf prices.</h1>
        <p>
          Any product on Blinkit, Zepto, and Instamart. See which app, brand, and pack is cheaper.
        </p>
        <ul>
          <li>One rate per kilogram, so pack size does not hide the price.</li>
          <li>The cheapest listing, the median, and the gap.</li>
          <li>Export the comparison.</li>
        </ul>
        <CollectorDownload />
      </section>
      <form className="sp-login-card" onSubmit={handleSubmit}>
        <h2>Sign in</h2>
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <button type="submit">Enter the desk</button>
        {error && <p className="sp-login-error">{error}</p>}
      </form>
    </div>
  );
};

export default LoginForm;
