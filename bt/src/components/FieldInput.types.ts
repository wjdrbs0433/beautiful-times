export type FieldInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  onFocus?: () => void;
};
export const fieldInputStyle = {
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#DFE4D9',
  color: '#333833',
  paddingHorizontal: 14,
  paddingVertical: 14,
  borderRadius: 5,
  fontSize: 16,
};
