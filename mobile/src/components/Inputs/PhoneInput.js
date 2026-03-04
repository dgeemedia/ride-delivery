import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Input from '../Common/Input';
import { validatePhone } from '../../utils/helpers';

const PhoneInput = ({ value, onChangeText, error, ...props }) => {
  const [internalError, setInternalError] = useState('');

  const handleChange = (text) => {
    // Remove non-numeric characters except +
    const cleaned = text.replace(/[^0-9+]/g, '');
    
    onChangeText(cleaned);
    
    // Validate phone number
    if (cleaned && !validatePhone(cleaned)) {
      setInternalError('Invalid phone number');
    } else {
      setInternalError('');
    }
  };

  return (
    <Input
      {...props}
      value={value}
      onChangeText={handleChange}
      keyboardType="phone-pad"
      leftIcon="phone"
      error={error || internalError}
      placeholder="+1 (555) 000-0000"
    />
  );
};

export default PhoneInput;