import React, { useState } from "react";
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
  const [scrapedData, setScrapedData] = useState(null); // State to hold scraped data
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");

  const shouldDisplayProductDetails = selectedProduct && selectedPincode;

  const handleLoginSuccess = (user) => {
    setIsLoggedIn(true);
    setUsername(user);
  };

  return (
    <Router>
      <div className="app-container">
        {isLoggedIn ? (
          <>
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
