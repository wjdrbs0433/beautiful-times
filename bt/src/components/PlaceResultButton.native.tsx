import React from 'react';
import { Pressable } from 'react-native';
import type { PlaceResultButtonProps } from './PlaceResultButton.types';
export default function PlaceResultButton({label,onPress,children}:PlaceResultButtonProps) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={{paddingVertical:13,borderBottomWidth:1,borderBottomColor:'#E4E7E0'}}>{children}</Pressable>;
}
