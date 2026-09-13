import React from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

export default function PasswordVisibilityField({ id, value, onChange, label, ...props }) {
  const [visible, setVisible] = React.useState(false);
  const buttonLabel = visible ? 'Sembunyikan password' : 'Tampilkan password';

  return (
    <div className="password-input-wrapper">
      <input {...props} id={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} aria-label={label} />
      <button type="button" className="toggle-password" onClick={() => setVisible((current) => !current)} aria-label={buttonLabel} aria-controls={id} aria-pressed={visible} title={buttonLabel}>
        {visible ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
      </button>
    </div>
  );
}
