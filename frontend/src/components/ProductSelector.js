import React, { useState, useEffect } from "react";
import axios from "axios";

const ProductSelector = ({ onSelectProduct, onSelectPincode ,onSelectProductType}) => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    axios.get("http://127.0.0.1:5000/live_product_history") // ✅ Ensure Flask is running here
      .then(response => setProducts(response.data))
      .catch(error => console.error("Error fetching products:", error));
  }, []);
  

  const handleProductSelect = (productId,pincode) => {
    setSelectedProduct(productId);
    console.log(productId,pincode)
    onSelectProduct(productId); // Passing the selected product to the parent
    onSelectPincode(pincode); // Passing the selected pincode to the parent
    onSelectProductType(2);
  };


  return (
    <div className="live-selector-form">
      <h2 className="sidebar-title ">Scraped Products History</h2>
      <h4>Select Product:</h4>
      <ul>
          {products.length === 0 ? (
            <li className="empty">No products available</li>
          ) : (
            products.map((product) => (
              <li
                key={product.product_id}
                className={`sidebar-item ${selectedProduct === product.product_id ? "active" : ""}`}
                onClick={() => handleProductSelect(product.product_id, product.pincode)}
              >
                {product.name}
              </li>
            ))
          )}
        </ul>
    </div>
  );
};

export default ProductSelector;
