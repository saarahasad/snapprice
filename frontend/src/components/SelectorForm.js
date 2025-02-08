import React, { useState, useEffect } from "react";
import axios from "axios";

const SelectorForm = ({
  onSelectProduct,
  onSelectPincode,
  onSelectProductType,
}) => {
  const [pincodes, setPincodes] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedPincode, setSelectedPincode] = useState(null);

  useEffect(() => {
    axios
      .get("http://127.0.0.1:5000/pincodes")
      .then((response) => setPincodes(response.data))
      .catch((error) => console.error("Error fetching pincodes:", error));

    axios
      .get("http://127.0.0.1:5000/products") // ✅ Ensure Flask is running here
      .then((response) => setProducts(response.data))
      .catch((error) => console.error("Error fetching products:", error));
  }, []);

  const handleProductSelect = (productId) => {
    setSelectedProduct(productId);
    onSelectProduct(productId); // Passing the selected product to the parent
  };

  const handlePincodeSelect = (pincode) => {
    setSelectedPincode(pincode);
    onSelectPincode(pincode); // Passing the selected pincode to the parent
    onSelectProductType(1);
  };

  return (
    <>
      <form className="selector-form">
      <h3 className="sidebar-title">Product Listing</h3>

        <h4>Select Pincode:</h4>
        <div className="pincode-selector">
          <select
            value={selectedPincode || ""}
            onChange={(e) => handlePincodeSelect(e.target.value)}
            className="pincode-dropdown"
          >
            <option value="">All Pincodes</option>
            {pincodes.map((pincode) => (
              <option key={pincode} value={pincode}>
                {pincode}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h4>Select Product:</h4>
          <ul className="product-selector">
            {products.length === 0 ? (
              <li className="empty">No products available</li>
            ) : (
              products.map((product) => (
                <li
                  key={product.id}
                  className={`sidebar-item ${
                    selectedProduct === product.id ? "active" : ""
                  }`}
                  onClick={() => handleProductSelect(product.id)}
                >
                  {product.name}
                </li>
              ))
            )}
          </ul>
        </div>
      </form>
    </>
  );
};

export default SelectorForm;
