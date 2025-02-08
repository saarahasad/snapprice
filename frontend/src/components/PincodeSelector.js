import React, { useState, useEffect } from "react";
import axios from "axios";

const PincodeSelector = ({ onSelectPincode }) => {
  const [pincodes, setPincodes] = useState([]);

  useEffect(() => {
    axios.get("http://127.0.0.1:5000/pincodes") 
      .then(response => setPincodes(response.data))
      .catch(error => console.error("Error fetching pincodes:", error));
  }, []);

  return (
    <div className="pincode-selector">
      <h2>Select Pincode</h2>
      <select onChange={(e) => onSelectPincode(e.target.value)} className="pincode-dropdown">
        <option value="">All Pincodes</option>
        {pincodes.map((pincode) => (
          <option key={pincode} value={pincode}>{pincode}</option>
        ))}
      </select>
    </div>
  );
};

export default PincodeSelector;
