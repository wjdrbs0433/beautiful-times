import React, { useLayoutEffect, useRef, useState } from 'react';
import { fieldInputStyle, type FieldInputProps } from './FieldInput.types';

/** Let the browser own the active IME buffer. Only committed text reaches search/state. */
export default function FieldInput({label,value,onChange,placeholder,multiline,onFocus}:FieldInputProps) {
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const committed = useRef(value);
  const [initialValue] = useState(value);

  useLayoutEffect(() => {
    if (!composing.current && input.current && input.current.value !== value) {
      input.current.value = value;
    }
    if (!composing.current) committed.current = value;
  }, [value]);

  function commit(text: string) {
    if (committed.current === text) return;
    committed.current = text;
    onChange(text);
  }
  const {paddingHorizontal,paddingVertical,...sharedStyle} = fieldInputStyle;
  const props = {
    ref: input,
    'aria-label': label,
    defaultValue: initialValue,
    placeholder,
    autoComplete: 'off',
    style: {
      ...sharedStyle,
      borderStyle: 'solid',
      boxSizing: 'border-box',
      width: '100%',
      minWidth: 0,
      display: 'block',
      fontFamily: 'inherit',
      padding: `${paddingVertical}px ${paddingHorizontal}px`,
      margin: 0,
      minHeight: multiline ? 150 : undefined,
      resize: multiline ? 'vertical' : undefined,
    } as React.CSSProperties,
    onFocus: () => onFocus?.(),
    onCompositionStart: () => { composing.current = true; },
    onCompositionEnd: (event: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      composing.current = false;
      commit(event.currentTarget.value);
    },
    onInput: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (composing.current || (event.nativeEvent as InputEvent).isComposing) return;
      commit(event.currentTarget.value);
    },
    onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      composing.current = false;
      commit(event.currentTarget.value);
    },
  };
  return multiline ? <textarea {...props} /> : <input type="text" {...props} />;
}
