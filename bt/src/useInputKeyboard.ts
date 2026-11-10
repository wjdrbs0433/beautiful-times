import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function dismissInputKeyboard() {
  if (Platform.OS === 'web') (document.activeElement as HTMLElement | null)?.blur();
  else Keyboard.dismiss();
}

export function useInputKeyboard() {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (Platform.OS !== 'web') {
      const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
      const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
      return () => { show.remove(); hide.remove(); };
    }
    // Mobile browsers do not emit React Native Keyboard events.
    const viewport = window.visualViewport;
    const baseline = window.innerHeight;
    const update = () => {
      setHeight(viewport?.height ?? window.innerHeight);
      const active = document.activeElement;
      const editing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      setOpen(editing && (window.innerWidth < 700 || baseline - (viewport?.height ?? window.innerHeight) > 120));
    };
    const afterBlur = () => setTimeout(update, 0);
    update();
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', afterBlur);
    viewport?.addEventListener('resize', update);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', afterBlur);
      viewport?.removeEventListener('resize', update);
    };
  }, []);
  return { open, height };
}
