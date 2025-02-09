import React, { useState, useEffect } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import LoginForm from "./components/LoginForm";
import ProductDetails from "./components/ProductDetails";
import LiveScrapeDetails from "./components/LiveScrapeDetails";
import SelectorForm from "./components/SelectorForm";
import ProductSelector from "./components/ProductSelector";
import LiveScrape from "./components/LiveScrape";
import "./styles.css";

const App = () => {
  const [selectedProduct, setSelectedProduct] = useState(1);
  const [selectedPincode, setSelectedPincode] = useState(560001);
  const [selectedProductType, setSelectedProductType] = useState(1);
  const [scrapedData, setScrapedData] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setIsLoggedIn(true);
      setUsername(storedUsername);
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setIsLoggedIn(true);
    setUsername(user);
    localStorage.setItem("username", user);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername("");
    localStorage.removeItem("username");
  };

  const shouldDisplayProductDetails = selectedProduct && selectedPincode;

  return (
    <Router>
      <div className="app-container">
        {isLoggedIn ? (
          <>
            {/* Topbar with Username and Logout Button */}
          
            <div className="sidebar-container">
              <LiveScrape
                onSelectProduct={setSelectedProduct}
                onSelectPincode={setSelectedPincode}
                onSelectProductType={setSelectedProductType}
              />
              <br />
              <ProductSelector
                onSelectProduct={setSelectedProduct}
                onSelectPincode={setSelectedPincode}
                onSelectProductType={setSelectedProductType}
              />
              <br />
              <SelectorForm
                onSelectPincode={setSelectedPincode}
                onSelectProduct={setSelectedProduct}
                onSelectProductType={setSelectedProductType}
              />
            </div>

            <div className="content-container">
            <div className="topbar">
              <span className="username">Logged in as: {username}</span>
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </div>

              {shouldDisplayProductDetails ? (
                <ProductDetails
                  productId={selectedProduct}
                  pincode={selectedPincode}
                  productType={selectedProductType}
                />
              ) : scrapedData ? (
                <LiveScrapeDetails scrapedData={scrapedData} />
              ) : (
                <div>No data available for live scrape.</div>
              )}
            </div>
          </>
        ) : (
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        )}
      </div>
    </Router>
  );
};

export default App;
