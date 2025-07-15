import { useNavigate } from "react-router-dom";
import './Setting.scss'
import { useState } from 'react'
const Setting = () => {
  const navigate = useNavigate();


  return <div className="setting">
    <div className="form">
      <div className="form_item">
        <div className="label">开机自启</div>
        <div className="wrapper"><input type="checkbox" switch></input></div>
      </div>
    </div>

  </div>;
};

export default Setting;
