import { useState } from "react";
import axios from "axios";

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
        <p className="sp-kicker">Pricebench</p>
        <h1>Shelf prices, split by flavor.</h1>
        <p>
          Built for a nut or makhana brand that needs the plain price and the salted price kept apart, across Blinkit, Zepto, and Swiggy Instamart.
        </p>
        <ul>
          <li>Median price per kilogram, so pack size does not disguise the rate.</li>
          <li>Salt & pepper, peri peri, and plain each get their own number.</li>
          <li>A file you can export and send to a buyer.</li>
        </ul>
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
