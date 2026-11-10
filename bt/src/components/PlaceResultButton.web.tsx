import React from 'react';
import type { PlaceResultButtonProps } from './PlaceResultButton.types';
export default function PlaceResultButton({label,onPress,children}:PlaceResultButtonProps) {
  return <button type="button" aria-label={label}
    // Keep IME blur from replacing/unmounting the result before click can select it.
    onPointerDown={event=>{if(event.button===0)event.preventDefault();}}
    onMouseDown={event=>{if(event.button===0)event.preventDefault();}}
    onClick={onPress}
    style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'stretch',gap:2,textAlign:'left',font:'inherit',color:'inherit',background:'transparent',border:0,borderBottom:'1px solid #E4E7E0',padding:'13px 0',cursor:'pointer'}}>{children}</button>;
}
