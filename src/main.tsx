
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Global: allow comma (,) as decimal separator in all number inputs
// Note: type="number" inputs don't support selectionStart in most browsers,
// so we append the dot at the end of the current value.
document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLInputElement;
  if (target?.tagName === 'INPUT' && target.type === 'number' && e.key === ',') {
    e.preventDefault();
    const currentValue = target.value;
    // Only insert if there's no existing decimal point
    if (!currentValue.includes('.')) {
      const newValue = currentValue + '.';
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      nativeInputValueSetter.call(target, newValue);
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
});

createRoot(document.getElementById("root")!).render(<App />);
