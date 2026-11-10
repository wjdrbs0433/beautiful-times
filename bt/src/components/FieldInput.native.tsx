import React from 'react';
import { TextInput } from 'react-native';
import { fieldInputStyle, type FieldInputProps } from './FieldInput.types';
export default function FieldInput({label,value,onChange,placeholder,multiline,onFocus}:FieldInputProps) {
  return <TextInput accessibilityLabel={label} value={value} onChangeText={onChange}
    placeholder={placeholder} placeholderTextColor="#A5AAA3" multiline={multiline}
    onFocus={onFocus} style={[fieldInputStyle,multiline&&{minHeight:150,textAlignVertical:'top'}]} />;
}
